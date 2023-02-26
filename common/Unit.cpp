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
#include <mutex>
#include <sstream>
#include <sysexits.h>
#include <thread>

#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Util/LayeredConfiguration.h>
#include <Poco/Util/Application.h>

#include "Log.hpp"
#include "Util.hpp"
#include <test/testlog.hpp>

#include <common/SigUtil.hpp>
#include <common/StringVector.hpp>
#include <common/Message.hpp>

UnitKit *GlobalKit = nullptr;
UnitWSD *GlobalWSD = nullptr;
UnitTool *GlobalTool = nullptr;
UnitBase** UnitBase::GlobalArray = nullptr;
int UnitBase::GlobalIndex = -1;
char* UnitBase::UnitLibPath = nullptr;
void* UnitBase::DlHandle = nullptr;
UnitBase::TestOptions UnitBase::GlobalTestOptions;
UnitBase::TestResult UnitBase::GlobalResult = UnitBase::TestResult::Ok;
static std::thread TimeoutThread;
static std::atomic<bool> TimeoutThreadRunning(false);
std::timed_mutex TimeoutThreadMutex;

/// Controls whether experimental features/behavior is enabled or not.
bool EnableExperimental = false;

UnitBase** UnitBase::linkAndCreateUnit(UnitType type, const std::string& unitLibPath)
{
#if !MOBILEAPP
    DlHandle = dlopen(unitLibPath.c_str(), RTLD_GLOBAL|RTLD_NOW);
    if (!DlHandle)
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
        {
            // Try the multi-test version first.
            CreateUnitHooksFunctionMulti* createHooksMulti =
                reinterpret_cast<CreateUnitHooksFunctionMulti*>(
                    dlsym(DlHandle, "unit_create_wsd_multi"));
            if (createHooksMulti)
            {
                UnitBase** hooks = createHooksMulti();
                if (hooks)
                {
                    std::ostringstream oss;
                    oss << "Loaded UnitTest [" << unitLibPath << "] with: ";
                    for (int i = 0; hooks[i] != nullptr; ++i)
                    {
                        if (i)
                            oss << ", ";
                        oss << hooks[i]->getTestname();
                    }

                    LOG_INF(oss.str());
                    return hooks;
                }
            }

            // Fallback.
            symbol = "unit_create_wsd";
            break;
        }
        case UnitType::Kit:
            symbol = "unit_create_kit";
            break;
        case UnitType::Tool:
            symbol = "unit_create_tool";
            break;
    }

    // Internal consistency sanity check.
    selfTest();

    CreateUnitHooksFunction* createHooks =
        reinterpret_cast<CreateUnitHooksFunction*>(dlsym(DlHandle, symbol));

    if (!createHooks)
    {
        LOG_ERR("No " << symbol << " symbol in " << unitLibPath);
        return nullptr;
    }

    UnitBase* hooks = createHooks();
    if (hooks)
        return new UnitBase* [2] { hooks, nullptr };

    LOG_ERR("No wsd unit-tests found in " << unitLibPath);
#else
    (void) type;
    (void) unitLibPath;
#endif

    return nullptr;
}

void UnitBase::initTestSuiteOptions()
{
    static const char* TestOptions = getenv("COOL_TEST_OPTIONS");
    if (TestOptions == nullptr)
        return;

    StringVector tokens = StringVector::tokenize(std::string(TestOptions), ':');

    for (const auto& token : tokens)
    {
        // Expect name=value pairs.
        const auto pair = Util::split(tokens.getParam(token), '=');

        // If there is no value, assume it's a filter string.
        if (pair.second.empty())
        {
            const std::string filter = Util::toLower(pair.first);
            LOG_INF("Setting the 'filter' test option to [" << filter << ']');
            GlobalTestOptions.setFilter(filter);
        }
        else if (pair.first == "keepgoing")
        {
            const bool keepgoing = pair.second == "1" || pair.second == "true";
            LOG_INF("Setting the 'keepgoing' test option to " << keepgoing);
            GlobalTestOptions.setKeepgoing(keepgoing);
        }
    }
}

