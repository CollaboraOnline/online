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

#include <net/WebSocketHandler.hpp>

#include <atomic>
#include <chrono>
#include <csignal>
#include <string>

class ChildProcess;
class DocumentBroker;

// A WSProcess object in the WSD process represents a descendant process, either the direct child
// process ForKit or a grandchild Kit process, with which the WSD process communicates through a
// WebSocket.
class WSProcess
{
public:
    /// @param pid is the process ID.
    /// @param socket is the underlying Socket to the process.
    WSProcess(const std::string& name, const pid_t pid, const std::shared_ptr<StreamSocket>& socket,
              std::shared_ptr<WebSocketHandler> handler)
        : _name(name)
        , _ws(std::move(handler))
        , _socket(socket)
        , _pid(pid)
    {
        LOG_INF(_name << " ctor [" << _pid << "].");
    }

    WSProcess(WSProcess&& other) = delete;

    const WSProcess& operator=(WSProcess&& other) = delete;

    virtual ~WSProcess()
    {
        LOG_DBG('~' << _name << " dtor [" << _pid << "].");

        if (_pid <= 0)
            return;

        terminate();

        // No need for the socket anymore.
        _ws.reset();
        _socket.reset();
    }

    /// Let the child close a nice way.
    void close()
    {
        if (_pid < 0)
            return;

        try
        {
            LOG_DBG("Closing ChildProcess [" << _pid << "].");

            requestTermination();

            // Shutdown the socket.
            if (_ws)
                _ws->shutdown();
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Error while closing child process: " << ex.what());
        }

        _pid = -1; // Detach from child.
    }

    /// Request graceful termination.
    void requestTermination()
    {
        // Request the child to exit
        if (isAlive())
        {
            LOG_DBG("Stopping ChildProcess [" << _pid << "] by sending 'exit' command");
            sendTextFrame("exit", /*flush=*/true);
        }
    }

    /// Kill or abandon the child.
    void terminate()
    {
        if (_pid < 0)
            return;

#if !MOBILEAPP
        if (::kill(_pid, 0) == 0)
        {
            LOG_INF("Killing child [" << _pid << "].");
#if CODE_COVERAGE || VALGRIND_COOLFORKIT
            constexpr auto signal = SIGTERM;
#else
            constexpr auto signal = SIGKILL;
#endif
            if (!SigUtil::killChild(_pid, signal))
            {
                LOG_ERR("Cannot terminate lokit [" << _pid << "]. Abandoning.");
            }
        }
#else
            // What to do? Throw some unique exception that the outermost call in the thread catches and
            // exits from the thread?
#endif
        _pid = -1;
    }

    pid_t getPid() const { return _pid; }

    /// Send a text payload to the child-process WS.
    bool sendTextFrame(const std::string& data, bool flush = false)
    {
        return sendFrame(data, false, flush);
    }

    /// Send a payload to the child-process WS.
    bool sendFrame(const std::string& data, bool binary = false, bool flush = false)
    {
        try
        {
            if (_ws)
            {
                LOG_TRC("Send to " << _name << " message: ["
                                   << COOLProtocol::getAbbreviatedMessage(data) << ']');
                _ws->sendMessage(data.c_str(), data.size(),
                                 (binary ? WSOpCode::Binary : WSOpCode::Text), flush);
                return true;
            }
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Failed to send " << _name << " [" << _pid << "] data ["
                                      << COOLProtocol::getAbbreviatedMessage(data)
                                      << "] due to: " << exc.what());
            throw;
        }

        LOG_WRN("No socket to " << _name << " to send ["
                                << COOLProtocol::getAbbreviatedMessage(data) << ']');
        return false;
    }

    /// Check whether this child is alive and socket not in error.
    /// Note: zombies will show as alive, and sockets have waiting
    /// time after the other end-point closes. So this isn't accurate.
    virtual bool isAlive() const
    {
#if !MOBILEAPP
        try
        {
            return _pid > 1 && _ws && ::kill(_pid, 0) == 0;
        }
        catch (const std::exception&)
        {
        }

        return false;
#else
        return _pid > 1;
#endif
    }

protected:
    std::shared_ptr<WebSocketHandler> getWSHandler() const { return _ws; }
    std::shared_ptr<StreamSocket> getSocket() const { return _socket.lock(); };

private:
    std::string _name;
    std::shared_ptr<WebSocketHandler> _ws; // FIXME: should be weak ? ...
    std::weak_ptr<StreamSocket> _socket;
    std::atomic<pid_t> _pid; ///< The process-id, which can be access from different threads.
};

