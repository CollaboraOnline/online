/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <atomic>
#include <cerrno>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <mutex>
#include <thread>
#include <assert.h>

#include <Poco/MemoryStream.h>
#include <Poco/Net/SocketAddress.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Runnable.h>
#include <Poco/Thread.h>

using Poco::MemoryInputStream;
using Poco::StringTokenizer;

#include "ssl.hpp"
#include "socket.hpp"

constexpr int HttpPortNumber = 9191;
constexpr int SslPortNumber = 9193;

static std::string computeAccept(const std::string &key);

template <class T>
class SimpleResponseClient : public T
{
    int _wsVersion;
    std::string _wsKey;
    std::string _wsProtocol;
    std::vector<char> _wsPayload;
    enum { HTTP, WEBSOCKET } _wsState;

public:
    SimpleResponseClient(const int fd) :
        T(fd),
        _wsVersion(0),
        _wsState(HTTP)
    {
    }
    virtual void handleHTTP()
    {
        int number = 0;
        MemoryInputStream message(&T::_inBuffer[0], T::_inBuffer.size());
        Poco::Net::HTTPRequest req;
        req.read(message);

        // if we succeeded - remove that from our input buffer
        // An HTTP request is either parsed completely and successfully, or not.
        // We can't have partial read, even though Poco seems to not report full read.
        T::_inBuffer.clear();

        StringTokenizer tokens(req.getURI(), "/?");
        if (tokens.count() == 4)
        {
            std::string subpool = tokens[2];
            number = std::stoi(tokens[3]);

            // complex algorithmic core:
            number = number + 1;

            std::string numberString = std::to_string(number);
            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                << "Date: Once, Upon a time GMT\r\n" // Mon, 27 Jul 2009 12:28:53 GMT
                << "Server: madeup string (Linux)\r\n"
                << "Content-Length: " << numberString.size() << "\r\n"
                << "Content-Type: text/plain\r\n"
                << "Connection: Closed\r\n"
                << "\r\n"
                << numberString;
            ;
            std::string str = oss.str();
            T::_outBuffer.insert(T::_outBuffer.end(), str.begin(), str.end());
        }
        else if (tokens.count() == 2 && tokens[1] == "ws")
        { // create our websocket goodness ...
            _wsVersion = std::stoi(req.get("Sec-WebSocket-Version", "13"));
            _wsKey = req.get("Sec-WebSocket-Key", "");
            _wsProtocol = req.get("Sec-WebSocket-Protocol", "chat");
            std::cerr << "version " << _wsVersion << " key '" << _wsKey << "\n";
            // FIXME: other sanity checks ...

            std::ostringstream oss;
            oss << "HTTP/1.1 101 Switching Protocols\r\n"
                << "Upgrade: websocket\r\n"
                << "Connection: Upgrade\r\n"
                << "Sec-Websocket-Accept: " << computeAccept(_wsKey) << "\r\n"
                << "\r\n";
            std::string str = oss.str();
            T::_outBuffer.insert(T::_outBuffer.end(), str.begin(), str.end());
            _wsState = WEBSOCKET;
        }
        else
            std::cerr << " unknown tokens " << tokens.count() << std::endl;
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

    virtual void handleIncomingMessage() override
    {
        std::cerr << "incoming message with buffer size " << T::_inBuffer.size() << "\n";
        if (_wsState == HTTP)
        {
            handleHTTP();
            return;
        }

        // websocket fun !
        size_t len = T::_inBuffer.size();
        if (len < 2) // partial read
            return;

        unsigned char *p = reinterpret_cast<unsigned char*>(&T::_inBuffer[0]);
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

        T::_inBuffer.erase(T::_inBuffer.begin(), T::_inBuffer.begin() + headerLen + payloadLen);

        // FIXME: fin, aggregating payloads into _wsPayload etc.
        handleWSMessage(fin, code, _wsPayload);
        _wsPayload.clear();
    }

    virtual void queueWSMessage(const std::vector<char> &data,
                                WSOpCode code = WSOpCode::Binary)
    {
        size_t len = data.size();
        bool fin = false;
        bool mask = false;

        unsigned char header[2];
        header[0] = (fin ? 0x80 : 0) | static_cast<unsigned char>(code);
        header[1] = mask ? 0x80 : 0;
        T::_outBuffer.push_back((char)header[0]);

        // no out-bound masking ...
        if (len < 126)
        {
            header[1] |= len;
            T::_outBuffer.push_back((char)header[1]);
        }
        else if (len <= 0xffff)
        {
            header[1] |= 126;
            T::_outBuffer.push_back((char)header[1]);
            char* p = reinterpret_cast<char*>(&len);
            T::_outBuffer.push_back(p[1]);
            T::_outBuffer.push_back(p[0]);
        }
        else
        {
            header[1] |= 127;
            T::_outBuffer.push_back((char)header[1]);
            char* p = reinterpret_cast<char*>(&len);
            for (int i = 7; i >= 0; --i)
            {
                T::_outBuffer.push_back(p[i]);
            }
        }

        // FIXME: pick random number and mask in the outbuffer etc.
        assert (!mask);

        T::_outBuffer.insert(T::_outBuffer.end(), data.begin(), data.end());
    }

    virtual void handleWSMessage( bool fin, WSOpCode code, std::vector<char> &data)
    {
        std::cerr << "Message: fin? " << fin << " code " << code << " data size " << data.size();
        if (code == WSOpCode::Text)
        {
            std::string text(data.begin(), data.end());
            std::cerr << " text is '" << text << "'\n";

            return;
        }
        else
            std::cerr << " binary\n";

        std::vector<char> reply;
        if (data.size() == sizeof(size_t))
        {
            // ping pong test
            assert (data.size() >= sizeof(size_t));
            size_t *countPtr = reinterpret_cast<size_t *>(&data[0]);
            size_t count = *countPtr;
            count++;
            std::cerr << "count is " << count << "\n";
            reply.insert(reply.end(), reinterpret_cast<char *>(&count),
                        reinterpret_cast<char *>(&count) + sizeof(count));
        }
        else
        {
            // echo tests
            reply.insert(reply.end(), data.begin(), data.end());
        }

        queueWSMessage(reply);
    }

};

// FIXME: use Poco Thread instead (?)

/// Generic thread class.
class Thread
{
public:
    Thread(const std::function<void(std::atomic<bool>&)>& cb) :
        _cb(cb),
        _stop(false)
    {
        _thread = std::thread([this]() { _cb(_stop); });
    }

