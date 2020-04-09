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

#include <chrono>
#include <memory>
#include <vector>

#include "common/Common.hpp"
#include "common/Log.hpp"
#include "common/Unit.hpp"
#include "Socket.hpp"

#include <Poco/MemoryStream.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/WebSocket.h>

class WebSocketHandler : public ProtocolHandlerInterface
{
private:
    /// The socket that owns us (we can't own it).
    std::weak_ptr<StreamSocket> _socket;

    std::chrono::steady_clock::time_point _lastPingSentTime;
    int _pingTimeUs;

    std::vector<char> _wsPayload;
    std::atomic<bool> _shuttingDown;
    bool _isClient;
#if !MOBILEAPP
    bool _isMasking;
    bool _inFragmentBlock;
#endif

protected:
    struct WSFrameMask
    {
        static const unsigned char Fin = 0x80;
        static const unsigned char Mask = 0x80;
    };

    static const int InitialPingDelayMicroS;
    static const int PingFrequencyMicroS;

public:
    /// Perform upgrade ourselves, or select a client web socket.
    /// Parameters:
    /// isClient: the instance should behave like a client (true) or like a server (false)
    ///           (from websocket perspective)
    /// isMasking: a client should mask (true) or not (false) outgoing frames
    /// isManualDefrag: the message handler should be called for every fragment of a message and
    ///                 defragmentation should be handled inside message handler (true) or the message handler
    ///                 should be called after all fragments of a message were received and the message
    ///                 was defragmented (false).
    WebSocketHandler(bool isClient = false, bool isMasking = true)
        : _lastPingSentTime(std::chrono::steady_clock::now())
        , _pingTimeUs(0)
        , _shuttingDown(false)
        , _isClient(isClient)
#if !MOBILEAPP
        , _isMasking(isClient && isMasking)
        , _inFragmentBlock(false)
#endif
    {
    }

    /// Upgrades itself to a websocket directly.
    /// Parameters:
    /// socket: the TCP socket which received the upgrade request
    /// request: the HTTP upgrade request to WebSocket
    WebSocketHandler(const std::weak_ptr<StreamSocket>& socket,
                     const Poco::Net::HTTPRequest& request)
        : _socket(socket)
        , _lastPingSentTime(std::chrono::steady_clock::now() -
                            std::chrono::microseconds(PingFrequencyMicroS) -
                            std::chrono::microseconds(InitialPingDelayMicroS))
        , _pingTimeUs(0)
        , _shuttingDown(false)
        , _isClient(false)
#if !MOBILEAPP
        , _isMasking(false)
        , _inFragmentBlock(false)
#endif
    {
        upgradeToWebSocket(request);
    }

    /// Implementation of the ProtocolHandlerInterface.
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _socket = socket;
        LOG_TRC("#" << socket->getFD() << " Connected to WS Handler " << this);
    }

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

    /// Sends WS Close frame to the peer.
    void sendCloseFrame(const StatusCodes statusCode = StatusCodes::NORMAL_CLOSE, const std::string& statusMessage = "")
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (socket == nullptr)
        {
            LOG_ERR("No socket associated with WebSocketHandler " << this);
            return;
        }

        LOG_TRC("#" << socket->getFD() << ": Shutdown websocket, code: " <<
                static_cast<unsigned>(statusCode) << ", message: " << statusMessage);
        _shuttingDown = true;

#if !MOBILEAPP
        const size_t len = statusMessage.size();
        std::vector<char> buf(2 + len);
        buf[0] = ((((int)statusCode) >> 8) & 0xff);
        buf[1] = ((((int)statusCode) >> 0) & 0xff);
        std::copy(statusMessage.begin(), statusMessage.end(), buf.begin() + 2);
        const unsigned char flags = WSFrameMask::Fin
                                  | static_cast<char>(WSOpCode::Close);

        sendFrame(socket, buf.data(), buf.size(), flags);
