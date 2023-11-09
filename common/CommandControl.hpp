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

#include <string>
#include <unordered_set>
#include "ConfigUtil.hpp"
#include <Poco/Util/LayeredConfiguration.h>
#include <Poco/URI.h>
#include <Poco/Exception.h>
#include <Log.hpp>

namespace CommandControl
{
class LockManager
{
    static std::unordered_set<std::string> LockedCommandList;
    static bool _isLockedUser;
    static bool _isHostReadOnly;
    static std::string LockedCommandListString;
    static std::string translationPath;

    static void generateLockedCommandList();

public:
    LockManager();
    static const std::unordered_set<std::string>& getLockedCommandList();
    static const std::string getLockedCommandListString();

    // Allow/deny Locked hosts
    static Util::RegexListMatcher readOnlyWopiHosts;
    static Util::RegexListMatcher disabledCommandWopiHosts;
    static std::map<std::string, std::string> unlockLinkMap;
    static std::string unlockLink;
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
    static void setTranslationPath(const std::string& lockedDialogLang);
    static std::string getUnlockTitle()
    {
        if (config::has(translationPath + ".unlock_title"))
            return config::getString(translationPath + ".unlock_title", "");
        return config::getString("feature_lock.unlock_title", "");
    }
    static std::string getUnlockLink()
    {
        if (!unlockLink.empty())
            return unlockLink;
        return config::getString("feature_lock.unlock_link", "");
    }
    static std::string getUnlockDescription()
    {
        if (config::has(translationPath + ".unlock_description"))
            return config::getString(translationPath + ".unlock_description", "");
        return config::getString("feature_lock.unlock_description", "");
    }
    static std::string getWriterHighlights()
    {
        if (config::has(translationPath + ".writer_unlock_highlights"))
            return config::getString(translationPath + ".writer_unlock_highlights", "");
        return config::getString("feature_lock.writer_unlock_highlights", "");
    }
    static std::string getCalcHighlights()
    {
        if (config::has(translationPath + ".calc_unlock_highlights"))
            return config::getString(translationPath + ".calc_unlock_highlights", "");
        return config::getString("feature_lock.calc_unlock_highlights", "");
    }
    static std::string getImpressHighlights()
    {
        if (config::has(translationPath + ".impress_unlock_highlights"))
            return config::getString(translationPath + ".impress_unlock_highlights", "");
        return config::getString("feature_lock.impress_unlock_highlights", "");
    }
    static std::string getDrawHighlights()
    {
        if (config::has(translationPath + ".draw_unlock_highlights"))
            return config::getString(translationPath + ".draw_unlock_highlights", "");
        return config::getString("feature_lock.draw_unlock_highlights", "");
    }
    static const Poco::URI getUnlockImageUri()
    {
        const std::string unlockImageUrl = config::getString("feature_lock.unlock_image", "");
        if (!unlockImageUrl.empty())
        {
            try
            {
                const Poco::URI unlockImageUri(unlockImageUrl);
                return unlockImageUri;
            }
            catch (Poco::SyntaxException& exc)
            {
                LOG_ERR("Parsing of unlock_image url failed with " << exc.what());
            }
        }
        return Poco::URI();
    }
    static void resetTransalatioPath() { translationPath = std::string(); }
    static void mapUnlockLink(const std::string& host, const std::string& path);
    static void setUnlockLink(const std::string& host)
    {
        unlockLink = Util::getValue(unlockLinkMap, host);
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
