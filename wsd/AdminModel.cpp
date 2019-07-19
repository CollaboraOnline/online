/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "AdminModel.hpp"

#include <chrono>
#include <memory>
#include <set>
#include <sstream>
#include <string>

#include <Poco/Process.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>

#include <Protocol.hpp>
#include <net/WebSocketHandler.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include <wsd/LOOLWSD.hpp>

void Document::addView(const std::string& sessionId, const std::string& userName, const std::string& userId)
{
    const auto ret = _views.emplace(sessionId, View(sessionId, userName, userId));
    if (!ret.second)
    {
        LOG_WRN("View with SessionID [" << sessionId << "] already exists.");
    }
    else
    {
        ++_activeViews;
    }
}

int Document::expireView(const std::string& sessionId)
{
    auto it = _views.find(sessionId);
    if (it != _views.end())
    {
        it->second.expire();

        // If last view, expire the Document also
        if (--_activeViews == 0)
            _end = std::time(nullptr);
    }
    takeSnapshot();

    return _activeViews;
}

std::pair<std::time_t, std::string> Document::getSnapshot() const
{
    std::time_t ct = std::time(nullptr);
    std::ostringstream oss;
    oss << "{";
    oss << "\"creationTime\"" << ":" << ct << ",";
    oss << "\"memoryDirty\"" << ":" << getMemoryDirty() << ",";
    oss << "\"activeViews\"" << ":" << getActiveViews() << ",";

    oss << "\"views\"" << ":[";
    std::string separator;
    for (const auto& view : getViews())
    {
        oss << separator << "\"";
        if(view.second.isExpired())
        {
            oss << "-";
        }
        oss << view.first << "\"";
        separator = ",";
    }
    oss << "],";

    oss << "\"lastActivity\"" << ":" << _lastActivity;
    oss << "}";
    return std::make_pair(ct, oss.str());
}

const std::string Document::getHistory() const
{
    std::ostringstream oss;
    oss << "{";
    oss << "\"docKey\"" << ":\"" << _docKey << "\",";
    oss << "\"filename\"" << ":\"" << LOOLWSD::anonymizeUrl(getFilename()) << "\",";
    oss << "\"start\"" << ":" << _start << ",";
    oss << "\"end\"" << ":" << _end << ",";
    oss << "\"pid\"" << ":" << getPid() << ",";
    oss << "\"snapshots\"" << ":[";
    std::string separator;
    for (const auto& s : _snapshots)
    {
        oss << separator << s.second;
        separator = ",";
    }
    oss << "]}";
    return oss.str();
}

void Document::takeSnapshot()
{
    std::pair<std::time_t, std::string> p = getSnapshot();
    auto insPoint = _snapshots.upper_bound(p.first);
    _snapshots.insert(insPoint, p);
}

std::string Document::to_string() const
{
    std::ostringstream oss;
    std::string encodedFilename;
    Poco::URI::encode(getFilename(), " ", encodedFilename);
    oss << getPid() << ' '
        << encodedFilename << ' '
        << getActiveViews() << ' '
        << getMemoryDirty() << ' '
        << getElapsedTime() << ' '
        << getIdleTime() << ' ';
    return oss.str();
}

bool Subscriber::notify(const std::string& message)
{
    // If there is no socket, then return false to
    // signify we're disconnected.
    std::shared_ptr<WebSocketHandler> webSocket = _ws.lock();
    if (webSocket)
    {
        if (_subscriptions.find(LOOLProtocol::getFirstToken(message)) == _subscriptions.end())
        {
            // No subscribers for the given message.
            return true;
        }

        try
        {
            UnitWSD::get().onAdminNotifyMessage(message);
            webSocket->sendMessage(message);
            return true;
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Failed to notify Admin subscriber with message [" <<
                    message << "] due to [" << ex.what() << "].");
        }
    }

    return false;
}

bool Subscriber::subscribe(const std::string& command)
{
    auto ret = _subscriptions.insert(command);
    return ret.second;
}

void Subscriber::unsubscribe(const std::string& command)
{
    _subscriptions.erase(command);
}

void AdminModel::assertCorrectThread() const
{
    // FIXME: share this code [!]
    const bool sameThread = std::this_thread::get_id() == _owner;
    if (!sameThread)
        LOG_ERR("Admin command invoked from foreign thread. Expected: " <<
        Log::to_string(_owner) << " but called from " <<
        std::this_thread::get_id() << " (" << Util::getThreadId() << ").");

    assert(sameThread);
}

AdminModel::~AdminModel()
{
    LOG_TRC("History:\n\n" << getAllHistory() << '\n');
    LOG_INF("AdminModel dtor.");
}