void UnitBase::filter()
{
    const auto& filter = GlobalTestOptions.getFilter();
    for (; GlobalArray[GlobalIndex] != nullptr; ++GlobalIndex)
    {
        const std::string& name = GlobalArray[GlobalIndex]->getTestname();
        if (strstr(Util::toLower(name).c_str(), filter.c_str()))
            break;

        LOG_INF("Skipping test [" << name << "] per filter [" << filter << ']');
    }
}

void UnitBase::selfTest()
{
    assert(init(UnitType::Wsd, std::string()));
    assert(!UnitBase::get().isFinished());
    assert(!UnitWSD::get().isFinished());
    assert(GlobalArray);
    assert(GlobalIndex == 0);
    assert(&UnitBase::get() == GlobalArray[0]);
    delete GlobalArray[0];
    delete[] GlobalArray;
    GlobalArray = nullptr;
    GlobalIndex = -1;
    GlobalKit = nullptr;
    GlobalWSD = nullptr;
    GlobalTool = nullptr;

    assert(init(UnitType::Kit, std::string()));
    assert(!UnitBase::get().isFinished());
    assert(!UnitKit::get().isFinished());
    assert(GlobalArray);
    assert(GlobalIndex == 0);
    assert(&UnitBase::get() == GlobalArray[0]);
    delete GlobalArray[0];
    delete[] GlobalArray;
    GlobalArray = nullptr;
    GlobalIndex = -1;
    GlobalKit = nullptr;
    GlobalWSD = nullptr;
    GlobalTool = nullptr;
}

