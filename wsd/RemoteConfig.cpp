/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#if defined(MOBILEAPP) && MOBILEAPP
#error This file should be excluded from Mobile App builds
#endif // MOBILEAPP

#include <config.h>

#include "RemoteConfig.hpp"
#include "FileUtil.hpp"
#include "Util.hpp"

#include <common/JsonUtil.hpp>
#include <net/HttpRequest.hpp>
#include <net/Socket.hpp>
#include <wsd/Admin.hpp>
#include <wsd/COOLWSD.hpp>
#include <wsd/HostUtil.hpp>
#include <wsd/wopi/StorageConnectionManager.hpp>
#include <CommandControl.hpp>

#include <Poco/URI.h>
#include <Poco/Util/LayeredConfiguration.h>
#include <Poco/Util/MapConfiguration.h>
#include <Poco/Dynamic/Var.h>

#include <string>

void RemoteJSONPoll::start()
{
    Poco::URI remoteServerURI(_conf.getString(_configKey));

    if (remoteServerURI.empty())
    {
        LOG_INF("Remote " << _expectedKind << " is not specified in coolwsd.xml");
        return; // no remote config server setup.
    }
#if !ENABLE_DEBUG
    if (Util::iequal(remoteServerURI.getScheme(), "http"))
    {
        LOG_ERR("Remote config url should only use HTTPS protocol: " << remoteServerURI.toString());
        return;
    }
#endif

    startThread();
}

void RemoteJSONPoll::pollingThread()
{
    while (!isStop() && !SigUtil::getShutdownRequestFlag())
    {
        Poco::URI remoteServerURI(_conf.getString(_configKey));

        // don't try to fetch from an empty URI
        bool valid = !remoteServerURI.empty();

#if !ENABLE_DEBUG
        if (Util::iequal(remoteServerURI.getScheme(), "http"))
        {
            LOG_ERR(
                "Remote config url should only use HTTPS protocol: " << remoteServerURI.toString());
            valid = false;
        }
#endif

        if (valid)
        {
            try
            {
                std::shared_ptr<http::Session> httpSession(
                    StorageConnectionManager::getHttpSession(remoteServerURI));
                http::Request request(remoteServerURI.getPathAndQuery());

                //we use ETag header to check whether JSON is modified or not
                if (!_eTagValue.empty())
                {
                    request.set("If-None-Match", _eTagValue);
                }

                const std::shared_ptr<const http::Response> httpResponse =
                    httpSession->syncRequest(request);

                const http::StatusCode statusCode = httpResponse->statusLine().statusCode();

                if (statusCode == http::StatusCode::OK)
                {
                    _eTagValue = httpResponse->get("ETag");

                    const std::string& body = httpResponse->getBody();

                    LOG_DBG("Got " << body.size() << " bytes for " << remoteServerURI.toString());

                    Poco::JSON::Object::Ptr remoteJson;
                    if (JsonUtil::parseJSON(body, remoteJson))
                    {
                        std::string kind;
                        JsonUtil::findJSONValue(remoteJson, "kind", kind);
                        const std::pair<std::string_view, std::string_view> expectedKinds =
                            Util::split(_expectedKind, '|');
                        if (kind == expectedKinds.first || kind == expectedKinds.second)
                        {
                            handleJSON(remoteJson);
                        }
                        else
                        {
                            LOG_ERR("Make sure that " << remoteServerURI.toString()
                                                      << " contains a property 'kind' with "
                                                         "value '"
                                                      << _expectedKind << "'");
                        }
                    }
                    else
                    {
                        LOG_ERR("Could not parse the remote config JSON");
                    }
                }
                else if (statusCode == http::StatusCode::NotModified)
                {
                    LOG_DBG("Not modified since last time: " << remoteServerURI.toString());
                    handleUnchangedJSON();
                }
                else
                {
                    LOG_ERR("Remote config server has response status code: " << statusCode);
                }
            }
            catch (...)
            {
                LOG_ERR("Failed to fetch remote config JSON, Please check JSON format");
            }
        }
        poll(std::chrono::seconds(60));
    }
}

