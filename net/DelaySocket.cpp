/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include "net/DelaySocket.hpp"

class Delayer;

// FIXME: TerminatingPoll ?
static SocketPoll DelayPoll("delay_poll");

/// Reads from fd, delays that and then writes to _dest.
class DelaySocket : public Socket {
    int _delayMs;
    bool _closed;
    bool _stopPoll;
    bool _waitForWrite;
    std::weak_ptr<DelaySocket> _dest;

    const size_t WindowSize = 64 * 1024;

    struct DelayChunk {
        std::chrono::steady_clock::time_point _sendTime;
        std::vector<char> _data;
        DelayChunk(int delayMs)
        {
            _sendTime = std::chrono::steady_clock::now() +
                std::chrono::milliseconds(delayMs);
        }
        bool isError() { return _data.size() == 0; }
    private:
        DelayChunk();
    };

    size_t _chunksSize;
    std::vector<std::shared_ptr<DelayChunk>> _chunks;
public:
    DelaySocket(int delayMs, int fd) :
        Socket (fd), _delayMs(delayMs), _closed(false),
        _stopPoll(false), _waitForWrite(false),
        _chunksSize(0)
	{
//        setSocketBufferSize(Socket::DefaultSendBufferSize);
	}
    void setDestination(const std::weak_ptr<DelaySocket> &dest)
    {
        _dest = dest;
    }

    void dumpState(std::ostream& os) override
    {
        os << "\tfd: " << getFD()
           << "\n\tqueue: " << _chunks.size() << "\n";
        auto now = std::chrono::steady_clock::now();
        for (auto &chunk : _chunks)
        {
            os << "\t\tin: " <<
                std::chrono::duration_cast<std::chrono::milliseconds>(
                    chunk->_sendTime - now).count() << "ms - "
               << chunk->_data.size() << "bytes\n";
        }
    }

    // FIXME - really need to propagate 'noDelay' etc.
    // have a debug only lookup of delayed sockets for this case ?

    int getPollEvents(std::chrono::steady_clock::time_point now,
                      int &timeoutMaxMs) override
    {
        auto dest = _dest.lock();

        bool bOtherIsWriteBlocked = !dest || dest->_waitForWrite;
        bool bWeAreReadBlocked = _chunksSize >= WindowSize;

        if (_chunks.size() > 0 && (!bOtherIsWriteBlocked || !bWeAreReadBlocked))
        {
            int remainingMs = std::chrono::duration_cast<std::chrono::milliseconds>(
                (*_chunks.begin())->_sendTime - now).count();
            if (remainingMs < timeoutMaxMs)
                std::cerr << "#" << getFD() << " reset timeout max to " << remainingMs
                          << "ms from " << timeoutMaxMs << "ms "
                          << "owb: " << bOtherIsWriteBlocked << " rb: "
                          << bWeAreReadBlocked << "\n";
            timeoutMaxMs = std::min(timeoutMaxMs, remainingMs);
        }

        if (_stopPoll)
            return -1;

        int events = 0;

        if (!bWeAreReadBlocked)
            events |= POLLIN;

        // NB. controlled by the other socket.
        if (_waitForWrite)
            events |= POLLOUT;

        return events;
    }

    void pushCloseChunk(bool bErrorSocket)
    {
        // socket in error state ? don't keep polling it.
        _stopPoll |= bErrorSocket;
        _chunks.push_back(std::make_shared<DelayChunk>(_delayMs));
    }

