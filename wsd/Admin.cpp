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
#include <Poco/StringTokenizer.h>

#include "Admin.hpp"
#include "AdminModel.hpp"
#include "Auth.hpp"
#include "Common.hpp"
#include "FileServer.hpp"
#include "IoUtil.hpp"
#include "Protocol.hpp"
#include "LOOLWSD.hpp"
#include "Log.hpp"
#include "Storage.hpp"
#include "TileCache.hpp"
#include "Unit.hpp"
#include "Util.hpp"

#include "net/Socket.hpp"
#include "net/WebSocketHandler.hpp"

#include "common/SigUtil.hpp"

using namespace LOOLProtocol;

using Poco::StringTokenizer;
using Poco::Net::HTTPResponse;
using Poco::Util::Application;

/// Process incoming websocket messages
void AdminSocketHandler::handleMessage(bool /* fin */, WSOpCode /* code */,
                                       std::vector<char> &payload)
{
    // FIXME: check fin, code etc.
    const std::string firstLine = getFirstLine(payload.data(), payload.size());
    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
    LOG_TRC("Recv: " << firstLine << " tokens " << tokens.count());

    if (tokens.count() < 1)
    {
        LOG_TRC("too few tokens");
        return;
    }

    AdminModel& model = _admin->getModel();

    if (tokens[0] == "auth")
    {
        if (tokens.count() < 2)
        {
            LOG_DBG("Auth command without any token");
            sendMessage("InvalidAuthToken");
            shutdown();
            return;
        }
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
            return;
        }
        else
        {
            LOG_DBG("Invalid auth token");
            sendMessage("InvalidAuthToken");
            shutdown();
            return;
        }
    }

    if (!_isAuthenticated)
    {
        LOG_DBG("Not authenticated - message is '" << firstLine << "' " <<
                tokens.count() << " first: '" << tokens[0] << "'");
        sendMessage("NotAuthenticated");
        shutdown();
        return;
    }
    else if (tokens[0] == "documents" ||
             tokens[0] == "active_users_count" ||
             tokens[0] == "active_docs_count" ||
             tokens[0] == "mem_stats" ||
             tokens[0] == "cpu_stats")
    {
        const std::string result = model.query(tokens[0]);
        if (!result.empty())
            sendTextFrame(tokens[0] + ' ' + result);
    }
    else if (tokens[0] == "version")
    {
        // Send LOOL version information
        std::string version, hash;
        Util::getVersionInfo(version, hash);
        std::string versionStr =
            "{ \"Version\":  \"" + version + "\", " +
            "\"Hash\":  \"" + hash  + "\" }";
        sendTextFrame("loolserver " + versionStr);
        // Send LOKit version information
        sendTextFrame("lokitversion " + LOOLWSD::LOKitVersion);
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
        oss << "settings "
            << "mem_stats_size=" << model.query("mem_stats_size") << ' '
            << "mem_stats_interval=" << std::to_string(_admin->getMemStatsInterval()) << ' '
            << "cpu_stats_size="  << model.query("cpu_stats_size") << ' '
            << "cpu_stats_interval=" << std::to_string(_admin->getCpuStatsInterval()) << ' ';

        const DocProcSettings& docProcSettings = _admin->getDefDocProcSettings();
        oss << "limit_virt_mem_mb=" << docProcSettings.LimitVirtMemMb << ' '
            << "limit_stack_mem_kb=" << docProcSettings.LimitStackMemKb << ' '
            << "limit_file_size_mb=" << docProcSettings.LimitFileSizeMb << ' ';

        sendTextFrame(oss.str());
    }
    else if (tokens[0] == "shutdown")
    {
        LOG_INF("Shutdown requested by admin.");
        ShutdownRequestFlag = true;
        SocketPoll::wakeupWorld();
        return;
    }
    else if (tokens[0] == "set" && tokens.count() > 1)
    {
        for (size_t i = 1; i < tokens.count(); i++)
        {
            StringTokenizer setting(tokens[i], "=", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            int settingVal = 0;
            try
            {
                settingVal = std::stoi(setting[1]);
            }
            catch (const std::exception& exc)
            {
                LOG_WRN("Invalid setting value: " << setting[1] <<
                        " for " << setting[0]);
                return;
            }

            const std::string settingName = setting[0];
            if (settingName == "mem_stats_size")
            {
                if (settingVal != std::stoi(model.query(settingName)))
                {
                    model.setMemStatsSize(settingVal);
                }
            }
            else if (settingName == "mem_stats_interval")
            {
                if (settingVal != static_cast<int>(_admin->getMemStatsInterval()))
                {
                    _admin->rescheduleMemTimer(settingVal);
                    model.clearMemStats();
                    model.notify("settings mem_stats_interval=" + std::to_string(settingVal));
                }
            }
            else if (settingName == "cpu_stats_size")
            {
                if (settingVal != std::stoi(model.query(settingName)))
                {
                    model.setCpuStatsSize(settingVal);
                }
            }
            else if (settingName == "cpu_stats_interval")
            {
                if (settingVal != static_cast<int>(_admin->getCpuStatsInterval()))
                {
                    _admin->rescheduleCpuTimer(settingVal);
                    model.clearCpuStats();
                    model.notify("settings cpu_stats_interval=" + std::to_string(settingVal));
                }
            }
            else if (LOOLProtocol::matchPrefix("limit_", settingName))
            {
                DocProcSettings docProcSettings = _admin->getDefDocProcSettings();
                if (settingName == "limit_virt_mem_mb")
                    docProcSettings.LimitVirtMemMb = settingVal;
                else if (settingName == "limit_stack_mem_kb")
                    docProcSettings.LimitStackMemKb = settingVal;
                else if (settingName == "limit_file_size_mb")
                    docProcSettings.LimitFileSizeMb = settingVal;
                else
                    LOG_ERR("Unknown limit: " << settingName);

                model.notify("settings " + settingName + '=' + std::to_string(settingVal));
                _admin->setDefDocProcSettings(docProcSettings);
            }
        }
    }
}

