/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <cassert>
#include <mutex>
#include <sys/poll.h>
#include <unistd.h>

#include <Poco/Net/HTTPCookie.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>

#include "Admin.hpp"
#include "AdminModel.hpp"
#include "Auth.hpp"
#include <Common.hpp>
#include "FileServer.hpp"
#include <IoUtil.hpp>
#include "LOOLWSD.hpp"
#include <Log.hpp>
#include <Protocol.hpp>
#include "Storage.hpp"
#include "TileCache.hpp"
#include <Unit.hpp>
#include <Util.hpp>

#include <net/Socket.hpp>
#include <net/SslSocket.hpp>
#include <net/WebSocketHandler.hpp>

#include <common/SigUtil.hpp>
#include <common/Authorization.hpp>

using namespace LOOLProtocol;

using Poco::Net::HTTPResponse;
using Poco::Util::Application;

const int Admin::MinStatsIntervalMs = 50;
const int Admin::DefStatsIntervalMs = 1000;

/// Process incoming websocket messages
void AdminSocketHandler::handleMessage(const std::vector<char> &payload)
{
    // FIXME: check fin, code etc.
    const std::string firstLine = getFirstLine(payload.data(), payload.size());
    StringVector tokens(LOOLProtocol::tokenize(firstLine, ' '));
    LOG_TRC("Recv: " << firstLine << " tokens " << tokens.size());

    if (tokens.empty())
    {
        LOG_TRC("too few tokens");
        return;
    }

    AdminModel& model = _admin->getModel();

    if (tokens.equals(0, "auth"))
    {
        if (tokens.size() < 2)
        {
            LOG_DBG("Auth command without any token");
            sendMessage("InvalidAuthToken");
            shutdown();
            return;
        }
        std::string jwtToken;
        LOOLProtocol::getTokenString(tokens[1], "jwt", jwtToken);

        LOG_INF("Verifying JWT token: " << jwtToken);
        JWTAuth authAgent("admin", "admin", "admin");
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
                tokens.size() << " first: '" << tokens[0] << "'");
        sendMessage("NotAuthenticated");
        shutdown();
        return;
    }
    else if (tokens.equals(0, "documents") ||
             tokens.equals(0, "active_users_count") ||
             tokens.equals(0, "active_docs_count") ||
             tokens.equals(0, "mem_stats") ||
             tokens.equals(0, "cpu_stats") ||
             tokens.equals(0, "sent_activity") ||
             tokens.equals(0, "recv_activity"))
    {
        const std::string result = model.query(tokens[0]);
        if (!result.empty())
            sendTextFrame(tokens[0] + ' ' + result);
    }
    else if (tokens.equals(0, "history"))
    {
        sendTextFrame("{ \"History\": " + model.getAllHistory() + "}");
    }
    else if (tokens.equals(0, "version"))
    {
        // Send LOOL version information
        sendTextFrame("loolserver " + LOOLWSD::getVersionJSON());
        // Send LOKit version information
        sendTextFrame("lokitversion " + LOOLWSD::LOKitVersion);
    }
    else if (tokens.equals(0, "subscribe") && tokens.size() > 1)
    {
        for (std::size_t i = 0; i < tokens.size() - 1; i++)
        {
            model.subscribe(_sessionId, tokens[i + 1]);
        }
    }
    else if (tokens.equals(0, "unsubscribe") && tokens.size() > 1)
    {
        for (std::size_t i = 0; i < tokens.size() - 1; i++)
        {
            model.unsubscribe(_sessionId, tokens[i + 1]);
        }
    }
    else if (tokens.equals(0, "mem_consumed"))
        sendTextFrame("mem_consumed " + std::to_string(_admin->getTotalMemoryUsage()));

    else if (tokens.equals(0, "total_avail_mem"))
        sendTextFrame("total_avail_mem " + std::to_string(_admin->getTotalAvailableMemory()));

    else if (tokens.equals(0, "sent_bytes"))
        sendTextFrame("sent_bytes " + std::to_string(model.getSentBytesTotal() / 1024));

    else if (tokens.equals(0, "recv_bytes"))
        sendTextFrame("recv_bytes " + std::to_string(model.getRecvBytesTotal() / 1024));

    else if (tokens.equals(0, "uptime"))
        sendTextFrame("uptime " + std::to_string(model.getServerUptime()));

    else if (tokens.equals(0, "kill") && tokens.size() == 2)
    {
        try
        {
            const int pid = std::stoi(tokens[1]);
            LOG_INF("Admin request to kill PID: " << pid);
            SigUtil::killChild(pid);
        }
        catch (std::invalid_argument& exc)
        {
            LOG_WRN("Invalid PID to kill: " << tokens[1]);
        }
    }
    else if (tokens.equals(0, "settings"))
    {
        // for now, we have only these settings
        std::ostringstream oss;
        oss << "settings "
            << "mem_stats_size=" << model.query("mem_stats_size") << ' '
            << "mem_stats_interval=" << std::to_string(_admin->getMemStatsInterval()) << ' '
            << "cpu_stats_size="  << model.query("cpu_stats_size") << ' '
            << "cpu_stats_interval=" << std::to_string(_admin->getCpuStatsInterval()) << ' '
            << "net_stats_size=" << model.query("net_stats_size") << ' '
            << "net_stats_interval=" << std::to_string(_admin->getNetStatsInterval()) << ' ';

        const DocProcSettings& docProcSettings = _admin->getDefDocProcSettings();
        oss << "limit_virt_mem_mb=" << docProcSettings.getLimitVirtMemMb() << ' '
            << "limit_stack_mem_kb=" << docProcSettings.getLimitStackMemKb() << ' '
            << "limit_file_size_mb=" << docProcSettings.getLimitFileSizeMb() << ' '
            << "limit_num_open_files=" << docProcSettings.getLimitNumberOpenFiles() << ' ';

        sendTextFrame(oss.str());
    }
    else if (tokens.equals(0, "shutdown"))
    {
        LOG_INF("Shutdown requested by admin.");
        SigUtil::requestShutdown();
        return;
    }
    else if (tokens.equals(0, "set") && tokens.size() > 1)
    {
        for (size_t i = 1; i < tokens.size(); i++)
        {
            StringVector setting(LOOLProtocol::tokenize(tokens[i], '='));
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
                    model.notify("settings mem_stats_interval=" + std::to_string(_admin->getMemStatsInterval()));
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
                    model.notify("settings cpu_stats_interval=" + std::to_string(_admin->getCpuStatsInterval()));
                }
            }
            else if (LOOLProtocol::matchPrefix("limit_", settingName))
            {
                DocProcSettings docProcSettings = _admin->getDefDocProcSettings();
                if (settingName == "limit_virt_mem_mb")
                    docProcSettings.setLimitVirtMemMb(settingVal);
                else if (settingName == "limit_stack_mem_kb")
                    docProcSettings.setLimitStackMemKb(settingVal);
                else if (settingName == "limit_file_size_mb")
                    docProcSettings.setLimitFileSizeMb(settingVal);
                else if (settingName == "limit_num_open_files")
                    docProcSettings.setLimitNumberOpenFiles(settingVal);
                else
                    LOG_ERR("Unknown limit: " << settingName);

                model.notify("settings " + settingName + '=' + std::to_string(settingVal));
                _admin->setDefDocProcSettings(docProcSettings, true);
            }
        }
    }
}