void RemoteConfigPoll::handleJSON(const Poco::JSON::Object::Ptr& remoteJson)
{
    std::map<std::string, std::string> newAppConfig;

    fetchAliasGroups(newAppConfig, remoteJson);

#if ENABLE_FEATURE_LOCK
    fetchLockedHostPatterns(newAppConfig, remoteJson);
    fetchLockedTranslations(newAppConfig, remoteJson);
    fetchUnlockImageUrl(newAppConfig, remoteJson);
#endif

    fetchIndirectionEndpoint(newAppConfig, remoteJson);

    fetchMonitors(newAppConfig, remoteJson);

    fetchRemoteFontConfig(newAppConfig, remoteJson);

    // before resetting get monitors list
    std::vector<std::pair<std::string, int>> oldMonitors = Admin::instance().getMonitorList();

    _persistConfig->reset(newAppConfig);

#if ENABLE_FEATURE_LOCK
    CommandControl::LockManager::parseLockedHost(_conf);
#endif
    Admin::instance().updateMonitors(oldMonitors);

    HostUtil::parseAliases(_conf);

    handleOptions(remoteJson);
}

void RemoteConfigPoll::fetchLockedHostPatterns(std::map<std::string, std::string>& newAppConfig,
                                               Poco::JSON::Object::Ptr remoteJson)
{
    try
    {
        Poco::JSON::Object::Ptr lockedHost;
        Poco::JSON::Array::Ptr lockedHostPatterns;
        try
        {
            lockedHost = remoteJson->getObject("feature_locking")->getObject("locked_hosts");
            lockedHostPatterns = lockedHost->getArray("hosts");
        }
        catch (const Poco::NullPointerException&)
        {
            LOG_INF("Overriding locked_hosts failed because "
                    "feature_locking->locked_hosts->hosts array does not exist");
            return;
        }

        if (lockedHostPatterns.isNull() || lockedHostPatterns->size() == 0)
        {
            LOG_INF("Overriding locked_hosts failed because locked_hosts->hosts array is empty "
                    "or null");
            return;
        }

        //use feature_lock.locked_hosts[@allow] entry from coolwsd.xml if feature_lock.locked_hosts.allow key does not exist in json
        Poco::Dynamic::Var allow =
            !lockedHost->has("allow")
                ? Poco::Dynamic::Var(_conf.getBool("feature_lock.locked_hosts[@allow]"))
                : lockedHost->get("allow");
        newAppConfig.insert(
            std::make_pair("feature_lock.locked_hosts[@allow]", booleanToString(allow)));

        if (booleanToString(allow) == "false")
        {
            LOG_INF("locked_hosts feature is disabled, set feature_lock->locked_hosts->allow "
                    "to true to enable");
            return;
        }

        std::size_t i;
        for (i = 0; i < lockedHostPatterns->size(); i++)
        {
            std::string host;
            Poco::JSON::Object::Ptr subObject = lockedHostPatterns->getObject(i);
            JsonUtil::findJSONValue(subObject, "host", host);
            Poco::Dynamic::Var readOnly = subObject->get("read_only");
            Poco::Dynamic::Var disabledCommands = subObject->get("disabled_commands");

            const std::string path = "feature_lock.locked_hosts.host[" + std::to_string(i) + "]";
            newAppConfig.insert(std::make_pair(path, host));
            newAppConfig.insert(std::make_pair(path + "[@read_only]", booleanToString(readOnly)));
            newAppConfig.insert(
                std::make_pair(path + "[@disabled_commands]", booleanToString(disabledCommands)));
        }

        //if number of locked wopi host patterns defined in coolwsd.xml are greater than number of host
        //fetched from json, overwrite the remaining host from config file to empty strings and
        //set read_only and disabled_commands to false
        for (;; ++i)
        {
            const std::string path = "feature_lock.locked_hosts.host[" + std::to_string(i) + "]";
            if (!_conf.has(path))
            {
                break;
            }
            newAppConfig.insert(std::make_pair(path, ""));
            newAppConfig.insert(std::make_pair(path + "[@read_only]", "false"));
            newAppConfig.insert(std::make_pair(path + "[@disabled_commands]", "false"));
        }
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to fetch locked_hosts, please check JSON format: " << exc.what());
    }
}

