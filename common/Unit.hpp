/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <atomic>
#include <cassert>
#include <chrono>
#include <memory>
#include <string>
#include <vector>

#include <common/StateEnum.hpp>
#include "Util.hpp"
#include "net/Socket.hpp"

#include <test/testlog.hpp>

class UnitBase;
class UnitWSD;
class UnitKit;
class UnitTimeout;

class ChildProcess;
class WebSocketHandler;
class ClientSession;
class Message;

// Forward declaration to avoid pulling the world here.
namespace Poco
{
    class MemoryInputStream;

    namespace Net
    {
        class HTTPServerRequest;
        class HTTPServerResponse;
    }

    namespace Util
    {
        class LayeredConfiguration;
    }
}

class Session;
class StorageBase;

typedef UnitBase *(CreateUnitHooksFunction)();
typedef UnitBase**(CreateUnitHooksFunctionMulti)();
extern "C" { UnitBase *unit_create_wsd(void); }
extern "C" { UnitBase** unit_create_wsd_multi(void); }
extern "C" { UnitBase *unit_create_kit(void); }
extern "C" { typedef struct _LibreOfficeKit LibreOfficeKit; }

/// Derive your WSD unit test / hooks from me.
class UnitBase
{
    friend UnitTimeout;
    friend UnitWSD;
    friend UnitKit;

public:
    enum class UnitType
    {
        Wsd,
        Kit,
        Tool
    };

protected:
    /// The options used for the current TestSuite.
    class TestOptions
    {
    public:
        TestOptions()
            : _keepgoing(false)
        {
        }

        void setFilter(const std::string& filter) { _filter = filter; }
        const std::string& getFilter() const { return _filter; }

        void setKeepgoing(bool failfase) { _keepgoing = failfase; }
        bool getKeepgoing() const { return _keepgoing; }

    private:
        /// The test filter string. Only run tests that match.
        std::string _filter;
        /// Don't run subsequent tests, if any, on failure.
        bool _keepgoing;
    };

    // ---------------- Helper API ----------------
    /// After this time we invoke 'timeout' default 30 seconds
    void setTimeout(std::chrono::milliseconds timeoutMilliSeconds);

    STATE_ENUM(TestResult, Failed, Ok, TimedOut);

    /// Encourages the process to exit with this value (unless hooked)
    void exitTest(TestResult result, const std::string& reason = std::string());

    /// Fail the test with the given reason.
    void failTest(const std::string& reason)
    {
        exitTest(TestResult::Failed, reason);
    }

    /// Pass the test with the given optional reason.
    void passTest(const std::string& reason = std::string())
    {
        exitTest(TestResult::Ok, reason);
    }

    /// Called when a test has eneded, to clean up.
    virtual void endTest(const std::string& reason);

    /// Construct a UnitBase instance with a default name.
    explicit UnitBase(const std::string& name, UnitType type)
        : _setRetValue(false)
        , _result(TestResult::Ok)
        , _timeoutMilliSeconds(std::chrono::seconds(30))
        , _startTimeMilliSeconds(std::chrono::milliseconds::zero())
        , _type(type)
        , _socketPoll(std::make_shared<SocketPoll>(name))
        , testname(name)
    {
    }

    virtual ~UnitBase();

public:
    /// Load unit test hook shared library from this path
    static bool init(UnitType type, const std::string& unitLibPath);

    /// Uninitialize the unit-test and return the global exit code.
    /// Returns 0 on success.
    static int uninit();

    /// Do we have a unit test library hooking things & loaded
    static bool isUnitTesting();

    /// Tweak the return value from the process.
    virtual void returnValue(int& /* retValue */);

    /// Data-loss detection. Override if expected/intentional.
    /// Returns true if we failed, false otherwise.
    virtual bool onDataLoss(const std::string& reason)
    {
        LOG_TST("onDataLoss: " << reason);
        failTest(reason);
        return failed();
    }

    /// Input message either for WSD or Kit
    virtual bool filterSessionInput(Session *, const char */* buffer */,
                                    int /* length */,
                                    std::unique_ptr< std::vector<char> > & /* replace */)
    {
        return false;
    }

    /// Message that LOKit sent (typically upon receipt in DocBroker).
    /// To override, handle onFilterLOKitMessage.
    /// Returns true to stop processing the message further.
    bool filterLOKitMessage(const std::shared_ptr<Message>& message);

    /// Message that is about to be sent via the websocket.
    /// To override, handle onFilterSendWebSocketMessage or any of the onDocument...() handlers.
    /// Returns true to stop processing the message further.
    bool filterSendWebSocketMessage(const char* data, const std::size_t len, const WSOpCode code,
                                    const bool flush, int& unitReturn);

