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

#include "AdminModel.hpp"
#include "Log.hpp"

#include "net/WebSocketHandler.hpp"
#include "LOOLWSD.hpp"

class Admin;

/// Handle admin client's Websocket requests & replies.
class AdminSocketHandler : public WebSocketHandler
{
public:
    /// Client connection to remote amdin socket
    AdminSocketHandler(Admin* adminManager);

    /// Connection from remote admin socket
    AdminSocketHandler(Admin* adminManager,
                       const std::weak_ptr<StreamSocket>& socket,
                       const Poco::Net::HTTPRequest& request);

    /// Handle the initial Admin WS upgrade request.
    /// @returns true if we should give this socket to the Admin poll.
    static bool handleInitialRequest(const std::weak_ptr<StreamSocket> &socket,
                                     const Poco::Net::HTTPRequest& request);

    static void subscribeAsync(const std::shared_ptr<AdminSocketHandler>& handler);

    /// Process incoming websocket messages
    void handleMessage(const std::vector<char> &data) override;

private:
    /// Sends text frames simply to authenticated clients.
    void sendTextFrame(const std::string& message);

private:
    Admin* _admin;
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

    void start();

    /// Custom poll thread function
    void pollingThread() override;

    size_t getTotalMemoryUsage();
    /// Takes into account the 'memproportion' property in config file to find the amount of memory
    /// available to us.
    size_t getTotalAvailableMemory() { return _totalAvailMemKb; }
    size_t getTotalCpuUsage();

    void modificationAlert(const std::string& dockey, Poco::Process::PID pid, bool value);
    /// Update the Admin Model.
    void update(const std::string& message);

    /// Calls with same pid will increment view count, if pid already exists
    void addDoc(const std::string& docKey, Poco::Process::PID pid, const std::string& filename, const std::string& sessionId, const std::string& userName, const std::string& userId);

    /// Decrement view count till becomes zero after which doc is removed
    void rmDoc(const std::string& docKey, const std::string& sessionId);

    /// Remove the document with all views. Used on termination or catastrophic failure.
    void rmDoc(const std::string& docKey);

    void setForKitPid(const int forKitPid) { _forKitPid = forKitPid; _model.setForKitPid(forKitPid);}

    /// Callers must ensure that modelMutex is acquired
    AdminModel& getModel();

    unsigned getMemStatsInterval();

    unsigned getCpuStatsInterval();

    unsigned getNetStatsInterval();

    void rescheduleMemTimer(unsigned interval);

    void rescheduleCpuTimer(unsigned interval);

    void updateLastActivityTime(const std::string& docKey);
    void updateMemoryDirty(const std::string& docKey, int dirty);
    void addBytes(const std::string& docKey, uint64_t sent, uint64_t recv);

    void dumpState(std::ostream& os) override;

    const DocProcSettings& getDefDocProcSettings() const { return _defDocProcSettings; }
    void setDefDocProcSettings(const DocProcSettings& docProcSettings, bool notifyKit)
    {
        _defDocProcSettings = docProcSettings;
        if (notifyKit)
            notifyForkit();
    }

    /// Attempt a synchronous connection to a monitor with @uri @when that future comes
    void scheduleMonitorConnect(const std::string &uri, std::chrono::steady_clock::time_point when);

    void sendMetrics(const std::shared_ptr<StreamSocket>& socket, const std::shared_ptr<Poco::Net::HTTPResponse>& response);
    void sendMetricsAsync(const std::shared_ptr<StreamSocket>& socket, const std::shared_ptr<Poco::Net::HTTPResponse>& response);

    void setViewLoadDuration(const std::string& docKey, const std::string& sessionId, std::chrono::milliseconds viewLoadDuration);
    void setDocWopiDownloadDuration(const std::string& docKey, std::chrono::milliseconds wopiDownloadDuration);
    void setDocWopiUploadDuration(const std::string& docKey, const std::chrono::milliseconds uploadDuration);

    void getMetrics(std::ostringstream &metrics);

private:
    /// Notify Forkit of changed settings.
    void notifyForkit();

    /// Memory consumption has increased, start killing kits etc. till memory consumption gets back
    /// under @hardModeLimit
    void triggerMemoryCleanup(size_t hardModeLimit);

    /// Round the interval up to multiples of MinStatsIntervalMs.
    /// This is to avoid arbitrarily small intervals that hammer the server.
    static int capAndRoundInterval(const unsigned interval)
    {
        const int value = std::max<int>(interval, MinStatsIntervalMs);
        return ((value + MinStatsIntervalMs - 1) / MinStatsIntervalMs) * MinStatsIntervalMs;
    }

    /// Synchronous connection setup to remote monitoring server
    void connectToMonitorSync(const std::string &uri);

private:
    /// The model is accessed only during startup & in
    /// the Admin Poll thread.
    AdminModel _model;
    int _forKitPid;
    size_t _lastTotalMemory;
    size_t _lastJiffies;
    uint64_t _lastSentCount;
    uint64_t _lastRecvCount;
    size_t _totalSysMemKb;
    size_t _totalAvailMemKb;

    struct MonitorConnectRecord
    {
        void setWhen(std::chrono::steady_clock::time_point when) { _when = when; }
        std::chrono::steady_clock::time_point getWhen() const { return _when; }

        void setUri(const std::string& uri) { _uri = uri; }
        std::string getUri() const { return _uri; }

    private:
        std::chrono::steady_clock::time_point _when;
        std::string _uri;
    };
    std::vector<MonitorConnectRecord> _pendingConnects;

    std::atomic<int> _cpuStatsTaskIntervalMs;
    std::atomic<int> _memStatsTaskIntervalMs;
    std::atomic<int> _netStatsTaskIntervalMs;
    DocProcSettings _defDocProcSettings;

    // Don't update any more frequently than this since it's excessive.
    static const int MinStatsIntervalMs;
    static const int DefStatsIntervalMs;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
