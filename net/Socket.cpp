/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <stdio.h>
#include <ctype.h>
#include <iomanip>

#include <Poco/DateTime.h>
#include <Poco/DateTimeFormat.h>
#include <Poco/DateTimeFormatter.h>

#include "SigUtil.hpp"
#include "Socket.hpp"
#include "ServerSocket.hpp"
#include "WebSocketHandler.hpp"

int SocketPoll::DefaultPollTimeoutMs = 5000;

// help with initialization order
namespace {
    std::vector<int> &getWakeupsArray()
    {
        static std::vector<int> pollWakeups;
        return pollWakeups;
    }
    std::mutex &getPollWakeupsMutex()
    {
        static std::mutex pollWakeupsMutex;
        return pollWakeupsMutex;
    }
}

SocketPoll::SocketPoll(const std::string& threadName)
    : _name(threadName),
      _stop(false),
      _threadStarted(false),
      _threadFinished(false)
{
    // Create the wakeup fd.
    if (::pipe2(_wakeup, O_CLOEXEC | O_NONBLOCK) == -1)
    {
        throw std::runtime_error("Failed to allocate pipe for SocketPoll [" + threadName + "] waking.");
    }

    {
        std::lock_guard<std::mutex> lock(getPollWakeupsMutex());
        getWakeupsArray().push_back(_wakeup[1]);
    }

    _owner = std::this_thread::get_id();
}

SocketPoll::~SocketPoll()
{
    stop();
    if (_threadStarted && _thread.joinable())
    {
        if (_thread.get_id() == std::this_thread::get_id())
            LOG_ERR("DEADLOCK PREVENTED: joining own thread!");
        else
            _thread.join();
    }

    {
        std::lock_guard<std::mutex> lock(getPollWakeupsMutex());
        auto it = std::find(getWakeupsArray().begin(),
                            getWakeupsArray().end(),
                            _wakeup[1]);

        if (it != getWakeupsArray().end())
            getWakeupsArray().erase(it);
    }

    ::close(_wakeup[0]);
    ::close(_wakeup[1]);
    _wakeup[0] = -1;
    _wakeup[1] = -1;
}

void SocketPoll::startThread()
{
    if (!_threadStarted)
    {
        _threadStarted = true;
        try
        {
            _thread = std::thread(&SocketPoll::pollingThreadEntry, this);
            _owner = _thread.get_id();
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Failed to start poll thread: " << exc.what());
            _threadStarted = false;
        }
    }
}

void SocketPoll::wakeupWorld()
{
    for (const auto& fd : getWakeupsArray())
        wakeup(fd);
}

void ServerSocket::dumpState(std::ostream& os)
{
    os << "\t" << getFD() << "\t<accept>\n";
}

namespace {

void dump_hex (const char *legend, const char *prefix, std::vector<char> buffer)
{
    unsigned int i, j;
    fprintf (stderr, "%s", legend);
    for (j = 0; j < buffer.size() + 15; j += 16)
    {
        fprintf (stderr, "%s0x%.4x  ", prefix, j);
        for (i = 0; i < 16; i++)
        {
            if ((j + i) < buffer.size())
                fprintf (stderr, "%.2x ", (unsigned char)buffer[j+i]);
            else
                fprintf (stderr, "   ");
            if (i == 8)
                fprintf (stderr, " ");
        }
        fprintf (stderr, " | ");

        for (i = 0; i < 16; i++)
            if ((j + i) < buffer.size() && ::isprint(buffer[j+i]))
                fprintf (stderr, "%c", buffer[j+i]);
            else
                fprintf (stderr, ".");
        fprintf (stderr, "\n");
    }
}

} // namespace

void WebSocketHandler::dumpState(std::ostream& os)
{
    os << (_shuttingDown ? "shutd " : "alive ")
       << std::setw(5) << 1.0*_pingTimeUs/1000 << "ms ";
    if (_wsPayload.size() > 0)
        dump_hex("\t\tws queued payload:\n", "\t\t", _wsPayload);
}

void StreamSocket::dumpState(std::ostream& os)
{
    int timeoutMaxMs = SocketPoll::DefaultPollTimeoutMs;
    int events = getPollEvents(std::chrono::steady_clock::now(), timeoutMaxMs);
    os << "\t" << getFD() << "\t" << events << "\t"
       << _inBuffer.size() << "\t" << _outBuffer.size() << "\t";
    _socketHandler->dumpState(os);
    if (_inBuffer.size() > 0)
        dump_hex("\t\tinBuffer:\n", "\t\t", _inBuffer);
    if (_outBuffer.size() > 0)
        dump_hex("\t\toutBuffer:\n", "\t\t", _inBuffer);
}

void SocketPoll::dumpState(std::ostream& os)
{
    // FIXME: NOT thread-safe! _pollSockets is modified from the polling thread!
    os << " Poll [" << _pollSockets.size() << "] - wakeup r: "
       << _wakeup[0] << " w: " << _wakeup[1] << "\n";
    if (_newCallbacks.size() > 0)
        os << "\tcallbacks: " << _newCallbacks.size() << "\n";
    os << "\tfd\tevents\trsize\twsize\n";
    for (auto &i : _pollSockets)
        i->dumpState(os);
}

namespace HttpHelper
{
    void sendFile(const std::shared_ptr<StreamSocket>& socket, const std::string& path,
                  Poco::Net::HTTPResponse& response, bool noCache)
    {
        struct stat st;
        if (stat(path.c_str(), &st) != 0)
        {
            LOG_WRN("#" << socket->getFD() << ": Failed to stat [" << path << "]. File will not be sent.");
            throw Poco::FileNotFoundException("Failed to stat [" + path + "]. File will not be sent.");
            return;
        }

        int bufferSize = std::min(st.st_size, (off_t)Socket::MaximumSendBufferSize);
        if (st.st_size >= socket->getSendBufferSize())
        {
            socket->setSocketBufferSize(bufferSize);
            bufferSize = socket->getSendBufferSize();
        }

        response.setContentLength(st.st_size);
        response.set("User-Agent", HTTP_AGENT_STRING);
        response.set("Date", Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT));
        if (!noCache)
        {
            // 60 * 60 * 24 * 128 (days) = 11059200
            response.set("Cache-Control", "max-age=11059200");
            response.set("ETag", "\"" LOOLWSD_VERSION_HASH "\"");
        }

        std::ostringstream oss;
        response.write(oss);
        const std::string header = oss.str();
        LOG_TRC("#" << socket->getFD() << ": Sending file [" << path << "]: " << header);
        socket->send(header);

        std::ifstream file(path, std::ios::binary);
        bool flush = true;
        do
        {
            char buf[bufferSize];
            file.read(buf, sizeof(buf));
            const int size = file.gcount();
            if (size > 0)
                socket->send(buf, size, flush);
            else
                break;
            flush = false;
        }
        while (file);
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
