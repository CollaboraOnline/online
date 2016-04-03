/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_IOUTIL_HPP
#define INCLUDED_IOUTIL_HPP

#include <functional>
#include <string>
#include <memory>

#include <sys/poll.h>

#include <Poco/Net/WebSocket.h>
#include <Poco/Net/DialogSocket.h>
#include <Poco/Logger.h>

namespace IoUtil
{
    /// Synchronously process WebSocket requests and dispatch to handler.
    //. Handler returns false to end.
    void SocketProcessor(std::shared_ptr<Poco::Net::WebSocket> ws,
                         Poco::Net::HTTPServerResponse& response,
                         std::function<bool(const std::vector<char>&)> handler,
                         std::function<bool()> stopPredicate,
                         std::string name = std::string(),
                         const size_t pollTimeoutMs = POLL_TIMEOUT_MS);

    void SocketProcessor(std::shared_ptr<Poco::Net::DialogSocket> ds,
                         std::function<bool(std::string&)> handler,
                         std::function<bool()> stopPredicate,
                         std::string name = std::string(),
                         const size_t pollTimeoutMs = POLL_TIMEOUT_MS);


    /// Call WebSocket::shutdown() ignoring Poco::IOException.
    void shutdownWebSocket(std::shared_ptr<Poco::Net::WebSocket> ws);

    ssize_t writeFIFO(int pipe, const char* buffer, ssize_t size);
    inline
    ssize_t writeFIFO(int pipe, const std::string& message)
    {
        return writeFIFO(pipe, message.c_str(), message.size());
    }

    ssize_t readFIFO(int pipe, char* buffer, ssize_t size);

    ssize_t readMessage(const int pipe, char* buffer, const ssize_t size,
                        const size_t timeoutSec = CHILD_TIMEOUT_SECS);

    class PipeReader
    {
    public:
        PipeReader(const std::string& name, const int pipe) :
            _name(name),
            _pipe(pipe)
        {
        }

        /// Reads a single line from the pipe.
        /// Returns 0 for timeout, <0 for error, and >0 on success.
        /// On success, line will contain the read message.
        int readLine(std::string& line,
                     std::function<bool()> stopPredicate,
                     const size_t timeoutMs = POLL_TIMEOUT_MS);

        void process(std::function<bool(std::string& message)> handler,
                     std::function<bool()> stopPredicate,
                     const size_t pollTimeoutMs = POLL_TIMEOUT_MS);

    private:
        const std::string _name;
        const int _pipe;
        std::string _data;
    };
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
