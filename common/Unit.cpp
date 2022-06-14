/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "Unit.hpp"

#include <iostream>
#include <cassert>
#include <dlfcn.h>
#include <fstream>
#include <sstream>
#include <sysexits.h>
#include <thread>

#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Util/LayeredConfiguration.h>

#include "Log.hpp"
#include "Util.hpp"

#include <common/SigUtil.hpp>

UnitBase *UnitBase::Global = nullptr;
UnitKit *GlobalKit = nullptr;
UnitWSD *GlobalWSD = nullptr;
UnitTool *GlobalTool = nullptr;
char * UnitBase::UnitLibPath;
static std::thread TimeoutThread;
static std::atomic<bool> TimeoutThreadRunning(false);
std::timed_mutex TimeoutThreadMutex;

/// Controls whether experimental features/behavior is enabled or not.
bool EnableExperimental = false;

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
        case UnitType::Tool:
            symbol = "unit_create_tool";
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
    assert(!get(type));
#else
    // The COOLWSD initialization is called in a loop on mobile, allow reuse
    if (get(type))
        return true;
#endif

    if (!unitLibPath.empty())
    {
        UnitBase* instance = linkAndCreateUnit(type, unitLibPath);
        rememberInstance(type, instance);
        LOG_DBG(instance->getTestname() << ": Initializing");

        if (instance && type == UnitType::Kit)
        {
            TimeoutThreadMutex.lock();
            TimeoutThread = std::thread([instance]{
                    TimeoutThreadRunning = true;
                    Util::setThreadName("unit timeout");

                    if (TimeoutThreadMutex.try_lock_for(instance->_timeoutMilliSeconds))
                    {
                        LOG_DBG(instance->getTestname() << ": Unit test finished in time");
                        TimeoutThreadMutex.unlock();
                    }
                    else
                    {
                        LOG_ERR(instance->getTestname()
                                << ": Unit test timeout after " << instance->_timeoutMilliSeconds);
                        instance->timeout();
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
            rememberInstance(UnitType::Wsd, new UnitWSD("UnitWSD"));
            break;
        case UnitType::Kit:
            rememberInstance(UnitType::Kit, new UnitKit("UnitKit"));
            break;
        case UnitType::Tool:
            rememberInstance(UnitType::Tool, new UnitTool("UnitTool"));
            break;
        default:
            assert(false);
            break;
        }
    }

    return get(type) != nullptr;
}

UnitBase* UnitBase::get(UnitType type)
{
    switch (type)
    {
    case UnitType::Wsd:
        return GlobalWSD;
        break;
    case UnitType::Kit:
        return GlobalKit;
        break;
    case UnitType::Tool:
        return GlobalTool;
        break;
    default:
        assert(false);
        break;
    }

    return nullptr;
}

void UnitBase::rememberInstance(UnitType type, UnitBase* instance)
{
    assert(instance->_type == type);

    Global = instance;

    switch (type)
    {
    case UnitType::Wsd:
        GlobalWSD = static_cast<UnitWSD*>(instance);
        break;
    case UnitType::Kit:
        GlobalKit = static_cast<UnitKit*>(instance);
        break;
    case UnitType::Tool:
        GlobalTool = static_cast<UnitTool*>(instance);
        break;
    default:
        assert(false);
        break;
    }
}

bool UnitBase::isUnitTesting()
{
    return Global && Global->_dlHandle;
}

void UnitBase::setTimeout(std::chrono::milliseconds timeoutMilliSeconds)
{
    assert(!TimeoutThreadRunning);
    _timeoutMilliSeconds = timeoutMilliSeconds;
    LOG_TST(getTestname() << ": setTimeout: " << _timeoutMilliSeconds);
}

UnitBase::~UnitBase()
{
    LOG_TST(getTestname() << ": ~UnitBase");

// FIXME: we should really clean-up properly.
//    if (_dlHandle)
//        dlclose(_dlHandle);
    _dlHandle = nullptr;
    _socketPoll->joinThread();
}

bool UnitBase::filterSendWebSocketMessage(const char* data, const std::size_t len,
                                          const WSOpCode code, const bool flush, int& unitReturn)
{
    const std::string message(data, len);
    if (Util::startsWith(message, "unocommandresult:"))
    {
        const std::size_t index = message.find_first_of('{');
        if (index != std::string::npos)
        {
            try
            {
                const std::string stringJSON = message.substr(index);
                Poco::JSON::Parser parser;
                const Poco::Dynamic::Var parsedJSON = parser.parse(stringJSON);
                const auto& object = parsedJSON.extract<Poco::JSON::Object::Ptr>();
                if (object->get("commandName").toString() == ".uno:Save")
                {
                    const bool success = object->get("success").toString() == "true";
                    std::string result;
                    if (object->has("result"))
                    {
                        const Poco::Dynamic::Var parsedResultJSON = object->get("result");
                        const auto& resultObj = parsedResultJSON.extract<Poco::JSON::Object::Ptr>();
                        if (resultObj->get("type").toString() == "string")
                            result = resultObj->get("value").toString();
                    }

                    if (onDocumentSaved(message, success, result))
                        return false;
                }
            }
            catch (const std::exception& exception)
            {
                LOG_TST("unocommandresult parsing failure: " << exception.what());
            }
        }
        else
        {
            LOG_TST("Expected json unocommandresult. Ignoring: " << message);
        }
    }
    else if (Util::startsWith(message, "status:"))
    {
        if (onDocumentLoaded(message))
            return false;
    }
    else if (message == "statechanged: .uno:ModifiedStatus=true")
    {
        if (onDocumentModified(message))
            return false;
    }
    else if (Util::startsWith(message, "statechanged:"))
    {
        if (onDocumentStateChanged(message))
            return false;
    }
    else if (Util::startsWith(message, "error:"))
    {
        if (onDocumentError(message))
            return false;
    }

    return onFilterSendWebSocketMessage(data, len, code, flush, unitReturn);
}

UnitWSD::UnitWSD(const std::string& name)
    : UnitBase(name, UnitType::Wsd)
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
                         std::shared_ptr<TileData> &tile)
{
    if (isUnitTesting())
    {
        if (tile)
            onTileCacheHit(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
        else
            onTileCacheMiss(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
    }
}

UnitWSD& UnitWSD::get()
{
    assert(GlobalWSD);
    return *GlobalWSD;
}

UnitKit::UnitKit(const std::string& name)
    : UnitBase(name, UnitType::Kit)
{
}

UnitKit::~UnitKit()
{
}

UnitKit& UnitKit::get()
{
#if MOBILEAPP
    if (!GlobalKit)
        GlobalKit = new UnitKit("UnitKit");
#endif

    assert(GlobalKit);
    return *GlobalKit;
}

void UnitBase::exitTest(TestResult result)
{
    if (isFinished())
    {
        return;
    }

    if (result == TestResult::Ok)
        LOG_TST(getTestname() << ": SUCCESS: exitTest: " << testResultAsString(result)
                              << ". Flagging to shutdown.");
    else
        LOG_TST("ERROR " << getTestname() << ": FAILURE: exitTest: " << testResultAsString(result)
                         << ". Flagging to shutdown.");

    _setRetValue = true;
    _retValue = result == TestResult::Ok ? EX_OK : EX_SOFTWARE;
#if !MOBILEAPP
    LOG_INF("Setting ShutdownRequestFlag: " << getTestname() << " test has finished.");
    SigUtil::setTerminationFlag(); // And wakupWorld.
#else
    SocketPoll::wakeupWorld();
#endif
}

void UnitBase::timeout()
{
    // Don't timeout if we had already finished.
    if (isUnitTesting() && !isFinished())
    {
        LOG_TST("ERROR " << getTestname() << ": Timed out waiting for unit test to complete within "
                         << _timeoutMilliSeconds);
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

    Global = nullptr;
}

void UnitKit::returnValue(int &retValue)
{
    UnitBase::returnValue(retValue);

    delete GlobalKit;
    GlobalKit = nullptr;
}

void UnitWSD::returnValue(int &retValue)
{
    UnitBase::returnValue(retValue);

    delete GlobalWSD;
    GlobalWSD = nullptr;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
