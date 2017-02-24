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
    std::unique_ptr<StreamSocket> _socket;
    int _wsVersion;
    std::string _wsKey;
    std::string _wsProtocol;
    std::vector<char> _wsPayload;
    enum { HTTP, WEBSOCKET } _wsState;

public:
    WebSocketHandler() :
        _wsVersion(0),
        _wsState(HTTP)
    {
    }

    /// Implementation of the SocketHandlerInterface.
    virtual void setSocket(StreamSocket* socket) override
    {
        _socket.reset(socket);
    }

    /// Upgrade the http(s) connection to a websocket.
    void handleWebsocketUpgrade();

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
        LOG_TRC("incoming WebSocket message");
        if (_wsState == HTTP)
        {
            handleWebsocketUpgrade();
            return;
        }

        // websocket fun !
        size_t len = _socket->_inBuffer.size();
        if (len < 2) // partial read
            return;

        unsigned char *p = reinterpret_cast<unsigned char*>(&_socket->_inBuffer[0]);
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

        _socket->_inBuffer.erase(_socket->_inBuffer.begin(), _socket->_inBuffer.begin() + headerLen + payloadLen);

        // FIXME: fin, aggregating payloads into _wsPayload etc.
        handleMessage(fin, code, _wsPayload);
        _wsPayload.clear();
    }

    void sendMessage(const std::vector<char> &data,
                     WSOpCode code = WSOpCode::Binary)
    {
        size_t len = data.size();
        bool fin = false;
        bool mask = false;

        unsigned char header[2];
        header[0] = (fin ? 0x80 : 0) | static_cast<unsigned char>(code);
        header[1] = mask ? 0x80 : 0;
        _socket->_outBuffer.push_back((char)header[0]);

        // no out-bound masking ...
        if (len < 126)
        {
            header[1] |= len;
            _socket->_outBuffer.push_back((char)header[1]);
        }
        else if (len <= 0xffff)
        {
            header[1] |= 126;
            _socket->_outBuffer.push_back((char)header[1]);
            _socket->_outBuffer.push_back(static_cast<char>((len >> 8) & 0xff));
            _socket->_outBuffer.push_back(static_cast<char>((len >> 0) & 0xff));
        }
        else
        {
            header[1] |= 127;
            _socket->_outBuffer.push_back((char)header[1]);
            _socket->_outBuffer.push_back(static_cast<char>((len >> 56) & 0xff));
            _socket->_outBuffer.push_back(static_cast<char>((len >> 48) & 0xff));
            _socket->_outBuffer.push_back(static_cast<char>((len >> 40) & 0xff));
            _socket->_outBuffer.push_back(static_cast<char>((len >> 32) & 0xff));
            _socket->_outBuffer.push_back(static_cast<char>((len >> 24) & 0xff));
            _socket->_outBuffer.push_back(static_cast<char>((len >> 16) & 0xff));
            _socket->_outBuffer.push_back(static_cast<char>((len >> 8) & 0xff));
            _socket->_outBuffer.push_back(static_cast<char>((len >> 0) & 0xff));
        }

        // FIXME: pick random number and mask in the outbuffer etc.
        assert (!mask);

        _socket->_outBuffer.insert(_socket->_outBuffer.end(), data.begin(), data.end());
    }

    /// To me overriden to handle the websocket messages the way you need.
    virtual void handleMessage(bool fin, WSOpCode code, std::vector<char> &data) = 0;

private:
    static std::string computeAccept(const std::string &key);
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