    /// Hook the disk space check
    virtual bool filterCheckDiskSpace(const std::string & /* path */,
                                      bool & /* newResult */)
    {
        return false;
    }

    /// Trap and filter alerting all users
    virtual bool filterAlertAllusers(const std::string & /* msg */)
    {
        return false;
    }

    /// Custom response to a http request.
    virtual bool handleHttpRequest(const Poco::Net::HTTPRequest& /*request*/,
                                   Poco::MemoryInputStream& /*message*/,
                                   std::shared_ptr<StreamSocket>& /*socket*/)
    {
        return false;
    }

    /// Called when the document has been loaded,
    /// based on the "status:" message, in the context of filterSendWebSocketMessage.
    /// Return true to stop further handling of messages.
    virtual bool onDocumentLoaded(const std::string&) { return false; }

    /// Called when the document's 'modified' status
    /// changes to true.
    /// Return true to stop further handling of messages.
    virtual bool onDocumentModified(const std::string&) { return false; }

    /// Called when the document's 'modified' status
    /// changes to false. This happens after saving.
    /// Return true to stop further handling of messages.
    virtual bool onDocumentUnmodified(const std::string&) { return false; }

    /// Called when the document has been saved.
    /// Return true to stop further handling of messages.
    virtual bool onDocumentSaved(const std::string&, bool, const std::string&) { return false; }

    /// Called when the document has been uploaded.
    virtual void onDocumentUploaded(bool) {}

    /// Called when the document issues a 'statechanged:' message.
    /// Return true to stop further handling of messages.
    virtual bool onDocumentStateChanged(const std::string&) { return false; }

    /// Called when the document issues an 'error:' message.
    /// Return true to stop further handling of messages.
    virtual bool onDocumentError(const std::string&) { return false; }

    /// If the test times out this gets invoked, the default just exits.
    virtual void timeout();

    /// True iff exitTest is called.
    bool isFinished() const { return _setRetValue; }

    /// True iff exitTest was called with anything but TestResult::Ok.
    /// Meaningful only when isFinished() is true.
    bool failed() const { return _result != TestResult::Ok; }

    std::chrono::milliseconds getTimeoutMilliSeconds() const
    {
        return _timeoutMilliSeconds;
    }

    void checkTimeout(const std::chrono::milliseconds elapsedTime)
    {
        if (_startTimeMilliSeconds == std::chrono::milliseconds::zero())
        {
            // Since we can't assume we are the first test to run,
            // we need to capture *out* start so we can correctly
            // calculate how long we've been running.
            _startTimeMilliSeconds = elapsedTime;
        }

        if (isUnitTesting() && !isFinished() &&
            (elapsedTime - _startTimeMilliSeconds) > getTimeoutMilliSeconds())
        {
            LOG_TST("ERROR Test exceeded its time limit of "
                    << getTimeoutMilliSeconds() << ". It's been running for " << elapsedTime);
            timeout();
        }
    }

    static UnitBase& get()
    {
        assert(GlobalArray && GlobalIndex >= 0 && GlobalArray[GlobalIndex] &&
               "There are no tests to dereference");
        return *GlobalArray[GlobalIndex];
    }

    static std::string getUnitLibPath() { return std::string(UnitLibPath); }

    const std::string& getTestname() const { return testname; }
    void setTestname(const std::string& name) { testname = name; }

    std::shared_ptr<SocketPoll> socketPoll() { return _socketPoll; }

private:
    /// Initialize the test.
    virtual void initialize();

    /// Dynamically load the unit-test .so.
    static UnitBase** linkAndCreateUnit(UnitType type, const std::string& unitLibPath);

    /// Initialize the Test Suite options.
    static void initTestSuiteOptions();

    /// Based on COOL_TEST_OPTIONS envar, filter the tests.
    static void filter();

    /// Returns true iff there are more valid test instances to dereference.
    static bool haveMoreTests()
    {
        return GlobalArray && GlobalIndex >= 0 && GlobalArray[GlobalIndex + 1];
    }

    /// Self-test.
    static void selfTest();

    /// Called when a test is finished with the given result and reason.
    virtual void onExitTest(TestResult result, const std::string& reason = std::string()) = 0;

    /// Handles messages from LOKit.
    virtual bool onFilterLOKitMessage(const std::shared_ptr<Message>& /*message*/) { return false; }

    /// Handles messages sent via WebSocket.
    virtual bool onFilterSendWebSocketMessage(const char* /*data*/, const std::size_t /*len*/,
                                              const WSOpCode /* code */, const bool /* flush */,
                                              int& /*unitReturn*/)
    {
        return false;
    }

