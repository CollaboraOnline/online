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

#include <atomic>
#include <queue>

#include <WebSocketHandler.hpp>
#include <net/Socket.hpp>

class PerfTestSocketHandler : public WebSocketHandler
{
private:
    const std::string _server;
    SocketPoll _poll;
    bool _connecting = false;
    // Send shutdown signal between threads
    std::atomic<bool> _shutdown = false;
    std::queue<std::string> _incomingMessages;
    std::queue<std::string> _outgoingMessages;

public:
    PerfTestSocketHandler(
            const std::string &name,
            const std::string &server);

    // Called from PerfTest thread
    void sendMessage(const std::string &message);
    bool hasIncomingMessage(const std::string &substring);
    void connect(const std::string &filePath);
    void loadDocument(const std::string &filePath);
    void shutdown();

    // Called from Socket thread
    int getPollEvents(std::chrono::steady_clock::time_point now, int64_t &timeoutMaxMicroS) override;
    void handleMessage(const std::vector<char> &data) override;
    void abort(const std::string &message);
};

class MessagePerfTestSocketHandler : public PerfTestSocketHandler
{
private:
    // Shared with MessagePerfTest
    std::atomic<bool> *_measuring;
    std::atomic<unsigned int> *_messageCount;
    std::atomic<unsigned int> *_messageBytes;

public:
    MessagePerfTestSocketHandler(
            const std::string &name,
            const std::string &server,
            std::atomic<bool>* measuring,
            std::atomic<unsigned int>* messageCount,
            std::atomic<unsigned int>* messageBytes);
    void handleMessage(const std::vector<char> &data) override;
};