void RemoteConfigPoll::fetchAliasGroups(std::map<std::string, std::string>& newAppConfig,
                                        const Poco::JSON::Object::Ptr& remoteJson)
{
    try
    {
        Poco::JSON::Object::Ptr aliasGroups;
        Poco::JSON::Array::Ptr groups;

        try
        {
            aliasGroups =
                remoteJson->getObject("storage")->getObject("wopi")->getObject("alias_groups");
            groups = aliasGroups->getArray("groups");
        }
        catch (const Poco::NullPointerException&)
        {
            LOG_INF("Overriding alias_groups failed because "
                    "storage->wopi->alias_groups->groups array does not exist");
            return;
        }

        if (groups.isNull() || groups->size() == 0)
        {
            LOG_INF("Overriding alias_groups failed because alias_groups->groups array is "
                    "empty or null");
            return;
        }

        std::string mode = "first";
        JsonUtil::findJSONValue(aliasGroups, "mode", mode);
        newAppConfig.insert(std::make_pair("storage.wopi.alias_groups[@mode]", mode));

        std::size_t i;
        for (i = 0; i < groups->size(); i++)
        {
            Poco::JSON::Object::Ptr group = groups->getObject(i);
            std::string host;
            JsonUtil::findJSONValue(group, "host", host);
            Poco::Dynamic::Var allow = group->get("allow");
            const std::string path = "storage.wopi.alias_groups.group[" + std::to_string(i) + ']';

            newAppConfig.insert(std::make_pair(path + ".host", host));
            newAppConfig.insert(std::make_pair(path + ".host[@allow]", booleanToString(allow)));
#if ENABLE_FEATURE_LOCK
            std::string unlockLink;
            JsonUtil::findJSONValue(group, "unlock_link", unlockLink);
            newAppConfig.insert(std::make_pair(path + ".unlock_link", unlockLink));
#endif
            Poco::JSON::Array::Ptr aliases = group->getArray("aliases");

            size_t j = 0;
            if (aliases)
            {
                auto it = aliases->begin();
                for (; j < aliases->size(); j++)
                {
                    const std::string aliasPath = path + ".alias[" + std::to_string(j) + ']';
                    newAppConfig.insert(std::make_pair(aliasPath, it->toString()));
                    it++;
                }
            }
            for (;; j++)
            {
                const std::string aliasPath = path + ".alias[" + std::to_string(j) + ']';
                if (!_conf.has(aliasPath))
                {
                    break;
                }
                newAppConfig.insert(std::make_pair(aliasPath, ""));
            }
        }

        //if number of alias_groups defined in configuration are greater than number of alias_group
        //fetched from json, overwrite the remaining alias_groups from config file to empty strings and
        for (;; i++)
        {
            const std::string path =
                "storage.wopi.alias_groups.group[" + std::to_string(i) + "].host";
            if (!_conf.has(path))
            {
                break;
            }
            newAppConfig.insert(std::make_pair(path, ""));
            newAppConfig.insert(std::make_pair(path + "[@allowed]", "false"));
        }
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Fetching of alias groups failed with error: " << exc.what()
                                                               << ", please check JSON format");
    }
}

void RemoteConfigPoll::fetchRemoteFontConfig(std::map<std::string, std::string>& newAppConfig,
                                             const Poco::JSON::Object::Ptr& remoteJson)
{
    try
    {
        Poco::JSON::Object::Ptr remoteFontConfig = remoteJson->getObject("remote_font_config");

        std::string url;
        if (JsonUtil::findJSONValue(remoteFontConfig, "url", url))
            newAppConfig.insert(std::make_pair("remote_font_config.url", url));
    }
    catch (const Poco::NullPointerException&)
    {
        LOG_INF("Overriding the remote font config URL failed because the remote_font_config "
                "entry does not exist");
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to fetch remote_font_config, please check JSON format: " << exc.what());
    }
}

