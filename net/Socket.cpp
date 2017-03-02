/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "Socket.hpp"

std::mutex SocketPoll::_pollWakeupsMutex;
std::vector<int> SocketPoll::_pollWakeups;

SocketPoll::SocketPoll()
{
    // Create the wakeup fd.
    if (::pipe2(_wakeup, O_CLOEXEC | O_NONBLOCK) == -1)
    {
        throw std::runtime_error("Failed to allocate pipe for SocketPoll waking.");
    }
    std::lock_guard<std::mutex> lock(_pollWakeupsMutex);
    _pollWakeups.push_back(_wakeup[1]);
}

SocketPoll::~SocketPoll()
{
    ::close(_wakeup[0]);
    ::close(_wakeup[1]);

    std::lock_guard<std::mutex> lock(_pollWakeupsMutex);
    auto it = std::find(_pollWakeups.begin(),
                        _pollWakeups.end(),
                        _wakeup[1]);
    if (it != _pollWakeups.end())
        _pollWakeups.erase(it);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
