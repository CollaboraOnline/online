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
#include <fstream>

#include "Util.hpp"
#include "Unit.hpp"

#include <Poco/Thread.h>
#include <Poco/Util/Application.h>

UnitBase *UnitBase::_global = nullptr;

static Poco::Thread TimeoutThread("unit timeout");

UnitBase *UnitBase::linkAndCreateUnit(UnitType type, const std::string &unitLibPath)
{
    void *dlHandle = dlopen(unitLibPath.c_str(), RTLD_GLOBAL|RTLD_NOW);
    if (!dlHandle)
    {
        Log::error("Failed to load " + unitLibPath + ": " + std::string(dlerror()));
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
        Log::error("No " + std::string(symbol) + " symbol in " + unitLibPath);
        return NULL;
    }
    UnitBase *pHooks = createHooks();

    if (pHooks)
        pHooks->setHandle(dlHandle);

    return pHooks;
}

bool UnitBase::init(UnitType type, const std::string &unitLibPath)
{
    assert(!_global);
    if (!unitLibPath.empty())
    {
        _global = linkAndCreateUnit(type, unitLibPath);
        if (_global)
        {
            TimeoutThread.startFunc([](){
                    TimeoutThread.trySleep(_global->_timeoutMilliSeconds);
                    if (!_global->_timeoutShutdown)
                    {
                        Log::error("Timeout");
                        _global->timeout();
                    }
                });
        }
    }
    else
    {
        switch (type)
        {
        case TYPE_WSD:
            _global = new UnitWSD();
            break;
        case TYPE_KIT:
            _global = new UnitKit();
            break;
        default:
            assert(false);
            break;
        }
    }

    if (_global)
        _global->_type = type;

    return _global != NULL;
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
      _timeoutShutdown(false)
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
    _setRetValue = true;
    _retValue = result == TestResult::TEST_OK ?
        Poco::Util::Application::EXIT_OK :
        Poco::Util::Application::EXIT_SOFTWARE;
    TerminationFlag = true;
}

void UnitBase::timeout()
{
    exitTest(TestResult::TEST_TIMED_OUT);
}

void UnitBase::returnValue(int &retValue)
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
