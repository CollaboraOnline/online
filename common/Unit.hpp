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

#include <atomic>
#include <cassert>
#include <memory>
#include <string>

#include <LOOLWebSocket.hpp>
#include "net/WebSocketHandler.hpp"

class UnitBase;
class UnitWSD;
class UnitKit;
class UnitTimeout;
class UnitHTTPServerRequest;
class UnitHTTPServerResponse;

// Forward declaration to avoid pulling the world here.
namespace Poco
{
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

protected:
    // ---------------- Helper API ----------------
    /// After this time we invoke 'timeout' default 30 seconds
    void setTimeout(int timeoutMilliSeconds);

    enum class TestResult
    {
        Failed,
        Ok,
        TimedOut
    };

    /// Encourages the process to exit with this value (unless hooked)
    void exitTest(TestResult result);

    UnitBase();
    virtual ~UnitBase();

public:
    enum class UnitType
    {
        Wsd,
        Kit
    };
    /// Load unit test hook shared library from this path
    static bool init(UnitType type, const std::string& unitLibPath);

    /// Do we have a unit test library hooking things & loaded
    static bool isUnitTesting();

    /// Tweak the return value from the process.
    virtual void returnValue(int& /* retValue */);

    /// Input message either for WSD or Kit
    virtual bool filterSessionInput(Session *, const char */* buffer */,
                                    int /* length */,
                                    std::unique_ptr< std::vector<char> > & /* replace */)
    {
        return false;
    }

    /// Hook the disk space check
    virtual bool filterCheckDiskSpace(const std::string & /* path */,
                                      bool & /* newResult */)
    {
        return false;
    }

    /// If the test times out this gets invoked, the default just exits.
    virtual void timeout();

    int getTimeoutMilliSeconds() const
    {
        return _timeoutMilliSeconds;
    }

    static UnitBase& get()
    {
        assert(Global);
        return *Global;
    }

private:
    void setHandle(void *dlHandle) { _dlHandle = dlHandle; }
    static UnitBase *linkAndCreateUnit(UnitType type, const std::string& unitLibPath);

    void *_dlHandle;
    bool _setRetValue;
    int _retValue;
    int _timeoutMilliSeconds;
    std::atomic<bool> _timeoutShutdown;
    static UnitBase *Global;
    UnitType _type;
};

/// Derive your WSD unit test / hooks from me.
class UnitWSD : public UnitBase
{
    bool _hasKitHooks;

public:
    UnitWSD();
    virtual ~UnitWSD();

    static UnitWSD& get()
    {
        assert(Global && Global->_type == UnitType::Wsd);
        return *static_cast<UnitWSD *>(Global);
    }

    enum class TestRequest
    {
        Client,
        Prisoner
    };
    /// Simulate an incoming request
    static void testHandleRequest(TestRequest type,
                                  UnitHTTPServerRequest& request,
                                  UnitHTTPServerResponse& response);
    /// Do we have hooks for the Kit too
    bool hasKitHooks() { return _hasKitHooks; }
    /// set in your unit if you want to be injected into the kit too.
    void setHasKitHooks() { _hasKitHooks = true; }

    // ---------------- WSD hooks ----------------

    /// Manipulate and modify the configuration before any usage.
    virtual void configure(Poco::Util::LayeredConfiguration& /* config */);
    /// Main-loop reached, time for testing
    virtual void invokeTest() {}
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
    /// Intercept incoming requests, so unit tests can silently communicate
    virtual bool filterHandleRequest(
        TestRequest /* type */,
        SocketDisposition & /* disposition */,
        WebSocketHandler & /* handler */)
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
                            int tileWidth, int tileHeight, std::unique_ptr<std::fstream>& cacheFile);

    // ---------------- DocumentBroker hooks ----------------
    virtual bool filterLoad(const std::string& /* sessionId */,
                            const std::string& /* jailId */,
                            bool& /* result */)
    {
        return false;
    }

    // ---------------- WSD events ----------------
    virtual void onChildConnected(const int /* pid */, const std::string& /* sessionId */) {}
    /// When admin notify message is sent
    virtual void onAdminNotifyMessage(const std::string& /* message */) {}
    /// When admin message is sent in response to a query
    virtual void onAdminQueryMessage(const std::string& /* message */) {}

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
};

/// Derive your Kit unit test / hooks from me.
class UnitKit : public UnitBase
{
public:
    UnitKit();
    virtual ~UnitKit();
    static UnitKit& get()
    {
        assert(Global && Global->_type == UnitType::Kit);
        return *static_cast<UnitKit *>(Global);
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
    virtual bool filterKitMessage(const std::shared_ptr<LOOLWebSocket>& /* ws */,
                                  std::string& /* message */)
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

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