void RemoteConfigPoll::fetchLockedTranslations(std::map<std::string, std::string>& newAppConfig,
                                               const Poco::JSON::Object::Ptr& remoteJson)
{
    try
    {
        Poco::JSON::Array::Ptr lockedTranslations;
        try
        {
            lockedTranslations = remoteJson->getObject("feature_locking")->getArray("translations");
        }
        catch (const Poco::NullPointerException&)
        {
            LOG_INF("Overriding translations failed because feature_locking->translations array "
                    "does not exist");
            return;
        }

        if (lockedTranslations.isNull() || lockedTranslations->size() == 0)
        {
            LOG_INF("Overriding feature_locking->translations failed because array is empty or "
                    "null");
            return;
        }

        std::size_t i;
        for (i = 0; i < lockedTranslations->size(); i++)
        {
            Poco::JSON::Object::Ptr translation = lockedTranslations->getObject(i);
            std::string language;
            //default values if the one of the entry is missing in json
            std::string title = _conf.getString("feature_lock.unlock_title", "");
            std::string description = _conf.getString("feature_lock.unlock_description", "");
            std::string writerHighlights =
                _conf.getString("feature_lock.writer_unlock_highlights", "");
            std::string impressHighlights =
                _conf.getString("feature_lock.impress_unlock_highlights", "");
            std::string calcHighlights = _conf.getString("feature_lock.calc_unlock_highlights", "");
            std::string drawHighlights = _conf.getString("feature_lock.draw_unlock_highlights", "");

            JsonUtil::findJSONValue(translation, "language", language);
            JsonUtil::findJSONValue(translation, "unlock_title", title);
            JsonUtil::findJSONValue(translation, "unlock_description", description);
            JsonUtil::findJSONValue(translation, "writer_unlock_highlights", writerHighlights);
            JsonUtil::findJSONValue(translation, "calc_unlock_highlights", calcHighlights);
            JsonUtil::findJSONValue(translation, "impress_unlock_highlights", impressHighlights);
            JsonUtil::findJSONValue(translation, "draw_unlock_highlights", drawHighlights);

            const std::string path =
                "feature_lock.translations.language[" + std::to_string(i) + ']';

            newAppConfig.insert(std::make_pair(path + "[@name]", language));
            newAppConfig.insert(std::make_pair(path + ".unlock_title", title));
            newAppConfig.insert(std::make_pair(path + ".unlock_description", description));
            newAppConfig.insert(
                std::make_pair(path + ".writer_unlock_highlights", writerHighlights));
            newAppConfig.insert(std::make_pair(path + ".calc_unlock_highlights", calcHighlights));
            newAppConfig.insert(
                std::make_pair(path + ".impress_unlock_highlights", impressHighlights));
            newAppConfig.insert(std::make_pair(path + ".draw_unlock_highlights", drawHighlights));
        }

        //if number of translations defined in configuration are greater than number of translation
        //fetched from json, overwrite the remaining translations from config file to empty strings
        for (;; i++)
        {
            const std::string path =
                "feature_lock.translations.language[" + std::to_string(i) + "][@name]";
            if (!_conf.has(path))
            {
                break;
            }
            newAppConfig.insert(std::make_pair(path, ""));
        }
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to fetch feature_locking->translations, please check JSON format: "
                << exc.what());
    }
}

void RemoteConfigPoll::fetchUnlockImageUrl(std::map<std::string, std::string>& newAppConfig,
                                           const Poco::JSON::Object::Ptr& remoteJson)
{
    try
    {
        Poco::JSON::Object::Ptr featureLocking = remoteJson->getObject("feature_locking");

        std::string unlockImage;
        if (JsonUtil::findJSONValue(featureLocking, "unlock_image", unlockImage))
        {
            newAppConfig.insert(std::make_pair("feature_lock.unlock_image", unlockImage));
        }
    }
    catch (const Poco::NullPointerException&)
    {
        LOG_INF("Overriding unlock_image URL failed because the unlock_image entry does not "
                "exist");
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to fetch unlock_image, please check JSON format: " << exc.what());
    }
}

void RemoteConfigPoll::fetchIndirectionEndpoint(std::map<std::string, std::string>& newAppConfig,
                                                const Poco::JSON::Object::Ptr& remoteJson)
{
    try
    {
        Poco::JSON::Object::Ptr indirectionEndpoint = remoteJson->getObject("indirection_endpoint");

        std::string url;
        if (JsonUtil::findJSONValue(indirectionEndpoint, "url", url))
        {
            newAppConfig.insert(std::make_pair("indirection_endpoint.url", url));
        }
    }
    catch (const Poco::NullPointerException&)
    {
        LOG_INF("Overriding indirection_endpoint.url failed because the indirection_endpoint.url "
                "entry does not "
                "exist");
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to fetch indirection_endpoint, please check JSON format: " << exc.what());
    }
}

