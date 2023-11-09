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

#include <config.h>
#include <string>
#include <unordered_set>
#include "ConfigUtil.hpp"
#include "Util.hpp"
#include "CommandControl.hpp"

namespace CommandControl
{
bool LockManager::_isLockedUser = false;
bool LockManager::_isHostReadOnly = false;
std::unordered_set<std::string> LockManager::LockedCommandList;
std::string LockManager::LockedCommandListString;
Util::RegexListMatcher LockManager::readOnlyWopiHosts;
Util::RegexListMatcher LockManager::disabledCommandWopiHosts;
std::map<std::string, std::string> LockManager::unlockLinkMap;
bool LockManager::lockHostEnabled = false;
std::string LockManager::translationPath = std::string();
std::string LockManager::unlockLink = std::string();

LockManager::LockManager() {}

void LockManager::generateLockedCommandList()
{
#ifdef ENABLE_FEATURE_LOCK

    LockedCommandListString = config::getString("feature_lock.locked_commands", "");
    Util::trim(LockedCommandListString);
    StringVector commandList = StringVector::tokenize(LockedCommandListString);

    std::string command;
    for (std::size_t i = 0; i < commandList.size(); i++)
    {
        command = commandList[i];
        if (!command.empty())
        {
            LockedCommandList.emplace(command);
        }
    }
#endif
}

const std::unordered_set<std::string>& LockManager::getLockedCommandList()
{
    if (LockedCommandList.empty())
        generateLockedCommandList();

    return LockedCommandList;
}

const std::string LockManager::getLockedCommandListString()
{
    if (LockedCommandListString.empty())
        generateLockedCommandList();

    return LockedCommandListString;
}

void LockManager::parseLockedHost(Poco::Util::LayeredConfiguration& conf)
{
    readOnlyWopiHosts.clear();
    disabledCommandWopiHosts.clear();

    lockHostEnabled = config::getBool("feature_lock.locked_hosts[@allow]", false);

    if (lockHostEnabled)
    {
        for (size_t i = 0;; i++)
        {
            const std::string path = "feature_lock.locked_hosts.host[" + std::to_string(i) + ']';
            const std::string host = conf.getString(path, "");
            if (!host.empty())
            {
                if (conf.getBool(path + "[@read_only]", false))
                {
                    readOnlyWopiHosts.allow(host);
                }
                else
                {
                    readOnlyWopiHosts.deny(host);
                }

                if (conf.getBool(path + "[@disabled_commands]", false))
                {
                    disabledCommandWopiHosts.allow(host);
                }
                else
                {
                    disabledCommandWopiHosts.deny(host);
                }
            }
            else if (!conf.has(path))
            {
                break;
            }
        }
    }
}

bool LockManager::isHostReadOnly(const std::string& host)
{
    return LockManager::lockHostEnabled && LockManager::readOnlyWopiHosts.match(host);
}

bool LockManager::isHostCommandDisabled(const std::string& host)
{
    return LockManager::lockHostEnabled && LockManager::disabledCommandWopiHosts.match(host);
}

bool LockManager::hostExist(const std::string& host)
{
    return LockManager::lockHostEnabled && LockManager::readOnlyWopiHosts.matchExist(host);
}

void LockManager::setTranslationPath(const std::string& lockedDialogLang)
{
    for (size_t i = 0;; ++i)
    {
        const std::string path =
            "feature_lock.translations.language[" + std::to_string(i) + "][@name]";

        if (!config::has(path))
        {
            return;
        }
        if (config::getString(path, "") == lockedDialogLang)
        {
            LockManager::translationPath =
                "feature_lock.translations.language[" + std::to_string(i) + ']';
            return;
        }
    }
}
void LockManager::mapUnlockLink(const std::string& host, const std::string& path)
{
    if (!config::has(path + ".unlock_link"))
    {
        return;
    }
    const std::string link = config::getString(path + ".unlock_link" , "");
    if (!link.empty())
    {
        unlockLinkMap.insert({host, link });
    }
}

bool RestrictionManager::_isRestrictedUser = false;
std::unordered_set<std::string> RestrictionManager::RestrictedCommandList;
std::string RestrictionManager::RestrictedCommandListString;

RestrictionManager::RestrictionManager() {}

void RestrictionManager::generateRestrictedCommandList()
{
#ifdef ENABLE_FEATURE_RESTRICTION
    RestrictedCommandListString = config::getString("restricted_commands", "");
    Util::trim(RestrictedCommandListString);
    StringVector commandList = StringVector::tokenize(RestrictedCommandListString);

    std::string command;
    for (std::size_t i = 0; i < commandList.size(); i++)
    {
        command = commandList[i];
        if (!command.empty())
        {
            RestrictedCommandList.emplace(command);
        }
    }
#endif
}

const std::unordered_set<std::string>& RestrictionManager::getRestrictedCommandList()
{
    if (RestrictedCommandList.empty())
        generateRestrictedCommandList();

    return RestrictedCommandList;
}

const std::string RestrictionManager::getRestrictedCommandListString()
{
    if (RestrictedCommandListString.empty())
        generateRestrictedCommandList();

    return RestrictedCommandListString;
}
} // namespace CommandControl

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
