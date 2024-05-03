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

#pragma once

#include <config.h>
#include <WebSocketHandler.hpp>
#include <net/Socket.hpp>
#include <common/MessageQueue.hpp>

class PerfTestSocketHandler : public WebSocketHandler
{
private:
    const std::string _server;
    SocketPoll _poll;
    bool _connecting = false;
    bool _aborted = false;
    MessageQueue _incomingMessages;
    MessageQueue _outgoingMessages;

public:
    PerfTestSocketHandler(const std::string &server, const std::string &name);
    int getPollEvents(std::chrono::steady_clock::time_point now, int64_t &timeoutMaxMicroS) override;
    void handleMessage(const std::vector<char> &data) override;
    void sendMessage(const std::string &message);
    bool hasIncomingMessage(const std::string &substring);
    void connect(const std::string &filePath);
    void loadDocument(const std::string &filePath);
    void abort(const std::string &message);
};

class MessagePerfTestSocketHandler : public PerfTestSocketHandler
{
private:
    std::shared_ptr<bool> _measuring;
    std::shared_ptr<unsigned int> _messageCount;
    std::shared_ptr<unsigned int> _messageBytes;

public:
    MessagePerfTestSocketHandler(const std::string &server, const std::string &name, std::shared_ptr<bool> measuring, std::shared_ptr<unsigned int> messageCount, std::shared_ptr<unsigned int> messageBytes);
    void handleMessage(const std::vector<char> &data) override;
};