void RemoteConfigPoll::fetchMonitors(std::map<std::string, std::string>& newAppConfig,
                                     const Poco::JSON::Object::Ptr& remoteJson)
{
    Poco::JSON::Array::Ptr monitors;
    try
    {
        monitors = remoteJson->getArray("monitors");
    }
    catch (const Poco::NullPointerException&)
    {
        LOG_INF("Overriding monitor failed because array "
                "does not exist");
        return;
    }

    if (monitors.isNull() || monitors->size() == 0)
    {
        LOG_INF("Overriding monitors failed because array is empty or "
                "null");
        return;
    }
    std::size_t i;
    for (i = 0; i < monitors->size(); i++)
        newAppConfig.insert(std::make_pair("monitors.monitor[" + std::to_string(i) + ']',
                                           monitors->get(i).toString()));

    //if number of monitors defined in configuration are greater than number of monitors
    //fetched from json or if the number of monitors shrinks with new json,
    //overwrite the remaining monitors from config file to empty strings
    for (;; i++)
    {
        const std::string path = "monitors.monitor[" + std::to_string(i) + ']';
        if (!_conf.has(path))
        {
            break;
        }
        newAppConfig.insert(std::make_pair(path, ""));
    }
}

void RemoteConfigPoll::handleOptions(const Poco::JSON::Object::Ptr& remoteJson)
{
    try
    {
        std::string buyProduct;
        JsonUtil::findJSONValue(remoteJson, "buy_product_url", buyProduct);
        Poco::URI buyProductUri(buyProduct);
        {
            std::lock_guard<std::mutex> lock(COOLWSD::RemoteConfigMutex);
            COOLWSD::BuyProductUrl = buyProductUri.toString();
        }
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("handleOptions: Exception " << exc.what());
    }
}

bool RemoteAssetConfigPoll::getFontAssets(const Poco::JSON::Object::Ptr& remoteJson,
                                          const std::string& fontJsonKey)
{
    // First mark all fonts we have downloaded previously as "inactive" to be able to check if
    // some asset gets deleted from the list in the JSON file.
    for (auto& it : fonts)
        it.second.active = false;

    return getNewAssets(remoteJson->getArray(fontJsonKey), fontJsonKey, fonts);
}

bool RemoteAssetConfigPoll::getTemplateAssets(const Poco::JSON::Object::Ptr& remoteJson,
                                              const std::string& templateType)
{
    // First mark all templates we have downloaded previously as "inactive" to be able to check if
    // some asset gets deleted from the list in the JSON file.
    for (auto& it : templates)
        it.second.active = false;

    auto templateObj = remoteJson->getObject("templates");

    if (!templateObj)
    {
        LOG_WRN("The templates property does not exist");
        return false;
    }

    return getNewAssets(templateObj->getArray(templateType), templateType, templates);
}

bool RemoteAssetConfigPoll::getNewAssets(const Poco::JSON::Array::Ptr& assetsPtr,
                                         const std::string& assetJsonKey,
                                         std::map<std::string, AssetData>& assets)
{
    bool reDownloadConfig = false;

    if (!assetsPtr)
    {
        LOG_WRN("The [" + assetJsonKey + "] property does not exist or is not an array");
        return reDownloadConfig;
    }

    for (std::size_t i = 0; i < assetsPtr->size(); i++)
    {
        if (!assetsPtr->isObject(i))
            LOG_WRN("Element " << i << " in " << assetJsonKey << " array is not an object");
        else
        {
            const auto assetPtr = assetsPtr->getObject(i);
            const auto uriPtr = assetPtr->get("uri");
            if (uriPtr.isEmpty() || !uriPtr.isString())
                LOG_WRN("Element in " << assetJsonKey
                                      << " array does not have an 'uri' property or it is not a "
                                         "string");
            else
            {
                const std::string uri = uriPtr.toString();
                Poco::Dynamic::Var stampPtr;
                // stamp and version are same in terms of functionality but stamp was not clear name so use version instead in json
                // for backwardcompatibility keep the stamp as well
                if (assetPtr->has("version"))
                    stampPtr = assetPtr->get("version");
                else if (assetPtr->has("stamp"))
                    stampPtr = assetPtr->get("stamp");

                if (!stampPtr.isEmpty() && !stampPtr.isString())
                    LOG_WRN("Element in "
                            << assetJsonKey << "array with uri '" << uri
                            << "' has a stamp/version property that is not a string, ignored");
                else if (assets.count(uri) == 0)
                {
                    // First case: This asset has not been downloaded.
                    if (!stampPtr.isEmpty())
                    {
                        if (downloadPlain(uri, assets, assetJsonKey))
                        {
                            assets[uri].stamp = stampPtr.toString();
                            assets[uri].active = true;
                        }
                    }
                    else
                    {
                        if (downloadWithETag(uri, "", assets, assetJsonKey))
                        {
                            assets[uri].active = true;
                        }
                    }
                }
                else if (!stampPtr.isEmpty() && stampPtr.toString() != assets[uri].stamp)
                {
                    // Second case: asset has been downloaded already, has a "stamp" property,
                    // and that has been changed in the JSON since it was downloaded.
                    reDownloadConfig = true;
                    break;
                }
                else if (!stampPtr.isEmpty())
                {
                    // Third case: asset has been downloaded already, has a "stamp" property, and
                    // that has *not* changed in the JSON since it was downloaded.
                    assets[uri].active = true;
                }
                else
                {
                    // Last case: Asset has been downloaded but does not have a "stamp" property.
                    // Use ETag.
                    if (!eTagUnchanged(uri, assets[uri].eTag))
                    {
                        reDownloadConfig = true;
                        break;
                    }
                    assets[uri].active = true;
                }
            }
        }
    }

    // Any asset that has been deleted from the JSON needs to be removed on this side, too.
    for (const auto& it : assets)
    {
        if (!it.second.active)
        {
            LOG_DBG("Asset no longer mentioned in the remote font config: " << it.first);
            reDownloadConfig = true;
            break;
        }
    }
    return reDownloadConfig;
}

