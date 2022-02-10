/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
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
std::unordered_set<std::string> LockManager::LockedCommandList;
std::string LockManager::LockedCommandListString;

LockManager::LockManager() {}

void LockManager::generateLockedCommandList()
{
#ifdef ENABLE_FEATURE_LOCK

    LockedCommandListString = config::getString("feature_lock.locked_commands", "");
    Util::trim(LockedCommandListString);
    StringVector commandList = Util::tokenize(LockedCommandListString);

    std::string command;
    for (std::size_t i = 0; i < commandList.size(); i++)
    {
        // just an extra check to make sure any whitespace does not sniff in command
        // or else command will not be recognized
        command = Util::trim_whitespace(commandList[i]);
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

bool RestrictionManager::_isRestrictedUser = false;
std::unordered_set<std::string> RestrictionManager::RestrictedCommandList;
std::string RestrictionManager::RestrictedCommandListString;

RestrictionManager::RestrictionManager() {}

void RestrictionManager::generateRestrictedCommandList()
{
#ifdef ENABLE_FEATURE_RESTRICTION
    RestrictedCommandListString = config::getString("restricted_commands", "");
    Util::trim(RestrictedCommandListString);
    StringVector commandList = Util::tokenize(RestrictedCommandListString);

    std::string command;
    for (std::size_t i = 0; i < commandList.size(); i++)
    {
        // just an extra check to make sure any whitespace does not sniff in command
        // or else command will not be recognized
        command = Util::trim_whitespace(commandList[i]);
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
