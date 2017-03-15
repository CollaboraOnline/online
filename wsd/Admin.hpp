/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_ADMIN_HPP
#define INCLUDED_ADMIN_HPP

#include <mutex>

#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPRequestHandler.h>
#include <Poco/Net/HTTPServer.h>
#include <Poco/Runnable.h>
#include <Poco/Types.h>
#include <Poco/Util/Timer.h>
#include <Poco/Util/TimerTask.h>

#include "AdminModel.hpp"
#include "Log.hpp"
#include <LOOLWebSocket.hpp>

#include "net/WebSocketHandler.hpp"

class Admin;

/// Handle admin client's Websocket requests & replies.
class AdminRequestHandler : public WebSocketHandler
{
public:
    AdminRequestHandler(Admin* adminManager,
                        const std::weak_ptr<StreamSocket>& socket,
                        const Poco::Net::HTTPRequest& request);

    /// Handle the initial Admin WS upgrade request.
    /// @returns true if we should give this socket to the Admin poll.
    static bool handleInitialRequest(const std::weak_ptr<StreamSocket> &socket,
                                     const Poco::Net::HTTPRequest& request);

private:
    void handleWSRequests(Poco::Net::HTTPServerRequest& request, Poco::Net::HTTPServerResponse& response, int sessionId);

    void sendTextFrame(const std::string& message);

    /// Process incoming websocket messages
    void handleMessage(bool fin, WSOpCode code, std::vector<char> &data);

private:
    Admin* _admin;
//    std::shared_ptr<LOOLWebSocket> _adminWs; FIXME - this is us now !
    int _sessionId;
    bool _isAuthenticated;
};

class MemoryStatsTask;

/// An admin command processor.
class Admin : public SocketPoll
{
    Admin();
public:
    virtual ~Admin();

    static Admin& instance()
    {
        static Admin admin;
        return admin;
    }

    void start()
    {
        // FIXME: not if admin console is not enabled ?
        startThread();
    }

    unsigned getTotalMemoryUsage();

    /// Update the Admin Model.
    void update(const std::string& message);

    /// Calls with same pid will increment view count, if pid already exists
    void addDoc(const std::string& docKey, Poco::Process::PID pid, const std::string& filename, const std::string& sessionId);

    /// Decrement view count till becomes zero after which doc is removed
    void rmDoc(const std::string& docKey, const std::string& sessionId);

    /// Remove the document with all views. Used on termination or catastrophic failure.
    void rmDoc(const std::string& docKey);

    void setForKitPid(const int forKitPid) { _forKitPid = forKitPid; }

    /// Callers must ensure that modelMutex is acquired
    AdminModel& getModel();

    unsigned getMemStatsInterval();

    unsigned getCpuStatsInterval();

    void rescheduleMemTimer(unsigned interval);

    void rescheduleCpuTimer(unsigned interval);

    std::unique_lock<std::mutex> getLock() { return std::unique_lock<std::mutex>(_modelMutex); }

    void updateLastActivityTime(const std::string& docKey);
    void updateMemoryDirty(const std::string& docKey, int dirty);

    void dumpState(std::ostream& os) override;

private:
    AdminModel _model;
    std::mutex _modelMutex;
    int _forKitPid;

    Poco::Util::Timer _memStatsTimer;
    Poco::AutoPtr<MemoryStatsTask> _memStatsTask;
    unsigned _memStatsTaskInterval = 5000;

    Poco::Util::Timer _cpuStatsTimer;
    Poco::Util::TimerTask::Ptr _cpuStatsTask;
    unsigned _cpuStatsTaskInterval = 5000;
};

/// Memory statistics.
class MemoryStatsTask : public Poco::Util::TimerTask
{
public:
    MemoryStatsTask(Admin* admin)
        : _admin(admin),
          _lastTotalMemory(0)
    {
        LOG_DBG("Memory stat ctor");
    }

    ~MemoryStatsTask()
    {
        LOG_DBG("Memory stat dtor");
    }

    long getLastTotalMemory() { return _lastTotalMemory; }

    void run() override;

private:
    Admin* _admin;
    long _lastTotalMemory;
};

/// CPU statistics.
class CpuStats : public Poco::Util::TimerTask
{
public:
    CpuStats(Admin* /*admin*/)
    {
        LOG_DBG("Cpu stat ctor");
    }

    ~CpuStats()
    {
        LOG_DBG("Cpu stat dtor");
    }

    void run() override;

private:
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
