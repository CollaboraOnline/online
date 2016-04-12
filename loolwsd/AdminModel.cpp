/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <memory>
#include <set>
#include <sstream>
#include <string>

#include <Poco/Net/WebSocket.h>
#include <Poco/Process.h>
#include <Poco/StringTokenizer.h>

#include "AdminModel.hpp"
#include "Util.hpp"

using Poco::StringTokenizer;

/////////////////
// Document Impl
////////////////
void Document::addView(int nSessionId)
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

void Document::removeView(int nSessionId)
{
    auto it = _views.find(nSessionId);
    if (it != _views.end())
    {
        it->second.expire();
        _nActiveViews--;
    }
}

///////////////////
// Subscriber Impl
//////////////////
bool Subscriber::notify(const std::string& message)
{
    StringTokenizer tokens(message, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

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

bool  Subscriber::subscribe(const std::string& command)
{
    auto ret = _subscriptions.insert(command);
    return ret.second;
}

void  Subscriber::unsubscribe(const std::string& command)
{
    _subscriptions.erase(command);
}

///////////////////
// AdminModel Impl
//////////////////

void AdminModel::update(const std::string& data)
{
    StringTokenizer tokens(data, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

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

std::string AdminModel::query(const std::string& command)
{
    StringTokenizer tokens(command, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

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
unsigned AdminModel::getTotalMemoryUsage()
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

void AdminModel::subscribe(int nSessionId, std::shared_ptr<Poco::Net::WebSocket>& ws)
{
    const auto ret = _subscribers.emplace(nSessionId, Subscriber(nSessionId, ws));
    if (!ret.second)
    {
        Log::warn() << "Subscriber already exists" << Log::end;
    }
}

void AdminModel::subscribe(int nSessionId, const std::string& command)
{
    auto subscriber = _subscribers.find(nSessionId);
    if (subscriber == _subscribers.end() )
        return;

    subscriber->second.subscribe(command);
}

void AdminModel::unsubscribe(int nSessionId, const std::string& command)
{
    auto subscriber = _subscribers.find(nSessionId);
    if (subscriber == _subscribers.end())
        return;

    subscriber->second.unsubscribe(command);
}

void AdminModel::addMemStats(unsigned memUsage)
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

void AdminModel::addCpuStats(unsigned cpuUsage)
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

void AdminModel::setCpuStatsSize(unsigned size)
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

void AdminModel::setMemStatsSize(unsigned size)
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

void AdminModel::notify(const std::string& message)
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

void AdminModel::addDocument(Poco::Process::PID pid, const std::string& url)
{
    _documents.emplace(pid, Document(pid, url));
}

void AdminModel::removeDocument(Poco::Process::PID pid)
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

std::string AdminModel::getMemStats()
{
    std::string response;
    for (auto& i: _memStats)
    {
        response += std::to_string(i) + ",";
    }

    return response;
}

std::string AdminModel::getCpuStats()
{
    std::string response;
    for (auto& i: _cpuStats)
    {
        response += std::to_string(i) + ",";
    }

    return response;
}

unsigned AdminModel::getTotalActiveViews()
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

std::string AdminModel::getDocuments()
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
        std::string sElapsed = std::to_string(it.second.getElapsedTime());

        oss << sPid << " "
            << sUrl << " "
            << sViews << " "
            << sMem << " "
            << sElapsed << " \n ";
    }

    return oss.str();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
