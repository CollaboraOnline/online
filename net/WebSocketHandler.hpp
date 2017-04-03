/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_WEBSOCKETHANDLER_HPP
#define INCLUDED_WEBSOCKETHANDLER_HPP

#include "Common.hpp"
#include "Log.hpp"
#include "Socket.hpp"

#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/WebSocket.h>

class WebSocketHandler : public SocketHandlerInterface
{
protected:
    // The socket that owns us (we can't own it).
    std::weak_ptr<StreamSocket> _socket;

    const int InitialPingDelayMs = 25;
    const int PingFrequencyMs = 18 * 1000;
    std::chrono::steady_clock::time_point _pingSent;
    int _pingTimeUs;

    std::vector<char> _wsPayload;
    bool _shuttingDown;
    enum class WSState { HTTP, WS } _wsState;

    enum class WSFrameMask : unsigned char
    {
        Fin = 0x80,
        Mask = 0x80
    };

public:
    WebSocketHandler() :
        _pingSent(std::chrono::steady_clock::now()),
        _pingTimeUs(0),
        _shuttingDown(false),
        _wsState(WSState::HTTP)
    {
    }

    /// Upgrades itself to a websocket directly.
    WebSocketHandler(const std::weak_ptr<StreamSocket>& socket,
                     const Poco::Net::HTTPRequest& request) :
        _socket(socket),
        _pingSent(std::chrono::steady_clock::now() -
                  std::chrono::milliseconds(PingFrequencyMs) -
                  std::chrono::milliseconds(InitialPingDelayMs)),
        _pingTimeUs(0),
        _shuttingDown(false),
        _wsState(WSState::HTTP)
    {
        upgradeToWebSocket(request);
    }

