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
#include <list>

#include <Poco/Process.h>

#include "Log.hpp"
#include "net/WebSocketHandler.hpp"
#include "Util.hpp"

/// A client view in Admin controller.
class View
{
public:
    View(const std::string& sessionId, const std::string& userName, const std::string& userId) :
        _sessionId(sessionId),
        _userName(userName),
        _userId(userId),
        _start(std::time(nullptr))
    {
    }

    void expire() { _end = std::time(nullptr); }
    std::string getUserName() const { return _userName; }
    std::string getUserId() const { return _userId; }
    std::string getSessionId() const { return _sessionId; }
    bool isExpired() const { return _end != 0 && std::time(nullptr) >= _end; }

private:
    const std::string _sessionId;
    const std::string _userName;
    const std::string _userId;
    const std::time_t _start;
    std::time_t _end = 0;
};

struct DocProcSettings
{
    size_t LimitVirtMemMb;
    size_t LimitDataMemKb;
    size_t LimitStackMemKb;
    size_t LimitFileSizeMb;
    size_t LimitNumberOpenFiles;
};

/// Containing basic information about document
struct DocBasicInfo
{
    std::string DocKey;
    std::time_t IdleTime;
    int Mem;
    bool Saved;

    DocBasicInfo(const std::string& docKey, std::time_t idleTime, int mem, bool saved) :
        DocKey(docKey),
        IdleTime(idleTime),
        Mem(mem),
        Saved(saved)
    {
    }
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
          _activeViews(0),
          _filename(filename),
          _memoryDirty(0),
          _lastJiffy(0),
          _start(std::time(nullptr)),
          _lastActivity(_start),
          _end(0),
          _sentBytes(0),
          _recvBytes(0),
          _isModified(false)
    {
    }

    const std::string getDocKey() const { return _docKey; }

    Poco::Process::PID getPid() const { return _pid; }

    std::string getFilename() const { return _filename; }

    bool isExpired() const { return _end != 0 && std::time(nullptr) >= _end; }

    std::time_t getElapsedTime() const { return std::time(nullptr) - _start; }

    std::time_t getIdleTime() const { return std::time(nullptr) - _lastActivity; }

    void addView(const std::string& sessionId, const std::string& userName, const std::string& userId);

    int expireView(const std::string& sessionId);

    unsigned getActiveViews() const { return _activeViews; }

    unsigned getLastJiffies() const { return _lastJiffy; }
    void setLastJiffies(size_t newJ) { _lastJiffy = newJ; }

    const std::map<std::string, View>& getViews() const { return _views; }

    void updateLastActivityTime() { _lastActivity = std::time(nullptr); }
    bool updateMemoryDirty(int dirty);
    int getMemoryDirty() const { return _memoryDirty; }

    std::pair<std::time_t, std::string> getSnapshot() const;
    const std::string getHistory() const;
    void takeSnapshot();

    void setModified(bool value) { _isModified = value; }
    bool getModifiedStatus() const { return _isModified; }

    void addBytes(uint64_t sent, uint64_t recv)
    {
        _sentBytes += sent;
        _recvBytes += recv;
    }

    const DocProcSettings& getDocProcSettings() const { return _docProcSettings; }
    void setDocProcSettings(const DocProcSettings& docProcSettings) { _docProcSettings = docProcSettings; }

    std::string to_string() const;

private:
    const std::string _docKey;
    const Poco::Process::PID _pid;
    /// SessionId mapping to View object
    std::map<std::string, View> _views;
    /// Total number of active views
    unsigned _activeViews;
    /// Hosted filename
    std::string _filename;
    /// The dirty (ie. un-shared) memory of the document's Kit process.
    int _memoryDirty;
    /// Last noted Jiffy count
    unsigned _lastJiffy;

    std::time_t _start;
    std::time_t _lastActivity;
    std::time_t _end;
    std::map<std::time_t,std::string> _snapshots;

    /// Total bytes sent and recv'd by this document.
    uint64_t _sentBytes, _recvBytes;

