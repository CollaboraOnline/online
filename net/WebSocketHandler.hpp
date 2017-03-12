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
        _shuttingDown(false),
        _wsState(WSState::HTTP)
    {
    }

    /// Upgrades itself to a websocket directly.
    WebSocketHandler(const std::weak_ptr<StreamSocket>& socket,
                     const Poco::Net::HTTPRequest& request) :
        _socket(socket),
        _shuttingDown(false),
        _wsState(WSState::HTTP)
    {
        upgradeToWebSocket(request);
    }

    /// Implementation of the SocketHandlerInterface.
    void onConnect(const std::weak_ptr<StreamSocket>& socket) override
    {
        _socket = socket;
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
            return;

        LOG_TRC("#" << socket->getFD() << " shutdown websocket.");

        const size_t len = statusMessage.size();
        std::vector<char> buf(2 + len);
        buf[0] = ((((int)statusCode) >> 8) & 0xff);
        buf[1] = ((((int)statusCode) >> 0) & 0xff);
        std::copy(statusMessage.begin(), statusMessage.end(), buf.end());
        const unsigned char flags = static_cast<unsigned char>(WSFrameMask::Fin) | static_cast<char>(WSOpCode::Close);

        auto lock = socket->getWriteLock();
        sendFrame(socket, buf.data(), buf.size(), flags);
        _shuttingDown = true;
    }

    /// Implementation of the SocketHandlerInterface.
    virtual bool handleOneIncomingMessage()
    {
        auto socket = _socket.lock();
        if (socket == nullptr)
            return false;

        // websocket fun !
        const size_t len = socket->_inBuffer.size();

        if (len == 0)
            return false; // avoid logging.

        LOG_TRC("Incoming WebSocket data of " << len << " bytes to socket #" << socket->getFD());

        if (len < 2) // partial read
            return false;

        unsigned char *p = reinterpret_cast<unsigned char*>(&socket->_inBuffer[0]);
        bool fin = p[0] & 0x80;
        WSOpCode code = static_cast<WSOpCode>(p[0] & 0x0f);
        bool hasMask = p[1] & 0x80;
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
            for (size_t i = 0; i < payloadLen; ++i)
                data[i] = data[i] ^ mask[i % 4];

            // FIXME: copy and un-mask at the same time ...
            _wsPayload.insert(_wsPayload.end(), data, data + payloadLen);
        } else
            _wsPayload.insert(_wsPayload.end(), data, data + payloadLen);

        socket->_inBuffer.erase(socket->_inBuffer.begin(), socket->_inBuffer.begin() + headerLen + payloadLen);

        // FIXME: fin, aggregating payloads into _wsPayload etc.
        LOG_TRC("Incoming WebSocket message code " << code << " fin? " << fin << " payload length " << _wsPayload.size());

        if (code & WSOpCode::Close)
        {
            if (!_shuttingDown)
            {
                // Peer-initiated shutdown must be echoed.
                // Otherwise, this is the echo to _out_ shutdown message.
                const StatusCodes statusCode = static_cast<StatusCodes>((static_cast<unsigned>(_wsPayload[0]) << 8) | _wsPayload[1]);
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

            // TCP Close.
            socket->shutdown();
        }
        else
        {
            handleMessage(fin, code, _wsPayload);
        }

        _wsPayload.clear();

        return true;
    }

    /// Implementation of the SocketHandlerInterface.
    virtual void handleIncomingMessage() override
    {
        while (handleOneIncomingMessage())
            ; // can have multiple msgs in one recv'd packet.
    }


    bool hasQueuedWrites() const override
    {
        LOG_TRC("WebSocket - asked for queued writes");
        return false;
    }

    void performWrites() override
    {
        assert(false && "performWrites not implemented");
    }

    void sendFrame(const std::string& msg) const
    {
        sendMessage(msg.data(), msg.size(), WSOpCode::Text);
    }

    /// Sends a WebSocket message of WPOpCode type.
    /// Returns the number of bytes written (including frame overhead) on success,
    /// 0 for closed/invalid socket, and -1 for other errors.
    int sendMessage(const char* data, const size_t len, const WSOpCode code, const bool flush = true) const
    {
        if (data == nullptr || len == 0)
            return -1;

        auto socket = _socket.lock();
        if (socket == nullptr)
            return -1; // no socket == error.

        assert(socket->isCorrectThread());
        auto lock = socket->getWriteLock();
        std::vector<char>& out = socket->_outBuffer;

        //TODO: Support fragmented messages.
        const unsigned char fin = static_cast<unsigned char>(WSFrameMask::Fin);

        // FIXME: need to support fragmented mesages, but for now send prefix message with size.
        if (len >= LARGE_MESSAGE_SIZE)
        {
            const std::string nextmessage = "nextmessage: size=" + std::to_string(len);
            const unsigned char size = (nextmessage.size() & 0xff);
            out.push_back(static_cast<char>(fin | WSOpCode::Text));
            out.push_back(size);
            out.insert(out.end(), nextmessage.data(), nextmessage.data() + size);
            socket->writeOutgoingData();
        }

        return sendFrame(socket, data, len, static_cast<unsigned char>(fin | code), flush);
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
        LOG_TRC("Upgrading to WebSocket");
        assert(_wsState == WSState::HTTP);

        auto socket = _socket.lock();
        if (socket == nullptr)
            throw std::runtime_error("Invalid socket while upgrading to WebSocket. Request: " + req.getURI());

        // create our websocket goodness ...
        const int wsVersion = std::stoi(req.get("Sec-WebSocket-Version", "13"));
        const std::string wsKey = req.get("Sec-WebSocket-Key", "");
        const std::string wsProtocol = req.get("Sec-WebSocket-Protocol", "chat");
        // FIXME: other sanity checks ...
        LOG_INF("WebSocket version " << wsVersion << " key '" << wsKey << "'.");

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
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
