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

#include <config.h>

#include <net/DelaySocket.hpp>

#include <memory>

#define DELAY_LOG(X) std::cerr << X << '\n';

std::shared_ptr<TerminatingPoll> Delay::DelayPoll;
std::once_flag Delay::DelayPollOnceFlag;

/// Reads from fd, delays that and then writes to _dest.
class DelaySocket : public Socket {
    STATE_ENUM(State,
               ReadWrite,      // normal socket
               EofFlushWrites, // finish up writes and close
               Closed
              );

    std::shared_ptr<DelaySocket> _dest; // our writing twin.
    int _delayMs;
    State _state;

    /// queued up data - sent to us by our opposite twin.
    struct WriteChunk {
    private:
        std::chrono::steady_clock::time_point _sendTime;
        std::vector<char> _data;
    public:
        WriteChunk(int delayMs)
        {
            _sendTime = std::chrono::steady_clock::now() +
                std::chrono::milliseconds(delayMs);
        }
        bool isError() const { return _data.empty(); }
        std::chrono::steady_clock::time_point getSendTime() const { return _sendTime; }
        std::vector<char>& getData() { return _data; }
        WriteChunk() = delete;
    };

    std::vector<std::shared_ptr<WriteChunk>> _chunks;
public:
    DelaySocket(int delayMs, int fd, std::chrono::steady_clock::time_point creationTime) :
        Socket(fd, Socket::Type::Unix, creationTime), _delayMs(delayMs),
        _state(State::ReadWrite)
	{
//        setSocketBufferSize(Socket::DefaultSendBufferSize);
	}
    void setDestination(const std::shared_ptr<DelaySocket> &dest)
    {
        _dest = dest;
    }

    void dumpState(std::ostream& os) override
    {
        os << "\tfd: " << getFD()
           << "\n\tqueue: " << _chunks.size() << '\n';
        auto now = std::chrono::steady_clock::now();
        for (auto &chunk : _chunks)
        {
            os << "\t\tin: "
               << std::chrono::duration_cast<std::chrono::milliseconds>(chunk->getSendTime() - now)
               << " - " << chunk->getData().size() << "bytes\n";
        }
    }

    // FIXME - really need to propagate 'noDelay' etc.
    // have a debug only lookup of delayed sockets for this case ?

    int getPollEvents(std::chrono::steady_clock::time_point now,
                      int64_t &timeoutMaxMicroS) override
    {
        if (_chunks.size() > 0)
        {
            int64_t remainingMicroS = std::chrono::duration_cast<std::chrono::microseconds>(
                (*_chunks.begin())->getSendTime() - now).count();
            if (remainingMicroS < timeoutMaxMicroS)
                DELAY_LOG('#' << getFD() << " reset timeout max to " << remainingMicroS
                          << "us from " << timeoutMaxMicroS << "us\n");
            timeoutMaxMicroS = std::min(timeoutMaxMicroS, remainingMicroS);
        }

        if (_chunks.size() > 0 &&
            now > (*_chunks.begin())->getSendTime())
            return POLLIN | POLLOUT;
        else
            return POLLIN;
    }

    void pushCloseChunk()
    {
        _chunks.push_back(std::make_shared<WriteChunk>(_delayMs));
    }

    void changeState(State newState)
    {
        switch (newState)
        {
        case State::ReadWrite:
            assert (false);
            break;
        case State::EofFlushWrites:
            assert (_state == State::ReadWrite);
            assert (_dest);
            _dest->pushCloseChunk();
            _dest = nullptr;
            break;
        case State::Closed:
            if (_dest && _state == State::ReadWrite)
                _dest->pushCloseChunk();
            _dest = nullptr;
            shutdown();
            break;
        }
        DELAY_LOG('#' << getFD() << " changed to state " << nameShort(newState) << '\n');
        _state = newState;
    }

