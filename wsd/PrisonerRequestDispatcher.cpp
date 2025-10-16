/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <wsd/PrisonerRequestDispatcher.hpp>

PrisonerRequestDispatcher::PrisonerRequestDispatcher()
    : WebSocketHandler(/* isClient = */ false, /* isMasking = */ true)
    , _pid(0)
    , _socketFD(0)
    , _associatedWithDoc(false)
{
    LOG_TRC_S("PrisonerRequestDispatcher");
}

PrisonerRequestDispatcher::~PrisonerRequestDispatcher()
{
    LOG_TRC("~PrisonerRequestDispatcher");

    // Notify the broker that we're done.
    // Note: since this class is the default WebScoketHandler
    // for all incoming connections, for ForKit we have to
    // replace it (once we receive 'GET /coolws/forkit') with
    // ForKitProcWSHandler (see ForKitProcess) and nothing to disconnect.
    std::shared_ptr<ChildProcess> child = _childProcess.lock();
    if (child && child->getPid() > 0)
        onDisconnect();
}

int PrisonerRequestDispatcher::getPollEvents(std::chrono::steady_clock::time_point /* now */,
                                             int64_t& /* timeoutMaxMs */) override
{
    return POLLIN;
}

/// Prisoner websocket fun ... (for now)
virtual void PrisonerRequestDispatcher::handleMessage(const std::vector<char>& data) override
{
    if (UnitWSD::isUnitTesting() && UnitWSD::get().filterChildMessage(data))
        return;

    auto message = std::make_shared<Message>(data.data(), data.size(), Message::Dir::Out);
    std::shared_ptr<StreamSocket> socket = getSocket().lock();
    if (socket)
    {
        assert(socket->getFD() == _socketFD && "Socket FD changed unexpectedly");
        LOG_TRC("Prisoner message [" << message->abbr() << ']');
    }
    else
        LOG_WRN("Message handler called but without valid socket. Expected #" << _socketFD);

    std::shared_ptr<ChildProcess> child = _childProcess.lock();
    std::shared_ptr<DocumentBroker> docBroker =
        child && child->getPid() > 0 ? child->getDocumentBroker() : nullptr;
    if (docBroker)
    {
        assert(child->getPid() == _pid && "Child PID changed unexpectedly");
        _associatedWithDoc = true;
        docBroker->handleInput(message);
    }
    else if (child && child->getPid() > 0)
    {
        const std::string abbreviatedMessage = COOLWSD::AnonymizeUserData ? "..." : message->abbr();
        LOG_WRN("Child " << child->getPid() << " has no DocBroker to handle message: ["
                         << abbreviatedMessage << ']');
    }
    else
    {
        const std::string abbreviatedMessage = COOLWSD::AnonymizeUserData ? "..." : message->abbr();
        LOG_ERR("Cannot handle message with unassociated Kit (PID " << _pid << "): ["
                                                                    << abbreviatedMessage);
    }
}

