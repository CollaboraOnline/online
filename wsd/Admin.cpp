/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <cassert>
#include <mutex>
#include <sys/poll.h>

#include <Poco/Net/HTTPCookie.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPRequestHandler.h>
#include <Poco/Net/HTTPServerParams.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTTPServerResponse.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/SecureServerSocket.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Util/ServerApplication.h>
#include <Poco/Util/Timer.h>

#include "Admin.hpp"
#include "AdminModel.hpp"
#include "Auth.hpp"
#include "Common.hpp"
#include "FileServer.hpp"
#include "IoUtil.hpp"
#include "Protocol.hpp"
#include "LOOLWebSocket.hpp"
#include "LOOLWSD.hpp"
#include "Log.hpp"
#include "Storage.hpp"
#include "TileCache.hpp"
#include "Unit.hpp"
#include "Util.hpp"

#include "common/SigUtil.hpp"

using namespace LOOLProtocol;

using Poco::StringTokenizer;
using Poco::Net::HTTPRequestHandler;
using Poco::Net::HTTPResponse;
using Poco::Net::HTTPServerRequest;
using Poco::Net::HTTPServerResponse;
using Poco::Util::Application;

bool AdminRequestHandler::adminCommandHandler(const std::vector<char>& payload)
{
    const std::string firstLine = getFirstLine(payload.data(), payload.size());
    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
    LOG_TRC("Recv: " << firstLine);

    if (tokens.count() < 1)
        return false;

    std::unique_lock<std::mutex> modelLock(_admin->getLock());
    AdminModel& model = _admin->getModel();

    if (tokens.count() > 1 && tokens[0] == "auth")
    {
        std::string jwtToken;
        LOOLProtocol::getTokenString(tokens[1], "jwt", jwtToken);
        const auto& config = Application::instance().config();
        const auto sslKeyPath = config.getString("ssl.key_file_path", "");

        LOG_INF("Verifying JWT token: " << jwtToken);
        JWTAuth authAgent(sslKeyPath, "admin", "admin", "admin");
        if (authAgent.verify(jwtToken))
        {
            LOG_TRC("JWT token is valid");
            _isAuthenticated = true;
        }
        else
        {
            sendTextFrame("InvalidAuthToken");
            return false;
        }
    }

    if (!_isAuthenticated)
    {
        sendTextFrame("NotAuthenticated");
        return false;
    }
    else if (tokens[0] == "documents" ||
             tokens[0] == "active_users_count" ||
             tokens[0] == "active_docs_count" ||
             tokens[0] == "mem_stats" ||
             tokens[0] == "cpu_stats")
    {
        const std::string result = model.query(tokens[0]);
        if (!result.empty())
        {
            sendTextFrame(tokens[0] + ' ' + result);
        }
    }
    else if (tokens[0] == "subscribe" && tokens.count() > 1)
    {
        for (std::size_t i = 0; i < tokens.count() - 1; i++)
        {
            model.subscribe(_sessionId, tokens[i + 1]);
        }
    }
    else if (tokens[0] == "unsubscribe" && tokens.count() > 1)
    {
        for (std::size_t i = 0; i < tokens.count() - 1; i++)
        {
            model.unsubscribe(_sessionId, tokens[i + 1]);
        }
    }
    else if (tokens[0] == "total_mem")
    {
        const auto totalMem = _admin->getTotalMemoryUsage();
        sendTextFrame("total_mem " + std::to_string(totalMem));
    }
    else if (tokens[0] == "kill" && tokens.count() == 2)
    {
        try
        {
            const auto pid = std::stoi(tokens[1]);
            LOG_INF("Admin request to kill PID: " << pid);
            SigUtil::killChild(pid);
        }
        catch (std::invalid_argument& exc)
        {
            LOG_WRN("Invalid PID to kill: " << tokens[1]);
        }
    }
    else if (tokens[0] == "settings")
    {
        // for now, we have only these settings
        std::ostringstream oss;
        oss << tokens[0] << " "
            << "mem_stats_size=" << model.query("mem_stats_size") << " "
            << "mem_stats_interval=" << std::to_string(_admin->getMemStatsInterval()) << " "
            << "cpu_stats_size="  << model.query("cpu_stats_size") << " "
            << "cpu_stats_interval=" << std::to_string(_admin->getCpuStatsInterval());

        std::string responseFrame = oss.str();
        sendTextFrame(responseFrame);
    }
    else if (tokens[0] == "shutdown")
    {
        LOG_INF("Shutdown requested by admin.");
        SigUtil::requestShutdown();
        return false;
    }
    else if (tokens[0] == "set" && tokens.count() > 1)
    {
        for (size_t i = 1; i < tokens.count(); i++)
        {
            StringTokenizer setting(tokens[i], "=", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            unsigned settingVal = 0;
            try
            {
                settingVal = std::stoi(setting[1]);
            }
            catch (const std::exception& exc)
            {
                LOG_WRN("Invalid setting value: " << setting[1] <<
                        " for " << setting[0]);
                return false;
            }

            if (setting[0] == "mem_stats_size")
            {
                if (settingVal != static_cast<unsigned>(std::stoi(model.query(setting[0]))))
                {
                    model.setMemStatsSize(settingVal);
                }
            }
            else if (setting[0] == "mem_stats_interval")
            {
                if (settingVal != _admin->getMemStatsInterval())
                {
                    _admin->rescheduleMemTimer(settingVal);
                    model.clearMemStats();
                    model.notify("settings mem_stats_interval=" + std::to_string(settingVal));
                }
            }
            else if (setting[0] == "cpu_stats_size")
            {
                if (settingVal != static_cast<unsigned>(std::stoi(model.query(setting[0]))))
                {
                    model.setCpuStatsSize(settingVal);
                }
            }
            else if (setting[0] == "cpu_stats_interval")
            {
                if (settingVal != _admin->getCpuStatsInterval())
                {
                    _admin->rescheduleCpuTimer(settingVal);
                    model.clearCpuStats();
                    model.notify("settings cpu_stats_interval=" + std::to_string(settingVal));
                }
            }
        }
    }

    return true;
}

/// Handle admin requests.
void AdminRequestHandler::handleWSRequests(HTTPServerRequest& request, HTTPServerResponse& response, int sessionId)
{
    _adminWs = std::make_shared<LOOLWebSocket>(request, response);

    {
        std::unique_lock<std::mutex> modelLock(_admin->getLock());
        // Subscribe the websocket of any AdminModel updates
        AdminModel& model = _admin->getModel();
        _sessionId = sessionId;
        model.subscribe(_sessionId, _adminWs);
    }

    IoUtil::SocketProcessor(_adminWs, "admin",
                            [this](const std::vector<char>& payload)
                            {
                                return adminCommandHandler(payload);
                            },
                            []() { },
                            []() { return TerminationFlag.load(); });

    LOG_DBG("Finishing Admin Session " << Util::encodeId(sessionId));
}

AdminRequestHandler::AdminRequestHandler(Admin* adminManager)
    : _admin(adminManager),
      _sessionId(0),
      _isAuthenticated(false)
{
}

void AdminRequestHandler::sendTextFrame(const std::string& message)
{
    UnitWSD::get().onAdminQueryMessage(message);
    _adminWs->sendFrame(message.data(), message.size());
}

void AdminRequestHandler::handleRequest(HTTPServerRequest& request, HTTPServerResponse& response)
{
    // Different session id pool for admin sessions (?)
    const auto sessionId = Util::decodeId(LOOLWSD::GenSessionId());

    Util::setThreadName("admin_ws_" + std::to_string(sessionId));

    LOG_DBG("Thread started.");

    try
    {
        std::string requestURI = request.getURI();
        StringTokenizer pathTokens(requestURI, "/", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

        if (request.find("Upgrade") != request.end() && Poco::icompare(request["Upgrade"], "websocket") == 0)
        {
            handleWSRequests(request, response, sessionId);
        }
    }
    catch(const Poco::Net::NotAuthenticatedException& exc)
    {
        LOG_INF("Admin::NotAuthenticated");
        response.set("WWW-Authenticate", "Basic realm=\"online\"");
        response.setStatusAndReason(HTTPResponse::HTTP_UNAUTHORIZED);
        response.setContentLength(0);
        response.send();
    }
    catch (const std::exception& exc)
    {
        LOG_INF("Admin::handleRequest: Exception: " << exc.what());
        response.setStatusAndReason(HTTPResponse::HTTP_BAD_REQUEST);
        response.setContentLength(0);
        response.send();
    }

    LOG_DBG("Thread finished.");
}

/// An admin command processor.
Admin::Admin() :
    _model(AdminModel()),
    _forKitPid(0)
{
    LOG_INF("Admin ctor.");

    std::unique_lock<std::mutex> modelLock(getLock());
    const auto totalMem = getTotalMemoryUsage();
    LOG_TRC("Total memory used: " << totalMem);
    _model.addMemStats(totalMem);

    _memStatsTask.reset(new MemoryStatsTask(this));
    _memStatsTimer.schedule(_memStatsTask.get(), _memStatsTaskInterval, _memStatsTaskInterval);

    _cpuStatsTask = new CpuStats(this);
    _cpuStatsTimer.schedule(_cpuStatsTask, _cpuStatsTaskInterval, _cpuStatsTaskInterval);
}

Admin::~Admin()
{
    LOG_INF("~Admin dtor.");

    _memStatsTask->cancel();
    _cpuStatsTask->cancel();
}

void Admin::addDoc(const std::string& docKey, Poco::Process::PID pid, const std::string& filename, const std::string& sessionId)
{
    std::unique_lock<std::mutex> modelLock(_modelMutex);
    _model.addDocument(docKey, pid, filename, sessionId);
}

void Admin::rmDoc(const std::string& docKey, const std::string& sessionId)
{
    std::unique_lock<std::mutex> modelLock(_modelMutex);
    _model.removeDocument(docKey, sessionId);
}

void Admin::rmDoc(const std::string& docKey)
{
    std::unique_lock<std::mutex> modelLock(_modelMutex);
    LOG_INF("Removing complete doc [" << docKey << "] from Admin.");
    _model.removeDocument(docKey);
}

void MemoryStatsTask::run()
{
    std::unique_lock<std::mutex> modelLock(_admin->getLock());
    const auto totalMem = _admin->getTotalMemoryUsage();

    if (totalMem != _lastTotalMemory)
    {
        LOG_TRC("Total memory used: " << totalMem);
        _lastTotalMemory = totalMem;
    }

    _admin->getModel().addMemStats(totalMem);
}

void CpuStats::run()
{
    //TODO: Implement me
    //std::unique_lock<std::mutex> modelLock(_admin->getLock());
    //model.addCpuStats(totalMem);
}

void Admin::rescheduleMemTimer(unsigned interval)
{
    _memStatsTask->cancel();
    _memStatsTaskInterval = interval;
    _memStatsTask.reset(new MemoryStatsTask(this));
    _memStatsTimer.schedule(_memStatsTask.get(), _memStatsTaskInterval, _memStatsTaskInterval);
    LOG_INF("Memory stats interval changed - New interval: " << interval);
}

void Admin::rescheduleCpuTimer(unsigned interval)
{
    _cpuStatsTask->cancel();
    _cpuStatsTaskInterval = interval;
    _cpuStatsTask = new CpuStats(this);
    _cpuStatsTimer.schedule(_cpuStatsTask, _cpuStatsTaskInterval, _cpuStatsTaskInterval);
    LOG_INF("CPU stats interval changed - New interval: " << interval);
}

unsigned Admin::getTotalMemoryUsage()
{
    Util::assertIsLocked(_modelMutex);

    // PSS would be wrong for forkit since we will have one or
    // more prespawned kits that will share their pages with forkit,
    // but we don't count the kits unless and until a document is loaded.
    // So RSS is a decent approximation (albeit slightly on the high side).
    const size_t forkitRssKb = Util::getMemoryUsageRSS(_forKitPid);
    const size_t wsdPssKb = Util::getMemoryUsagePSS(Poco::Process::id());
    const size_t kitsPssKb = _model.getKitsMemoryUsage();
    const size_t totalMem = wsdPssKb + forkitRssKb + kitsPssKb;

    LOG_TRC("Total mem: " << totalMem << ", wsd pss: " << wsdPssKb <<
            ", forkit rss: " << forkitRssKb << ", kits pss: " << kitsPssKb);
    return totalMem;
}

unsigned Admin::getMemStatsInterval()
{
    return _memStatsTaskInterval;
}

unsigned Admin::getCpuStatsInterval()
{
    return _cpuStatsTaskInterval;
}

AdminModel& Admin::getModel()
{
    return _model;
}

void Admin::updateLastActivityTime(const std::string& docKey)
{
    std::unique_lock<std::mutex> modelLock(_modelMutex);
    _model.updateLastActivityTime(docKey);
}

void Admin::updateMemoryPss(const std::string& docKey, int pss)
{
    std::unique_lock<std::mutex> modelLock(_modelMutex);
    _model.updateMemoryPss(docKey, pss);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