AdminSocketHandler::AdminSocketHandler(Admin* adminManager,
                                       const std::weak_ptr<StreamSocket>& socket,
                                       const Poco::Net::HTTPRequest& request)
    : WebSocketHandler(socket, request),
      _admin(adminManager),
      _sessionId(0),
      _isAuthenticated(false)
{
}

void AdminSocketHandler::sendTextFrame(const std::string& message)
{
    UnitWSD::get().onAdminQueryMessage(message);
    if (_isAuthenticated)
        sendMessage(message);
    else
        LOG_TRC("Skip sending message to non-authenticated client: '" << message << "'");
}

bool AdminSocketHandler::handleInitialRequest(
    const std::weak_ptr<StreamSocket> &socketWeak,
    const Poco::Net::HTTPRequest& request)
{
    auto socket = socketWeak.lock();

    // Different session id pool for admin sessions (?)
    const auto sessionId = Util::decodeId(LOOLWSD::GenSessionId());

    const std::string& requestURI = request.getURI();
    StringTokenizer pathTokens(requestURI, "/", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    if (request.find("Upgrade") != request.end() && Poco::icompare(request["Upgrade"], "websocket") == 0)
    {
        Admin &admin = Admin::instance();
        auto handler = std::make_shared<AdminSocketHandler>(&admin, socketWeak, request);
        socket->setHandler(handler);
        admin.addCallback([handler, sessionId]
        {
            Admin &adminIn = Admin::instance();
            AdminModel& model = adminIn.getModel();
            handler->_sessionId = sessionId;
            model.subscribe(sessionId, handler);
        });
        return true;
    }

    HTTPResponse response;
    response.setStatusAndReason(HTTPResponse::HTTP_BAD_REQUEST);
    response.setContentLength(0);
    LOG_INF("Admin::handleInitialRequest bad request");
    socket->send(response);

    return false;
}

/// An admin command processor.
Admin::Admin() :
    SocketPoll("admin"),
    _model(AdminModel()),
    _forKitPid(-1),
    _forKitWritePipe(-1),
    _lastTotalMemory(0),
    _memStatsTaskIntervalMs(5000),
    _cpuStatsTaskIntervalMs(5000)
{
    LOG_INF("Admin ctor.");

    _totalSysMem = Util::getTotalSystemMemory();
    LOG_TRC("Total system memory : " << _totalSysMem);

    const auto totalMem = getTotalMemoryUsage();
    LOG_TRC("Total memory used: " << totalMem);
    _model.addMemStats(totalMem);
}

Admin::~Admin()
{
    LOG_INF("~Admin dtor.");
}

void Admin::pollingThread()
{
    std::chrono::steady_clock::time_point lastCPU, lastMem;

    _model.setThreadOwner(std::this_thread::get_id());

    lastCPU = std::chrono::steady_clock::now();
    lastMem = lastCPU;

    while (!_stop && !TerminationFlag && !ShutdownRequestFlag)
    {
        std::chrono::steady_clock::time_point now = std::chrono::steady_clock::now();
        int cpuWait = _cpuStatsTaskIntervalMs -
            std::chrono::duration_cast<std::chrono::milliseconds>(now - lastCPU).count();
        if (cpuWait <= 0)
        {
            // TODO: implement me ...
            lastCPU = now;
            cpuWait += _cpuStatsTaskIntervalMs;
        }
        int memWait = _memStatsTaskIntervalMs -
            std::chrono::duration_cast<std::chrono::milliseconds>(now - lastMem).count();
        if (memWait <= 0)
        {
            const auto totalMem = getTotalMemoryUsage();
            if (totalMem != _lastTotalMemory)
            {
                LOG_TRC("Total memory used: " << totalMem);
                _lastTotalMemory = totalMem;
            }

            _model.addMemStats(totalMem);

            lastMem = now;
            memWait += _memStatsTaskIntervalMs;

            // If our total memory consumption is above limit, cleanup
            triggerMemoryCleanup(totalMem);
        }

        // Handle websockets & other work.
        int timeout = std::min(cpuWait, memWait);
        LOG_TRC("Admin poll for " << timeout << "ms");
        poll(timeout);
    }
}

void Admin::modificationAlert(const std::string& dockey, Poco::Process::PID pid, bool value){
    addCallback([this, dockey, pid, value]
                { _model.modificationAlert(dockey, pid, value); });
}

void Admin::addDoc(const std::string& docKey, Poco::Process::PID pid, const std::string& filename,
        const std::string& sessionId, const std::string& userName, const std::string& userId)
{
    addCallback([this, docKey, pid, filename, sessionId, userName, userId]
                 { _model.addDocument(docKey, pid, filename, sessionId, userName, userId); });
}

void Admin::rmDoc(const std::string& docKey, const std::string& sessionId)
{
    addCallback([this, docKey, sessionId]
                 { _model.removeDocument(docKey, sessionId); });
}

void Admin::rmDoc(const std::string& docKey)
{
    LOG_INF("Removing complete doc [" << docKey << "] from Admin.");
    addCallback([this, docKey]{ _model.removeDocument(docKey); });
}

void Admin::rescheduleMemTimer(unsigned interval)
{
    _memStatsTaskIntervalMs = interval;
    LOG_INF("Memory stats interval changed - New interval: " << interval);
    wakeup();
}

void Admin::rescheduleCpuTimer(unsigned interval)
{
    _cpuStatsTaskIntervalMs = interval;
    LOG_INF("CPU stats interval changed - New interval: " << interval);
    wakeup();
}

unsigned Admin::getTotalMemoryUsage()
{
    // To simplify and clarify this; since load, link and pre-init all
    // inside the forkit - we should account all of our fixed cost of
    // memory to the forkit; and then count only dirty pages in the clients
    // since we know that they share everything else with the forkit.
    const size_t forkitRssKb = Util::getMemoryUsageRSS(_forKitPid);
    const size_t wsdPssKb = Util::getMemoryUsagePSS(Poco::Process::id());
    const size_t kitsDirtyKb = _model.getKitsMemoryUsage();
    const size_t totalMem = wsdPssKb + forkitRssKb + kitsDirtyKb;

    return totalMem;
}

unsigned Admin::getMemStatsInterval()
{
    return _memStatsTaskIntervalMs;
}

unsigned Admin::getCpuStatsInterval()
{
    return _cpuStatsTaskIntervalMs;
}

AdminModel& Admin::getModel()
{
    return _model;
}

void Admin::updateLastActivityTime(const std::string& docKey)
{
    addCallback([this, docKey]{ _model.updateLastActivityTime(docKey); });
}

void Admin::updateMemoryDirty(const std::string& docKey, int dirty)
{
    addCallback([this, docKey, dirty]
                 { _model.updateMemoryDirty(docKey, dirty); });
}


void Admin::triggerMemoryCleanup(size_t totalMem)
{
    LOG_TRC("Total memory we are consuming (in kB): " << totalMem);
    // Trigger mem cleanup when we are consuming too much memory (as configured by sysadmin)
    const auto memLimit = LOOLWSD::getConfigValue<double>("memproportion", static_cast<double>(0.0));
    LOG_TRC("Mem proportion for LOOL configured : " << memLimit);
    if (memLimit == 0.0 || _totalSysMem == 0)
    {
        LOG_TRC("Not configured to do memory cleanup. Skipping memory cleanup.");
        return;
    }

    float memToFreePercentage = 0;
    if ( (memToFreePercentage = (totalMem/static_cast<double>(_totalSysMem)) - memLimit/100.) > 0.0 )
    {
        int memToFree = memToFreePercentage * _totalSysMem;
        LOG_TRC("Memory to be freed (in kB) : " << memToFree);
        // prepare document list sorted by most idle times
        std::list<DocBasicInfo> docList = _model.getDocumentsSortedByIdle();

        LOG_TRC("Checking saved documents in document list, length: " << docList.size());
        // Kill the saved documents first
        std::list<DocBasicInfo>::iterator docIt = docList.begin();
        while (docIt != docList.end() && memToFree > 0)
        {
            LOG_TRC("Document: DocKey[" << docIt->_docKey << "], Idletime[" << docIt->_idleTime << "],"
                    << " Saved: [" << docIt->_saved << "], Mem: [" << docIt->_mem << "].");
            if (docIt->_saved)
            {
                // Kill and remove from list
                LOG_DBG("OOM: Killing saved document with DocKey " << docIt->_docKey);
                LOOLWSD::closeDocument(docIt->_docKey, "oom");
                memToFree -= docIt->_mem;
                docIt = docList.erase(docIt);
            }
            else
                ++docIt;
        }
    }

    LOG_TRC("OOM: Memory to free percentage : " << memToFreePercentage);
}

void Admin::notifyForkit()
{
    std::ostringstream oss;
    oss << "setconfig limit_virt_mem_mb " << _defDocProcSettings.LimitVirtMemMb << '\n'
        << "setconfig limit_stack_mem_kb " << _defDocProcSettings.LimitStackMemKb << '\n'
        << "setconfig limit_file_size_mb " << _defDocProcSettings.LimitFileSizeMb << '\n';
    IoUtil::writeToPipe(_forKitWritePipe, oss.str());
}

void Admin::dumpState(std::ostream& os)
{
    // FIXME: be more helpful ...
    SocketPoll::dumpState(os);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