    /// Per-doc kit process settings.
    DocProcSettings _docProcSettings;
    bool _isModified;
};

/// An Admin session subscriber.
class Subscriber
{
public:
    Subscriber(const std::weak_ptr<WebSocketHandler>& ws)
        : _ws(ws),
          _start(std::time(nullptr))
    {
        LOG_INF("Subscriber ctor.");
    }

    ~Subscriber()
    {
        LOG_INF("Subscriber dtor.");
    }

    bool notify(const std::string& message);

    bool subscribe(const std::string& command);

    void unsubscribe(const std::string& command);

    void expire() { _end = std::time(nullptr); }

    bool isExpired() const { return _end != 0 && std::time(nullptr) >= _end; }

private:
    /// The underlying AdminRequestHandler
    std::weak_ptr<WebSocketHandler> _ws;

    std::set<std::string> _subscriptions;

    std::time_t _start;
    std::time_t _end = 0;
};

/// The Admin controller implementation.
class AdminModel
{
public:
    AdminModel() :
        _owner(std::this_thread::get_id())
    {
        LOG_INF("AdminModel ctor.");
    }

    ~AdminModel();

    /// All methods here must be called from the Admin socket-poll
    void setThreadOwner(const std::thread::id &id) { _owner = id; }

    /// In debug mode check that code is running in the correct thread.
    /// Asserts in the debug builds, otherwise just logs.
    void assertCorrectThread() const;

    std::string query(const std::string& command);
    std::string getAllHistory() const;

    /// Returns memory consumed by all active loolkit processes
    unsigned getKitsMemoryUsage();
    size_t getKitsJiffies();

    void subscribe(int sessionId, const std::weak_ptr<WebSocketHandler>& ws);
    void subscribe(int sessionId, const std::string& command);

    void unsubscribe(int sessionId, const std::string& command);

    void modificationAlert(const std::string& docKey, Poco::Process::PID pid, bool value);

    void clearMemStats() { _memStats.clear(); }

    void clearCpuStats() { _cpuStats.clear(); }

    void addMemStats(unsigned memUsage);

    void addCpuStats(unsigned cpuUsage);

    void addSentStats(uint64_t sent);

    void addRecvStats(uint64_t recv);

    void setCpuStatsSize(unsigned size);

    void setMemStatsSize(unsigned size);

    void notify(const std::string& message);

    void addDocument(const std::string& docKey, Poco::Process::PID pid, const std::string& filename, const std::string& sessionId, const std::string& userName, const std::string& userId);

    void removeDocument(const std::string& docKey, const std::string& sessionId);
    void removeDocument(const std::string& docKey);

    void updateLastActivityTime(const std::string& docKey);
    void updateMemoryDirty(const std::string& docKey, int dirty);

    void addBytes(const std::string& docKey, uint64_t sent, uint64_t recv);

    uint64_t getSentBytesTotal() { return _sentBytesTotal; }
    uint64_t getRecvBytesTotal() { return _recvBytesTotal; }

    double getServerUptime();

    /// Document basic info list sorted by most idle time
    std::vector<DocBasicInfo> getDocumentsSortedByIdle() const;

private:
    std::string getMemStats();

    std::string getSentActivity();

    std::string getRecvActivity();

    std::string getCpuStats();

    unsigned getTotalActiveViews();

    std::string getDocuments() const;

private:
    std::map<int, Subscriber> _subscribers;
    std::map<std::string, Document> _documents;
    std::map<std::string, Document> _expiredDocuments;

    /// The last N total memory Dirty size.
    std::list<unsigned> _memStats;
    unsigned _memStatsSize = 100;

    std::list<unsigned> _cpuStats;
    unsigned _cpuStatsSize = 100;

    std::list<unsigned> _sentStats;
    unsigned _sentStatsSize = 100;

    std::list<unsigned> _recvStats;
    unsigned _recvStatsSize = 100;

    uint64_t _sentBytesTotal;
    uint64_t _recvBytesTotal;

    /// We check the owner even in the release builds, needs to be always correct.
    std::thread::id _owner;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
