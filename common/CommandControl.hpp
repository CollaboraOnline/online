/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <string>
#include <unordered_set>
#include "ConfigUtil.hpp"
#include <Poco/Util/LayeredConfiguration.h>

namespace CommandControl
{
class LockManager
{
    static std::unordered_set<std::string> LockedCommandList;
    static bool _isLockedUser;
    static bool _isHostReadOnly;
    static std::string LockedCommandListString;

    static void generateLockedCommandList();

public:
    LockManager();
    static const std::unordered_set<std::string>& getLockedCommandList();
    static const std::string getLockedCommandListString();

    // Allow/deny Locked hosts
    static Util::RegexListMatcher readOnlyWopiHosts;
    static Util::RegexListMatcher disabledCommandWopiHosts;
    static bool lockHostEnabled;

    static void parseLockedHost(Poco::Util::LayeredConfiguration& conf);

    static bool isLockedUser() { return _isLockedUser; }
    static bool isLockReadOnly()
    {
        return config::getBool("feature_lock.is_lock_readonly", false) || isHostReadOnly();
    }
    static bool isHostReadOnly() { return _isHostReadOnly; };
    static bool isLockedReadOnlyUser() { return isLockedUser() && isLockReadOnly(); }

    static bool isHostReadOnly(const std::string& host);
    static bool isHostCommandDisabled(const std::string& host);
    static bool hostExist(const std::string& host);

    static void setLockedUser(bool isLocked) { _isLockedUser = isLocked; }
    static void setHostReadOnly(bool isReadOnly) { _isHostReadOnly = isReadOnly; }

    static std::string getUnlockTitle()
    {
        return config::getString("feature_lock.unlock_title", "");
    }
    static std::string getUnlockLink() { return config::getString("feature_lock.unlock_link", ""); }
    static std::string getUnlockDescription()
    {
        return config::getString("feature_lock.unlock_description", "");
    }
    static std::string getWriterHighlights()
    {
        return config::getString("feature_lock.writer_unlock_highlights", "");
    }
    static std::string getCalcHighlights()
    {
        return config::getString("feature_lock.calc_unlock_highlights", "");
    }
    static std::string getImpressHighlights()
    {
        return config::getString("feature_lock.impress_unlock_highlights", "");
    }
    static std::string getDrawHighlights()
    {
        return config::getString("feature_lock.draw_unlock_highlights", "");
    }
};

class RestrictionManager
{
    static std::unordered_set<std::string> RestrictedCommandList;
    static bool _isRestrictedUser;
    static std::string RestrictedCommandListString;

    static void generateRestrictedCommandList();

public:
    RestrictionManager();
    static const std::unordered_set<std::string>& getRestrictedCommandList();
    static const std::string getRestrictedCommandListString();

    static bool isRestrictedUser() { return _isRestrictedUser; }

    static void setRestrictedUser(bool isRestrictedUser) { _isRestrictedUser = isRestrictedUser; }
};
} // namespace CommandControl

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