#endif
    }

    void shutdown(bool goingAway, const std::string &statusMessage) override
    {
        shutdown(goingAway ? WebSocketHandler::StatusCodes::ENDPOINT_GOING_AWAY :
                 WebSocketHandler::StatusCodes::NORMAL_CLOSE, statusMessage);
    }

    void getIOStats(uint64_t &sent, uint64_t &recv) override
    {
        std::shared_ptr<StreamSocket> socket = getSocket().lock();
        if (socket)
            socket->getIOStats(sent, recv);
        else
        {
            sent = 0;
            recv = 0;
        }
    }

    void shutdown(const StatusCodes statusCode = StatusCodes::NORMAL_CLOSE, const std::string& statusMessage = "")
    {
        if (!_shuttingDown)
            sendCloseFrame(statusCode, statusMessage);
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (socket)
        {
            socket->closeConnection();
            socket->getInBuffer().clear();
        }
        _wsPayload.clear();
#if !MOBILEAPP
        _inFragmentBlock = false;
#endif
        _shuttingDown = false;
    }

    bool handleTCPStream(const std::shared_ptr<StreamSocket>& socket)
    {
        assert(socket && "Expected a valid socket instance.");

        // websocket fun !
        const size_t len = socket->getInBuffer().size();

        if (len == 0)
            return false; // avoid logging.

#if !MOBILEAPP
        if (len < 2) // partial read
        {
            LOG_TRC("#" << socket->getFD() << ": Still incomplete WebSocket message, have " << len << " bytes");
            return false;
        }

        unsigned char *p = reinterpret_cast<unsigned char*>(&socket->getInBuffer()[0]);
        const bool fin = p[0] & 0x80;
        const WSOpCode code = static_cast<WSOpCode>(p[0] & 0x0f);
        const bool hasMask = p[1] & 0x80;
        size_t payloadLen = p[1] & 0x7f;
        size_t headerLen = 2;

        // normally - 7 bit length.
        if (payloadLen == 126) // 2 byte length
        {
            if (len < 2 + 2)
            {
                LOG_TRC("#" << socket->getFD() << ": Still incomplete WebSocket message, have " << len << " bytes");
                return false;
            }

            payloadLen = (((unsigned)p[2]) << 8) | ((unsigned)p[3]);
            headerLen += 2;
        }
        else if (payloadLen == 127) // 8 byte length
        {
            if (len < 2 + 8)
            {
                LOG_TRC("#" << socket->getFD() << ": Still incomplete WebSocket message, have " << len << " bytes");
                return false;
            }
            payloadLen = ((((uint64_t)p[9]) <<  0) + (((uint64_t)p[8]) <<  8) +
                          (((uint64_t)p[7]) << 16) + (((uint64_t)p[6]) << 24) +
                          (((uint64_t)p[5]) << 32) + (((uint64_t)p[4]) << 40) +
                          (((uint64_t)p[3]) << 48) + (((uint64_t)p[2]) << 56));
            // FIXME: crop read length to remove top / sign bits.
            headerLen += 8;
        }

        unsigned char *data, *mask = nullptr;

        if (hasMask)
        {
            mask = p + headerLen;
            headerLen += 4;
        }

        if (payloadLen + headerLen > len)
        { // partial read wait for more data.
            LOG_TRC("#" << socket->getFD() << ": Still incomplete WebSocket frame, have " << len
                        << " bytes, frame is " << payloadLen + headerLen << " bytes");
            return false;
        }

        if (hasMask && _isClient)
        {
            LOG_ERR("#" << socket->getFD() << ": Servers should not send masked frames. Only clients.");
            shutdown(StatusCodes::PROTOCOL_ERROR);
            return true;
        }

        LOG_TRC("#" << socket->getFD() << ": Incoming WebSocket data of " << len << " bytes: "
                    << Util::stringifyHexLine(socket->getInBuffer(), 0, std::min((size_t)32, len)));

        data = p + headerLen;

        if (isControlFrame(code))
        {
            //Process control frames

            std::vector<char> ctrlPayload;

            readPayload(data, payloadLen, mask, ctrlPayload);
            socket->getInBuffer().erase(socket->getInBuffer().begin(), socket->getInBuffer().begin() + headerLen + payloadLen);
            LOG_TRC("#" << socket->getFD() << ": Incoming WebSocket frame code " << static_cast<unsigned>(code) <<
                ", fin? " << fin << ", mask? " << hasMask << ", payload length: " << payloadLen <<
                ", residual socket data: " << socket->getInBuffer().size() << " bytes.");

            // All control frames MUST NOT be fragmented and MUST have a payload length of 125 bytes or less
            if (!fin)
            {
                LOG_ERR("#" << socket->getFD() << ": A control frame cannot be fragmented.");
                shutdown(StatusCodes::PROTOCOL_ERROR);
                return true;
            }
            if (payloadLen > 125)
            {
                LOG_ERR("#" << socket->getFD() << ": The payload length of a control frame must not exceed 125 bytes.");
                shutdown(StatusCodes::PROTOCOL_ERROR);
                return true;
            }

            switch (code)
            {
            case WSOpCode::Pong:
                if (_isClient)
                {
                    LOG_ERR("#" << socket->getFD() << ": Servers should not send pongs, only clients");
                    shutdown(StatusCodes::POLICY_VIOLATION);
                    return true;
                }
                else
                {
                    _pingTimeUs = std::chrono::duration_cast<std::chrono::microseconds>
                        (std::chrono::steady_clock::now() - _lastPingSentTime).count();
                    LOG_TRC("#" << socket->getFD() << ": Pong received: " << _pingTimeUs << " microseconds");
                }
                break;
            case WSOpCode::Ping:
                if (_isClient)
                {
                    auto now = std::chrono::steady_clock::now();
                    _pingTimeUs = std::chrono::duration_cast<std::chrono::microseconds>
                                            (now - _lastPingSentTime).count();
                    sendPong(now, &ctrlPayload[0], payloadLen, socket);
                }
                else
                {
                    LOG_ERR("#" << socket->getFD() << ": Clients should not send pings, only servers");
                    shutdown(StatusCodes::POLICY_VIOLATION);
                    return true;
                }
                break;
            case WSOpCode::Close:
                {
                    std::string message;
                    StatusCodes statusCode = StatusCodes::NORMAL_CLOSE;
                    if (!_shuttingDown)
                    {
                        // Peer-initiated shutdown must be echoed.
                        // Otherwise, this is the echo to _our_ shutdown message, which we should ignore.
                        LOG_TRC("#" << socket->getFD() << ": Peer initiated socket shutdown. Code: " << static_cast<int>(statusCode));
                        if (ctrlPayload.size())
                        {
                            statusCode = static_cast<StatusCodes>((((uint64_t)(unsigned char)ctrlPayload[0]) << 8) +
                                                                (((uint64_t)(unsigned char)ctrlPayload[1]) << 0));
                            if (ctrlPayload.size() > 2)
                                message.assign(&ctrlPayload[2], &ctrlPayload[2] + ctrlPayload.size() - 2);
                        }
                    }
                    shutdown(statusCode, message);
                    return true;
                }
            default:
                LOG_ERR("#" << socket->getFD() << ": Received unknown control code");
                shutdown(StatusCodes::PROTOCOL_ERROR);
                break;
            }

            return true;
        }

        // Check data frames for errors
        if (_inFragmentBlock)
        {
            if (code != WSOpCode::Continuation)
            {
                LOG_ERR("#" << socket->getFD() << ": A fragment that is not the first fragment of a message must have the opcode equal to 0.");
                shutdown(StatusCodes::PROTOCOL_ERROR);
                return true;
            }
        }
        else if (code == WSOpCode::Continuation)
        {
            LOG_ERR("#" << socket->getFD() << ": An unfragmented message or the first fragment of a fragmented message must have the opcode different than 0.");
            shutdown(StatusCodes::PROTOCOL_ERROR);
            return true;
        }

        //Process data frame
        readPayload(data, payloadLen, mask, _wsPayload);
#else
        unsigned char * const p = reinterpret_cast<unsigned char*>(&socket->getInBuffer()[0]);
        _wsPayload.insert(_wsPayload.end(), p, p + len);
        const size_t headerLen = 0;
        const size_t payloadLen = len;
#endif

        socket->getInBuffer().erase(socket->getInBuffer().begin(), socket->getInBuffer().begin() + headerLen + payloadLen);

#if !MOBILEAPP

        LOG_TRC("#" << socket->getFD() << ": Incoming WebSocket frame code " << static_cast<unsigned>(code) <<
                ", fin? " << fin << ", mask? " << hasMask << ", payload length: " << payloadLen <<
                ", residual socket data: " << socket->getInBuffer().size() << " bytes, unmasked data: "+
                Util::stringifyHexLine(_wsPayload, 0, std::min((size_t)32, _wsPayload.size())));

        if (fin)
        {
            // If is final fragment then process the accumulated message.
            handleMessage(_wsPayload);
            _inFragmentBlock = false;
        }
        else
        {
            _inFragmentBlock = true;
            // If is not final fragment then wait for next fragment.
            return false;
        }
#else
        handleMessage(_wsPayload);

#endif

        _wsPayload.clear();

        return true;
    }

    /// Implementation of the ProtocolHandlerInterface.
    virtual void handleIncomingMessage(SocketDisposition&) override
    {
        // LOG_TRC("***** WebSocketHandler::handleIncomingMessage()");

        std::shared_ptr<StreamSocket> socket = _socket.lock();

#if MOBILEAPP
        // No separate "upgrade" is going on
        if (socket != nullptr && !socket->isWebSocket())
            socket->setWebSocket();
#endif

        if (socket == nullptr)
        {
            LOG_ERR("No socket associated with WebSocketHandler " << this);
        }
#if !MOBILEAPP
        else if (_isClient && !socket->isWebSocket())
            handleClientUpgrade();
#endif
        else
        {
            while (handleTCPStream(socket))
                ; // might have multiple messages in the accumulated buffer.
        }
    }

    int pgetPollEvents(std::chrono::steady_clock::time_point now,
                      int64_t & timeoutMaxMicroS) override
    {
        if (!_isClient)
        {
            const int64_t timeSincePingMicroS =
                std::chrono::duration_cast<std::chrono::microseconds>(now - _lastPingSentTime).count();
            timeoutMaxMicroS = std::min(timeoutMaxMicroS, PingFrequencyMicroS - timeSincePingMicroS);
        }
        int events = POLLIN;
        if (_msgHandler && _msgHandler->hasQueuedMessages())
            events |= POLLOUT;
        return events;
    }