    /// Implementation of the SocketHandlerInterface.
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _socket = socket;
        LOG_TRC("#" << socket->getFD() << " Connected to WS Handler 0x" << std::hex << this << std::dec);
    }

    enum WSOpCode {
        Continuation, // 0x0
        Text,         // 0x1
        Binary,       // 0x2
        Reserved1,    // 0x3
        Reserved2,    // 0x4
        Reserved3,    // 0x5
        Reserved4,    // 0x6
        Reserved5,    // 0x7
        Close,        // 0x8
        Ping,         // 0x9
        Pong          // 0xa
        // ... reserved
    };

    /// Status codes sent to peer on shutdown.
    enum class StatusCodes : unsigned short
    {
        NORMAL_CLOSE            = 1000,
        ENDPOINT_GOING_AWAY     = 1001,
        PROTOCOL_ERROR          = 1002,
        PAYLOAD_NOT_ACCEPTABLE  = 1003,
        RESERVED                = 1004,
        RESERVED_NO_STATUS_CODE = 1005,
        RESERVED_ABNORMAL_CLOSE = 1006,
        MALFORMED_PAYLOAD       = 1007,
        POLICY_VIOLATION        = 1008,
        PAYLOAD_TOO_BIG         = 1009,
        EXTENSION_REQUIRED      = 1010,
        UNEXPECTED_CONDITION    = 1011,
        RESERVED_TLS_FAILURE    = 1015
    };

    /// Sends WS shutdown message to the peer.
    void shutdown(const StatusCodes statusCode = StatusCodes::NORMAL_CLOSE, const std::string& statusMessage = "")
    {
        auto socket = _socket.lock();
        if (socket == nullptr)
        {
            LOG_ERR("No socket associated with WebSocketHandler 0x" << std::hex << this << std::dec);
            return;
        }

        LOG_TRC("#" << socket->getFD() << ": Shutdown websocket, code: " <<
                static_cast<unsigned>(statusCode) << ", message: " << statusMessage);
        _shuttingDown = true;

        const size_t len = statusMessage.size();
        std::vector<char> buf(2 + len);
        buf[0] = ((((int)statusCode) >> 8) & 0xff);
        buf[1] = ((((int)statusCode) >> 0) & 0xff);
        std::copy(statusMessage.begin(), statusMessage.end(), buf.begin() + 2);
        const unsigned char flags = static_cast<unsigned char>(WSFrameMask::Fin)
                                  | static_cast<char>(WSOpCode::Close);

        sendFrame(socket, buf.data(), buf.size(), flags);
    }

    bool handleOneIncomingMessage(const std::shared_ptr<StreamSocket>& socket)
    {
        assert(socket && "Expected a valid socket instance.");

        // websocket fun !
        const size_t len = socket->_inBuffer.size();

        if (len == 0)
            return false; // avoid logging.

        LOG_TRC("#" << socket->getFD() << ": Incoming WebSocket data of " << len << " bytes.");

        if (len < 2) // partial read
            return false;

        unsigned char *p = reinterpret_cast<unsigned char*>(&socket->_inBuffer[0]);
        const bool fin = p[0] & 0x80;
        const WSOpCode code = static_cast<WSOpCode>(p[0] & 0x0f);
        const bool hasMask = p[1] & 0x80;
        size_t payloadLen = p[1] & 0x7f;
        size_t headerLen = 2;

        // normally - 7 bit length.
        if (payloadLen == 126) // 2 byte length
        {
            if (len < 2 + 2)
                return false;

            payloadLen = (((unsigned)p[2]) << 8) | ((unsigned)p[3]);
            headerLen += 2;
        }
        else if (payloadLen == 127) // 8 byte length
        {
            if (len < 2 + 8)
                return false;

            payloadLen = ((((uint64_t)p[9]) <<  0) + (((uint64_t)p[8]) <<  8) +
                          (((uint64_t)p[7]) << 16) + (((uint64_t)p[6]) << 24) +
                          (((uint64_t)p[5]) << 32) + (((uint64_t)p[4]) << 40) +
                          (((uint64_t)p[3]) << 48) + (((uint64_t)p[2]) << 56));
            // FIXME: crop read length to remove top / sign bits.
            headerLen += 8;
        }

        unsigned char *data, *mask;

        if (hasMask)
        {
            mask = p + headerLen;
            headerLen += 4;
        }

        if (payloadLen + headerLen > len)
        { // partial read wait for more data.
            return false;
        }

        data = p + headerLen;

        if (hasMask)
        {
            const size_t end = _wsPayload.size();
            _wsPayload.resize(end + payloadLen);
            char* wsData = &_wsPayload[end];
            for (size_t i = 0; i < payloadLen; ++i)
                *wsData++ = data[i] ^ mask[i % 4];
        } else
            _wsPayload.insert(_wsPayload.end(), data, data + payloadLen);

        socket->_inBuffer.erase(socket->_inBuffer.begin(), socket->_inBuffer.begin() + headerLen + payloadLen);

        // FIXME: fin, aggregating payloads into _wsPayload etc.
        LOG_TRC("#" << socket->getFD() << ": Incoming WebSocket message code " << code <<
                " fin? " << fin << ", mask? " << hasMask << " payload length: " << _wsPayload.size());

        switch (code)
        {
        case WSOpCode::Pong:
            _pingTimeUs = std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() - _pingSent).count();
            LOG_TRC("#" << socket->getFD() << ": Pong received: " << _pingTimeUs << " microseconds");
            break;
        case WSOpCode::Ping:
            LOG_ERR("#" << socket->getFD() << ": Clients should not send pings, only servers");
            // drop through
        case WSOpCode::Close:
            if (!_shuttingDown)
            {
                // Peer-initiated shutdown must be echoed.
                // Otherwise, this is the echo to _our_ shutdown message, which we should ignore.
                const StatusCodes statusCode = static_cast<StatusCodes>((((uint64_t)(unsigned char)_wsPayload[0]) << 8) +
                                                                        (((uint64_t)(unsigned char)_wsPayload[1]) << 0));
                LOG_TRC("#" << socket->getFD() << ": Client initiated socket shutdown. Code: " << static_cast<int>(statusCode));
                if (_wsPayload.size() > 2)
                {
                    const std::string message(&_wsPayload[2], &_wsPayload[2] + _wsPayload.size() - 2);
                    shutdown(statusCode, message);
                }
                else
                {
                    shutdown(statusCode);
                }
            }
            else
            {
                LOG_TRC("#" << socket->getFD() << ": Client responded to our shutdown.");
            }

            // TCP Close.
            socket->closeConnection();
            break;
        default:
            handleMessage(fin, code, _wsPayload);
            break;
        }

        _wsPayload.clear();

        return true;
    }

    /// Implementation of the SocketHandlerInterface.
    virtual SocketHandlerInterface::SocketOwnership handleIncomingMessage() override
    {
        auto socket = _socket.lock();
        if (socket == nullptr)
        {
            LOG_ERR("No socket associated with WebSocketHandler 0x" << std::hex << this << std::dec);
        }
        else
        {
            while (handleOneIncomingMessage(socket))
                ; // can have multiple msgs in one recv'd packet.
        }

        return SocketHandlerInterface::SocketOwnership::UNCHANGED;
    }

    int getPollEvents(std::chrono::steady_clock::time_point now,
                      int & timeoutMaxMs) override
    {
        int timeSincePingMs =
            std::chrono::duration_cast<std::chrono::milliseconds>(now - _pingSent).count();
        timeoutMaxMs = std::min(timeoutMaxMs, PingFrequencyMs - timeSincePingMs);
        return POLLIN;
    }

    /// Send a ping message
    void sendPing(std::chrono::steady_clock::time_point now)
    {
        // Must not send this before we're upgraded.
        if (_wsState == WSState::WS)
        {
            LOG_WRN("Attempted ping on non-upgraded websocket!");
            _pingSent = now; // Pretend we sent it to avoid timing out immediately.
            return;
        }
        LOG_TRC("Send ping message");
        // FIXME: allow an empty payload.
        sendMessage("", 1, WSOpCode::Ping, false);
        _pingSent = now;
    }

    /// Do we need to handle a timeout ?
    void checkTimeout(std::chrono::steady_clock::time_point now) override
    {
        int timeSincePingMs =
            std::chrono::duration_cast<std::chrono::milliseconds>(now - _pingSent).count();
        if (timeSincePingMs >= PingFrequencyMs)
            sendPing(now);
    }

    /// By default rely on the socket buffer.
    void performWrites() override {}

    /// Sends a WebSocket Text message.
    int sendMessage(const std::string& msg) const
    {
        return sendMessage(msg.data(), msg.size(), WSOpCode::Text);
    }

    /// Sends a WebSocket message of WPOpCode type.
    /// Returns the number of bytes written (including frame overhead) on success,
    /// 0 for closed/invalid socket, and -1 for other errors.
    int sendMessage(const char* data, const size_t len, const WSOpCode code, const bool flush = true) const
    {
        //TODO: Support fragmented messages.
        static const unsigned char Fin = static_cast<unsigned char>(WSFrameMask::Fin);

        auto socket = _socket.lock();
        return sendFrame(socket, data, len, static_cast<unsigned char>(Fin | code), flush);
    }

