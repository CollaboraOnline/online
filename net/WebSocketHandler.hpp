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

#include "Log.hpp"
#include "Socket.hpp"

class WebSocketHandler : public SocketHandlerInterface
{
    // The socket that owns us (we can't own it).
    std::weak_ptr<StreamSocket> _socket;
    std::vector<char> _wsPayload;

public:
    WebSocketHandler()
    {
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

    /// Implementation of the SocketHandlerInterface.
    virtual void handleIncomingMessage() override
    {
        auto socket = _socket.lock();
        if (socket == nullptr)
            return;

        // websocket fun !
        const size_t len = socket->_inBuffer.size();
        LOG_TRC("Incoming WebSocket data of " << len << " bytes to socket #" << socket->getFD());

        if (len < 2) // partial read
            return;

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
                return;

            payloadLen = (((unsigned)p[2]) << 8) | ((unsigned)p[3]);
            headerLen += 2;
        }
        else if (payloadLen == 127) // 8 byte length
        {
            if (len < 2 + 8)
                return;

            payloadLen = ((((uint64_t)(p[9])) <<  0) + (((uint64_t)(p[8])) <<  8) +
                          (((uint64_t)(p[7])) << 16) + (((uint64_t)(p[6])) << 24) +
                          (((uint64_t)(p[5])) << 32) + (((uint64_t)(p[4])) << 40) +
                          (((uint64_t)(p[3])) << 48) + (((uint64_t)(p[2])) << 56));
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
            return;
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
        handleMessage(fin, code, _wsPayload);
        _wsPayload.clear();
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
            return 0; // no socket == connection closed.

        bool fin = false;
        bool mask = false;

        auto lock = socket->getWriteLock();

        unsigned char header[2];
        header[0] = (fin ? 0x80 : 0) | static_cast<unsigned char>(code);
        header[1] = mask ? 0x80 : 0;
        socket->_outBuffer.push_back((char)header[0]);

        // no out-bound masking ...
        if (len < 126)
        {
            header[1] |= len;
            socket->_outBuffer.push_back((char)header[1]);
        }
        else if (len <= 0xffff)
        {
            header[1] |= 126;
            socket->_outBuffer.push_back((char)header[1]);
            socket->_outBuffer.push_back(static_cast<char>((len >> 8) & 0xff));
            socket->_outBuffer.push_back(static_cast<char>((len >> 0) & 0xff));
        }
        else
        {
            header[1] |= 127;
            socket->_outBuffer.push_back((char)header[1]);
            socket->_outBuffer.push_back(static_cast<char>((len >> 56) & 0xff));
            socket->_outBuffer.push_back(static_cast<char>((len >> 48) & 0xff));
            socket->_outBuffer.push_back(static_cast<char>((len >> 40) & 0xff));
            socket->_outBuffer.push_back(static_cast<char>((len >> 32) & 0xff));
            socket->_outBuffer.push_back(static_cast<char>((len >> 24) & 0xff));
            socket->_outBuffer.push_back(static_cast<char>((len >> 16) & 0xff));
            socket->_outBuffer.push_back(static_cast<char>((len >> 8) & 0xff));
            socket->_outBuffer.push_back(static_cast<char>((len >> 0) & 0xff));
        }

        // FIXME: pick random number and mask in the outbuffer etc.
        assert (!mask);

        socket->_outBuffer.insert(socket->_outBuffer.end(), data, data + len);
        if (flush)
            socket->writeOutgoingData();

        return len + sizeof(header);
    }

    /// To me overriden to handle the websocket messages the way you need.
    virtual void handleMessage(bool fin, WSOpCode code, std::vector<char> &data) = 0;
};

class WebSocketSender : private WebSocketHandler
{
public:
    WebSocketSender(const std::weak_ptr<StreamSocket>& socket)
    {
        onConnect(socket);
    }

    void sendFrame(const std::string& msg) const
    {
        sendMessage(msg.data(), msg.size(), WSOpCode::Text);
    }

private:
    void handleMessage(bool, WSOpCode, std::vector<char>&) override
    {
        // We will not read any.
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
