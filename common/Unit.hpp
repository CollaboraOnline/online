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

class WebSocketHandler;
class ClientSession;

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
extern "C" { UnitBase *unit_create_wsd(void); }
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
    // ---------------- Helper API ----------------
    /// After this time we invoke 'timeout' default 30 seconds
    void setTimeout(std::chrono::milliseconds timeoutMilliSeconds);

    enum class TestResult
    {
        Failed,
        Ok,
        TimedOut
    };

    static const std::string testResultAsString(TestResult res)
    {
        switch (res)
        {
            case TestResult::Failed:
                return "Failed";
            case TestResult::Ok:
                return "Ok";
            case TestResult::TimedOut:
                return "TimedOut";
        }

        assert(!"Unknown TestResult entry.");
        return std::to_string(static_cast<int>(res));
    }

    /// Encourages the process to exit with this value (unless hooked)
    void exitTest(TestResult result);

    /// Fail the test with the given reason.
    void failTest(const std::string& reason)
    {
        LOG_TST("FAILURE: " << getTestname() << " finished: " << reason);
        exitTest(TestResult::Failed);
    }

    /// Pass the test with the given optional reason.
    void passTest(const std::string& reason = std::string())
    {
        LOG_TST("SUCCESS: " << getTestname() << " finished: " << reason);
        exitTest(TestResult::Ok);
    }

    /// Construct a UnitBase instance with a default name.
    explicit UnitBase(const std::string& name, UnitType type)
        : _dlHandle(nullptr)
        , _setRetValue(false)
        , _retValue(0)
        , _timeoutMilliSeconds(std::chrono::seconds(30))
        , _type(type)
        , _socketPoll(std::make_shared<SocketPoll>(name))
        , testname(name)
    {
    }

    virtual ~UnitBase();

public:
    /// Load unit test hook shared library from this path
    static bool init(UnitType type, const std::string& unitLibPath);

    /// Do we have a unit test library hooking things & loaded
    static bool isUnitTesting();

    /// Tweak the return value from the process.
    virtual void returnValue(int& /* retValue */);

    /// Trigger a failure due to any reason.
    virtual void fail(const std::string& reason)
    {
        failTest(reason);
    }

    /// Input message either for WSD or Kit
    virtual bool filterSessionInput(Session *, const char */* buffer */,
                                    int /* length */,
                                    std::unique_ptr< std::vector<char> > & /* replace */)
    {
        return false;
    }

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

    /// Called when the document has been saved.
    /// Return true to stop further handling of messages.
    virtual bool onDocumentSaved(const std::string&, bool, const std::string&) { return false; }

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
    bool failed() const { return _retValue; }

    std::chrono::milliseconds getTimeoutMilliSeconds() const
    {
        return _timeoutMilliSeconds;
    }

    void checkTimeout(const std::chrono::milliseconds elapsedTime)
    {
        if (isUnitTesting() && !isFinished() && elapsedTime > getTimeoutMilliSeconds())
        {
            LOG_TST("ERROR Test exceeded its time limit of "
                    << getTimeoutMilliSeconds() << ". It's been running for " << elapsedTime);
            timeout();
        }
    }

    static UnitBase& get()
    {
        assert(Global);
        return *Global;
    }

    static std::string getUnitLibPath() { return std::string(UnitLibPath); }

    const std::string& getTestname() const { return testname; }
    void setTestname(const std::string& name) { testname = name; }

    std::shared_ptr<SocketPoll> socketPoll() { return _socketPoll; }

private:
    void setHandle(void *dlHandle)
    {
        assert(_dlHandle == nullptr && "setHandle must only be called once");
        assert(dlHandle != nullptr && "Invalid handle to set");
        _dlHandle = dlHandle;
        _socketPoll->startThread();
    }
    static UnitBase *linkAndCreateUnit(UnitType type, const std::string& unitLibPath);

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

    void *_dlHandle;
    static char *UnitLibPath;
    bool _setRetValue;
    int _retValue;
    std::chrono::milliseconds _timeoutMilliSeconds;
    static UnitBase *Global;
    UnitType _type;

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

    virtual void returnValue(int& /* retValue */);

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
    virtual void configure(Poco::Util::LayeredConfiguration& /* config */);

    /// Main-loop reached, time for testing.
    /// Invoked from coolwsd's main thread.
    void invokeTest()
    {
        try
        {
            // Invoke the test, expect no exceptions.
            invokeWSDTest();
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
    virtual void newChild(WebSocketHandler &/* socket */) {}
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
    virtual void lookupTile(int part, int width, int height, int tilePosX, int tilePosY,
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

    /// Called when a DocumentBroker is destroyed (from the destructor).
    /// Useful to detect when unloading was clean and to (re)load again.
    virtual void onDocBrokerDestroy(const std::string&) {}

    // ---------------- TileCache events ----------------
    virtual void onTileCacheHit(int /*part*/, int /*width*/, int /*height*/,
                                int /*tilePosX*/, int /*tilePosY*/,
                                int /*tileWidth*/, int /*tileHeight*/) {}
    virtual void onTileCacheMiss(int /*part*/, int /*width*/, int /*height*/,
                                 int /*tilePosX*/, int /*tilePosY*/,
                                 int /*tileWidth*/, int /*tileHeight*/) {}
    virtual void onTileCacheSubscribe(int /*part*/, int /*width*/, int /*height*/,
                                      int /*tilePosX*/, int /*tilePosY*/,
                                      int /*tileWidth*/, int /*tileHeight*/) {}
private:
    /// The actual test implementation.
    virtual void invokeWSDTest() {}
};

/// Derive your Kit unit test / hooks from me.
class UnitKit : public UnitBase
{
public:
    explicit UnitKit(const std::string& testname);
    virtual ~UnitKit();
    static UnitKit& get();

    virtual void returnValue(int& /* retValue */);

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
};

/// Derive your Tool unit test / hooks from me.
class UnitTool : public UnitBase
{
public:
    explicit UnitTool(const std::string& name)
        : UnitBase(name, UnitType::Tool)
    {
    }
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
