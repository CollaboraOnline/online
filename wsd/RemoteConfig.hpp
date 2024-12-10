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

#pragma once

#if defined(MOBILEAPP) && MOBILEAPP
#error This file should be excluded from Mobile App builds
#endif // MOBILEAPP

#include <common/ConfigUtil.hpp>
#include <common/JsonUtil.hpp>
#include <net/HttpRequest.hpp>
#include <net/Socket.hpp>

#include <Poco/URI.h>
#include <Poco/Util/LayeredConfiguration.h>
#include <Poco/JSON/Object.h>
#include <map>

#include <string>

/**
  A custom socket poll to fetch remote config every 60 seconds.
  If config changes it applies the new config using LayeredConfiguration.

  The URI to fetch is read from the configuration too - it is either the
  remote config itself, or the font configuration.  It si passed via the
  uriConfigKey param.
*/
class RemoteJSONPoll : public SocketPoll
{
public:
    RemoteJSONPoll(Poco::Util::LayeredConfiguration& config, const std::string& uriConfigKey,
                   const std::string& name, const std::string& kind)
        : SocketPoll(name)
        , _conf(config)
        , _configKey(uriConfigKey)
        , _expectedKind(kind)
    {
    }

    virtual void handleJSON(const Poco::JSON::Object::Ptr& json) = 0;

    virtual void handleUnchangedJSON() {}

    void start();

    void pollingThread();

protected:
    Poco::Util::LayeredConfiguration& _conf;
    std::string _eTagValue;

private:
    std::string _configKey;
    std::string _expectedKind;
};

class RemoteConfigPoll : public RemoteJSONPoll
{
public:
    RemoteConfigPoll(Poco::Util::LayeredConfiguration& config)
        : RemoteJSONPoll(config, "remote_config.remote_url", "remoteconfig_poll", "configuration")
    {
        constexpr int PRIO_JSON = -200; // highest priority
        _persistConfig = new ConfigUtil::AppConfigMap(std::map<std::string, std::string>{});
        _conf.addWriteable(_persistConfig, PRIO_JSON);
    }

    void handleJSON(const Poco::JSON::Object::Ptr& remoteJson) override;

    void fetchLockedHostPatterns(std::map<std::string, std::string>& newAppConfig,
                                 Poco::JSON::Object::Ptr remoteJson);

    void fetchAliasGroups(std::map<std::string, std::string>& newAppConfig,
                          const Poco::JSON::Object::Ptr& remoteJson);

    void fetchRemoteFontConfig(std::map<std::string, std::string>& newAppConfig,
                               const Poco::JSON::Object::Ptr& remoteJson);

    void fetchLockedTranslations(std::map<std::string, std::string>& newAppConfig,
                                 const Poco::JSON::Object::Ptr& remoteJson);

    void fetchUnlockImageUrl(std::map<std::string, std::string>& newAppConfig,
                             const Poco::JSON::Object::Ptr& remoteJson);

    void fetchIndirectionEndpoint(std::map<std::string, std::string>& newAppConfig,
                                  const Poco::JSON::Object::Ptr& remoteJson);

    void fetchMonitors(std::map<std::string, std::string>& newAppConfig,
                       const Poco::JSON::Object::Ptr& remoteJson);

    void handleOptions(const Poco::JSON::Object::Ptr& remoteJson);

    //sets property to false if it is missing from JSON
    //and returns std::string
    std::string booleanToString(Poco::Dynamic::Var& booleanFlag)
    {
        if (booleanFlag.isEmpty())
        {
            booleanFlag = "false";
        }
        return booleanFlag.toString();
    }

private:
    // keeps track of remote config layer
    Poco::AutoPtr<ConfigUtil::AppConfigMap> _persistConfig = nullptr;
};

class RemoteAssetConfigPoll : public RemoteJSONPoll
{
public:
    RemoteAssetConfigPoll(Poco::Util::LayeredConfiguration& config, const std::string& uriConfigKey)
        : RemoteJSONPoll(config, uriConfigKey, "remoteassetconfig_poll",
                         "assetconfiguration|fontconfiguration")
    {
    }

    void handleJSON(const Poco::JSON::Object::Ptr& remoteJson) override;

    void handleUnchangedJSON() override;

private:
    bool eTagUnchanged(const std::string& uri, const std::string& oldETag);

    struct AssetData
    {
        // Each asset can have a "stamp" or "version" in the JSON that we treat just as a string. In practice it
        // can be some timestamp, but we don't parse it. If the stamp is changed, we re-download the
        // asset file.
        std::string stamp;

        // If the asset has no "stamp" property, we use the ETag mechanism to see if the font file
        // needs to be re-downloaded.
        std::string eTag;

        // Where the asset has been stored
        std::string pathName;

        // Flag that tells whether the asset is mentioned in the JSON file that is being handled.
        // Used only in handleJSON() when the JSON has been (re-)downloaded, not when the JSON was
        // unchanged in handleUnchangedJSON().
        bool active;
    };

    bool downloadPlain(const std::string& uri, std::map<std::string, AssetData>& assets,
                       const std::string& assetType);

    bool finishDownload(const std::string& uri,
                        const std::shared_ptr<const http::Response>& httpResponse,
                        std::map<std::string, AssetData>& assets, const std::string& assetType);

    bool downloadWithETag(const std::string& uri, const std::string& oldETag,
                          std::map<std::string, AssetData>& assets, const std::string& assetType);

    bool getNewAssets(const Poco::JSON::Array::Ptr& assetsPtr, const std::string& assetJsonKey,
                      std::map<std::string, AssetData>& assets);

    bool getTemplateAssets(const Poco::JSON::Object::Ptr& remoteJson,
                           const std::string& templateType);

    bool getFontAssets(const Poco::JSON::Object::Ptr& remoteJson, const std::string& fontJsonKey);

    void reDownloadConfigFile(std::map<std::string, AssetData>& assets,
                              const std::string& assetType);

    bool handleUnchangedAssets(std::map<std::string, AssetData>& assets);

    std::string removeTemplate(const std::string& uri, const std::string& tmpPath);

    // The key of this map is the download URI of the font.
    std::map<std::string, AssetData> fonts;

    // The key of this map is the download URI of the template.
    std::map<std::string, AssetData> templates;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
