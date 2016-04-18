/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
#ifndef INCLUDED_UNIT_HPP
#define INCLUDED_UNIT_HPP

#include <string>
#include <memory>
#include <atomic>
#include <assert.h>

#include <Poco/Net/WebSocket.h>

class UnitBase;
class UnitWSD;
class UnitKit;
class UnitTimeout;
class UnitHTTPServerRequest;
class UnitHTTPServerResponse;

// Forward declaration to avoid pulling the world here.
namespace Poco {
    namespace Net {
        class HTTPServerRequest;
        class HTTPServerResponse;
    }

    namespace Util {
        class LayeredConfiguration;
    }
}

class StorageBase;

typedef UnitBase *(CreateUnitHooksFunction)();
extern "C" { UnitBase *unit_create_wsd(void); }
extern "C" { UnitBase *unit_create_kit(void); }

/// Derive your WSD unit test / hooks from me.
class UnitBase
{
    friend UnitTimeout;
    friend UnitWSD;
    friend UnitKit;

protected:

    // ---------------- Helper API ----------------
    /// After this time we invoke 'timeout' default 30 seconds
    void setTimeout(int timeoutMilliSeconds);

    /// If the test times out this gets invoked, the default just exits.
    virtual void timeout();

    enum TestResult { TEST_FAILED, TEST_OK, TEST_TIMED_OUT };

    /// Encourages the process to exit with this value (unless hooked)
    void exitTest(TestResult result);

             UnitBase();
    virtual ~UnitBase();

public:
    enum UnitType { TYPE_WSD, TYPE_KIT };
    /// Load unit test hook shared library from this path
    static bool init(UnitType type, const std::string &unitLibPath);

    /// Tweak the return value from the process.
	virtual void returnValue(int & /* retValue */);

private:
    void setHandle(void *dlHandle) { _dlHandle = dlHandle; }
    static UnitBase *linkAndCreateUnit(UnitType type, const std::string &unitLibPath);

    void *_dlHandle;
    bool _setRetValue;
    int  _retValue;
    int  _timeoutMilliSeconds;
    std::atomic<bool> _timeoutShutdown;
    static UnitBase *_global;
    UnitType _type;
};

/// Derive your WSD unit test / hooks from me.
class UnitWSD : public UnitBase
{
    bool _hasKitHooks;
public:
             UnitWSD();
    virtual ~UnitWSD();

	static UnitWSD &get()
    {
        assert (_global && _global->_type == UnitType::TYPE_WSD);
        return *static_cast<UnitWSD *>(_global);
    }

    enum TestRequest { TEST_REQ_CLIENT, TEST_REQ_PRISONER };
    /// Simulate an incoming request
    void testHandleRequest(TestRequest type,
                           UnitHTTPServerRequest& request,
                           UnitHTTPServerResponse& response);
    /// Do we have hooks for the Kit too
    bool hasKitHooks() { return _hasKitHooks; }
    /// set in your unit if you want to be injected into the kit too.
    void setHasKitHooks(bool hasHooks = true) { _hasKitHooks = hasHooks; }

    // ---------------- WSD hooks ----------------

    /// Manipulate and modify the configuration before any usage.
    virtual void configure(Poco::Util::LayeredConfiguration & /* config */) {}
    /// Main-loop reached, time for testing
    virtual void invokeTest() {}
    /// Tweak the count of pre-spawned kits.
    virtual void preSpawnCount(int & /* numPrefork */) {}
    /// When a new child kit process reports
    virtual void newChild(const std::shared_ptr<Poco::Net::WebSocket> & /* socket */) {}
    /// Intercept createStorage
    virtual bool createStorage(const std::string& /* jailRoot */,
                               const std::string& /* jailPath */,
                               const Poco::URI& /* uri */,
                               std::unique_ptr<StorageBase> & /*rStorage */)
        { return false; }
    /// Intercept incoming requests, so unit tests can silently communicate
    virtual bool filterHandleRequest(
                     TestRequest /* type */,
                     Poco::Net::HTTPServerRequest& /* request */,
                     Poco::Net::HTTPServerResponse& /* response */)
        { return false; }

    // ---------------- WSD events ----------------
    virtual void onChildConnected(const int /* pid */, const std::string& /* sessionId */) {}
    /// When admin notify message is sent
    virtual void onAdminNotifyMessage(const std::string& /* message */) {}
    /// When admin message is sent in response to a query
    virtual void onAdminQueryMessage(const std::string& /* message */) {}
};

/// Derive your Kit unit test / hooks from me.
class UnitKit : public UnitBase
{
public:
             UnitKit();
    virtual ~UnitKit();
	static UnitKit &get()
    {
        assert (_global && _global->_type == UnitType::TYPE_KIT);
        return *static_cast<UnitKit *>(_global);
    }

    // ---------------- ForKit hooks ----------------

    /// main-loop reached, time for testing
    virtual void invokeForKitTest() {}

    /// Post fork hook - just after we fork to init the child kit
    virtual void launchedKit(int /* pid */) {}

    // ---------------- Kit hooks ----------------

    /// Post fork hook - just before we init the child kit
    virtual void postFork() {}

    /// Kit got a message
    virtual bool filterKitMessage(const std::shared_ptr<Poco::Net::WebSocket> & /* ws */,
                                  std::string &/* message */)
        { return false; }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