protected:

    /// Sends a WebSocket frame given the data, length, and flags.
    /// Returns the number of bytes written (including frame overhead) on success,
    /// 0 for closed/invalid socket, and -1 for other errors.
    static int sendFrame(const std::shared_ptr<StreamSocket>& socket,
                         const char* data, const size_t len,
                         const unsigned char flags, const bool flush = true)
    {
        if (!socket || data == nullptr || len == 0)
            return -1;

        assert(socket->isCorrectThread());
        std::vector<char>& out = socket->_outBuffer;

        out.push_back(flags);

        if (len < 126)
        {
            out.push_back((char)len);
        }
        else if (len <= 0xffff)
        {
            out.push_back((char)126);
            out.push_back(static_cast<char>((len >> 8) & 0xff));
            out.push_back(static_cast<char>((len >> 0) & 0xff));
        }
        else
        {
            out.push_back((char)127);
            out.push_back(static_cast<char>((len >> 56) & 0xff));
            out.push_back(static_cast<char>((len >> 48) & 0xff));
            out.push_back(static_cast<char>((len >> 40) & 0xff));
            out.push_back(static_cast<char>((len >> 32) & 0xff));
            out.push_back(static_cast<char>((len >> 24) & 0xff));
            out.push_back(static_cast<char>((len >> 16) & 0xff));
            out.push_back(static_cast<char>((len >> 8) & 0xff));
            out.push_back(static_cast<char>((len >> 0) & 0xff));
        }

        // Copy the data.
        out.insert(out.end(), data, data + len);

        if (flush)
            socket->writeOutgoingData();

        // Data + header.
        return len + 2;
    }

    /// To be overriden to handle the websocket messages the way you need.
    virtual void handleMessage(bool /*fin*/, WSOpCode /*code*/, std::vector<char> &/*data*/)
    {
    }

    void dumpState(std::ostream& os) override;

private:
    /// To make the protected 'computeAccept' accessible.
    class PublicComputeAccept : public Poco::Net::WebSocket
    {
    public:
        static std::string doComputeAccept(const std::string &key)
        {
            return computeAccept(key);
        }
    };

protected:
    /// Upgrade the http(s) connection to a websocket.
    void upgradeToWebSocket(const Poco::Net::HTTPRequest& req)
    {
        auto socket = _socket.lock();
        if (socket == nullptr)
            throw std::runtime_error("Invalid socket while upgrading to WebSocket. Request: " + req.getURI());

        LOG_TRC("#" << socket->getFD() << ": Upgrading to WebSocket.");
        assert(_wsState == WSState::HTTP);

        // create our websocket goodness ...
        const int wsVersion = std::stoi(req.get("Sec-WebSocket-Version", "13"));
        const std::string wsKey = req.get("Sec-WebSocket-Key", "");
        const std::string wsProtocol = req.get("Sec-WebSocket-Protocol", "chat");
        // FIXME: other sanity checks ...
        LOG_INF("#" << socket->getFD() << ": WebSocket version " << wsVersion << " key '" << wsKey << "'.");

        std::ostringstream oss;
        oss << "HTTP/1.1 101 Switching Protocols\r\n"
            << "Upgrade: websocket\r\n"
            << "Connection: Upgrade\r\n"
            << "Sec-WebSocket-Accept: " << PublicComputeAccept::doComputeAccept(wsKey) << "\r\n"
            << "\r\n";

        // Want very low latency sockets.
        socket->setNoDelay();
        socket->setSocketBufferSize(0);

        socket->send(oss.str());
        _wsState = WSState::WS;
        sendPing(std::chrono::steady_clock::now());
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