    static UnitBase* get(UnitType type);

    /// setup global instance for get() method
    static void rememberInstance(UnitType type, UnitBase* instance);

    static void* DlHandle; //< The handle to the unit-test .so.
    static char *UnitLibPath;
    static UnitBase** GlobalArray; //< All the tests.
    static int GlobalIndex; //< The index of the current test.
    static TestOptions GlobalTestOptions; //< The test options for this Test Suite.
    static TestResult GlobalResult; //< The result of all tests. Latches at first failure.

    bool _setRetValue;
    TestResult _result;
    std::chrono::milliseconds _timeoutMilliSeconds;
    /// The time at which this particular test started, relative to the start of the Test Suite.
    std::chrono::milliseconds _startTimeMilliSeconds;
    UnitType _type;

    std::mutex _lock; //< Used to protect cleanup functions.
    std::shared_ptr<SocketPoll> _socketPoll; //< Poll thread for async http comm.

protected:

    /// The name of the current test. Accessed from logs in derived classes.
    std::string testname;
};

struct TileData;

/// Derive your WSD unit test / hooks from me.
class UnitWSD : public UnitBase
{
    bool _hasKitHooks;

public:
    UnitWSD(const std::string& testname);

    virtual ~UnitWSD();

    static UnitWSD& get();

    /// Applies the default config.
    /// This is needed to initialize the logging subsystem early.
    static void defaultConfigure(Poco::Util::LayeredConfiguration& /* config */);

    enum class TestRequest
    {
        Client,
        Prisoner
    };

    /// Do we have hooks for the Kit too
    bool hasKitHooks() { return _hasKitHooks; }
    /// set in your unit if you want to be injected into the kit too.
    void setHasKitHooks() { _hasKitHooks = true; }

    // ---------------- WSD hooks ----------------

    /// Manipulate and modify the configuration before any usage.
    virtual void configure(Poco::Util::LayeredConfiguration& /* config */) {}

    /// Main-loop reached, time for testing.
    /// Invoked from coolwsd's main thread.
    void invokeTest()
    {
        try
        {
            // Invoke the test, expect no exceptions.
            if (!isFinished())
            {
                invokeWSDTest();
            }
        }
        catch (const Poco::Exception& ex)
        {
            LOG_ERR("ERROR: unexpected exception while invoking WSD Test: : "
                    << ex.displayText()
                    << (ex.nested() ? "( " + ex.nested()->displayText() + ')' : ""));
            exitTest(TestResult::Failed);
        }
        catch (const std::exception& ex)
        {
            LOG_TST("ERROR: unexpected exception while invoking WSD Test: " << ex.what());
            exitTest(TestResult::Failed);
        }
        catch (...)
        {
            LOG_TST("ERROR: unexpected unknown exception while invoking WSD Test");
            exitTest(TestResult::Failed);
        }
    }

    /// When a new child kit process reports
    virtual void newChild(const std::shared_ptr<ChildProcess>& /*child*/) {}
    /// Intercept createStorage
    virtual bool createStorage(const Poco::URI& /* uri */,
                               const std::string& /* jailRoot */,
                               const std::string& /* jailPath */,
                               std::unique_ptr<StorageBase>& /* storage */)
    {
        return false;
    }
    /// Child sent a message
    virtual bool filterChildMessage(const std::vector<char>& /* payload */)
    {
        return false;
    }

    // ---------------- TileCache hooks ----------------
    /// Called before the lookupTile call returns. Should always be called to fire events.
    virtual void lookupTile(int part, int mode, int width, int height, int tilePosX, int tilePosY,
                            int tileWidth, int tileHeight,
                            std::shared_ptr<TileData> &tile);

    // ---------------- DocumentBroker hooks ----------------
    virtual bool filterLoad(const std::string& /* sessionId */,
                            const std::string& /* jailId */,
                            bool& /* result */)
    {
        return false;
    }

    /// To force the save operation being handled as auto-save from a unit test.
    virtual bool isAutosave()
    {
        return false;
    }

    /// hook and allow through clipboard authentication
    virtual bool filterClipboardAuth(const std::string & /* serverId */, const std::string &/* tag */)
    {
        return false;
    }

    // ---------------- WSD events ----------------
    virtual void onChildConnected(const int /* pid */, const std::string& /* sessionId */) {}
    /// When admin notify message is sent
    virtual void onAdminNotifyMessage(const std::string& /* message */) {}
    /// When admin message is sent in response to a query
    virtual void onAdminQueryMessage(const std::string& /* message */) {}

    // ---------------- DocBroker events ----------------