AdminSocketHandler::AdminSocketHandler(Admin* adminManager,
                                       const std::weak_ptr<StreamSocket>& socket,
                                       const Poco::Net::HTTPRequest& request)
    : WebSocketHandler(socket, request),
      _admin(adminManager),
      _isAuthenticated(false)
{
    // Different session id pool for admin sessions (?)
    _sessionId = Util::decodeId(LOOLWSD::GetConnectionId());
}

AdminSocketHandler::AdminSocketHandler(Admin* adminManager)
    : WebSocketHandler(true),
      _admin(adminManager),
      _isAuthenticated(true)
{
    _sessionId = Util::decodeId(LOOLWSD::GetConnectionId());
}

void AdminSocketHandler::sendTextFrame(const std::string& message)
{
    if (!Util::isFuzzing())
    {
        UnitWSD::get().onAdminQueryMessage(message);
    }

    if (_isAuthenticated)
    {
        LOG_TRC("send admin text frame '" << message << "'");
        sendMessage(message);
    }
    else
        LOG_TRC("Skip sending message to non-authenticated client: '" << message << "'");
}

void AdminSocketHandler::subscribeAsync(const std::shared_ptr<AdminSocketHandler>& handler)
{
    Admin &admin = Admin::instance();

    admin.addCallback([handler]
        {
            Admin &adminIn = Admin::instance();
            adminIn.getModel().subscribe(handler->_sessionId, handler);
        });
}

