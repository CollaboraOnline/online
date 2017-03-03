/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "Socket.hpp"

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

SocketPoll::SocketPoll()
{
    // Create the wakeup fd.
    if (::pipe2(_wakeup, O_CLOEXEC | O_NONBLOCK) == -1)
    {
        throw std::runtime_error("Failed to allocate pipe for SocketPoll waking.");
    }
    std::lock_guard<std::mutex> lock(getPollWakeupsMutex());
    getWakeupsArray().push_back(_wakeup[1]);
}

SocketPoll::~SocketPoll()
{
    ::close(_wakeup[0]);
    ::close(_wakeup[1]);

    std::lock_guard<std::mutex> lock(getPollWakeupsMutex());
    auto it = std::find(getWakeupsArray().begin(),
                        getWakeupsArray().end(),
                        _wakeup[1]);

    if (it != getWakeupsArray().end())
        getWakeupsArray().erase(it);
}

void SocketPoll::wakeupWorld()
{
    for (const auto& fd : getWakeupsArray())
        wakeup(fd);
}

void SocketPoll::dumpState()
{
    std::cerr << " Poll [" << _pollSockets.size() << "] - wakeup r: "
              << _wakeup[0] << " w: " << _wakeup[1] << "\n";
    std::cerr << "\tfd\tevents\trsize\twsize\n";
    for (auto &i : _pollSockets)
        i->dumpState();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
