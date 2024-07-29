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

#include "NetUtil.hpp"
#include "AsyncDNS.hpp"
#include <common/Util.hpp>

#include "Socket.hpp"
#if ENABLE_SSL && !MOBILEAPP
#include "SslSocket.hpp"
#endif

#include <Poco/Exception.h>
#include <Poco/Net/DNS.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/NetworkInterface.h>

#include <netdb.h>

#include <Poco/Net/SocketAddress.h>

namespace net
{

#if !MOBILEAPP

static std::string makeIPAddress(const sockaddr* ai_addr)
{
    char addrstr[INET6_ADDRSTRLEN];

    static_assert(INET6_ADDRSTRLEN >= INET_ADDRSTRLEN, "ipv6 addresses are longer than ipv4");

    const void *inAddr = nullptr;
    switch (ai_addr->sa_family)
    {
        case AF_INET:
        {
            auto ipv4 = (const sockaddr_in*)ai_addr;
            inAddr = &(ipv4->sin_addr);
            break;
        }
        case AF_INET6:
        {
            auto ipv6 = (const sockaddr_in6*)ai_addr;
            inAddr = &(ipv6->sin6_addr);
            break;
        }
    }

    if (!inAddr)
    {
        LOG_ERR("Unknown sa_family: " << ai_addr->sa_family);
        return std::string();
    }

    const char* result = inet_ntop(ai_addr->sa_family, inAddr, addrstr, sizeof(addrstr));
    if (!result)
    {
        LOG_ERR("inet_ntop failure: " << strerror(errno));
        return std::string();
    }
    return std::string(result);
}

bool HostEntry::resolveIP4(const std::string& addressToCheck, std::string& hostname)
{
    sockaddr_in sa4{};
    if (inet_pton(AF_INET, addressToCheck.c_str(), &sa4.sin_addr) == 1)
    {
        char hbuf[NI_MAXHOST];
        sa4.sin_family = AF_INET;
        fprintf(stderr, "4ok hee\n");
        if (getnameinfo((sockaddr*)(&sa4), sizeof(sa4), hbuf, sizeof(hbuf), nullptr, 0, NI_NAMEREQD) == 0)
        {
            // canonicalName = hbuf;
            fprintf(stderr, "4still ok %s\n", hbuf);
            hostname.assign(hbuf);
            return true;
        }
    }
    return false;
}

bool HostEntry::resolveIP6(const std::string& addressToCheck, std::string& hostname)
{
    sockaddr_in6 sa6{};
    if (inet_pton(AF_INET6, addressToCheck.c_str(), &sa6.sin6_addr) == 1)
    {
        char hbuf[NI_MAXHOST];
        sa6.sin6_family = AF_INET6;
        fprintf(stderr, "6ok hee\n");
        if (getnameinfo((sockaddr*)(&sa6), sizeof(sa6), hbuf, sizeof(hbuf), nullptr, 0, NI_NAMEREQD) == 0)
        {
            // canonicalName = hbuf;
            fprintf(stderr, "6still ok as %s\n", hbuf);
            hostname.assign(hbuf);
            return true;
        }
    }
    return false;
}

void HostEntry::initFromHostName(const std::string& host)
{
    addrinfo* ainfo = nullptr;
    addrinfo hints;
    std::memset(&hints, 0, sizeof(hints));
    hints.ai_flags = AI_CANONNAME | AI_ADDRCONFIG;
    const int rc = getaddrinfo(host.c_str(), nullptr, &hints, &ainfo);

    if (!rc && ainfo)
    {
        for (const addrinfo* ai = ainfo; ai; ai = ai->ai_next)
        {
            if (ai->ai_canonname)
                _canonicalName = ai->ai_canonname;

            if (ai->ai_addrlen && ai->ai_addr)
                _ipAddresses.push_back(makeIPAddress(ai->ai_addr));
        }

        freeaddrinfo(ainfo);
    }
    else
        LOG_SYS("Failed to lookup host [" << host << "]. Skipping");
}

HostEntry::HostEntry(const std::string& desc)
{
    std::string hostname;
    if (!resolveIP4(desc, hostname) && !resolveIP6(desc, hostname))
        hostname = desc;
    initFromHostName(hostname);
}

HostEntry::HostEntry()
{
}

struct DNSCacheEntry
{
    std::string queryAddress;
    HostEntry hostEntry;
    std::chrono::steady_clock::time_point lookupTime;
};

static HostEntry resolveDNS(const std::string& addressToCheck, std::vector<DNSCacheEntry>& querycache)
{
    const auto now = std::chrono::steady_clock::now();

    // remove entries >= 20 seconds old
    std::erase_if(querycache, [now](const auto& entry)->bool {
                                 auto ageMS = std::chrono::duration_cast<std::chrono::milliseconds>(now - entry.lookupTime).count();
                                 return ageMS > 20000;
                              });

    // search for hit
    auto findIt = std::find_if(querycache.begin(), querycache.end(),
                               [&addressToCheck](const auto& entry)->bool {
                                 return entry.queryAddress == addressToCheck;
                               });
    if (findIt != querycache.end())
        return findIt->hostEntry;

    // lookup and cache
    HostEntry hostEntry(addressToCheck);
    querycache.push_back(DNSCacheEntry{addressToCheck, hostEntry, now});
    return hostEntry;
}

class DNSResolver
{
private:
    std::vector<DNSCacheEntry> _querycache;
public:
    HostEntry resolveDNS(const std::string& addressToCheck)
    {
        return net::resolveDNS(addressToCheck, _querycache);
    }
};

HostEntry resolveDNS(const std::string& addressToCheck)
{
    static DNSResolver resolver;
    return resolver.resolveDNS(addressToCheck);
}

std::string canonicalHostName(const std::string& addressToCheck)
{
    return resolveDNS(addressToCheck).getCanonicalName();
}

std::vector<std::string> resolveAddresses(const std::string& addressToCheck)
{
    HostEntry hostEntry = resolveDNS(addressToCheck);
    return hostEntry.getAddresses();
}

std::string resolveOneAddress(const std::string& addressToCheck)
{
    HostEntry hostEntry = resolveDNS(addressToCheck);
    const auto& addresses = hostEntry.getAddresses();
    if (addresses.empty())
        throw Poco::Net::NoAddressFoundException(addressToCheck);
    return addresses[0];
}

std::string resolveHostAddress(const std::string& targetHost)
{
    try
    {
        return resolveOneAddress(targetHost);
    }
    catch (const Poco::Exception& exc)
    {
        LOG_WRN("Poco::Net::DNS::resolveOne(\"" << targetHost
                                                << "\") failed: " << exc.displayText());
        try
        {
            return Poco::Net::IPAddress(targetHost).toString();
        }
        catch (const Poco::Exception& exc1)
        {
            LOG_WRN("Poco::Net::IPAddress(\"" << targetHost
                                              << "\") failed: " << exc1.displayText());
        }
    }

    return targetHost;
}

bool isLocalhost(const std::string& targetHost)
{
    const std::string targetAddress = resolveHostAddress(targetHost);

    const Poco::Net::NetworkInterface::NetworkInterfaceList list =
        Poco::Net::NetworkInterface::list(true, true);
    for (const auto& netif : list)
    {
        std::string address = netif.address().toString();
        address = address.substr(0, address.find('%', 0));
        if (address == targetAddress)
        {
            LOG_TRC("Host [" << targetHost << "] is on the same host as the client: \""
                             << targetAddress << "\".");
            return true;
        }
    }

    LOG_TRC("Host [" << targetHost << "] is not on the same host as the client: \"" << targetAddress
                     << "\".");
    return false;
}

void AsyncDNS::startThread()
{
    assert(!_thread);
    _exit = false;
    _thread.reset(new std::thread(&AsyncDNS::resolveDNS, this));
}

void AsyncDNS::joinThread()
{
    _exit = true;
    _condition.notify_all();
    _thread->join();
    _thread.reset();
}

void AsyncDNS::dumpQueueState(std::ostream& os) const
{
    // NOT thread-safe
    auto activeLookup = _activeLookup;
    auto lookups = _lookups;
    os << "  active lookup: " << (activeLookup.cb ? "true" : "false") << '\n';
    if (activeLookup.cb)
    {
        os << "    lookup: " << activeLookup.query << '\n';
        os << "    callback: " << activeLookup.dumpState() << '\n';
    }
    os << "  queued lookups: " << lookups.size() << '\n';
    while (!lookups.empty())
    {
        os << "    lookup: " << lookups.front().query << '\n';
        os << "    callback: " << lookups.front().dumpState() << '\n';
        lookups.pop();
    }
}

AsyncDNS::AsyncDNS()
    : _resolver(std::make_unique<DNSResolver>())
{
    startThread();
}

AsyncDNS::~AsyncDNS()
{
    joinThread();
}

void AsyncDNS::resolveDNS()
{
    std::unique_lock<std::mutex> guard(_lock);
    while (true)
    {
        while (_lookups.empty() && !_exit)
            _condition.wait(guard);

        if (_exit)
            break;

        _activeLookup = _lookups.front();
        _lookups.pop();

        // Unlock to allow entries to queue up in _lookups while
        // resolving
        _lock.unlock();

        std::string exception;
        HostEntry hostEntry;

        try
        {
            hostEntry = _resolver->resolveDNS(_activeLookup.query);
            fprintf(stderr, "%d turned %s into %s\n", getpid(), _activeLookup.query.c_str(), hostEntry.getCanonicalName().c_str());
        }
        catch (const Poco::Exception& exc)
        {
            exception = "net::canonicalHostName(\"" + _activeLookup.query + "\") failed: " + exc.displayText();
        }

        _activeLookup.cb(hostEntry, exception);

        _activeLookup = {};

        _lock.lock();
    }
}

void AsyncDNS::addLookup(const std::string& lookup, const DNSThreadFn& cb,
                         const DNSThreadDumpStateFn& dumpState)
{
    std::unique_lock<std::mutex> guard(_lock);
    _lookups.emplace(Lookup({lookup, cb, dumpState}));
    guard.unlock();
    _condition.notify_one();
}

static std::unique_ptr<AsyncDNS> AsyncDNSThread;

//static
void AsyncDNS::startAsyncDNS()
{
    AsyncDNSThread = std::make_unique<AsyncDNS>();
}

//static
void AsyncDNS::dumpState(std::ostream& os)
{
    if (AsyncDNSThread)
    {
        os << "AsyncDNS:\n";
        AsyncDNSThread->dumpQueueState(os);
    }
    else
    {
        os << "AsyncDNS : doesn't exist.\n";
    }
}

//static
void AsyncDNS::stopAsyncDNS()
{
    AsyncDNSThread.reset();
}

//static
void AsyncDNS::lookup(const std::string& searchEntry, const DNSThreadFn& cb,
                      const DNSThreadDumpStateFn& dumpState)
{
    AsyncDNSThread->addLookup(searchEntry, cb, dumpState);
}

#endif //!MOBILEAPP

std::shared_ptr<StreamSocket>
connect(const std::string& host, const std::string& port, const bool isSSL,
        const std::shared_ptr<ProtocolHandlerInterface>& protocolHandler)
{
    std::shared_ptr<StreamSocket> socket;

    if (host.empty() || port.empty())
    {
        LOG_ERR("Invalid host/port " << host << ':' << port);
        return socket;
    }

    LOG_DBG("Connecting to " << host << ':' << port << " (" << (isSSL ? "SSL)" : "Unencrypted)"));

#if !ENABLE_SSL
    if (isSSL)
    {
        LOG_ERR("Error: isSSL socket requested but SSL is not compiled in.");
        return socket;
    }
#endif

    // FIXME: store the address?
    struct addrinfo* ainfo = nullptr;
    struct addrinfo hints;
    std::memset(&hints, 0, sizeof(hints));
    const int rc = getaddrinfo(host.c_str(), port.c_str(), &hints, &ainfo);

    if (!rc && ainfo)
    {
        for (struct addrinfo* ai = ainfo; ai; ai = ai->ai_next)
        {
            if (ai->ai_addrlen && ai->ai_addr)
            {
                int fd = ::socket(ai->ai_addr->sa_family, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0);
                if (fd < 0)
                {
                    LOG_SYS("Failed to create socket");
                    continue;
                }

                int res = ::connect(fd, ai->ai_addr, ai->ai_addrlen);
                if (fd < 0 || (res < 0 && errno != EINPROGRESS))
                {
                    LOG_SYS("Failed to connect to " << host);
                    ::close(fd);
                }
                else
                {
                    Socket::Type type = ai->ai_family == AF_INET ? Socket::Type::IPv4 : Socket::Type::IPv6;
#if ENABLE_SSL
                    if (isSSL)
                        socket = StreamSocket::create<SslStreamSocket>(host, fd, type, true, protocolHandler);
#endif
                    if (!socket && !isSSL)
                        socket = StreamSocket::create<StreamSocket>(host, fd, type, true, protocolHandler);

                    if (socket)
                    {
                        LOG_DBG('#' << fd << " New socket connected to " << host << ':' << port
                                    << " (" << (isSSL ? "SSL)" : "Unencrypted)"));
                        break;
                    }

                    LOG_ERR("Failed to allocate socket for client websocket " << host);
                    ::close(fd);
                    break;
                }
            }
        }

        freeaddrinfo(ainfo);
    }
    else
        LOG_SYS("Failed to lookup host [" << host << "]. Skipping");

    return socket;
}

std::shared_ptr<StreamSocket>
connect(std::string uri, const std::shared_ptr<ProtocolHandlerInterface>& protocolHandler)
{
    std::string scheme;
    std::string host;
    std::string port;
    if (!parseUri(std::move(uri), scheme, host, port))
    {
        return nullptr;
    }

    scheme = Util::toLower(std::move(scheme));
    const bool isSsl = scheme == "https://" || scheme == "wss://";

    return connect(host, port, isSsl, protocolHandler);
}

bool parseUri(std::string uri, std::string& scheme, std::string& host, std::string& port,
              std::string& url)
{
    const auto itScheme = uri.find("://");
    if (itScheme != uri.npos)
    {
        scheme = uri.substr(0, itScheme + 3); // Include the last slash.
        uri = uri.substr(scheme.size()); // Remove the scheme.
    }
    else
    {
        // No scheme.
        scheme.clear();
    }

    const auto itUrl = uri.find('/');
    if (itUrl != uri.npos)
    {
        url = uri.substr(itUrl); // Including the first foreslash.
        uri = uri.substr(0, itUrl);
    }
    else
    {
        url.clear();
    }

    const auto itPort = uri.find(':');
    if (itPort != uri.npos)
    {
        host = uri.substr(0, itPort);
        port = uri.substr(itPort + 1); // Skip the colon.
    }
    else
    {
        // No port, just hostname.
        host = uri;
        port.clear();
    }

    return !host.empty();
}

} // namespace net
/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