std::string RemoteAssetConfigPoll::removeTemplate(const std::string& uri,
                                                  const std::string& tmpPath)
{
    const Poco::URI assetUri{ uri };
    const std::string& path = assetUri.getPath();
    const std::string filename = path.substr(path.find_last_of('/') + 1);
    std::string assetFile;
    assetFile.append(tmpPath);
    assetFile.push_back('/');
    assetFile.append(filename);
    FileUtil::removeFile(assetFile);
    return assetFile;
}

void RemoteAssetConfigPoll::reDownloadConfigFile(std::map<std::string, AssetData>& assets,
                                                 const std::string& assetType)
{
    LOG_DBG("Downloaded asset has been updated or a asset has been removed.");

    // remove inactive templates
    if (assetType == "presentation")
    {
        for (const auto& it : assets)
            if (!it.second.active)
                removeTemplate(it.second.pathName, COOLWSD::TmpPresntTemplateDir);
    }

    assets.clear();
    // Clear the saved ETag of the remote font configuration file so that it will be
    // re-downloaded, and all fonts mentioned in it re-downloaded and fed to ForKit.
    _eTagValue.clear();
    if (assetType == "fonts")
    {
        LOG_DBG("ForKit must be restarted.");
        COOLWSD::sendMessageToForKit("exit");
    }
}

void RemoteAssetConfigPoll::handleJSON(const Poco::JSON::Object::Ptr& remoteJson)
{
    bool reDownloadFontConfig = getFontAssets(remoteJson, "fonts");
    bool reDownloadTemplateConfig = getTemplateAssets(remoteJson, "presentation");

    if (reDownloadFontConfig)
        reDownloadConfigFile(fonts, "fonts");
    if (reDownloadTemplateConfig)
        reDownloadConfigFile(templates, "presentation");
}

bool RemoteAssetConfigPoll::handleUnchangedAssets(std::map<std::string, AssetData>& assets)
{
    bool reDownloadConfig = false;

    // Iterate over the assets that were mentioned in the JSON file when it was last downloaded.
    for (auto& it : assets)
    {
        // If the JSON has a "stamp" for the asset, and we have already downloaded it, by
        // definition we don't need to do anything when the JSON file has not changed.
        if (it.second.stamp != "" && it.second.pathName != "")
            continue;

        // If the JSON has a "stamp" it must have been downloaded already. Should we even
        // assert() that?
        if (it.second.stamp != "" && it.second.pathName == "")
        {
            LOG_WRN("Asset at " << it.first << " was not downloaded, should have been");
            continue;
        }

        // Otherwise use the ETag to check if the asset file needs re-downloading.
        if (!eTagUnchanged(it.first, it.second.eTag))
        {
            reDownloadConfig = true;
            break;
        }
    }
    return reDownloadConfig;
}

