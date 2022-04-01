/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "HostUtil.hpp"
#include <common/ConfigUtil.hpp>
#include <common/Log.hpp>

Util::RegexListMatcher HostUtil::WopiHosts;
std::map<std::string, std::string> HostUtil::AliasHosts;
std::set<std::string> HostUtil::AllHosts;
std::string HostUtil::FirstHost;
bool HostUtil::WopiEnabled;

void HostUtil::parseWopiHost(Poco::Util::LayeredConfiguration& conf)
{
    // Parse the WOPI settings.
    WopiHosts.clear();
    WopiEnabled = conf.getBool("storage.wopi[@allow]", false);
    if (WopiEnabled)
    {
        for (size_t i = 0;; ++i)
        {
            const std::string path = "storage.wopi.host[" + std::to_string(i) + ']';
            if (!conf.has(path))
            {
                break;
            }
            HostUtil::addWopiHost(conf.getString(path, ""),
                                      conf.getBool(path + "[@allow]", false));
        }
    }
}

void HostUtil::addWopiHost(std::string host, bool allow)
{
    if (!host.empty())
    {
        if (allow)
        {
            LOG_INF("Adding trusted WOPI host: [" << host << "].");
            WopiHosts.allow(host);
        }
        else
        {
            LOG_INF("Adding blocked WOPI host: [" << host << "].");
            WopiHosts.deny(host);
        }
    }
}

bool HostUtil::allowedWopiHost(const std::string& host)
{
    return WopiEnabled && WopiHosts.match(host);
}

bool HostUtil::allowedAlias(const Poco::URI& uri)
{
    if (Util::iequal(config::getString("storage.wopi.alias_groups[@mode]", "first"), "compat"))
    {
        return true;
    }

    if (AllHosts.empty())
    {
        if (FirstHost != uri.getAuthority())
        {
            LOG_ERR("Only allowed host is: "
                    << FirstHost
                    << ", To use multiple host/aliases check alias_groups tag in configuration");
            return false;
        }
    }
    else if (!Util::matchRegex(AllHosts, uri.getAuthority()))
    {
        LOG_ERR("Host: " << uri.getAuthority()
                         << " is denied, It is not defined in alias_groups configuration");
        return false;
    }
    return true;
}

void HostUtil::parseAliases(Poco::Util::LayeredConfiguration& conf)
{
    //set alias_groups mode to compat
    if (!conf.has("storage.wopi.alias_groups"))
    {
        conf.setString("storage.wopi.alias_groups[@mode]", "compat");
    }
    else if (conf.has("storage.wopi.alias_groups.group[0]"))
    {
        // group defined in alias_groups
        if (Util::iequal(config::getString("storage.wopi.alias_groups[@mode]", "first"), "first"))
        {
            LOG_ERR("Admins didnot set the alias_groups mode to 'groups'");
            AliasHosts.clear();
            AllHosts.clear();
            return;
        }
    }

    AliasHosts.clear();
    AllHosts.clear();

    for (size_t i = 0;; i++)
    {
        const std::string path = "storage.wopi.alias_groups.group[" + std::to_string(i) + ']';
        if (!conf.has(path + ".host"))
        {
            break;
        }

        const std::string uri = conf.getString(path + ".host", "");
        if (uri.empty())
        {
            continue;
        }
        bool allow = conf.getBool(path + ".host[@allow]", false);

        try
        {
            const Poco::URI realUri(uri);
            HostUtil::addWopiHost(realUri.getHost(), allow);

            AllHosts.insert(realUri.getAuthority());
        }
        catch (const Poco::Exception& exc)
        {
            LOG_WRN("parseAliases: " << exc.displayText());
        }

        for (size_t j = 0;; j++)
        {
            const std::string aliasPath = path + ".alias[" + std::to_string(j) + ']';
            if (!conf.has(aliasPath))
            {
                break;
            }

            try
            {
                const Poco::URI aliasUri(conf.getString(aliasPath, ""));
                if (aliasUri.empty())
                {
                    continue;
                }
                const std::string host = aliasUri.getHost();

                std::vector<std::string> strVec = Util::splitStringToVector(host, '|');
                const Poco::URI realUri(uri);
                for (auto& x : strVec)
                {
                    const Poco::URI aUri(aliasUri.getScheme() + "://" + x + ':' +
                                         std::to_string(aliasUri.getPort()));
                    AliasHosts.insert({ aUri.getAuthority(), realUri.getAuthority() });
                    AllHosts.insert(aUri.getAuthority());
                    HostUtil::addWopiHost(aUri.getHost(), allow);
                }
            }
            catch (const Poco::Exception& exc)
            {
                LOG_WRN("parseAliases: " << exc.displayText());
            }
        }
    }
}

std::string HostUtil::getNewUri(const Poco::URI& uri)
{
    if (Util::iequal(config::getString("storage.wopi.alias_groups[@mode]", "first"), "compat"))
    {
        return uri.getPath();
    }
    Poco::URI newUri(uri);
    const std::string value = Util::getValue(AliasHosts, newUri.getAuthority());
    if (!value.empty())
    {
        newUri.setAuthority(value);
    }

    if (newUri.getAuthority().empty())
    {
        return newUri.getPath();
    }
    return newUri.getScheme() + "://" + newUri.getHost() + ':' + std::to_string(newUri.getPort()) +
           newUri.getPath();
}

const Poco::URI HostUtil::getNewLockedUri(Poco::URI& uri)
{
    Poco::URI newUri(uri);
    const std::string value = Util::getValue(AliasHosts, newUri.getAuthority());
    if (!value.empty())
    {
        newUri.setAuthority(value);
        LOG_WRN("The locked_host: " << uri.getAuthority() << " is alias of "
                                    << newUri.getAuthority() << ",Applying "
                                    << newUri.getAuthority() << " locked_host settings.");
    }
    return newUri;
}

void HostUtil::setFirstHost(const Poco::URI& uri)
{
    if (AllHosts.empty() && FirstHost.empty())
    {
        FirstHost = uri.getAuthority();
        addWopiHost(uri.getHost(), true);
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
