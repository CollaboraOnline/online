/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_ADMIN_MODEL_HPP
#define INCLUDED_ADMIN_MODEL_HPP

#include <memory>
#include <set>
#include <sstream>
#include <string>
#include <queue>

#include <Poco/Net/WebSocket.h>
#include <Poco/Process.h>
#include <Poco/StringTokenizer.h>

#include "Util.hpp"

class View
{
public:
    View(int nSessionId)
        : _nSessionId(nSessionId),
          _start(std::time(nullptr))
    {    }

    void expire()
    {
        _end = std::time(nullptr);
    }

    bool isExpired()
    {
        return _end != 0 && std::time(nullptr) >= _end;
    }

private:
    int _nSessionId;

    std::time_t _start;
    std::time_t _end = 0;
};

class Document
{
public:
    Document(Poco::Process::PID nPid, std::string sUrl)
        : _nPid(nPid),
          _sUrl(sUrl),
          _start(std::time(nullptr))
    {
        Log::info("Document " + std::to_string(_nPid) + " ctor.");
    }

    ~Document()
    {
        Log::info("Document " + std::to_string(_nPid) + " dtor.");
    }

    Poco::Process::PID getPid() const
    {
        return _nPid;
    }

    std::string getUrl() const
    {
        return _sUrl;
    }

    void expire()
    {
        _end = std::time(nullptr);
    }

    bool isExpired() const
    {
        return _end != 0 && std::time(nullptr) >= _end;
    }

    void addView(int nSessionId)
    {
        const auto ret = _views.emplace(nSessionId, View(nSessionId));
        if (!ret.second)
        {
            Log::warn() << "View with SessionID [" + std::to_string(nSessionId) + "] already exists." << Log::end;
        }
        else
        {
            _nActiveViews++;
        }
    }

    void removeView(int nSessionId)
    {
        auto it = _views.find(nSessionId);
        if (it != _views.end())
        {
            it->second.expire();
            _nActiveViews--;
        }
    }

    unsigned getActiveViews() const
    {
        return _nActiveViews;
    }

private:
    Poco::Process::PID _nPid;
    /// SessionId mapping to View object
    std::map<int, View> _views;
    /// Total number of active views
    unsigned _nActiveViews = 0;
    /// Hosted URL
    std::string _sUrl;

    std::time_t _start;
    std::time_t _end = 0;
};

class Subscriber
{
public:
    Subscriber(int nSessionId, std::shared_ptr<Poco::Net::WebSocket>& ws)
        : _nSessionId(nSessionId),
          _ws(ws),
          _start(std::time(nullptr))
    {
        Log::info("Subscriber ctor.");
    }

    ~Subscriber()
    {
        Log::info("Subscriber dtor.");
    }

    bool notify(const std::string& message)
    {
        Poco::StringTokenizer tokens(message, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);

        if (_subscriptions.find(tokens[0]) == _subscriptions.end())
            return true;

        auto webSocket = _ws.lock();
        if (webSocket)
        {
            webSocket->sendFrame(message.data(), message.length());
            return true;
        }
        else
        {
            return false;
        }
    }

    bool subscribe(const std::string& command)
    {
        auto ret = _subscriptions.insert(command);
        return ret.second;
    }

    void unsubscribe(const std::string& command)
    {
        _subscriptions.erase(command);
    }

    void expire()
    {
        _end = std::time(nullptr);
    }

    bool isExpired() const
    {
        return _end != 0 && std::time(nullptr) >= _end;
    }

private:
    /// Admin session Id
    int _nSessionId;
    /// WebSocket to use to send messages to session
    std::weak_ptr<Poco::Net::WebSocket> _ws;

    std::set<std::string> _subscriptions;

    std::time_t _start;
    std::time_t _end = 0;

    /// In case of huge number of documents,
    /// client can tell us the specific page it is
    /// interested in getting live notifications
    unsigned _currentPage;
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

    void update(const std::string& data)
    {
        Poco::StringTokenizer tokens(data, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);

        Log::info("AdminModel Recv: " + data);

        if (tokens[0] == "document")
        {
            addDocument(std::stoi(tokens[1]), tokens[2]);
            unsigned mem = Util::getMemoryUsage(std::stoi(tokens[1]));
            std::string response = data + std::to_string(mem);
            notify(response);
            return;
        }
        else if (tokens[0] == "addview")
        {
            auto it = _documents.find(std::stoi(tokens[1]));
            if (it != _documents.end())
            {
                const unsigned nSessionId = Util::decodeId(tokens[2]);
                it->second.addView(nSessionId);
            }
        }
        else if (tokens[0] == "rmview")
        {
            auto it = _documents.find(std::stoi(tokens[1]));
            if (it != _documents.end())
            {
                const unsigned nSessionId = Util::decodeId(tokens[2]);
                it->second.removeView(nSessionId);
            }
        }
        else if (tokens[0] == "rmdoc")
        {
            removeDocument(std::stoi(tokens[1]));
        }

        notify(data);
    }

