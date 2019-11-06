/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <cassert>
#include <sysexits.h>

#include <Log.hpp>
#include <Util.hpp>
#include <Unit.hpp>

class UnitTimeout : public UnitWSD
{
    std::atomic<bool> _timedOut;
public:
    UnitTimeout()
        : _timedOut(false)
    {
        setTimeout(10);
    }
    virtual void timeout() override
    {
        _timedOut = true;
        UnitBase::timeout();
    }
    virtual void returnValue(int & retValue) override
    {
        if (!_timedOut)
        {
            LOG_INF("Failed to timeout");
            retValue = EX_SOFTWARE;
        }
        else
        {
            assert(_setRetValue);
            assert(_retValue == EX_SOFTWARE);
            // we wanted a timeout.
            retValue = EX_OK;
        }
    }

    // sanity check the non-unit-test paths
    static void testDefaultKits()
    {
        bool madeWSD = init(UnitType::Wsd, std::string());
        assert(madeWSD);
        delete UnitBase::Global;
        UnitBase::Global = nullptr;
        bool madeKit = init(UnitType::Kit, std::string());
        assert(madeKit);
        delete UnitBase::Global;
        UnitBase::Global = nullptr;
    }
};

UnitBase *unit_create_wsd(void)
{
    UnitTimeout::testDefaultKits();
    return new UnitTimeout();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
