/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <iostream>
#include "Unit.hpp"

#include <cassert>
#include <dlfcn.h>
#include <fstream>
#include <sysexits.h>
#include <thread>

#include <Poco/Util/LayeredConfiguration.h>

#include "Log.hpp"
#include "Util.hpp"

#include <common/SigUtil.hpp>

UnitBase *UnitBase::Global = nullptr;
char * UnitBase::UnitLibPath;
static std::thread TimeoutThread;
static std::atomic<bool> TimeoutThreadRunning(false);
std::timed_mutex TimeoutThreadMutex;

UnitBase *UnitBase::linkAndCreateUnit(UnitType type, const std::string &unitLibPath)
{
#if !MOBILEAPP
    void *dlHandle = dlopen(unitLibPath.c_str(), RTLD_GLOBAL|RTLD_NOW);
    if (!dlHandle)
    {
        LOG_ERR("Failed to load " << unitLibPath << ": " << dlerror());
        return nullptr;
    }

    // avoid std:string de-allocation during failure / exit.
    UnitLibPath = strdup(unitLibPath.c_str());

    const char *symbol = nullptr;
    switch (type)
    {
        case UnitType::Wsd:
            symbol = "unit_create_wsd";
            break;
        case UnitType::Kit:
            symbol = "unit_create_kit";
            break;
    }
    CreateUnitHooksFunction* createHooks;
    createHooks = reinterpret_cast<CreateUnitHooksFunction *>(dlsym(dlHandle, symbol));
    if (!createHooks)
    {
        LOG_ERR("No " << symbol << " symbol in " << unitLibPath);
        return nullptr;
    }
    UnitBase *hooks = createHooks();

    if (hooks)
        hooks->setHandle(dlHandle);

    return hooks;
#else
    return nullptr;
#endif
}

bool UnitBase::init(UnitType type, const std::string &unitLibPath)
{
#if !MOBILEAPP
    assert(!Global);
#else
    // The LOOLWSD initialization is called in a loop on mobile, allow reuse
    if (Global)
        return true;
#endif

    if (!unitLibPath.empty())
    {
        Global = linkAndCreateUnit(type, unitLibPath);
        LOG_DBG(Global->_testname << ": Initializing");
        if (Global && type == UnitType::Kit)
        {
            TimeoutThreadMutex.lock();
            TimeoutThread = std::thread([]{
                    TimeoutThreadRunning = true;
                    Util::setThreadName("unit timeout");

                    if (TimeoutThreadMutex.try_lock_for(std::chrono::milliseconds(Global->_timeoutMilliSeconds)))
                    {
                        LOG_DBG(Global->_testname << ": Unit test finished in time");
                        TimeoutThreadMutex.unlock();
                    }
                    else
                    {
                        LOG_ERR(Global->_testname << ": Unit test timeout after "
                                                  << Global->_timeoutMilliSeconds);
                        Global->timeout();
                    }
                    TimeoutThreadRunning = false;
                });
        }
    }
    else
    {
        switch (type)
        {
        case UnitType::Wsd:
            Global = new UnitWSD();
            break;
        case UnitType::Kit:
            Global = new UnitKit();
            break;
        default:
            assert(false);
            break;
        }
    }

    if (Global)
        Global->_type = type;

    return Global != nullptr;
}

bool UnitBase::isUnitTesting()
{
    return Global && Global->_dlHandle;
}

void UnitBase::setTimeout(int timeoutMilliSeconds)
{
    assert(!TimeoutThreadRunning);
    _timeoutMilliSeconds = timeoutMilliSeconds;
    LOG_TST(getTestname() << ": setTimeout: " << _timeoutMilliSeconds);
}

UnitBase::~UnitBase()
{
// FIXME: we should really clean-up properly.
//    if (_dlHandle)
//        dlclose(_dlHandle);
    _dlHandle = nullptr;
    _socketPoll->joinThread();
}

UnitWSD::UnitWSD(std::string testname)
    : UnitBase(std::move(testname))
    , _hasKitHooks(false)
{
}

UnitWSD::~UnitWSD()
{
}

void UnitWSD::configure(Poco::Util::LayeredConfiguration &config)
{
    if (isUnitTesting())
    {
        // Force HTTP - helps stracing.
        config.setBool("ssl.enable", false);
        // Use http:// everywhere.
        config.setBool("ssl.termination", false);
        // Force console output - easier to debug.
        config.setBool("logging.file[@enable]", false);
    }
}

void UnitWSD::lookupTile(int part, int width, int height, int tilePosX, int tilePosY,
                         int tileWidth, int tileHeight,
                         std::shared_ptr<std::vector<char>> &tile)
{
    if (tile)
        onTileCacheHit(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
    else
        onTileCacheMiss(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
}

UnitKit::UnitKit()
{
}

UnitKit::~UnitKit()
{
}

void UnitBase::exitTest(TestResult result)
{
    if (_setRetValue)
    {
        return;
    }

    if (result == TestResult::Ok)
        LOG_INF(getTestname() << ": SUCCESS: exitTest: " << testResultAsString(result)
                              << ". Flagging to shutdown.");
    else
        LOG_ERR(getTestname() << ": FAILURE: exitTest: " << testResultAsString(result)
                              << ". Flagging to shutdown.");

    _setRetValue = true;
    _retValue = result == TestResult::Ok ? EX_OK : EX_SOFTWARE;
#if !MOBILEAPP
    SigUtil::requestShutdown(); // And wakupWorld.
#else
    SocketPoll::wakeupWorld();
#endif
}

void UnitBase::timeout()
{
    // Don't timeout if we had already finished.
    if (isUnitTesting() && !_setRetValue)
    {
        LOG_ERR(getTestname() << ": Timed out waiting for unit test to complete");
        exitTest(TestResult::TimedOut);
    }
}

void UnitBase::returnValue(int &retValue)
{
    if (_setRetValue)
        retValue = _retValue;

    // tell the timeout thread that the work has finished
    TimeoutThreadMutex.unlock();
    if (TimeoutThread.joinable())
        TimeoutThread.join();

    delete Global;
    Global = nullptr;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