void RemoteAssetConfigPoll::handleUnchangedJSON()
{
    bool reDownloadFontConfig = handleUnchangedAssets(fonts);
    bool reDownloadTemplateConfig = handleUnchangedAssets(templates);

    if (reDownloadFontConfig)
        reDownloadConfigFile(fonts, "fonts");
    if (reDownloadTemplateConfig)
        reDownloadConfigFile(templates, "presentation");
}

bool RemoteAssetConfigPoll::downloadPlain(const std::string& uri,
                                          std::map<std::string, AssetData>& assets,
                                          const std::string& assetType)
{
    const Poco::URI assetUri{ uri };
    std::shared_ptr<http::Session> httpSession(StorageConnectionManager::getHttpSession(assetUri));
    http::Request request(assetUri.getPathAndQuery());

    request.set("User-Agent", http::getAgentString());

    const std::shared_ptr<const http::Response> httpResponse = httpSession->syncRequest(request);

    return finishDownload(uri, httpResponse, assets, assetType);
}

bool RemoteAssetConfigPoll::eTagUnchanged(const std::string& uri, const std::string& oldETag)
{
    const Poco::URI assetUri{ uri };
    std::shared_ptr<http::Session> httpSession(StorageConnectionManager::getHttpSession(assetUri));
    http::Request request(assetUri.getPathAndQuery());

    if (!oldETag.empty())
    {
        request.set("If-None-Match", oldETag);
    }

    request.set("User-Agent", http::getAgentString());

    const std::shared_ptr<const http::Response> httpResponse = httpSession->syncRequest(request);

    if (httpResponse->statusLine().statusCode() == http::StatusCode::NotModified)
    {
        LOG_DBG("Not modified since last time: " << uri);
        return true;
    }

    return false;
}

bool RemoteAssetConfigPoll::downloadWithETag(const std::string& uri, const std::string& oldETag,
                                             std::map<std::string, AssetData>& assets,
                                             const std::string& assetType)
{
    const Poco::URI assetUri{ uri };
    std::shared_ptr<http::Session> httpSession(StorageConnectionManager::getHttpSession(assetUri));
    http::Request request(assetUri.getPathAndQuery());

    if (!oldETag.empty())
    {
        request.set("If-None-Match", oldETag);
    }

    request.set("User-Agent", http::getAgentString());

    const std::shared_ptr<const http::Response> httpResponse = httpSession->syncRequest(request);

    if (httpResponse->statusLine().statusCode() == http::StatusCode::NotModified)
    {
        LOG_DBG("Not modified since last time: " << uri);
        return true;
    }

    if (!finishDownload(uri, httpResponse, assets, assetType))
        return false;

    assets[uri].eTag = httpResponse->get("ETag");
    return true;
}

bool RemoteAssetConfigPoll::finishDownload(
    const std::string& uri, const std::shared_ptr<const http::Response>& httpResponse,
    std::map<std::string, AssetData>& assets, const std::string& assetType)
{
    if (httpResponse->statusLine().statusCode() != http::StatusCode::OK)
    {
        LOG_WRN("Could not fetch " << uri);
        return false;
    }

    const std::string& body = httpResponse->getBody();

    std::string assetFile;
    if (assetType == "fonts")
        // We intentionally use a new file name also when an updated version of a font is
        // downloaded. It causes trouble to rewrite the same file, in case it is in use in some Kit
        // process at the moment.

        // We don't remove the old file either as that also causes problems.
        // And in reality, it is a bit unclear how likely it even is that assets downloaded through
        // this mechanism even will be updated.
        assetFile = COOLWSD::TmpFontDir + '/' + Util::encodeId(Util::rng::getNext()) + ".ttf";
    else if (assetType == "presentation")
        assetFile = removeTemplate(uri, COOLWSD::TmpPresntTemplateDir);

    std::ofstream assetStream(assetFile);
    assetStream.write(body.data(), body.size());
    if (!assetStream.good())
    {
        LOG_ERR("Could not write " << body.size() << " bytes to [" << assetFile << ']');
        return false;
    }

    LOG_DBG("Got " << body.size() << " bytes from [" << uri << "] and wrote to [" << assetFile
                   << ']');

    assets[uri].pathName = assetFile;

    if (assetType == "fonts")
        COOLWSD::sendMessageToForKit("addfont " + assetFile);

    COOLWSD::requestTerminateSpareKits();

    return true;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
