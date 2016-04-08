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
#include "Util.hpp"
#include "Unit.hpp"

#include <Poco/Thread.h>
#include <Poco/Util/Application.h>

UnitHooks *UnitHooks::_global = nullptr;

static Poco::Thread TimeoutThread("unit timeout");

UnitHooks *UnitHooks::linkAndCreateUnit(const std::string &unitLibPath)
{
    void *dlHandle = dlopen(unitLibPath.c_str(), RTLD_GLOBAL|RTLD_NOW);
    if (!dlHandle)
    {
        Log::error("Failed to load " + unitLibPath + ": " + std::string(dlerror()));
        return NULL;
    }

    CreateUnitHooksFunction* createHooks;
    createHooks = (CreateUnitHooksFunction *)dlsym(dlHandle, CREATE_UNIT_HOOKS_SYMBOL);
    if (!createHooks)
    {
        Log::error("No " CREATE_UNIT_HOOKS_SYMBOL " symbol in " + unitLibPath);
        return NULL;
    }
    UnitHooks *pHooks = createHooks();

    if (pHooks)
        pHooks->setHandle(dlHandle);

    return pHooks;
}

bool UnitHooks::init(const std::string &unitLibPath)
{
    if (!unitLibPath.empty())
    {
        _global = linkAndCreateUnit(unitLibPath);
        TimeoutThread.startFunc([](){
                TimeoutThread.trySleep(_global->_timeoutMilliSeconds);
                if (!_global->_timeoutShutdown)
                {
                    Log::error("Timeout");
                    _global->timeout();
                }
            });
    }
    else
        _global = new UnitHooks();

    return _global != NULL;
}

void UnitHooks::setTimeout(int timeoutMilliSeconds)
{
    assert(!TimeoutThread.isRunning());
    _timeoutMilliSeconds = timeoutMilliSeconds;
}

UnitHooks::UnitHooks()
    : _dlHandle(NULL),
      _timeoutMilliSeconds(30 * 1000),
      _timeoutShutdown(false)
{
}

UnitHooks::~UnitHooks()
{
// FIXME: we should really clean-up properly.
//    if (_dlHandle)
//        dlclose(_dlHandle);
    _dlHandle = NULL;
}

void UnitHooks::exitTest(TestResult result)
{
    _setRetValue = true;
    _retValue = result == TestResult::TEST_OK ?
        Poco::Util::Application::EXIT_OK :
        Poco::Util::Application::EXIT_SOFTWARE;
    TerminationFlag = true;
}

void UnitHooks::timeout()
{
    exitTest(TestResult::TEST_TIMED_OUT);
}

void UnitHooks::returnValue(int &retValue)
{
    if (_setRetValue)
        retValue = _retValue;

    _timeoutShutdown = true;
    TimeoutThread.wakeUp();
    TimeoutThread.join();

    delete _global;
    _global = nullptr;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
