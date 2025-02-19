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

#pragma once

#include <atomic>
#include <condition_variable>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <queue>
#include <string>
#include <thread>

#include <NetUtil.hpp>

namespace net
{

class DNSResolver;
class HostEntry;

class AsyncDNS
{
public:
    AsyncDNS();
    ~AsyncDNS();

    static void startAsyncDNS();
    static void stopAsyncDNS();

    static void dumpState(std::ostream& os);

    typedef std::function<void(const HostEntry& hostEntry)> DNSThreadFn;
    typedef std::function<std::string()> DNSThreadDumpStateFn;

    static void lookup(const std::string& searchEntry,
                       const DNSThreadFn& cb,
                       const DNSThreadDumpStateFn& dumpState);

private:
    std::atomic<bool> _exit;
    std::unique_ptr<DNSResolver> _resolver;
    std::unique_ptr<std::thread> _thread;
    std::mutex _lock;
    std::condition_variable _condition;
    struct Lookup
    {
        std::string query;
        AsyncDNS::DNSThreadFn cb;
        AsyncDNS::DNSThreadDumpStateFn dumpState;
    };
    std::queue<Lookup> _lookups;
    Lookup _activeLookup;

    void resolveDNS();
    void addLookup(const std::string& lookup,
                   const DNSThreadFn& cb,
                   const DNSThreadDumpStateFn& dumpState);

    void startThread();
    void joinThread();

    void dumpQueueState(std::ostream& os) const;
};

}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