#if !MOBILEAPP
private:
    /// Send a ping message
    void sendPingOrPong(std::chrono::steady_clock::time_point now,
                        const char* data, const size_t len,
                        const WSOpCode code,
                        const std::shared_ptr<StreamSocket>& socket)
    {
        assert(socket && "Expected a valid socket instance.");

        // Must not send this before we're upgraded.
        if (!socket->isWebSocket())
        {
            LOG_WRN("Attempted ping on non-upgraded websocket! #" << socket->getFD());
            _lastPingSentTime = now; // Pretend we sent it to avoid timing out immediately.
            return;
        }

        LOG_TRC("#" << socket->getFD() << ": Sending " <<
                (const char *)(code == WSOpCode::Ping ? " ping." : "pong."));
        // FIXME: allow an empty payload.
        sendMessage(data, len, code, false);
        _lastPingSentTime = now;
    }

    void sendPing(std::chrono::steady_clock::time_point now,
                  const std::shared_ptr<StreamSocket>& socket)
    {
        assert(!_isClient);
        sendPingOrPong(now, "", 1, WSOpCode::Ping, socket);
    }

    void sendPong(std::chrono::steady_clock::time_point now,
                  const char* data, const size_t len,
                  const std::shared_ptr<StreamSocket>& socket)
    {
        assert(_isClient);
        sendPingOrPong(now, data, len, WSOpCode::Pong, socket);
    }
