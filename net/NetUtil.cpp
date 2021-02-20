/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "NetUtil.hpp"

#include "Socket.hpp"
#if ENABLE_SSL && !MOBILEAPP
#include "SslSocket.hpp"
#endif

#include <netdb.h>

namespace net
{
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
            std::string canonicalName;
            if (ai->ai_canonname)
                canonicalName = ai->ai_canonname;

            if (ai->ai_addrlen && ai->ai_addr)
            {
                int fd = ::socket(ai->ai_addr->sa_family, SOCK_STREAM | SOCK_NONBLOCK, 0);
                int res = ::connect(fd, ai->ai_addr, ai->ai_addrlen);
                if (fd < 0 || (res < 0 && errno != EINPROGRESS))
                {
                    LOG_SYS("Failed to connect to " << host);
                    ::close(fd);
                }
                else
                {
#if ENABLE_SSL
                    if (isSSL)
                        socket = StreamSocket::create<SslStreamSocket>(fd, true, protocolHandler);
#endif
                    if (!socket && !isSSL)
                        socket = StreamSocket::create<StreamSocket>(fd, true, protocolHandler);

                    if (socket)
                        break;

                    LOG_ERR("Failed to allocate socket for client websocket " << host);
                    ::close(fd);
                    break;
                }
            }
        }

        freeaddrinfo(ainfo);
    }
    else
        LOG_ERR("Failed to lookup host [" << host << "]. Skipping.");

    return socket;
}

} // namespace net