bool AdminSocketHandler::handleInitialRequest(
    const std::weak_ptr<StreamSocket> &socketWeak,
    const Poco::Net::HTTPRequest& request)
{
    if (!LOOLWSD::AdminEnabled)
    {
        LOG_ERR("Request for disabled admin console");
        return false;
    }

    std::shared_ptr<StreamSocket> socket = socketWeak.lock();

    const std::string& requestURI = request.getURI();
    StringVector pathTokens(LOOLProtocol::tokenize(requestURI, '/'));

    if (request.find("Upgrade") != request.end() && Poco::icompare(request["Upgrade"], "websocket") == 0)
    {
        Admin &admin = Admin::instance();
        auto handler = std::make_shared<AdminSocketHandler>(&admin, socketWeak, request);
        socket->setHandler(handler);

        AdminSocketHandler::subscribeAsync(handler);

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
    _lastJiffies(0),
    _lastSentCount(0),
    _lastRecvCount(0),
    _cpuStatsTaskIntervalMs(DefStatsIntervalMs),
    _memStatsTaskIntervalMs(DefStatsIntervalMs * 2),
    _netStatsTaskIntervalMs(DefStatsIntervalMs * 2)
{
    LOG_INF("Admin ctor.");

    _totalSysMemKb = Util::getTotalSystemMemoryKb();
    LOG_TRC("Total system memory:  " << _totalSysMemKb << " KB.");

    const auto memLimit = LOOLWSD::getConfigValue<double>("memproportion", 0.0);
    _totalAvailMemKb = _totalSysMemKb;
    if (memLimit != 0.0)
        _totalAvailMemKb = _totalSysMemKb * memLimit / 100.;

    LOG_TRC("Total available memory: " << _totalAvailMemKb << " KB (memproportion: " << memLimit << "%).");

    const size_t totalMem = getTotalMemoryUsage();
    LOG_TRC("Total memory used: " << totalMem << " KB.");
    _model.addMemStats(totalMem);
}

Admin::~Admin()
{
    LOG_INF("~Admin dtor.");
}

void Admin::pollingThread()
{
    std::chrono::steady_clock::time_point lastCPU, lastMem, lastNet;

    _model.setThreadOwner(std::this_thread::get_id());

    lastCPU = std::chrono::steady_clock::now();
    lastMem = lastCPU;
    lastNet = lastCPU;

    while (!isStop() && !SigUtil::getTerminationFlag() && !SigUtil::getShutdownRequestFlag())
    {
        const std::chrono::steady_clock::time_point now = std::chrono::steady_clock::now();

        int cpuWait = _cpuStatsTaskIntervalMs -
            std::chrono::duration_cast<std::chrono::milliseconds>(now - lastCPU).count();
        if (cpuWait <= MinStatsIntervalMs / 2) // Close enough
        {
            const size_t currentJiffies = getTotalCpuUsage();
            const size_t cpuPercent = 100 * 1000 * currentJiffies / (sysconf (_SC_CLK_TCK) * _cpuStatsTaskIntervalMs);
            _model.addCpuStats(cpuPercent);

            cpuWait += _cpuStatsTaskIntervalMs;
            lastCPU = now;
        }

        int memWait = _memStatsTaskIntervalMs -
            std::chrono::duration_cast<std::chrono::milliseconds>(now - lastMem).count();
        if (memWait <= MinStatsIntervalMs / 2) // Close enough
        {
            const size_t totalMem = getTotalMemoryUsage();
            _model.addMemStats(totalMem);

            if (totalMem != _lastTotalMemory)
            {
                // If our total memory consumption is above limit, cleanup
                triggerMemoryCleanup(totalMem);

                _lastTotalMemory = totalMem;
            }

            memWait += _memStatsTaskIntervalMs;
            lastMem = now;
        }

        int netWait = _netStatsTaskIntervalMs -
            std::chrono::duration_cast<std::chrono::milliseconds>(now - lastNet).count();
        if (netWait <= MinStatsIntervalMs / 2) // Close enough
        {
            const uint64_t sentCount = _model.getSentBytesTotal();
            const uint64_t recvCount = _model.getRecvBytesTotal();

            _model.addSentStats(sentCount - _lastSentCount);
            _model.addRecvStats(recvCount - _lastRecvCount);

            if (_lastRecvCount != recvCount || _lastSentCount != sentCount)
            {
                LOG_TRC("Total Data sent: " << sentCount << ", recv: " << recvCount);
                _lastRecvCount = recvCount;
                _lastSentCount = sentCount;
            }

            netWait += _netStatsTaskIntervalMs;
            lastNet = now;
        }

        // (re)-connect (with sync. DNS - urk) to one monitor at a time
        if (_pendingConnects.size())
        {
            MonitorConnectRecord rec = _pendingConnects[0];
            if (rec.getWhen() < now)
            {
                _pendingConnects.erase(_pendingConnects.begin());
                connectToMonitorSync(rec.getUri());
            }
        }

        // Handle websockets & other work.
        const int timeout = capAndRoundInterval(std::min(std::min(cpuWait, memWait), netWait));
        LOG_TRC("Admin poll for " << timeout << "ms.");
        poll(timeout);
    }
}

void Admin::modificationAlert(const std::string& dockey, Poco::Process::PID pid, bool value){
    addCallback([=] { _model.modificationAlert(dockey, pid, value); });
}

void Admin::addDoc(const std::string& docKey, Poco::Process::PID pid, const std::string& filename,
        const std::string& sessionId, const std::string& userName, const std::string& userId)
{
    addCallback([=] { _model.addDocument(docKey, pid, filename, sessionId, userName, userId); });
}

void Admin::rmDoc(const std::string& docKey, const std::string& sessionId)
{
    addCallback([=] { _model.removeDocument(docKey, sessionId); });
}

void Admin::rmDoc(const std::string& docKey)
{
    LOG_INF("Removing complete doc [" << docKey << "] from Admin.");
    addCallback([=]{ _model.removeDocument(docKey); });
}

void Admin::rescheduleMemTimer(unsigned interval)
{
    _memStatsTaskIntervalMs = capAndRoundInterval(interval);
    LOG_INF("Memory stats interval changed - New interval: " << _memStatsTaskIntervalMs);
    _netStatsTaskIntervalMs = capAndRoundInterval(interval); // Until we support modifying this.
    LOG_INF("Network stats interval changed - New interval: " << _netStatsTaskIntervalMs);
    wakeup();
}

void Admin::rescheduleCpuTimer(unsigned interval)
{
    _cpuStatsTaskIntervalMs = capAndRoundInterval(interval);
    LOG_INF("CPU stats interval changed - New interval: " << _cpuStatsTaskIntervalMs);
    wakeup();
}

size_t Admin::getTotalMemoryUsage()
{
    // To simplify and clarify this; since load, link and pre-init all
    // inside the forkit - we should account all of our fixed cost of
    // memory to the forkit; and then count only dirty pages in the clients
    // since we know that they share everything else with the forkit.
    const size_t forkitRssKb = Util::getMemoryUsageRSS(_forKitPid);
    const size_t wsdPssKb = Util::getMemoryUsagePSS(getpid());
    const size_t kitsDirtyKb = _model.getKitsMemoryUsage();
    const size_t totalMem = wsdPssKb + forkitRssKb + kitsDirtyKb;

    return totalMem;
}

size_t Admin::getTotalCpuUsage()
{
    const size_t forkitJ = Util::getCpuUsage(_forKitPid);
    const size_t wsdJ = Util::getCpuUsage(getpid());
    const size_t kitsJ = _model.getKitsJiffies();

    if (_lastJiffies == 0)
    {
        _lastJiffies = forkitJ + wsdJ;
        return 0;
    }

    const size_t totalJ = ((forkitJ + wsdJ) - _lastJiffies) + kitsJ;
    _lastJiffies = forkitJ + wsdJ;

    return totalJ;
}

unsigned Admin::getMemStatsInterval()
{
    return _memStatsTaskIntervalMs;
}

unsigned Admin::getCpuStatsInterval()
{
    return _cpuStatsTaskIntervalMs;
}

unsigned Admin::getNetStatsInterval()
{
    return _netStatsTaskIntervalMs;
}

AdminModel& Admin::getModel()
{
    return _model;
}

void Admin::updateLastActivityTime(const std::string& docKey)
{
    addCallback([=]{ _model.updateLastActivityTime(docKey); });
}

void Admin::updateMemoryDirty(const std::string& docKey, int dirty)
{
    addCallback([=] { _model.updateMemoryDirty(docKey, dirty); });
}

void Admin::addBytes(const std::string& docKey, uint64_t sent, uint64_t recv)
{
    addCallback([=] { _model.addBytes(docKey, sent, recv); });
}

void Admin::setViewLoadDuration(const std::string& docKey, const std::string& sessionId, std::chrono::milliseconds viewLoadDuration)
{
    addCallback([=]{ _model.setViewLoadDuration(docKey, sessionId, viewLoadDuration); });
}

void Admin::setDocWopiDownloadDuration(const std::string& docKey, std::chrono::milliseconds wopiDownloadDuration)
{
    addCallback([=]{ _model.setDocWopiDownloadDuration(docKey, wopiDownloadDuration); });
}

void Admin::setDocWopiUploadDuration(const std::string& docKey, const std::chrono::milliseconds uploadDuration)
{
    addCallback([=]{ _model.setDocWopiUploadDuration(docKey, uploadDuration); });
}

void Admin::notifyForkit()
{
    std::ostringstream oss;
    oss << "setconfig limit_virt_mem_mb " << _defDocProcSettings.getLimitVirtMemMb() << '\n'
        << "setconfig limit_stack_mem_kb " << _defDocProcSettings.getLimitStackMemKb() << '\n'
        << "setconfig limit_file_size_mb " << _defDocProcSettings.getLimitFileSizeMb() << '\n'
        << "setconfig limit_num_open_files " << _defDocProcSettings.getLimitNumberOpenFiles() << '\n';

    if (_forKitWritePipe != -1)
        IoUtil::writeToPipe(_forKitWritePipe, oss.str());
    else
        LOG_INF("Forkit write pipe not set (yet).");
}

void Admin::triggerMemoryCleanup(const size_t totalMem)
{
    // Trigger mem cleanup when we are consuming too much memory (as configured by sysadmin)
    const auto memLimit = LOOLWSD::getConfigValue<double>("memproportion", 0.0);
    if (memLimit == 0.0 || _totalSysMemKb == 0)
    {
        LOG_TRC("Total memory consumed: " << totalMem <<
                " KB. Not configured to do memory cleanup. Skipping memory cleanup.");
        return;
    }

    LOG_TRC("Total memory consumed: " << totalMem << " KB. Configured LOOL memory proportion: " <<
            memLimit << "% (" << static_cast<size_t>(_totalSysMemKb * memLimit / 100.) << " KB).");

    const double memToFreePercentage = (totalMem / static_cast<double>(_totalSysMemKb)) - memLimit / 100.;
    int memToFreeKb = static_cast<int>(memToFreePercentage > 0.0 ? memToFreePercentage * _totalSysMemKb : 0);
    // Don't kill documents to save a KB or two.
    if (memToFreeKb > 1024)
    {
        // prepare document list sorted by most idle times
        const std::vector<DocBasicInfo> docList = _model.getDocumentsSortedByIdle();

        LOG_TRC("OOM: Memory to free: " << memToFreePercentage << "% (" <<
                memToFreeKb << " KB) from " << docList.size() << " docs.");

        for (const auto& doc : docList)
        {
            LOG_TRC("OOM Document: DocKey: [" << doc.getDocKey() << "], Idletime: [" << doc.getIdleTime() << "]," <<
                    " Saved: [" << doc.getSaved() << "], Mem: [" << doc.getMem() << "].");
            if (doc.getSaved())
            {
                // Kill the saved documents first.
                LOG_DBG("OOM: Killing saved document with DocKey [" << doc.getDocKey() << "] with " << doc.getMem() << " KB.");
                LOOLWSD::closeDocument(doc.getDocKey(), "oom");
                memToFreeKb -= doc.getMem();
                if (memToFreeKb <= 1024)
                    break;
            }
            else
            {
                // Save unsaved documents.
                LOG_TRC("Saving document: DocKey [" << doc.getDocKey() << "].");
                LOOLWSD::autoSave(doc.getDocKey());
            }
        }
    }
}

void Admin::dumpState(std::ostream& os)
{
    // FIXME: be more helpful ...
    SocketPoll::dumpState(os);
}

class MonitorSocketHandler : public AdminSocketHandler
{
    bool _connecting;
    std::string _uri;
public:

    MonitorSocketHandler(Admin *admin, const std::string &uri) :
        AdminSocketHandler(admin),
        _connecting(true),
        _uri(uri)
    {
    }
    int getPollEvents(std::chrono::steady_clock::time_point now,
                      int &timeoutMaxMs) override
    {
        if (_connecting)
        {
            LOG_TRC("Waiting for outbound connection to complete");
            return POLLOUT;
        }
        else
            return AdminSocketHandler::getPollEvents(now, timeoutMaxMs);
    }

    void performWrites() override
    {
        LOG_TRC("Outbound monitor - connected");
        _connecting = false;
        return AdminSocketHandler::performWrites();
    }

    void onDisconnect() override
    {
        LOG_WRN("Monitor " << _uri << " dis-connected, re-trying in 20 seconds");
        Admin::instance().scheduleMonitorConnect(_uri, std::chrono::steady_clock::now() + std::chrono::seconds(20));
    }
};

void Admin::connectToMonitorSync(const std::string &uri)
{
    LOG_TRC("Add monitor " << uri);
    auto handler = std::make_shared<MonitorSocketHandler>(this, uri);
    insertNewWebSocketSync(Poco::URI(uri), handler);
    AdminSocketHandler::subscribeAsync(handler);
}

void Admin::scheduleMonitorConnect(const std::string &uri, std::chrono::steady_clock::time_point when)
{
    assertCorrectThread();

    MonitorConnectRecord todo;
    todo.setWhen(when);
    todo.setUri(uri);
    _pendingConnects.push_back(todo);
}

void Admin::getMetrics(std::ostringstream &metrics)
{
    size_t memAvail =  getTotalAvailableMemory();
    size_t memUsed = getTotalMemoryUsage();

    metrics << "global_host_system_memory_bytes " << _totalSysMemKb * 1024 << std::endl;
    metrics << "global_memory_available_bytes " << memAvail * 1024 << std::endl;
    metrics << "global_memory_used_bytes " << memUsed * 1024 << std::endl;
    metrics << "global_memory_free_bytes " << (memAvail - memUsed) * 1024 << std::endl;
    metrics << std::endl;

    _model.getMetrics(metrics);
}

void Admin::sendMetrics(const std::shared_ptr<StreamSocket>& socket, const std::shared_ptr<Poco::Net::HTTPResponse>& response)
{
    std::ostringstream oss;
    response->write(oss);
    getMetrics(oss);
    socket->send(oss.str());
    socket->shutdown();
}

void Admin::sendMetricsAsync(const std::shared_ptr<StreamSocket>& socket, const std::shared_ptr<Poco::Net::HTTPResponse>& response)
{
    addCallback([this, socket, response]{ sendMetrics(socket, response); });
}

void Admin::start()
{
    bool haveMonitors = false;
    const auto& config = Application::instance().config();

    for (size_t i = 0; ; ++i)
    {
        const std::string path = "monitors.monitor[" + std::to_string(i) + "]";
        const std::string uri = config.getString(path, "");
        if (!config.has(path))
            break;
        if (!uri.empty())
        {
            Poco::URI monitor(uri);
            if (monitor.getScheme() == "wss" || monitor.getScheme() == "ws")
            {
                addCallback([=] { scheduleMonitorConnect(uri, std::chrono::steady_clock::now()); });
                haveMonitors = true;
            }
            else
                LOG_ERR("Unhandled monitor URI: '" << uri << "' should be \"wss://foo:1234/baa\"");
        }
    }

    if (!haveMonitors)
        LOG_TRC("No monitors configured.");

    startThread();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