    HandleResult handlePoll(std::chrono::steady_clock::time_point now, int events) override
    {
        auto dest = _dest.lock();

        if (events & POLLIN)
        {
            auto chunk = std::make_shared<DelayChunk>(_delayMs);

            char buf[64 * 1024];
            ssize_t len;
            size_t toRead = std::min(sizeof(buf), WindowSize - _chunksSize);
            if (_closed)
            { // get last data before async close
                toRead = sizeof (buf);
            }
            do {
                len = ::read(getFD(), buf, toRead);
            } while (len < 0 && errno == EINTR);

            if (len >= 0)
            {
                std::cerr << "#" << getFD() << " read " << len
                      << " to queue: " << _chunks.size() << "\n";
                chunk->_data.insert(chunk->_data.end(), &buf[0], &buf[len]);
                _chunksSize += len;
                _chunks.push_back(chunk);
            }
            else if (errno != EAGAIN && errno != EWOULDBLOCK)
            {
                std::cerr << "#" << getFD() << " error : " << errno << " " << strerror(errno) << "\n";
                pushCloseChunk(true);
            }
        }

        if (_closed)
        {
            std::cerr << "#" << getFD() << " closing\n";
            dumpState(std::cerr);
            if (dest)
            {
                std::cerr << "\t#" << dest->getFD() << " closing linked\n";
                dest->dumpState(std::cerr);
                dest->pushCloseChunk(false);
                _dest.reset();
            }
            return HandleResult::SOCKET_CLOSED;
        }

        // Write if we have delayed enough.
        if (dest && _chunks.size() > 0)
        {
            std::shared_ptr<DelayChunk> chunk = *_chunks.begin();
            if (std::chrono::duration_cast<std::chrono::milliseconds>(
                    now - chunk->_sendTime).count() >= 0)
            {
                dest->_waitForWrite = false;

                if (chunk->_data.size() == 0)
                { // delayed error or close
                    std::cerr << "#" << getFD() << " handling delayed close with " << _chunksSize << "bytes left\n";
                    _closed = true;
                    return HandleResult::CONTINUE;
                }

                ssize_t len;
                do {
                    len = ::write(dest->getFD(), &chunk->_data[0], chunk->_data.size());
                } while (len < 0 && errno == EINTR);

                if (len < 0)
                {
                    if (errno == EAGAIN || errno == EWOULDBLOCK)
                    {
                        dest->_waitForWrite = true;
                        std::cerr << "#" << dest->getFD() << " full - waiting for write ultimately from fd #" << getFD() << "\n";
                    }
                    else
                    {
                        std::cerr << "#" << dest->getFD() << " failed onwards write " << len << "bytes of "
                                  << chunk->_data.size() << " ultimately from fd #" << getFD()
                                  << " queue: " << _chunks.size() << " error " << strerror(errno) << "\n";
                        dest->pushCloseChunk(false);
                    }
                }
                else
                {
                    std::cerr << "#" << dest->getFD() << " written onwards " << len << "bytes of "
                              << chunk->_data.size() << " ultimately from fd #" << getFD()
                              << " queue: " << _chunks.size() << "\n";
                    if (len > 0)
                    {
                        chunk->_data.erase(chunk->_data.begin(), chunk->_data.begin() + len);
                        _chunksSize -= len;
                    }

                    if (chunk->_data.size() == 0)
                        _chunks.erase(_chunks.begin(), _chunks.begin() + 1);
                }
            }
        }

        // FIXME: ideally we could avoid polling & delay _closed state etc.
        if (events & (POLLERR | POLLHUP | POLLNVAL))
        {
            std::cerr << "#" << getFD() << " error events: " << events << "\n";
            pushCloseChunk(true);
        }
        return HandleResult::CONTINUE;
    }
};

/// Delayer:
///
/// Some terminology:
///    physical socket (DelaySocket's own fd) - what we accepted.
///    internalFd - the internal side of the socket-pair
///    delayFd - what we hand on to our un-suspecting wrapped socket
///              which looks like an external socket - but delayed.
namespace Delay {
    int create(int delayMs, int physicalFd)
    {
        int pair[2];
        int rc = socketpair(AF_UNIX, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0, pair);
        assert (rc == 0);
        int internalFd = pair[0];
        int delayFd = pair[1];

        auto physical = std::make_shared<DelaySocket>(delayMs, physicalFd);
        auto internal = std::make_shared<DelaySocket>(delayMs, internalFd);
        physical->setDestination(internal);
        internal->setDestination(physical);

        DelayPoll.startThread();
        DelayPoll.insertNewSocket(physical);
        DelayPoll.insertNewSocket(internal);

        return delayFd;
    }
    void dumpState(std::ostream &os)
    {
        if (DelayPoll.isAlive())
        {
            os << "Delay poll:\n";
            DelayPoll.dumpState(os);
        }
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
