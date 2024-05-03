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

#include <iostream>
#include <sysexits.h>
#include <PerfTestSocketHandler.hpp>
#include <wsd/TileDesc.hpp>
#include <Poco/URI.h>

PerfTestSocketHandler::PerfTestSocketHandler(const std::string &name, const std::string &server) :
    WebSocketHandler(true, true),
    _server(server),
    _poll(name + " poll")
{
}

void PerfTestSocketHandler::sendMessage(const std::string &message)
{
    LOG_DBG("PerfTestSocketHandler sendMessage: " + message);
    _outgoingMessages.put(message);
}

bool PerfTestSocketHandler::hasIncomingMessage(const std::string &substring)
{
    while (!_incomingMessages.isEmpty()) {
        std::vector<char> msgVec = _incomingMessages.pop();
        std::string msgStr = std::string(msgVec.begin(), msgVec.end());
        if (msgStr.find(substring) != std::string::npos) {
            return true;
        }
    }
    return false;
}

void PerfTestSocketHandler::connect(const std::string &filePath)
{
    LOG_DBG("PerfTestSocketHandler connect: " << _server << " file: " << filePath);

    std::string fileUri;
    std::string fileabs = Poco::Path(filePath).makeAbsolute().toString();
    Poco::URI::encode("file://" + fileabs, ":/?", fileUri);

    std::string wrap;
    Poco::URI::encode(fileUri, ":/?", wrap); // double encode.
    std::string serverUri = _server + "/cool/" + wrap + "/ws";

    std::cerr << serverUri << std::endl;
    LOG_DBG("Connecting to: " + serverUri);
    // Cannot implement shared_from_this on PerfTestSocketHandler because it
    // is already implemented on ProtocolHandlerInterface. So do this cast instead.
    std::shared_ptr<WebSocketHandler> ptr_to_this =
        std::dynamic_pointer_cast<WebSocketHandler>(shared_from_this());
    _poll.insertNewWebSocketSync(Poco::URI(serverUri), ptr_to_this);
    _poll.startThread();
    LOG_DBG("PerfTestSocketHandler Connected");
}

void PerfTestSocketHandler::loadDocument(const std::string &filePath)
{
    LOG_DBG("PerfTestSocketHandler loadDocument: " + filePath);

    sendMessage("coolclient 0.1 1713197290182 836");

    std::string fileUri;
    std::string fileabs = Poco::Path(filePath).makeAbsolute().toString();
    Poco::URI::encode("https://localhost:9980/wopi/files" + fileabs, ":/?", fileUri);

    std::string message = "load url=" + fileUri + " deviceFormFactor=desktop";
    sendMessage(message);
}

void PerfTestSocketHandler::shutdown()
{
    LOG_DBG("PerfTestSocketHandler shutdown");
    _shutdown = true;
    _poll.joinThread();
    LOG_DBG("PerfTestSocketHandler done");
}

int PerfTestSocketHandler::getPollEvents(std::chrono::steady_clock::time_point now, int64_t &timeoutMaxMicroS)
{
    LOG_TRC("PerfTestSocketHandler getPollEvents");
    if (_connecting) {
        LOG_TRC("PerfTestSocketHandler getPollEvents (Waiting for outbound connection)");
        return POLLOUT;
    }

    while (!_outgoingMessages.isEmpty()) {
        std::vector<char> message = _outgoingMessages.pop();
        LOG_TRC("PerfTestSocketHandler Sending mesage: " << COOLProtocol::getFirstLine(message));
        WebSocketHandler::sendTextMessage((char*)&message[0], message.size());
    }

    if (_shutdown) {
        LOG_DBG("PerfTestSocketHandler shutdown1");
        WebSocketHandler::shutdown();
    }

    int events = WebSocketHandler::getPollEvents(now, timeoutMaxMicroS);
    timeoutMaxMicroS = std::min(timeoutMaxMicroS, (int64_t)1000);
    return events;
}

void PerfTestSocketHandler::handleMessage(const std::vector<char> &data)
{
    const std::string firstLine = COOLProtocol::getFirstLine(data.data(), data.size());
    LOG_TRC("handleMessage: " + firstLine);

    StringVector tokens = StringVector::tokenize(firstLine);
    if (tokens.equals(0, "error:")) {
        abort("Incoming error mesage: " + firstLine);
    }

    if (tokens.equals(0, "tile:")) {
        // eg. tileprocessed tile=0:9216:0:3072:3072:0
        TileDesc desc = TileDesc::parse(tokens);
        WebSocketHandler::sendMessage("tileprocessed tile=" + desc.generateID());
    }

    _incomingMessages.put(data);
}

void PerfTestSocketHandler::abort(const std::string &message)
{
    LOG_ERR("PerfTestSocketHandler abort: " << message);
    WebSocketHandler::shutdown();
    Util::forcedExit(EX_SOFTWARE);
}

MessagePerfTestSocketHandler::MessagePerfTestSocketHandler(
        const std::string &name,
        const std::string &server,
        std::atomic<bool>* measuring,
        std::atomic<unsigned int>* messageCount,
        std::atomic<unsigned int>* messageBytes) :
    PerfTestSocketHandler(name, server),
    _measuring(measuring),
    _messageCount(messageCount),
    _messageBytes(messageBytes)
{
}

void MessagePerfTestSocketHandler::handleMessage(const std::vector<char> &data)
{
    PerfTestSocketHandler::handleMessage(data);
    if (*_measuring) {
        (*_messageCount)++;
        (*_messageBytes) += data.size();
    }
}
