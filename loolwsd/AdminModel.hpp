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
#include <sstream>
#include <string>

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
        std::pair<std::map<int, View>::iterator, bool > ret;
        ret = _views.insert(std::pair<int, View>(nSessionId, View(nSessionId)));
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
    Subscriber(std::shared_ptr<Poco::Net::WebSocket>& ws)
        : _ws(ws)
    {
        Log::info("Subscriber ctor.");
    }

    ~Subscriber()
    {
        Log::info("Subscriber dtor.");
    }

    bool notify(const std::string& message)
    {
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

private:
    /// WebSocket to use to send messages to session
    std::weak_ptr<Poco::Net::WebSocket> _ws;

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
            return std::to_string(_nActiveDocuments);
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

    void subscribe(std::shared_ptr<Poco::Net::WebSocket>& ws)
    {
        _subscribers.push_back(ws);
    }

private:
    // FIXME: we have a problem if new document to be added has PID = expired document in the map
    // Prolly, *move* expired documents to another container (?)
    void addDocument(Poco::Process::PID pid, std::string url)
    {
        std::pair<std::map<Poco::Process::PID, Document>::iterator, bool > ret;
        ret = _documents.insert(std::pair<Poco::Process::PID, Document>(pid, Document(pid, url)));
        if (!ret.second)
        {
            Log::warn() << "Document with PID [" + std::to_string(pid) + "] already exists." << Log::end;
        }
        else
        {
            _nActiveDocuments++;
        }
    }

    void removeDocument(Poco::Process::PID pid)
    {
        auto it = _documents.find(pid);
        if (it != _documents.end() && !it->second.isExpired())
        {
            it->second.expire();
            _nActiveDocuments--;
        }
    }

    void notify(const std::string& message)
    {
        auto it = std::begin(_subscribers);
        while (it != std::end(_subscribers))
        {
            if (!it->notify(message))
            {
                it = _subscribers.erase(it);
            }
            else
            {
                it++;
            }
        }
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
    std::vector<Subscriber> _subscribers;
    std::map<Poco::Process::PID, Document> _documents;

    /// Number of active documents
    unsigned _nActiveDocuments = 0;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
