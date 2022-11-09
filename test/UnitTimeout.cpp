/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <chrono>

#include <cassert>
#include <sysexits.h>

#include <Log.hpp>
#include <Util.hpp>
#include <Unit.hpp>

class UnitTimeout : public UnitWSD
{
public:
    UnitTimeout()
        : UnitWSD("UnitTimeout")
    {
        setTimeout(std::chrono::seconds(1));
    }

    virtual void timeout() override
    {
        passTest("Timed out as expected");
    }

    // sanity check the non-unit-test paths
    static void testDefaultKits()
    {
        bool madeWSD = init(UnitType::Wsd, std::string());
        assert(madeWSD);
        delete [] UnitBase::GlobalArray;
        UnitBase::GlobalArray = nullptr;
        bool madeKit = init(UnitType::Kit, std::string());
        assert(madeKit);
        delete [] UnitBase::GlobalArray;
        UnitBase::GlobalArray = nullptr;
    }
};

UnitBase *unit_create_wsd(void)
{
    UnitTimeout::testDefaultKits();
    return new UnitTimeout();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