std::string AdminModel::getAllHistory() const
{
    std::ostringstream oss;
    oss << "{ \"documents\" : [";
    std::string separator1;
    for (const auto& d : _documents)
    {
        oss << separator1;
        oss << d.second.getHistory();
        separator1 = ",";
    }
    oss << "], \"expiredDocuments\" : [";
    separator1 = "";
    for (const auto& ed : _expiredDocuments)
    {
        oss << separator1;
        oss << ed.second.getHistory();
        separator1 = ",";
    }
    oss << "]}";
    return oss.str();
}

std::string AdminModel::query(const std::string& command)
{
    assertCorrectThread();

    const auto token = LOOLProtocol::getFirstToken(command);
    if (token == "documents")
    {
        return getDocuments();
    }
    else if (token == "active_users_count")
    {
        return std::to_string(getTotalActiveViews());
    }
    else if (token == "active_docs_count")
    {
        return std::to_string(_documents.size());
    }
    else if (token == "mem_stats")
    {
        return getMemStats();
    }
    else if (token == "mem_stats_size")
    {
        return std::to_string(_memStatsSize);
    }
    else if (token == "cpu_stats")
    {
        return getCpuStats();
    }
    else if (token == "cpu_stats_size")
    {
        return std::to_string(_cpuStatsSize);
    }
    else if (token == "sent_activity")
    {
        return getSentActivity();
    }
    else if (token == "recv_activity")
    {
        return getRecvActivity();
    }
    else if (token == "net_stats_size")
    {
        return std::to_string(std::max(_sentStatsSize, _recvStatsSize));
    }

    return std::string("");
}

/// Returns memory consumed by all active loolkit processes
unsigned AdminModel::getKitsMemoryUsage()
{
    assertCorrectThread();

    unsigned totalMem = 0;
    unsigned docs = 0;
    for (const auto& it : _documents)
    {
        if (!it.second.isExpired())
        {
            const int bytes = it.second.getMemoryDirty();
            if (bytes > 0)
            {
                totalMem += bytes;
                ++docs;
            }
        }
    }

    if (docs > 0)
    {
        LOG_TRC("Got total Kits memory of " << totalMem << " bytes for " << docs <<
                " docs, avg: " << static_cast<double>(totalMem) / docs << " bytes / doc.");
    }

    return totalMem;
}

size_t AdminModel::getKitsJiffies()
{
    assertCorrectThread();

    size_t totalJ = 0;
    for (auto& it : _documents)
    {
        if (!it.second.isExpired())
        {
            const int pid = it.second.getPid();
            if (pid > 0)
            {
                unsigned newJ = Util::getCpuUsage(pid);
                unsigned prevJ = it.second.getLastJiffies();
                if(newJ >= prevJ)
                {
                    totalJ += (newJ - prevJ);
                    it.second.setLastJiffies(newJ);
                }
            }
        }
    }
    return totalJ;
}

void AdminModel::subscribe(int sessionId, const std::weak_ptr<WebSocketHandler>& ws)
{
    assertCorrectThread();

    const auto ret = _subscribers.emplace(sessionId, Subscriber(ws));
    if (!ret.second)
    {
        LOG_WRN("Subscriber already exists");
    }
}

void AdminModel::subscribe(int sessionId, const std::string& command)
{
    assertCorrectThread();

    auto subscriber = _subscribers.find(sessionId);
    if (subscriber != _subscribers.end())
    {
        subscriber->second.subscribe(command);
    }
}

void AdminModel::unsubscribe(int sessionId, const std::string& command)
{
    assertCorrectThread();

    auto subscriber = _subscribers.find(sessionId);
    if (subscriber != _subscribers.end())
        subscriber->second.unsubscribe(command);
}

void AdminModel::addMemStats(unsigned memUsage)
{
    assertCorrectThread();

    _memStats.push_back(memUsage);
    if (_memStats.size() > _memStatsSize)
        _memStats.pop_front();

    notify("mem_stats " + std::to_string(memUsage));
}

void AdminModel::addCpuStats(unsigned cpuUsage)
{
    assertCorrectThread();

    _cpuStats.push_back(cpuUsage);
    if (_cpuStats.size() > _cpuStatsSize)
        _cpuStats.pop_front();

    notify("cpu_stats " + std::to_string(cpuUsage));
}

void AdminModel::addSentStats(uint64_t sent)
{
    assertCorrectThread();

    _sentStats.push_back(sent);
    if (_sentStats.size() > _sentStatsSize)
        _sentStats.pop_front();

    notify("sent_activity " + std::to_string(sent));
}

void AdminModel::addRecvStats(uint64_t recv)
{
    assertCorrectThread();

    _recvStats.push_back(recv);
    if (_recvStats.size() > _recvStatsSize)
        _recvStats.pop_front();

    notify("recv_activity " + std::to_string(recv));
}