#endif

    /// Do we need to handle a timeout ?
    void checkTimeout(std::chrono::steady_clock::time_point now) override
    {
#if !MOBILEAPP
        if (_isClient)
            return;

        const int64_t timeSincePingMicroS =
            std::chrono::duration_cast<std::chrono::microseconds>(now - _lastPingSentTime).count();
        if (timeSincePingMicroS >= PingFrequencyMicroS)
        {
            const std::shared_ptr<StreamSocket> socket = _socket.lock();
            if (socket)
                sendPing(now, socket);
        }
#endif
    }
public:
    void performWrites() override
    {
        if (_msgHandler)
            _msgHandler->writeQueuedMessages();
    }

    void onDisconnect() override
    {
        if (_msgHandler)
            _msgHandler->onDisconnect();
    }

    /// Sends a WebSocket Text message.
    int sendMessage(const std::string& msg) const
    {
        return sendTextMessage(msg.c_str(), msg.size());
    }

    /// Implementation of the ProtocolHandlerInterface.
    int sendTextMessage(const char* msg, const size_t len, bool flush = false) const override
    {
        return sendMessage(msg, len, WSOpCode::Text, flush);
    }

    /// Implementation of the ProtocolHandlerInterface.
    int sendBinaryMessage(const char *data, const size_t len, bool flush = false) const override
    {
        return sendMessage(data, len, WSOpCode::Binary, flush);
    }

    /// Sends a WebSocket message of WPOpCode type.
    /// Returns the number of bytes written (including frame overhead) on success,
    /// 0 for closed/invalid socket, and -1 for other errors.
    int sendMessage(const char* data, const size_t len, const WSOpCode code, const bool flush = true) const
    {
        int unitReturn = -1;
        if (!Util::isFuzzing() && UnitBase::get().filterSendMessage(data, len, code, flush, unitReturn))
            return unitReturn;

        //TODO: Support fragmented messages.

        std::shared_ptr<StreamSocket> socket = _socket.lock();
        return sendFrame(socket, data, len, WSFrameMask::Fin | static_cast<unsigned char>(code), flush);
    }