    std::string query(const std::string command)
    {
        Poco::StringTokenizer tokens(command, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);

        if (tokens[0] == "documents")
        {
            return getDocuments();
        }
        else if (tokens[0] == "active_users_count")
        {
            return std::to_string(getTotalActiveViews());
        }
        else if (tokens[0] == "active_docs_count")
        {
            return std::to_string(_documents.size());
        }
        else if (tokens[0] == "mem_stats")
        {
            return getMemStats();
        }
        else if (tokens[0] == "mem_stats_size")
        {
            return std::to_string(_memStatsSize);
        }
        else if (tokens[0] == "cpu_stats")
        {
            return getCpuStats();
        }
        else if (tokens[0] == "cpu_stats_size")
        {
            return std::to_string(_cpuStatsSize);
        }

        return std::string("");
    }

    /// Returns memory consumed by all active loolkit processes
    unsigned getTotalMemoryUsage()
    {
        unsigned totalMem = 0;
        for (auto& it: _documents)
        {
            if (it.second.isExpired())
                continue;

            totalMem += Util::getMemoryUsage(it.second.getPid());
        }

        return totalMem;
    }

    void subscribe(int nSessionId, std::shared_ptr<Poco::Net::WebSocket>& ws)
    {
        const auto ret = _subscribers.emplace(nSessionId, Subscriber(nSessionId, ws));
        if (!ret.second)
        {
            Log::warn() << "Subscriber already exists" << Log::end;
        }
    }

    void subscribe(int nSessionId, const std::string& command)
    {
        auto subscriber = _subscribers.find(nSessionId);
        if (subscriber == _subscribers.end() )
            return;

        subscriber->second.subscribe(command);
    }

    void unsubscribe(int nSessionId, const std::string& command)
    {
        auto subscriber = _subscribers.find(nSessionId);
        if (subscriber == _subscribers.end())
            return;

        subscriber->second.unsubscribe(command);
    }

    void clearMemStats()
    {
        _memStats.clear();
    }

    void clearCpuStats()
    {
        _cpuStats.clear();
    }

    void addMemStats(unsigned memUsage)
    {
        _memStats.push_back(memUsage);
        if (_memStats.size() > _memStatsSize)
        {
            _memStats.pop_front();
        }

        std::ostringstream oss;
        oss << "mem_stats "
            << std::to_string(memUsage);
        notify(oss.str());
    }

    void addCpuStats(unsigned cpuUsage)
    {
        _cpuStats.push_back(cpuUsage);
        if (_cpuStats.size() > _cpuStatsSize)
        {
            _cpuStats.pop_front();
        }

        std::ostringstream oss;
        oss << "cpu_stats "
            << std::to_string(cpuUsage);
        notify(oss.str());
    }

    void setCpuStatsSize(unsigned size)
    {
        int wasteValuesLen = _cpuStats.size() - size;
        while (wasteValuesLen-- > 0)
        {
            _cpuStats.pop_front();
        }
        _cpuStatsSize = size;

        std::ostringstream oss;
        oss << "settings "
            << "cpu_stats_size="
            << std::to_string(_cpuStatsSize);
        notify(oss.str());
    }

    void setMemStatsSize(unsigned size)
    {
        int wasteValuesLen = _memStats.size() - size;
        while (wasteValuesLen-- > 0)
        {
            _memStats.pop_front();
        }
        _memStatsSize = size;

        std::ostringstream oss;
        oss << "settings "
            << "mem_stats_size="
            << std::to_string(_memStatsSize);
        notify(oss.str());
    }

    void notify(const std::string& message)
    {
        auto it = std::begin(_subscribers);
        while (it != std::end(_subscribers))
        {
            if (!it->second.notify(message))
            {
                it = _subscribers.erase(it);
            }
            else
            {
                it++;
            }
        }
    }

private:
    void addDocument(Poco::Process::PID pid, std::string url)
    {
        const auto ret = _documents.emplace(pid, Document(pid, url));
        if (!ret.second)
        {
            Log::warn() << "Document with PID [" + std::to_string(pid) + "] already exists." << Log::end;
        }
    }

    void removeDocument(Poco::Process::PID pid)
    {
        auto it = _documents.find(pid);
        if (it != _documents.end() && !it->second.isExpired())
        {
            // TODO: The idea is to only expire the document and keep the history
            // of documents open and close, to be able to give a detailed summary
            // to the admin console with views. For now, just remove the document.
            it->second.expire();
            _documents.erase(it);
        }
    }

    std::string getMemStats()
    {
        std::string response;
        for (auto& i: _memStats)
        {
            response += std::to_string(i) + ",";
        }

        return response;
    }

    std::string getCpuStats()
    {
        std::string response;
        for (auto& i: _cpuStats)
        {
            response += std::to_string(i) + ",";
        }

        return response;
    }

    unsigned getTotalActiveViews()
    {
        unsigned nTotalViews = 0;
        for (auto& it: _documents)
        {
            if (it.second.isExpired())
                continue;

            nTotalViews += it.second.getActiveViews();
        }

        return nTotalViews;
    }

    std::string getDocuments()
    {
        std::ostringstream oss;
        for (auto& it: _documents)
        {
            if (it.second.isExpired())
                continue;

            std::string sPid = std::to_string(it.second.getPid());
            std::string sUrl = it.second.getUrl();
            std::string sViews = std::to_string(it.second.getActiveViews());
            std::string sMem = std::to_string(Util::getMemoryUsage(it.second.getPid()));

            oss << sPid << " "
                << sUrl << " "
                << sViews << " "
                << sMem << " \n ";
        }

        return oss.str();
    }

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