void AdminModel::setCpuStatsSize(unsigned size)
{
    assertCorrectThread();

    int wasteValuesLen = _cpuStats.size() - size;
    while (wasteValuesLen-- > 0)
    {
        _cpuStats.pop_front();
    }
    _cpuStatsSize = size;

    notify("settings cpu_stats_size=" + std::to_string(_cpuStatsSize));
}

void AdminModel::setMemStatsSize(unsigned size)
{
    assertCorrectThread();

    int wasteValuesLen = _memStats.size() - size;
    while (wasteValuesLen-- > 0)
    {
        _memStats.pop_front();
    }
    _memStatsSize = size;

    notify("settings mem_stats_size=" + std::to_string(_memStatsSize));
}

void AdminModel::notify(const std::string& message)
{
    assertCorrectThread();

    if (!_subscribers.empty())
    {
        LOG_TRC("Message to admin console: " << message);
        for (auto it = std::begin(_subscribers); it != std::end(_subscribers); )
        {
            if (!it->second.notify(message))
            {
                it = _subscribers.erase(it);
            }
            else
            {
                ++it;
            }
        }
    }
}

void AdminModel::addBytes(const std::string& docKey, uint64_t sent, uint64_t recv)
{
    assertCorrectThread();

    auto doc = _documents.find(docKey);
    if(doc != _documents.end())
        doc->second.addBytes(sent, recv);

    _sentBytesTotal += sent;
    _recvBytesTotal += recv;
}

void AdminModel::modificationAlert(const std::string& docKey, Poco::Process::PID pid, bool value)
{
    assertCorrectThread();

    auto doc = _documents.find(docKey);
    if (doc != _documents.end())
        doc->second.setModified(value);

    std::ostringstream oss;
    oss << "modifications "
        << pid << ' '
        << (value?"Yes":"No");

    notify(oss.str());
}

void AdminModel::addDocument(const std::string& docKey, Poco::Process::PID pid,
                             const std::string& filename, const std::string& sessionId,
                             const std::string& userName, const std::string& userId)
{
    assertCorrectThread();

    const auto ret = _documents.emplace(docKey, Document(docKey, pid, filename));
    ret.first->second.takeSnapshot();
    ret.first->second.addView(sessionId, userName, userId);
    LOG_DBG("Added admin document [" << docKey << "].");

    std::string encodedUsername;
    std::string encodedFilename;
    std::string encodedUserId;
    Poco::URI::encode(userId, " ", encodedUserId);
    Poco::URI::encode(filename, " ", encodedFilename);
    Poco::URI::encode(userName, " ", encodedUsername);

    // Notify the subscribers
    std::ostringstream oss;
    oss << "adddoc "
        << pid << ' '
        << encodedFilename << ' '
        << sessionId << ' '
        << encodedUsername << ' '
        << encodedUserId << ' ';

    // We have to wait until the kit sends us its PSS.
    // Here we guestimate until we get an update.
    if (_documents.size() < 2) // If we aren't the only one.
    {
        if (_memStats.empty())
        {
            oss << 0;
        }
        else
        {
            // Estimate half as much as wsd+forkit.
            oss << _memStats.front() / 2;
        }
    }
    else
    {
        oss << _documents.begin()->second.getMemoryDirty();
    }

    notify(oss.str());
}

void AdminModel::removeDocument(const std::string& docKey, const std::string& sessionId)
{
    assertCorrectThread();

    auto docIt = _documents.find(docKey);
    if (docIt != _documents.end() && !docIt->second.isExpired())
    {
        // Notify the subscribers
        std::ostringstream oss;
        oss << "rmdoc "
            << docIt->second.getPid() << ' '
            << sessionId;
        notify(oss.str());

        // The idea is to only expire the document and keep the history
        // of documents open and close, to be able to give a detailed summary
        // to the admin console with views.
        if (docIt->second.expireView(sessionId) == 0)
        {
            _expiredDocuments.emplace(*docIt);
            _documents.erase(docIt);
        }
    }
}

void AdminModel::removeDocument(const std::string& docKey)
{
    assertCorrectThread();

    auto docIt = _documents.find(docKey);
    if (docIt != _documents.end())
    {
        std::ostringstream oss;
        oss << "rmdoc "
            << docIt->second.getPid() << ' ';
        const std::string msg = oss.str();

        for (const auto& pair : docIt->second.getViews())
        {
            // Notify the subscribers
            notify(msg + pair.first);
            docIt->second.expireView(pair.first);
        }

        LOG_DBG("Removed admin document [" << docKey << "].");
        _expiredDocuments.emplace(*docIt);
        _documents.erase(docIt);
    }
}

std::string AdminModel::getMemStats()
{
    assertCorrectThread();

    std::ostringstream oss;
    for (const auto& i: _memStats)
    {
        oss << i << ',';
    }

    return oss.str();
}