void PrisonerRequestDispatcher::handleIncomingMessage(SocketDisposition& disposition) override
{
    if (_childProcess.lock())
    {
        // FIXME: inelegant etc. - derogate to websocket code
        WebSocketHandler::handleIncomingMessage(disposition);
        return;
    }

    std::shared_ptr<StreamSocket> socket = getSocket().lock();
    if (!socket)
    {
        LOG_ERR("Invalid socket while reading incoming message");
        return;
    }

    Buffer& data = socket->getInBuffer();
    if (data.empty())
    {
        LOG_DBG("No data to process from the socket");
        return;
    }

#ifdef LOG_SOCKET_DATA
    LOG_TRC("HandleIncomingMessage: buffer has:\n"
            << HexUtil::dumpHex(std::string(data.data(), std::min(data.size(), 256UL))));
#endif

    // Consume the incoming data by parsing and processing the body.
    http::RequestParser request;
#if !MOBILEAPP
    const int64_t read = request.readData(data.data(), data.size());
    if (read < 0)
    {
        LOG_ERR("Error parsing prisoner socket data");
        return;
    }

    if (read == 0)
    {
        // Not enough data.
        return;
    }

    assert(read > 0 && "Must have read some data!");

    // Remove consumed data.
    data.eraseFirst(read);
#endif

    try
    {
        std::string jailId;
        std::string configId;
        std::map<std::string, std::string> admsProps;
#if !MOBILEAPP
        LOG_TRC("Child connection with URI [" << COOLWSD::anonymizeUrl(request.getUrl()) << ']');
        Poco::URI requestURI(request.getUrl());
        if (requestURI.getPath() == FORKIT_URI)
        {
            // New ForKit is spawned.
            const Poco::URI::QueryParameters params = requestURI.getQueryParameters();
            const int pid = socket->getPid();
            for (const auto& param : params)
            {
                if (param.first == "configid")
                    configId = param.second;
            }

            if (configId.empty()) // primordial forkit
            {
                if (pid != COOLWSD::ForKitProcId)
                {
                    LOG_WRN("Connection request received on "
                            << FORKIT_URI << " endpoint from unexpected ForKit process. Skipped");
                    return;
                }
                COOLWSD::ForKitProc =
                    std::make_shared<ForKitProcess>(COOLWSD::ForKitProcId, socket, request);
                LOG_ASSERT_MSG(socket->getInBuffer().empty(), "Unexpected data in prisoner socket");
                socket->getInBuffer().clear();
                PrisonerPoll->setForKitProcess(COOLWSD::ForKitProc);
            }
            else
            {
                LOG_INF("subforkit [" << configId << "], seen as created.");
                SubForKitProcs[configId] = std::make_shared<ForKitProcess>(pid, socket, request);
                LOG_ASSERT_MSG(socket->getInBuffer().empty(), "Unexpected data in prisoner socket");
                socket->getInBuffer().clear();
                // created subforkit for a reason, create spare early
                std::unique_lock<std::mutex> lock(NewChildrenMutex);
                rebalanceChildren(configId, COOLWSD::NumPreSpawnedChildren);

                UnitWSD::get().newSubForKit(SubForKitProcs[configId], configId);
            }

            return;
        }
        if (requestURI.getPath() != NEW_CHILD_URI)
        {
            LOG_ERR("Invalid incoming child URI [" << requestURI.getPath() << ']');
            return;
        }

        const auto duration = (std::chrono::steady_clock::now() - LastForkRequestTimes[configId]);
        const auto durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(duration);
        LOG_TRC("New child spawned after " << durationMs << " of requesting");

        // New Child is spawned.
        const Poco::URI::QueryParameters params = requestURI.getQueryParameters();
        const int pid = socket->getPid();
        for (const auto& param : params)
        {
            if (param.first == "jailid")
                jailId = param.second;
            else if (param.first == "configid")
                configId = param.second;
            else if (param.first == "version")
                COOLWSD::LOKitVersion = param.second;
            else if (param.first.size() > 6 && param.first.compare(0, 5, "adms_") == 0)
                admsProps[param.first.substr(5)] = param.second;
        }

        if (pid <= 0)
        {
            LOG_ERR("Invalid PID in child URI [" << COOLWSD::anonymizeUrl(request.getUrl()) << ']');
            return;
        }

        if (jailId.empty())
        {
            LOG_ERR("Invalid JailId in child URI [" << COOLWSD::anonymizeUrl(request.getUrl())
                                                    << ']');
            return;
        }

        LOG_ASSERT_MSG(socket->getInBuffer().empty(), "Unexpected data in prisoner socket");
        socket->getInBuffer().clear();

        LOG_INF("New child [" << pid << "], jailId: " << jailId << ", configId: " << configId);
#else
        pid_t pid = 100;
        jailId = "jail";
        socket->getInBuffer().clear();
#endif
        LOG_TRC("Calling make_shared<ChildProcess>, for NewChildren?");

        auto child =
            std::make_shared<ChildProcess>(pid, jailId, configId, socket, request, admsProps);

        if constexpr (!Util::isMobileApp())
            UnitWSD::get().newChild(child);

        _pid = pid;
        _socketFD = socket->getFD();
#if !MOBILEAPP
        child->setSMapsFD(socket->getIncomingFD(SharedFDType::SMAPS));
#endif
        _childProcess = child; // weak

        addNewChild(std::move(child));
    }
    catch (const std::bad_weak_ptr&)
    {
        // Using shared_from_this() from a constructor is not good.
        assert(!"Got std::bad_weak_ptr. Are we using shared_from_this() from a constructor?");
    }
    catch (const std::exception& exc)
    {
        // Probably don't have enough data just yet.
        // TODO: timeout if we never get enough.
    }
}

void PrisonerRequestDispatcher::onDisconnect() override
{
    LOG_DBG("Prisoner connection disconnected");

    // Notify the broker that we're done.
    std::shared_ptr<ChildProcess> child = _childProcess.lock();
    std::shared_ptr<DocumentBroker> docBroker =
        child && child->getPid() > 0 ? child->getDocumentBroker() : nullptr;
    if (docBroker)
    {
        assert(child->getPid() == _pid && "Child PID changed unexpectedly");
        const bool unexpected = !docBroker->isUnloading() && !SigUtil::getShutdownRequestFlag();
        if (unexpected)
        {
            LOG_WRN("DocBroker [" << docBroker->getDocKey() << "] got disconnected from its Kit ("
                                  << child->getPid() << ") unexpectedly. Closing");
        }
        else
        {
            LOG_DBG("DocBroker [" << docBroker->getDocKey() << "] disconnected from its Kit ("
                                  << child->getPid() << ") as expected");
        }

        docBroker->disconnectedFromKit(unexpected);
    }
    else if (!_associatedWithDoc && !SigUtil::getShutdownRequestFlag())
    {
        LOG_WRN("Unassociated Kit (" << _pid << ") disconnected unexpectedly");

        std::string configId;
        std::unique_lock<std::mutex> lock(NewChildrenMutex);
        auto it = std::find(NewChildren.begin(), NewChildren.end(), child);
        if (it != NewChildren.end())
        {
            configId = (*it)->getConfigId();
            NewChildren.erase(it);
        }
        else
            LOG_WRN("Unknown Kit process closed with pid " << (child ? child->getPid() : -1));
#if !MOBILEAPP
        rebalanceChildren(configId, COOLWSD::NumPreSpawnedChildren);
#endif
    }
}

void PrisonerRequestDispatcher::onConnect(const std::shared_ptr<StreamSocket>& socket) override
{
    WebSocketHandler::onConnect(socket);
    LOG_TRC("Prisoner connected");
}

void PrisonerRequestDispatcher::performWrites(std::size_t capacity) override { (void)capacity; }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
