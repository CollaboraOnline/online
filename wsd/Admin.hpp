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

class Admin;

/// Admin requests over HTTP(S) handler.
class AdminRequestHandler : public Poco::Net::HTTPRequestHandler
{
public:
    AdminRequestHandler(Admin* adminManager);

    void handleRequest(Poco::Net::HTTPServerRequest& request, Poco::Net::HTTPServerResponse& response) override;

private:
    void handleWSRequests(Poco::Net::HTTPServerRequest& request, Poco::Net::HTTPServerResponse& response, int nSessionId);

    void sendTextFrame(const std::string& message);

    bool adminCommandHandler(const std::vector<char>& payload);

private:
    Admin* _admin;
    std::shared_ptr<LOOLWebSocket> _adminWs;
    int _sessionId;
    bool _isAuthenticated;
};

/// An admin command processor.
class Admin
{
public:
    virtual ~Admin();

    static Admin& instance()
    {
        static Admin admin;
        return admin;
    }

    unsigned getTotalMemoryUsage(AdminModel&);

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

    static AdminRequestHandler* createRequestHandler()
    {
        return new AdminRequestHandler(&instance());
    }

    std::unique_lock<std::mutex> getLock() { return std::unique_lock<std::mutex>(_modelMutex); }

private:
    Admin();

private:
    AdminModel _model;
    std::mutex _modelMutex;
    int _forKitPid;

    Poco::Util::Timer _memStatsTimer;
    Poco::Util::TimerTask::Ptr _memStatsTask;
    unsigned _memStatsTaskInterval = 5000;

    Poco::Util::Timer _cpuStatsTimer;
    Poco::Util::TimerTask::Ptr _cpuStatsTask;
    unsigned _cpuStatsTaskInterval = 5000;
};

/// Memory statistics.
class MemoryStats : public Poco::Util::TimerTask
{
public:
    MemoryStats(Admin* admin)
        : _admin(admin),
          _lastTotalMemory(0)
    {
        Log::debug("Memory stat ctor");
    }

    ~MemoryStats()
    {
        Log::debug("Memory stat dtor");
    }

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
        Log::debug("Cpu stat ctor");
    }

    ~CpuStats()
    {
        Log::debug("Cpu stat dtor");
    }

    void run() override;

private:
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
