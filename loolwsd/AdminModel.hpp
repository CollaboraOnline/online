/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_ADMINMODEL_HPP
#define INCLUDED_ADMINMODEL_HPP

#include <memory>
#include <set>
#include <string>

#include <Poco/Net/WebSocket.h>
#include <Poco/Process.h>

#include "Util.hpp"

class View
{
public:
    View(int sessionId)
        : _nSessionId(sessionId),
          _start(std::time(nullptr))
    {    }

    void expire() { _end = std::time(nullptr); }

    bool isExpired() { return _end != 0 && std::time(nullptr) >= _end; }

private:
    int _nSessionId;

    std::time_t _start;
    std::time_t _end = 0;
};

class Document
{
public:
    Document(Poco::Process::PID pid, std::string filename)
        : _nPid(pid),
          _sFilename(filename),
          _start(std::time(nullptr))
    {
        Log::info("Document " + std::to_string(_nPid) + " ctor.");
    }

    ~Document()
    {
        Log::info("Document " + std::to_string(_nPid) + " dtor.");
    }

    Poco::Process::PID getPid() const { return _nPid; }

    std::string getFilename() const { return _sFilename; }

    bool isExpired() const { return _end != 0 && std::time(nullptr) >= _end; }

    std::time_t getElapsedTime() const { return std::time(nullptr) - _start; }

    void addView(int sessionId);

    int expireView(int sessionId);

    unsigned getActiveViews() const { return _nActiveViews; }

private:
    Poco::Process::PID _nPid;
    /// SessionId mapping to View object
    std::map<int, View> _views;
    /// Total number of active views
    unsigned _nActiveViews = 0;
    /// Hosted filename
    std::string _sFilename;

    std::time_t _start;
    std::time_t _end = 0;
};

class Subscriber
{
public:
    Subscriber(int sessionId, std::shared_ptr<Poco::Net::WebSocket>& ws)
        : _nSessionId(sessionId),
          _ws(ws),
          _start(std::time(nullptr))
    {
        Log::info("Subscriber ctor.");
    }

    ~Subscriber()
    {
        Log::info("Subscriber dtor.");
    }

    bool notify(const std::string& message);

    bool subscribe(const std::string& command);

    void unsubscribe(const std::string& command);

    void expire() { _end = std::time(nullptr); }

    bool isExpired() const { return _end != 0 && std::time(nullptr) >= _end; }

private:
    /// Admin session Id
    int _nSessionId;
    /// WebSocket to use to send messages to session
    std::weak_ptr<Poco::Net::WebSocket> _ws;

    std::set<std::string> _subscriptions;

    std::time_t _start;
    std::time_t _end = 0;
};

class AdminModel
{
public:
    AdminModel()
    {
        Log::info("AdminModel ctor.");
    }

    ~AdminModel()
    {
        Log::info("AdminModel dtor.");
    }

    std::string query(const std::string& command);

    /// Returns memory consumed by all active loolkit processes
    unsigned getTotalMemoryUsage();

    void subscribe(int sessionId, std::shared_ptr<Poco::Net::WebSocket>& ws);
    void subscribe(int sessionId, const std::string& command);

    void unsubscribe(int sessionId, const std::string& command);

    void clearMemStats() { _memStats.clear(); }

    void clearCpuStats() { _cpuStats.clear(); }

    void addMemStats(unsigned memUsage);

    void addCpuStats(unsigned cpuUsage);

    void setCpuStatsSize(unsigned size);

    void setMemStatsSize(unsigned size);

    void notify(const std::string& message);

    void addDocument(Poco::Process::PID pid, const std::string& filename, const int sessionId);

    void removeDocument(Poco::Process::PID pid, const int sessionId);

private:

    std::string getMemStats();

    std::string getCpuStats();

    unsigned getTotalActiveViews();

    std::string getDocuments();

private:
    std::map<int, Subscriber> _subscribers;
    std::map<Poco::Process::PID, Document> _documents;

    std::list<unsigned> _memStats;
    unsigned _memStatsSize = 100;

    std::list<unsigned> _cpuStats;
    unsigned _cpuStatsSize = 100;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
