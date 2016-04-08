/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <dlfcn.h>
#include <ftw.h>
#include <cassert>
#include <iostream>

#include "Util.hpp"
#include "Unit.hpp"

#include <Poco/Timestamp.h>
#include <Poco/Util/Application.h>
using Poco::Timestamp;

class UnitTimeout : public UnitHooks
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
        UnitHooks::timeout();
    }
	virtual void returnValue(int & retValue) override
    {
        if (!_timedOut)
        {
            Log::info("Failed to timeout");
            retValue = Poco::Util::Application::EXIT_SOFTWARE;
        }
        else
        {
            assert(_setRetValue);
            assert(_retValue == Poco::Util::Application::EXIT_SOFTWARE);
            // we wanted a timeout.
            retValue = Poco::Util::Application::EXIT_OK;
        }
    }
};

UnitHooks *unit_create(void)
{
    return new UnitTimeout();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