private:
    /// Sends a WebSocket frame given the data, length, and flags.
    /// Returns the number of bytes written (including frame overhead) on success,
    /// 0 for closed/invalid socket, and -1 for other errors.
    int sendFrame(const std::shared_ptr<StreamSocket>& socket,
                  const char* data, const uint64_t len,
                  unsigned char flags, const bool flush = true) const
    {
        if (!socket || data == nullptr || len == 0)
            return -1;

        if (socket->isClosed())
            return 0;

        socket->assertCorrectThread();
        std::vector<char>& out = socket->getOutBuffer();

#if !MOBILEAPP
        const size_t oldSize = out.size();

        out.push_back(flags);

        int maskFlag = _isMasking ? 0x80 : 0;
        if (len < 126)
        {
            out.push_back((char)(len | maskFlag));
        }
        else if (len <= 0xffff)
        {
            out.push_back((char)(126 | maskFlag));
            out.push_back(static_cast<char>((len >> 8) & 0xff));
            out.push_back(static_cast<char>((len >> 0) & 0xff));
        }
        else
        {
            out.push_back((char)(127 | maskFlag));
            out.push_back(static_cast<char>((len >> 56) & 0xff));
            out.push_back(static_cast<char>((len >> 48) & 0xff));
            out.push_back(static_cast<char>((len >> 40) & 0xff));
            out.push_back(static_cast<char>((len >> 32) & 0xff));
            out.push_back(static_cast<char>((len >> 24) & 0xff));
            out.push_back(static_cast<char>((len >> 16) & 0xff));
            out.push_back(static_cast<char>((len >> 8) & 0xff));
            out.push_back(static_cast<char>((len >> 0) & 0xff));
        }

        if (_isMasking)
        { // flip some top bits - perhaps it helps.
            size_t mask = out.size();

            out.push_back(static_cast<char>(0x81));
            out.push_back(static_cast<char>(0x76));
            out.push_back(static_cast<char>(0x81));
            out.push_back(static_cast<char>(0x76));

            // Copy the data.
            out.insert(out.end(), data, data + len);

            // Mask it.
            for (size_t i = 4; i < out.size() - mask; ++i)
                out[mask + i] = out[mask + i] ^ out[mask + (i%4)];
        }
        else
        {
            // Copy the data.
            out.insert(out.end(), data, data + len);
        }
        const size_t size = out.size() - oldSize;

        if (flush)
            socket->writeOutgoingData();
#else
        LOG_TRC("WebSocketHandle::sendFrame: Writing to #" << socket->getFD() << " " << len << " bytes");

        // We ignore the flush parameter and always flush in the MOBILEAPP case because there is no
        // WebSocket framing, we put the messages as such into the FakeSocket queue.

        (void) flush;
        out.insert(out.end(), data, data + len);
        const size_t size = out.size();

        socket->writeOutgoingData();
#endif

        return size;
    }

protected:

    bool isControlFrame(WSOpCode code){ return code >= WSOpCode::Close; }

    void readPayload(unsigned char *data, size_t dataLen, unsigned char* mask, std::vector<char>& payload)
    {
        if (dataLen == 0)
            return;

        if (mask)
        {
            size_t end = payload.size();
            payload.resize(end + dataLen);
            if (dataLen > 0)
            {
                char* wsData = &payload[end];
                for (size_t i = 0; i < dataLen; ++i)
                    *wsData++ = data[i] ^ mask[i % 4];
            }
        }
        else
            payload.insert(payload.end(), data, data + dataLen);
    }

    /// To be overriden to handle the websocket messages the way you need.
    virtual void handleMessage(const std::vector<char> &data)
    {
        if (_msgHandler)
            _msgHandler->handleMessage(data);
    }

    std::weak_ptr<StreamSocket>& getSocket()
    {
        return _socket;
    }

    void setSocket(const std::weak_ptr<StreamSocket>& socket)
    {
        _socket = socket;
    }

    /// Implementation of the ProtocolHandlerInterface.
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
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (socket == nullptr)
            throw std::runtime_error("Invalid socket while upgrading to WebSocket. Request: " + req.getURI());

        LOG_TRC("#" << socket->getFD() << ": Upgrading to WebSocket.");
        assert(!socket->isWebSocket());

