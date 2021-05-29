/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef ONLINE_COMMON_FREEMIUM
#define ONLINE_COMMON_FREEMIUM

#include <string>
#include <vector>
#include "ConfigUtil.hpp"

namespace Freemium
{
class FreemiumManager
{
    static std::vector<std::string> FreemiumDenyList;
    static bool _isFreemiumUser;
    static std::string FreemiumDenyListString;

    static void generateDenyList();

public:
    FreemiumManager();
    static const std::vector<std::string>& getFreemiumDenyList();
    static const std::string getFreemiumDenyListString();

    static bool isFreemiumUser() { return _isFreemiumUser; }

    static void setFreemiumUser(bool isFreemiumUser) { _isFreemiumUser = isFreemiumUser; }

    static std::string getFreemiumPurchaseTitle() { return config::getString("freemium.purchase_title", ""); }
    static std::string getFreemiumPurchaseLink() { return config::getString("freemium.purchase_link", ""); }
    static std::string getFreemiumPurchaseDiscription() { return config::getString("freemium.purchase_discription", ""); }
    static std::string getWriterHighlights() { return config::getString("freemium.writer_subscription_highlights", ""); }
    static std::string getCalcHighlights() { return config::getString("freemium.calc_subscription_highlights", ""); }
    static std::string getImpressHighlights() { return config::getString("freemium.impress_subscription_highlights", ""); }
    static std::string getDrawHighlights() { return config::getString("freemium.draw_subscription_highlights", ""); }
};
} // namespace Freemium
#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