    void handlePoll(SocketDisposition &disposition,
                    std::chrono::steady_clock::time_point now, int events) override
    {
        if (_state == State::ReadWrite && (events & POLLIN))
        {
            auto chunk = std::make_shared<WriteChunk>(_delayMs);

            char buf[64 * 1024];
            ssize_t len;
            size_t toRead = sizeof(buf); //std::min(sizeof(buf), WindowSize - _chunksSize);
            do {
                len = ::read(getFD(), buf, toRead);
            } while (len < 0 && errno == EINTR);

            if (len == 0) // EOF.
                changeState(State::EofFlushWrites);
            else if (len >= 0)
            {
                DELAY_LOG('#' << getFD() << " read " << len
                          << " to queue: " << _chunks.size() << '\n');
                chunk->getData().insert(chunk->getData().end(), &buf[0], &buf[len]);
                assert(_dest && "no destination for data");
                _dest->_chunks.push_back(std::move(chunk));
            }
            else if (errno != EAGAIN && errno != EWOULDBLOCK)
            {
                DELAY_LOG('#' << getFD() << " error : " << Util::symbolicErrno(errno) << ": " << strerror(errno) << '\n');
                changeState(State::Closed); // FIXME - propagate the error ?
            }
        }

        if (_chunks.empty())
        {
            if (_state == State::EofFlushWrites)
                changeState(State::Closed);
        }
        else // Write if we have delayed enough.
        {
            std::shared_ptr<WriteChunk> chunk = *_chunks.begin();
            if (std::chrono::duration_cast<std::chrono::milliseconds>(
                    now - chunk->getSendTime()).count() >= 0)
            {
                if (chunk->getData().empty())
                { // delayed error or close
                    DELAY_LOG('#' << getFD() << " handling delayed close\n");
                    changeState(State::Closed);
                }
                else
                {
                    ssize_t len;
                    do {
                        len = ::write(getFD(), chunk->getData().data(), chunk->getData().size());
                    } while (len < 0 && errno == EINTR);

                    if (len < 0)
                    {
                        if (errno == EAGAIN || errno == EWOULDBLOCK)
                        {
                            DELAY_LOG('#' << getFD() << " full - waiting for write\n");
                        }
                        else
                        {
                            DELAY_LOG('#' << getFD() << " failed onwards write "
                                      << len << "bytes of "
                                      << chunk->getData().size()
                                      << " queue: " << _chunks.size() << " error: "
                                      << Util::symbolicErrno(errno) << ": " << strerror(errno) << '\n');
                            changeState(State::Closed);
                        }
                    }
                    else
                    {
                        DELAY_LOG('#' << getFD() << " written onwards " << len << "bytes of "
                                  << chunk->getData().size()
                                  << " queue: " << _chunks.size() << '\n');
                        if (len > 0)
                            chunk->getData().erase(chunk->getData().begin(), chunk->getData().begin() + len);

                        if (chunk->getData().empty())
                            _chunks.erase(_chunks.begin(), _chunks.begin() + 1);
                    }
                }
            }
        }

        if (events & (POLLERR | POLLHUP | POLLNVAL))
        {
            DELAY_LOG('#' << getFD() << " error events: " << events << '\n');
            changeState(State::Closed);
        }

        if (_state == State::Closed)
            disposition.setClosed();
    }
};

/// Delayer:
///
/// Some terminology:
///    physical socket (DelaySocket's own fd) - what we accepted.
///    internalFd - the internal side of the socket-pair
///    delayFd - what we hand on to our un-suspecting wrapped socket
///              which looks like an external socket - but delayed.
Delay::Delay(std::size_t latencyMs)
{
    if (latencyMs)
    {
        // This will be called exactly once, and all
        // competing threads (if more than one) will
        // block until it returns.
        std::call_once(DelayPollOnceFlag, []() {
            DelayPoll = std::make_shared<TerminatingPoll>("delay_poll");
            DelayPoll->startThread(); // Start the thread.
        });
    }
}

Delay::~Delay() { DelayPoll.reset(); }

int Delay::create(int delayMs, int physicalFd)
{
    auto delayPoll = DelayPoll;
    if (delayPoll && delayPoll->isAlive())
    {
        int pair[2];
        int rc = socketpair(AF_UNIX, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0, pair);
        assert(rc == 0);
        (void)rc;
        int internalFd = pair[0];
        int delayFd = pair[1];

        const std::chrono::steady_clock::time_point now = std::chrono::steady_clock::now();
        auto physical = std::make_shared<DelaySocket>(delayMs, physicalFd, now);
        auto internal = std::make_shared<DelaySocket>(delayMs, internalFd, now);
        physical->setDestination(internal);
        internal->setDestination(physical);

        delayPoll->insertNewSocket(physical);
        delayPoll->insertNewSocket(internal);
        LOG_TRC("Created DelaySockets with physicalFd: " << physicalFd
                                                         << " and internalFd: " << internalFd);
        return delayFd;
    }
    else
    {
        LOG_ERR("Failed to create DelaySockets for physicalFd: " << physicalFd
                                                                 << ". No DelayPoll exists.");
    }

    return -1;
}

void Delay::dumpState(std::ostream& os)
{
    auto delayPoll = DelayPoll;
    if (delayPoll && delayPoll->isAlive())
    {
        os << "Delay poll:\n";
        delayPoll->dumpState(os);
    }
    else
    {
        os << "Delay poll: doesn't exist.\n";
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