    Thread(Thread&& other) = delete;
    const Thread& operator=(Thread&& other) = delete;

    ~Thread()
    {
        stop();
        if (_thread.joinable())
        {
            _thread.join();
        }
    }

    void stop()
    {
        _stop = true;
    }

private:
    const std::function<void(std::atomic<bool>&)> _cb;
    std::atomic<bool> _stop;
    std::thread _thread;
};

Poco::Net::SocketAddress addrHttp("127.0.0.1", HttpPortNumber);
Poco::Net::SocketAddress addrSsl("127.0.0.1", SslPortNumber);

/// A non-blocking, streaming socket.
/// T is the socket type created by accept.
template <class T>
class ServerSocket : public Socket
{
    SocketPoll& _clientPoller;
public:
    ServerSocket(SocketPoll& clientPoller)
        : _clientPoller(clientPoller)
    {
    }

    /// Binds to a local address (Servers only).
    /// Does not retry on error.
    /// Returns true on success only.
    bool bind(const Poco::Net::SocketAddress& address)
    {
        // Enable address reuse to avoid stalling after
        // recycling, when previous socket is TIME_WAIT.
        //TODO: Might be worth refactoring out.
        const int reuseAddress = 1;
        constexpr unsigned int len = sizeof(reuseAddress);
        ::setsockopt(getFD(), SOL_SOCKET, SO_REUSEADDR, &reuseAddress, len);

        const int rc = ::bind(getFD(), address.addr(), address.length());
        return (rc == 0);
    }

    /// Listen to incoming connections (Servers only).
    /// Does not retry on error.
    /// Returns true on success only.
    bool listen(const int backlog = 64)
    {
        const int rc = ::listen(getFD(), backlog);
        return (rc == 0);
    }

    /// Accepts an incoming connection (Servers only).
    /// Does not retry on error.
    /// Returns a valid Socket shared_ptr on success only.
    std::shared_ptr<Socket> accept()
    {
        // Accept a connection (if any) and set it to non-blocking.
        // We don't care about the client's address, so ignored.
        const int rc = ::accept4(getFD(), nullptr, nullptr, SOCK_NONBLOCK);
        return (rc != -1 ? std::make_shared<T>(rc) : std::shared_ptr<T>(nullptr));
    }

    int getPollEvents() override
    {
        return POLLIN;
    }

    HandleResult handlePoll( int events ) override
    {
        if (events & POLLIN)
        {
            std::shared_ptr<Socket> clientSocket = accept();
            if (!clientSocket)
            {
                const std::string msg = "Failed to accept. (errno: ";
                throw std::runtime_error(msg + std::strerror(errno) + ")");
            }

            std::cout << "Accepted client #" << clientSocket->getFD() << std::endl;
            _clientPoller.insertNewSocket(clientSocket);
        }

        return Socket::HandleResult::CONTINUE;
    }
};

template <typename T>
void server(const Poco::Net::SocketAddress& addr, SocketPoll& clientPoller)
{
    // Start server.
    auto server = std::make_shared<ServerSocket<T>>(clientPoller);
    if (!server->bind(addr))
    {
        const std::string msg = "Failed to bind. (errno: ";
        throw std::runtime_error(msg + std::strerror(errno) + ")");
    }

    if (!server->listen())
    {
        const std::string msg = "Failed to listen. (errno: ";
        throw std::runtime_error(msg + std::strerror(errno) + ")");
    }

    SocketPoll serverPoll;

    serverPoll.insertNewSocket(server);

    std::cout << "Listening." << std::endl;
    for (;;)
    {
        serverPoll.poll(30000);
    }
}

int main(int, const char**)
{
    // TODO: These would normally come from config.
    SslContext::initialize("/etc/loolwsd/cert.pem",
                           "/etc/loolwsd/key.pem",
                           "/etc/loolwsd/ca-chain.cert.pem");

    // Used to poll client sockets.
    SocketPoll poller;

    // Start the client polling thread.
    Thread threadPoll([&poller](std::atomic<bool>& stop)
    {
        while (!stop)
        {
            poller.poll(5000);
        }
    });

    // Start the server.
    server<SimpleResponseClient<SslStreamSocket>>(addrSsl, poller);

    std::cout << "Shutting down server." << std::endl;

    threadPoll.stop();

    SslContext::uninitialize();
    return 0;
}

// Saves writing this ourselves:

#include <Poco/Net/WebSocket.h>

namespace {
#include <Poco/Net/WebSocket.h>
    struct Puncture : private Poco::Net::WebSocket {
        static std::string doComputeAccept(const std::string &key)
        {
            return computeAccept(key);
        }
    };
}

static std::string computeAccept(const std::string &key)
{
    return Puncture::doComputeAccept(key);
}


/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
