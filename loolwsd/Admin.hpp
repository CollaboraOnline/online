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

const std::string FIFO_NOTIFY = "loolnotify.fifo";

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
    Admin(const Poco::Process::PID brokerPid, const int notifyPipe);

    ~Admin();

    static int getBrokerPid() { return Admin::BrokerPid; }

    unsigned getTotalMemoryUsage(AdminModel&);

    void run() override;

    /// Callers must ensure that modelMutex is acquired
    AdminModel& getModel();

    unsigned getMemStatsInterval();

    unsigned getCpuStatsInterval();

    void rescheduleMemTimer(unsigned interval);

    void rescheduleCpuTimer(unsigned interval);

    AdminRequestHandler* createRequestHandler();

public:
    std::mutex _modelMutex;

private:
    void handleInput(std::string& message);

private:
    AdminModel _model;

    Poco::Util::Timer _memStatsTimer;
    Poco::Util::TimerTask::Ptr _memStatsTask;
    unsigned _memStatsTaskInterval = 5000;

    Poco::Util::Timer _cpuStatsTimer;
    Poco::Util::TimerTask::Ptr _cpuStatsTask;
    unsigned _cpuStatsTaskInterval = 5000;

    static Poco::Process::PID BrokerPid;
    static int BrokerPipe;
    static int NotifyPipe;
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
    Admin* _admin;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
