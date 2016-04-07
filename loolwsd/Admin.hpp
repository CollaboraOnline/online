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

#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPRequestHandler.h>
#include <Poco/Net/HTTPServer.h>
#include <Poco/Runnable.h>
#include <Poco/Types.h>
#include <Poco/Util/Timer.h>
#include <Poco/Util/TimerTask.h>

#include "AdminModel.hpp"

class Admin;

class AdminRequestHandler: public Poco::Net::HTTPRequestHandler
{
public:
    AdminRequestHandler(Admin* adminManager);

    void handleRequest(Poco::Net::HTTPServerRequest& request, Poco::Net::HTTPServerResponse& response) override;

private:
    void handleWSRequests(Poco::Net::HTTPServerRequest& request, Poco::Net::HTTPServerResponse& response, int nSessionId);

private:
    Admin* _admin;
};

/// An admin command processor.
class Admin : public Poco::Runnable
{
public:
    virtual ~Admin();

    static Admin& instance()
    {
        static Admin admin;
        return admin;
    }

    unsigned getTotalMemoryUsage(AdminModel&);

    void run() override;

    /// Update the Admin Model.
    void update(const std::string& message);

    /// Set the forkit process id.
    void setForKitPid(const int forKitPid) { _forKitPid = forKitPid; }

    /// Callers must ensure that modelMutex is acquired
    AdminModel& getModel();

    unsigned getMemStatsInterval();

    unsigned getCpuStatsInterval();

    void rescheduleMemTimer(unsigned interval);

    void rescheduleCpuTimer(unsigned interval);

    static
    AdminRequestHandler* createRequestHandler()
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

class MemoryStats : public Poco::Util::TimerTask
{
public:
    MemoryStats(Admin* admin)
        : _admin(admin)
    {
        Log::info("Memory stat ctor");
    }

    ~MemoryStats()
    {
        Log::info("Memory stat dtor");
    }

    void run() override;

private:
    Admin* _admin;
};

class CpuStats : public Poco::Util::TimerTask
{
public:
    CpuStats(Admin* /*admin*/)
    {
        Log::info("Cpu stat ctor");
    }

    ~CpuStats()
    {
        Log::info("Cpu stat dtor");
    }

    void run() override;

private:
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