    /// Called when a DocumentBroker is created (from the constructor).
    /// Useful to detect track the beginning of a document's life cycle.
    virtual void onDocBrokerCreate(const std::string&) {}

    /// Called when the Kit process is attached to a DocBroker.
    virtual void onDocBrokerAttachKitProcess(const std::string&, int) {}

    /// Called when a new client session is added to a DocumentBroker.
    virtual void onDocBrokerAddSession(const std::string&, const std::shared_ptr<ClientSession>&) {}

    /// Called when a client session is removed to a DocumentBroker.
    virtual void onDocBrokerRemoveSession(const std::string&, const std::shared_ptr<ClientSession>&)
    {
    }

protected:
    /// Called when a DocumentBroker is destroyed (from the destructor).
    /// Useful to detect when unloading was clean and to (re)load again.
    virtual void onDocBrokerDestroy(const std::string&) {}

public:
    /// Called when a DocumentBroker is destroyed (from the destructor).
    /// Useful to detect when unloading was clean and to (re)load again.
    /// Handle by overriding onDocBrokerDestroy.
    void DocBrokerDestroy(const std::string&);

    /// Called when a new view is loaded.
    virtual void onDocBrokerViewLoaded(const std::string&, const std::shared_ptr<ClientSession>&) {}

    // ---------------- TileCache events ----------------
    virtual void onTileCacheHit(int /*part*/, int /*mode*/,
                                int /*width*/, int /*height*/,
                                int /*tilePosX*/, int /*tilePosY*/,
                                int /*tileWidth*/, int /*tileHeight*/) {}
    virtual void onTileCacheMiss(int /*part*/, int /*mode*/,
                                 int /*width*/, int /*height*/,
                                 int /*tilePosX*/, int /*tilePosY*/,
                                 int /*tileWidth*/, int /*tileHeight*/) {}
    virtual void onTileCacheSubscribe(int /*part*/, int /*mode*/,
                                      int /*width*/, int /*height*/,
                                      int /*tilePosX*/, int /*tilePosY*/,
                                      int /*tileWidth*/, int /*tileHeight*/) {}
private:
    /// The actual test implementation.
    virtual void invokeWSDTest() {}

    void onExitTest(TestResult result, const std::string& reason = std::string()) override;
};

/// Derive your Kit unit test / hooks from me.
class UnitKit : public UnitBase
{
public:
    explicit UnitKit(const std::string& testname);
    virtual ~UnitKit();
    static UnitKit& get();

    // ---------------- ForKit hooks ----------------

    /// main-loop reached, time for testing
    virtual void invokeForKitTest() {}

    /// Post fork hook - just after we fork to init the child kit
    virtual void launchedKit(int /* pid */) {}

    // ---------------- Kit hooks ----------------

    /// Post fork hook - just before we init the child kit
    virtual void postFork() {}

    /// Kit got a message
    virtual bool filterKitMessage(WebSocketHandler *, std::string &/* message */ )
    {
        return false;
    }

    /// LOKit (and some synthetic internal) callbacks
    virtual bool filterLoKitCallback(const int /* type */, const std::string& /* payload */)
    {
        return false;
    }

    /// Allow a custom LibreOfficeKit wrapper
    virtual LibreOfficeKit *lok_init(const char * /* instdir */,
                                     const char * /* userdir */)
    {
        return nullptr;
    }

private:
    void onExitTest(TestResult result, const std::string& reason = std::string()) override;
};

/// Derive your Tool unit test / hooks from me.
class UnitTool : public UnitBase
{
public:
    explicit UnitTool(const std::string& name)
        : UnitBase(name, UnitType::Tool)
    {
    }

private:
    void onExitTest(TestResult, const std::string& = std::string()) override {}
};

/// Transition the test state of VAR to STATE, with a prefix message, and resume the test.
/// This will wake up all polls and the new state may be processed in parallel.
#define TRANSITION_STATE_MSG(VAR, STATE, MSG)                                                      \
    do                                                                                             \
    {                                                                                              \
        LOG_TST(MSG << ' ' << name(VAR) << " -> " #STATE);                                         \
        VAR = STATE;                                                                               \
        SocketPoll::wakeupWorld();                                                                 \
    } while (false)

/// Transition the test state of VAR to STATE and resume the test.
/// This will wake up all polls and the new state may be processed in parallel.
#define TRANSITION_STATE(VAR, STATE) TRANSITION_STATE_MSG(VAR, STATE, "Transitioning " #VAR " from")

#define LOK_ASSERT_STATE(VAR, STATE)                                                               \
    LOK_ASSERT_MESSAGE("Expected " #VAR " to be in " #STATE " but was " + toString(VAR),           \
                       VAR == STATE)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
