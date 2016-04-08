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

class UnitHooks;
class UnitTimeout;
class UnitHTTPServerRequest;
class UnitHTTPServerResponse;

class StorageBase;

#define CREATE_UNIT_HOOKS_SYMBOL "unit_create"
typedef UnitHooks *(CreateUnitHooksFunction)();
extern "C" { UnitHooks *unit_create(void); }

/// Derive your unit test / hooks from me.
class UnitHooks
{
    friend UnitTimeout;

    void *_dlHandle;
    bool _setRetValue;
    int  _retValue;
    int  _timeoutMilliSeconds;
    std::atomic<bool> _timeoutShutdown;
    static UnitHooks *_global;

    void setHandle(void *dlHandle) { _dlHandle = dlHandle; }
    static UnitHooks *linkAndCreateUnit(const std::string &unitLibPath);
protected:

    // ---------------- Helper API ----------------

    /// After this time we invoke 'timeout' default 30 seconds
    void setTimeout(int timeoutMilliSeconds);

    enum TestResult { TEST_FAILED, TEST_OK, TEST_TIMED_OUT };
    /// Encourages loolwsd to exit with this value (unless hooked)
    void exitTest(TestResult result);

    enum TestRequest { TEST_REQ_CLIENT, TEST_REQ_PRISONER };
    /// Simulate an incoming request
    void testHandleRequest(TestRequest type,
                           UnitHTTPServerRequest& request,
                           UnitHTTPServerResponse& response);

public:
             UnitHooks();
    virtual ~UnitHooks();
	static UnitHooks &get() { return *_global; }
    /// Load unit test hook shared library from this path
    static bool init(const std::string &unitLibPath);

    // ---------------- Hooks ----------------

    /// Main-loop reached, time for testing
    virtual void invokeTest() {}
    /// Tweak the count of pre-spawned kits.
	virtual void preSpawnCount(int & /* numPrefork */) {}
    /// Tweak the return value from LOOLWSD.
	virtual void returnValue(int & /* retValue */);
    /// When a new child kit process reports
    virtual void newChild() {}
    /// If the test times out this gets invoked, default exits.
    virtual void timeout();
    /// Intercept createStorage
    virtual bool createStorage(const std::string& /* jailRoot */,
                               const std::string& /* jailPath */,
                               const Poco::URI& /* uri */,
                               std::unique_ptr<StorageBase> & /*rStorage */) { return false; }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