/// A ChildProcess object represents a Kit process that hosts a document and manipulates the
/// document using the LibreOfficeKit API. It isn't actually a child of the WSD process, but a
/// grandchild. The comments loosely talk about "child" anyway.

class ChildProcess final : public WSProcess
{
public:
    /// @param pid is the process ID of the child.
    /// @param socket is the underlying Socket to the child.
    template <typename T>
    ChildProcess(const pid_t pid, const std::string& jailId,
                 const std::string& configId,
                 const std::shared_ptr<StreamSocket>& socket, const T& request)
        : WSProcess("ChildProcess", pid, socket,
                    std::make_shared<WebSocketHandler>(socket, request))
        , _jailId(jailId)
        , _configId(configId)
        , _smapsFD(-1)
    {
        const int urpFromKitFD = socket->getIncomingFD(SharedFDType::URPFromKit);
        const int urpToKitFD = socket->getIncomingFD(SharedFDType::URPToKit);
        if (urpFromKitFD != -1 && urpToKitFD != -1)
        {
            std::chrono::steady_clock::time_point now = std::chrono::steady_clock::now();
            _urpFromKit = StreamSocket::create<StreamSocket>(
                std::string(), urpFromKitFD, Socket::Type::Unix, /*isClient=*/false,
                HostType::Other, std::make_shared<UrpHandler>(this),
                StreamSocket::ReadType::NormalRead, now);

            _urpToKit = StreamSocket::create<StreamSocket>(
                std::string(), urpToKitFD, Socket::Type::Unix, /*isClient=*/false, HostType::Other,
                std::make_shared<UrpHandler>(this), StreamSocket::ReadType::NormalRead, now);
        }
    }

    ChildProcess(ChildProcess&& other) = delete;

    bool sendUrpMessage(const std::string& message)
    {
        if (!_urpToKit)
            return false;
        if (message.size() < 4)
        {
            LOG_ERR("URP Message too short");
            return false;
        }
        _urpToKit->send(message.data() + 4, message.size() - 4);
        return true;
    }

    virtual ~ChildProcess()
    {
        if (_urpFromKit)
            _urpFromKit->shutdown();
        if (_urpToKit)
            _urpToKit->shutdown();
        if (_smapsFD != -1)
        {
            ::close(_smapsFD);
            _smapsFD = -1;
        }
    }

    const ChildProcess& operator=(ChildProcess&& other) = delete;

    void setDocumentBroker(const std::shared_ptr<DocumentBroker>& docBroker);
    std::shared_ptr<DocumentBroker> getDocumentBroker() const { return _docBroker.lock(); }
    const std::string& getJailId() const { return _jailId; }
    const std::string& getConfigId() const { return _configId; }
    void setSMapsFD(int smapsFD) { _smapsFD = smapsFD; }
    int getSMapsFD() { return _smapsFD; }

    void moveSocketFromTo(const std::shared_ptr<SocketPoll>& from, SocketPoll& to)
    {
        to.takeSocket(from, getSocket());
    }

private:
    const std::string _jailId;
    const std::string _configId;
    std::weak_ptr<DocumentBroker> _docBroker;
    std::shared_ptr<StreamSocket> _urpFromKit;
    std::shared_ptr<StreamSocket> _urpToKit;
    int _smapsFD;
};

#if !MOBILEAPP

class ForKitProcWSHandler final : public WebSocketHandler
{
public:
    template <typename T>
    ForKitProcWSHandler(const std::weak_ptr<StreamSocket>& socket, const T& request)
        : WebSocketHandler(socket.lock(), request)
    {
    }

    virtual void handleMessage(const std::vector<char>& data) override;
};

class ForKitProcess final : public WSProcess
{
public:
    template <typename T>
    ForKitProcess(int pid, std::shared_ptr<StreamSocket>& socket, const T& request)
        : WSProcess("ForKit", pid, socket, std::make_shared<ForKitProcWSHandler>(socket, request))
    {
        socket->setHandler(getWSHandler());
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
