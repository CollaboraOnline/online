/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <iostream>
#include "Unit.hpp"
#include "config.h"

#include <cassert>
#include <dlfcn.h>
#include <fstream>
#include <ftw.h>

#include <Poco/Thread.h>
#include <Poco/Util/Application.h>

#include "Log.hpp"
#include "Util.hpp"

#include "common/SigUtil.hpp"

UnitBase *UnitBase::Global = nullptr;

static Poco::Thread TimeoutThread("unit timeout");

UnitBase *UnitBase::linkAndCreateUnit(UnitType type, const std::string &unitLibPath)
{
    void *dlHandle = dlopen(unitLibPath.c_str(), RTLD_GLOBAL|RTLD_NOW);
    if (!dlHandle)
    {
        LOG_ERR("Failed to load " << unitLibPath << ": " << dlerror());
        return NULL;
    }

    const char *symbol = NULL;
    switch (type)
    {
        case TYPE_WSD:
            symbol = "unit_create_wsd";
            break;
        case TYPE_KIT:
            symbol = "unit_create_kit";
            break;
    }
    CreateUnitHooksFunction* createHooks;
    createHooks = reinterpret_cast<CreateUnitHooksFunction *>(dlsym(dlHandle, symbol));
    if (!createHooks)
    {
        LOG_ERR("No " << symbol << " symbol in " << unitLibPath);
        return NULL;
    }
    UnitBase *pHooks = createHooks();

    if (pHooks)
        pHooks->setHandle(dlHandle);

    return pHooks;
}

bool UnitBase::init(UnitType type, const std::string &unitLibPath)
{
    assert(!Global);
    if (!unitLibPath.empty())
    {
        Global = linkAndCreateUnit(type, unitLibPath);
        if (Global)
        {
            TimeoutThread.startFunc([](){
                    TimeoutThread.trySleep(Global->_timeoutMilliSeconds);
                    if (!Global->_timeoutShutdown)
                    {
                        LOG_ERR("Unit test timeout");
                        Global->timeout();
                    }
                });
        }
    }
    else
    {
        switch (type)
        {
        case TYPE_WSD:
            Global = new UnitWSD();
            break;
        case TYPE_KIT:
            Global = new UnitKit();
            break;
        default:
            assert(false);
            break;
        }
    }

    if (Global)
        Global->_type = type;

    return Global != NULL;
}

bool UnitBase::isUnitTesting()
{
    return Global && Global->_dlHandle;
}

void UnitBase::setTimeout(int timeoutMilliSeconds)
{
    assert(!TimeoutThread.isRunning());
    _timeoutMilliSeconds = timeoutMilliSeconds;
}

UnitBase::UnitBase()
    : _dlHandle(NULL),
      _setRetValue(false),
      _retValue(0),
      _timeoutMilliSeconds(30 * 1000),
      _timeoutShutdown(false),
      _type(TYPE_WSD)
{
}

UnitBase::~UnitBase()
{
// FIXME: we should really clean-up properly.
//    if (_dlHandle)
//        dlclose(_dlHandle);
    _dlHandle = NULL;
}

UnitWSD::UnitWSD()
    : _hasKitHooks(false)
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
        // Force console output - easier to debug.
        config.setBool("logging.file[@enable]", false);
    }
    // else - a product run.
}

void UnitWSD::lookupTile(int part, int width, int height, int tilePosX, int tilePosY,
                         int tileWidth, int tileHeight, std::unique_ptr<std::fstream>& cacheFile)
{
    if (cacheFile && cacheFile->is_open())
    {
        onTileCacheHit(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
    }
    else
    {
        onTileCacheMiss(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
    }
}

UnitKit::UnitKit()
{
}

UnitKit::~UnitKit()
{
}

void UnitBase::exitTest(TestResult result)
{
    LOG_INF("exitTest: " << result << ". Flagging for termination.");
    _setRetValue = true;
    _retValue = result == TestResult::TEST_OK ?
        Poco::Util::Application::EXIT_OK :
        Poco::Util::Application::EXIT_SOFTWARE;
    TerminationFlag = true;
}

void UnitBase::timeout()
{
    LOG_ERR("Timed out waiting for unit test to complete");
    exitTest(TestResult::TEST_TIMED_OUT);
}

void UnitBase::returnValue(int &retValue)
{
    if (_setRetValue)
        retValue = _retValue;

    _timeoutShutdown = true;
    TimeoutThread.wakeUp();
    TimeoutThread.join();

    delete Global;
    Global = nullptr;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