std::string AdminModel::getCpuStats()
{
    assertCorrectThread();

    std::ostringstream oss;
    for (const auto& i: _cpuStats)
    {
        oss << i << ',';
    }

    return oss.str();
}

std::string AdminModel::getSentActivity()
{
    assertCorrectThread();

    std::ostringstream oss;
    for (const auto& i: _sentStats)
    {
        oss << i << ',';
    }

    return oss.str();
}

std::string AdminModel::getRecvActivity()
{
    assertCorrectThread();

    std::ostringstream oss;
    for (const auto& i: _recvStats)
    {
        oss << i << ',';
    }

    return oss.str();
}

unsigned AdminModel::getTotalActiveViews()
{
    assertCorrectThread();

    unsigned numTotalViews = 0;
    for (const auto& it: _documents)
    {
        if (!it.second.isExpired())
        {
            numTotalViews += it.second.getActiveViews();
        }
    }

    return numTotalViews;
}

std::vector<DocBasicInfo> AdminModel::getDocumentsSortedByIdle() const
{
    std::vector<DocBasicInfo> docs;
    docs.reserve(_documents.size());
    for (const auto& it: _documents)
    {
        docs.emplace_back(it.second.getDocKey(),
                          it.second.getIdleTime(),
                          it.second.getMemoryDirty(),
                          !it.second.getModifiedStatus());
    }

    // Sort the list by idle times;
    std::sort(std::begin(docs), std::end(docs),
              [](const DocBasicInfo& a, const DocBasicInfo& b)
              {
                return a.IdleTime >= b.IdleTime;
              });

    return docs;
}

std::string AdminModel::getDocuments() const
{
    assertCorrectThread();

    std::ostringstream oss;
    std::map<std::string, View> viewers;
    oss << '{' << "\"documents\"" << ':' << '[';
    std::string separator1;
    for (const auto& it: _documents)
    {
        if (!it.second.isExpired())
        {
            std::string encodedFilename;
            Poco::URI::encode(it.second.getFilename(), " ", encodedFilename);
            oss << separator1 << '{' << ' '
                << "\"pid\"" << ':' << it.second.getPid() << ','
                << "\"docKey\"" << ':' << '"' << it.second.getDocKey() << '"' << ','
                << "\"fileName\"" << ':' << '"' << encodedFilename << '"' << ','
                << "\"activeViews\"" << ':' << it.second.getActiveViews() << ','
                << "\"memory\"" << ':' << it.second.getMemoryDirty() << ','
                << "\"elapsedTime\"" << ':' << it.second.getElapsedTime() << ','
                << "\"idleTime\"" << ':' << it.second.getIdleTime() << ','
                << "\"modified\"" << ':' << '"' << (it.second.getModifiedStatus() ? "Yes" : "No") << '"' << ','
                << "\"views\"" << ':' << '[';
            viewers = it.second.getViews();
            std::string separator;
            for(const auto& viewIt: viewers)
            {
                if(!viewIt.second.isExpired()) {
                    oss << separator << '{'
                        << "\"userName\"" << ':' << '"' << viewIt.second.getUserName() << '"' << ','
                        << "\"userId\"" << ':' << '"' << viewIt.second.getUserId() << '"' << ','
                        << "\"sessionid\"" << ':' << '"' << viewIt.second.getSessionId() << '"' << '}';
                        separator = ',';
                }
            }
            oss << "]"
                << "}";
            separator1 = ',';
        }
    }
    oss << "]" << "}";

    return oss.str();
}

void AdminModel::updateLastActivityTime(const std::string& docKey)
{
    assertCorrectThread();

    auto docIt = _documents.find(docKey);
    if (docIt != _documents.end())
    {
        if (docIt->second.getIdleTime() >= 10)
        {
            docIt->second.takeSnapshot(); // I would like to keep the idle time
            docIt->second.updateLastActivityTime();
            notify("resetidle " + std::to_string(docIt->second.getPid()));
        }
    }
}

bool Document::updateMemoryDirty(int dirty)
{
    if (_memoryDirty == dirty)
        return false;
    _memoryDirty = dirty;
    return true;
}

void AdminModel::updateMemoryDirty(const std::string& docKey, int dirty)
{
    assertCorrectThread();

    auto docIt = _documents.find(docKey);
    if (docIt != _documents.end() &&
        docIt->second.updateMemoryDirty(dirty))
    {
        notify("propchange " + std::to_string(docIt->second.getPid()) +
               " mem " + std::to_string(dirty));
    }
}

double AdminModel::getServerUptime()
{
    auto currentTime = std::chrono::system_clock::now();
    std::chrono::duration<double> uptime = currentTime - LOOLWSD::StartTime;
    return uptime.count();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
