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

namespace CommandControl
{
class FreemiumManager
{
    static std::unordered_set<std::string> FreemiumDenyList;
    static bool _isFreemiumUser;
    static std::string FreemiumDenyListString;

    static void generateDenyList();

public:
    FreemiumManager();
    static const std::unordered_set<std::string>& getFreemiumDenyList();
    static const std::string getFreemiumDenyListString();

    static bool isFreemiumUser() { return _isFreemiumUser; }
    static bool isFreemiumReadOnly() { return config::getBool("freemium.is_freemium_readonly", false); }
    static bool isFreemiumReadOnlyUser() { return isFreemiumUser() && isFreemiumReadOnly(); }

    static void setFreemiumUser(bool isFreemiumUser) { _isFreemiumUser = isFreemiumUser; }

    static std::string getFreemiumPurchaseTitle() { return config::getString("freemium.purchase_title", ""); }
    static std::string getFreemiumPurchaseLink() { return config::getString("freemium.purchase_link", ""); }
    static std::string getFreemiumPurchaseDescription() { return config::getString("freemium.purchase_description", ""); }
    static std::string getWriterHighlights() { return config::getString("freemium.writer_subscription_highlights", ""); }
    static std::string getCalcHighlights() { return config::getString("freemium.calc_subscription_highlights", ""); }
    static std::string getImpressHighlights() { return config::getString("freemium.impress_subscription_highlights", ""); }
    static std::string getDrawHighlights() { return config::getString("freemium.draw_subscription_highlights", ""); }
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