bool UnitBase::init(UnitType type, const std::string &unitLibPath)
{
#if !MOBILEAPP
    LOG_ASSERT(!get(type));
#else
    // The COOLWSD initialization is called in a loop on mobile, allow reuse
    if (get(type))
        return true;
#endif

    LOG_ASSERT(GlobalArray == nullptr);
    LOG_ASSERT(GlobalIndex == -1);
    GlobalArray = nullptr;
    GlobalIndex = -1;
    GlobalKit = nullptr;
    GlobalWSD = nullptr;
    GlobalTool = nullptr;
    if (!unitLibPath.empty())
    {
        GlobalArray = linkAndCreateUnit(type, unitLibPath);
        if (GlobalArray)
        {
            initTestSuiteOptions();

            // Filter tests.
            GlobalIndex = 0;
            filter();

            UnitBase* instance = GlobalArray[GlobalIndex];
            if (instance)
            {
                rememberInstance(type, instance);
                TST_LOG_NAME("UnitBase",
                             "Starting test #1: " << GlobalArray[GlobalIndex]->getTestname());
                instance->initialize();

                if (instance && type == UnitType::Kit)
                {
                    TimeoutThreadMutex.lock();
                    TimeoutThread = std::thread(
                        [instance]
                        {
                            TimeoutThreadRunning = true;
                            Util::setThreadName("unit timeout");

                            if (TimeoutThreadMutex.try_lock_for(instance->_timeoutMilliSeconds))
                            {
                                LOG_DBG(instance->getTestname() << ": Unit test finished in time");
                                TimeoutThreadMutex.unlock();
                            }
                            else
                            {
                                LOG_ERR(instance->getTestname() << ": Unit test timeout after "
                                                                << instance->_timeoutMilliSeconds);
                                instance->timeout();
                            }
                            TimeoutThreadRunning = false;
                        });
                }

                return get(type) != nullptr;
            }
        }
    }

    // Fallback.
    switch (type)
    {
        case UnitType::Wsd:
            rememberInstance(UnitType::Wsd, new UnitWSD("UnitWSD"));
            GlobalArray = new UnitBase* [2] { GlobalWSD, nullptr };
            GlobalIndex = 0;
            break;
        case UnitType::Kit:
            rememberInstance(UnitType::Kit, new UnitKit("UnitKit"));
            GlobalArray = new UnitBase* [2] { GlobalKit, nullptr };
            GlobalIndex = 0;
            break;
        case UnitType::Tool:
            rememberInstance(UnitType::Tool, new UnitTool("UnitTool"));
            GlobalArray = new UnitBase* [2] { GlobalTool, nullptr };
            GlobalIndex = 0;
            break;
        default:
            assert(false);
            break;
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

    assert(GlobalWSD == nullptr);
    assert(GlobalKit == nullptr);
    assert(GlobalTool == nullptr);

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

int UnitBase::uninit()
{
    TST_LOG_NAME("UnitBase", "Uninitializing unit-tests: "
                                 << (GlobalResult == TestResult::Ok ? "SUCCESS" : "FAILED"));

    if (GlobalArray)
    {
        // By default, this will check _setRetValue and copy _retValue to the arg.
        // But we call it to trigger overrides and to perform cleanups.
        int retValue = GlobalResult == TestResult::Ok ? EX_OK : EX_SOFTWARE;
        if (GlobalArray[GlobalIndex] != nullptr)
            GlobalArray[GlobalIndex]->returnValue(retValue);
        if (retValue)
            GlobalResult = TestResult::Failed;

        for (int i = 0; GlobalArray[i] != nullptr; ++i)
        {
            delete GlobalArray[i];
        }

        delete[] GlobalArray;
        GlobalArray = nullptr;
    }

    GlobalIndex = -1;

    free(UnitBase::UnitLibPath);
    UnitBase::UnitLibPath = nullptr;

    GlobalKit = nullptr;
    GlobalWSD = nullptr;
    GlobalTool = nullptr;

    // Close the DLL last, after deleting the test instances.
    if (DlHandle)
        dlclose(DlHandle);
    DlHandle = nullptr;

    return GlobalResult == TestResult::Ok ? EX_OK : EX_SOFTWARE;
}

void UnitBase::initialize()
{
    assert(DlHandle != nullptr && "Invalid handle to set");
    LOG_TST("==================== Starting [" << getTestname() << "] ====================");
    _socketPoll->startThread();
}

bool UnitBase::isUnitTesting()
{
    return DlHandle;
}

void UnitBase::setTimeout(std::chrono::milliseconds timeoutMilliSeconds)
{
    assert(!TimeoutThreadRunning);
    _timeoutMilliSeconds = timeoutMilliSeconds;
    LOG_TST(getTestname() << ": setTimeout: " << _timeoutMilliSeconds);
}

UnitBase::~UnitBase()
{
    LOG_TST(getTestname() << ": ~UnitBase: " << (failed() ? "FAILED" : "SUCCESS"));

    _socketPoll->joinThread();
}

bool UnitBase::filterLOKitMessage(const std::shared_ptr<Message>& message)
{
    return onFilterLOKitMessage(message);
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
    else if (message == "statechanged: .uno:ModifiedStatus=false")
    {
        if (onDocumentUnmodified(message))
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

void UnitBase::exitTest(TestResult result, const std::string& reason)
{
    // We could be called from either a SocketPoll (websrv_poll)
    // or from invokeTest (coolwsd main).
    std::lock_guard<std::mutex> guard(_lock);

    if (isFinished())
    {
        if (result != _result)
            LOG_TST("exitTest got " << name(result) << " but is already finished with "
                                    << name(_result));
        return;
    }

    if (result == TestResult::Ok)
    {
        LOG_TST("SUCCESS: exitTest: " << name(result) << (reason.empty() ? "" : ": " + reason));
    }
    else
    {
        LOG_TST("ERROR: FAILURE: exitTest: " << name(result)
                                             << (reason.empty() ? "" : ": " + reason));

        if (GlobalResult == TestResult::Ok)
            GlobalResult = result;
    }

    _result = result;
    endTest(reason);
    _setRetValue = true;

    // Notify inheritors.
    onExitTest(result, reason);
}

void UnitBase::timeout()
{
    // Don't timeout if we had already finished.
    if (isUnitTesting() && !isFinished())
    {
        LOG_TST("ERROR: Timed out waiting for unit test to complete within "
                << _timeoutMilliSeconds);
        exitTest(TestResult::TimedOut);
    }
}

void UnitBase::returnValue(int& retValue)
{
    if (_setRetValue)
        retValue = (_result == TestResult::Ok ? EX_OK : EX_SOFTWARE);
}

void UnitBase::endTest(const std::string& reason)
{
    LOG_TST("Ending test by stopping SocketPoll [" << _socketPoll->name() << "]: " << reason);
    _socketPoll->joinThread();

    // tell the timeout thread that the work has finished
    TimeoutThreadMutex.unlock();
    if (TimeoutThread.joinable())
        TimeoutThread.join();

    LOG_TST("==================== Finished [" << getTestname() << "] ====================");
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

void UnitWSD::lookupTile(int part, int mode, int width, int height, int tilePosX, int tilePosY,
                         int tileWidth, int tileHeight,
                         std::shared_ptr<TileData> &tile)
{
    if (isUnitTesting())
    {
        if (tile)
            onTileCacheHit(part, mode, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
        else
            onTileCacheMiss(part, mode, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
    }
}

void UnitWSD::DocBrokerDestroy(const std::string& key)
{
    if (isUnitTesting())
    {
        onDocBrokerDestroy(key);
        if (!isFinished())
        {
            // Not yet finished; don't start the next test just yet.
            return;
        }

        // We could be called from either a SocketPoll (websrv_poll)
        // or from invokeTest (coolwsd main).
        std::lock_guard<std::mutex> guard(_lock);

        // Check if we have more tests, but keep the current index if it's the last.
        if (haveMoreTests())
        {
            // We have more tests.
            ++GlobalIndex;
            filter();

            // Clear the shortcuts.
            GlobalKit = nullptr;
            GlobalWSD = nullptr;
            GlobalTool = nullptr;

            if (GlobalArray[GlobalIndex] != nullptr)
            {
                rememberInstance(_type, GlobalArray[GlobalIndex]);

                LOG_TST("Starting test #" << GlobalIndex + 1 << ": "
                                          << GlobalArray[GlobalIndex]->getTestname());
                if (GlobalWSD)
                    GlobalWSD->configure(Poco::Util::Application::instance().config());
                GlobalArray[GlobalIndex]->initialize();

                // Wake-up so the previous test stops.
                SocketPoll::wakeupWorld();
            }
        }
    }
}

UnitWSD& UnitWSD::get()
{
    assert(GlobalWSD);
    return *GlobalWSD;
}

void UnitWSD::onExitTest(TestResult result, const std::string&)
{
    if (haveMoreTests())
    {
        if (result != TestResult::Ok && !GlobalTestOptions.getKeepgoing())
        {
            LOG_TST("Failing fast per options, even though there are more tests");
#if !MOBILEAPP
            LOG_TST("Setting TerminationFlag as the Test Suite failed");
            SigUtil::setTerminationFlag(); // And wakupWorld.
#else
            SocketPoll::wakeupWorld();
#endif
            return;
        }

        LOG_TST("Have more tests. Waiting for the DocBroker to destroy before starting them");
        return;
    }

    // We are done with all the tests.
    TST_LOG_NAME("UnitBase", getTestname()
                                 << " was the last test. Finishing "
                                 << (GlobalResult == TestResult::Ok ? "SUCCESS" : "FAILED"));

#if !MOBILEAPP
    LOG_TST("Setting TerminationFlag as there are no more tests");
    SigUtil::setTerminationFlag(); // And wakupWorld.
#else
    SocketPoll::wakeupWorld();
#endif
}

UnitKit::UnitKit(const std::string& name)
    : UnitBase(name, UnitType::Kit)
{
}

UnitKit::~UnitKit() {}

UnitKit& UnitKit::get()
{
#if MOBILEAPP
    if (!GlobalKit)
        GlobalKit = new UnitKit("UnitKit");
#endif

    assert(GlobalKit);
    return *GlobalKit;
}

void UnitKit::onExitTest(TestResult, const std::string&)
{
    // coolforkit doesn't link with CPPUnit.
    // LOK_ASSERT_MESSAGE("UnitKit doesn't yet support multiple tests", !haveMoreTests());

    // // We are done with all the tests.
    // TST_LOG_NAME("UnitBase", getTestname()
    //                              << " was the last test. Finishing "
    //                              << (GlobalResult == TestResult::Ok ? "SUCCESS" : "FAILED"));

#if !MOBILEAPP
    // LOG_TST("Setting TerminationFlag as there are no more tests");
    SigUtil::setTerminationFlag(); // And wakupWorld.
#else
    SocketPoll::wakeupWorld();
#endif
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