#if !MOBILEAPP
        // create our websocket goodness ...
        const int wsVersion = std::stoi(req.get("Sec-WebSocket-Version", "13"));
        const std::string wsKey = req.get("Sec-WebSocket-Key", "");
        const std::string wsProtocol = req.get("Sec-WebSocket-Protocol", "chat");
        // FIXME: other sanity checks ...
        LOG_INF("#" << socket->getFD() << ": WebSocket version: " << wsVersion <<
                ", key: [" << wsKey << "], protocol: [" << wsProtocol << "].");

#if ENABLE_DEBUG
        if (std::getenv("LOOL_ZERO_BUFFER_SIZE"))
            socket->setSocketBufferSize(0);
#endif

        std::ostringstream oss;
        oss << "HTTP/1.1 101 Switching Protocols\r\n"
            << "Upgrade: websocket\r\n"
            << "Connection: Upgrade\r\n"
            << "Sec-WebSocket-Accept: " << PublicComputeAccept::doComputeAccept(wsKey) << "\r\n"
            << "\r\n";

        const std::string res = oss.str();
        LOG_TRC("#" << socket->getFD() << ": Sending WS Upgrade response: " << res);
        socket->send(res);
#endif
        setWebSocket();
    }

#if !MOBILEAPP
    // Handle incoming upgrade to full socket as client WS.
    void handleClientUpgrade()
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();

        LOG_TRC("Incoming client websocket upgrade response: "
                << std::string(&socket->getInBuffer()[0], socket->getInBuffer().size()));

        bool bOk = false;
        StreamSocket::MessageMap map;

        try
        {
            Poco::MemoryInputStream message(&socket->getInBuffer()[0], socket->getInBuffer().size());;
            Poco::Net::HTTPResponse response;

            response.read(message);

            {
                static const std::string marker("\r\n\r\n");
                auto itBody = std::search(socket->getInBuffer().begin(),
                                          socket->getInBuffer().end(),
                                          marker.begin(), marker.end());

                if (itBody != socket->getInBuffer().end())
                    map._headerSize = itBody - socket->getInBuffer().begin() + marker.size();
            }

            if (response.getStatus() == Poco::Net::HTTPResponse::HTTP_SWITCHING_PROTOCOLS
                && response.has("Upgrade")
                && Poco::icompare(response.get("Upgrade"), "websocket") == 0)
            {
#if 0 // SAL_DEBUG ...
                const std::string wsKey = response.get("Sec-WebSocket-Accept", "");
                const std::string wsProtocol = response.get("Sec-WebSocket-Protocol", "");
                if (Poco::icompare(wsProtocol, "chat") != 0)
                    LOG_ERR("Unknown websocket protocol " << wsProtocol);
                else
#endif
                {
                    LOG_TRC("Accepted incoming websocket response");
                    // FIXME: validate Sec-WebSocket-Accept vs. Sec-WebSocket-Key etc.
                    bOk = true;
                }
            }
        }
        catch (const Poco::Exception& exc)
        {
            LOG_DBG("handleClientUpgrade exception caught: " << exc.displayText());
        }
        catch (const std::exception& exc)
        {
            LOG_DBG("handleClientUpgrade exception caught.");
        }

        if (!bOk || map._headerSize == 0)
        {
            LOG_ERR("Bad websocker server response.");

            socket->shutdown();
            return;
        }

        setWebSocket();
        socket->eraseFirstInputBytes(map);
    }
#endif

    void setWebSocket()
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        socket->setWebSocket();

        // No need to ping right upon connection/upgrade,
        // but do reset the time to avoid pinging immediately after.
        _lastPingSentTime = std::chrono::steady_clock::now();
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
