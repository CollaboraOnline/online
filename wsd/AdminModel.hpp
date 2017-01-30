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

#include <Poco/Process.h>

#include "Log.hpp"
#include <LOOLWebSocket.hpp>
#include "Util.hpp"

/// A client view in Admin controller.
class View
{
public:
    View(const std::string& sessionId) :
        _sessionId(sessionId),
        _start(std::time(nullptr))
    {
    }

    void expire() { _end = std::time(nullptr); }
    bool isExpired() const { return _end != 0 && std::time(nullptr) >= _end; }

private:
    const std::string _sessionId;
    const std::time_t _start;
    std::time_t _end = 0;
};

/// A document in Admin controller.
class Document
{
public:
    Document(const std::string& docKey,
             Poco::Process::PID pid,
             const std::string& filename)
        : _docKey(docKey),
          _pid(pid),
          _filename(filename),
          _start(std::time(nullptr)),
          _lastActivity(_start)
    {
    }

    Poco::Process::PID getPid() const { return _pid; }

    std::string getFilename() const { return _filename; }

    bool isExpired() const { return _end != 0 && std::time(nullptr) >= _end; }

    std::time_t getElapsedTime() const { return std::time(nullptr) - _start; }

    std::time_t getIdleTime() const { return std::time(nullptr) - _lastActivity; }

    void addView(const std::string& sessionId);

    int expireView(const std::string& sessionId);

    unsigned getActiveViews() const { return _activeViews; }

    const std::map<std::string, View>& getViews() const { return _views; }

    void updateLastActivityTime() { _lastActivity = std::time(nullptr); }

private:
    const std::string _docKey;
    const Poco::Process::PID _pid;
    /// SessionId mapping to View object
    std::map<std::string, View> _views;
    /// Total number of active views
    unsigned _activeViews = 0;
    /// Hosted filename
    std::string _filename;

    std::time_t _start;
    std::time_t _lastActivity;
    std::time_t _end = 0;
};

/// An Admin session subscriber.
class Subscriber
{
public:
    Subscriber(int sessionId, std::shared_ptr<LOOLWebSocket>& ws)
        : _sessionId(sessionId),
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
    int _sessionId;

    /// LOOLWebSocket to use to send messages to session
    std::weak_ptr<LOOLWebSocket> _ws;

    std::set<std::string> _subscriptions;

    std::time_t _start;
    std::time_t _end = 0;
};

/// The Admin controller implementation.
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
    unsigned getKitsMemoryUsage();

    void subscribe(int sessionId, std::shared_ptr<LOOLWebSocket>& ws);
    void subscribe(int sessionId, const std::string& command);

    void unsubscribe(int sessionId, const std::string& command);

    void clearMemStats() { _memStats.clear(); }

    void clearCpuStats() { _cpuStats.clear(); }

    void addMemStats(unsigned memUsage);

    void addCpuStats(unsigned cpuUsage);

    void setCpuStatsSize(unsigned size);

    void setMemStatsSize(unsigned size);

    void notify(const std::string& message);

    void addDocument(const std::string& docKey, Poco::Process::PID pid, const std::string& filename, const std::string& sessionId);

    void removeDocument(const std::string& docKey, const std::string& sessionId);
    void removeDocument(const std::string& docKey);

    void updateLastActivityTime(const std::string& docKey);

private:
    std::string getMemStats();

    std::string getCpuStats();

    unsigned getTotalActiveViews();

    std::string getDocuments() const;

private:
    std::map<int, Subscriber> _subscribers;
    std::map<std::string, Document> _documents;

    std::list<unsigned> _memStats;
    unsigned _memStatsSize = 100;

    std::list<unsigned> _cpuStats;
    unsigned _cpuStatsSize = 100;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
