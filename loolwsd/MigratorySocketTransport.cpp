/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef _WIN32
#include <sys/socket.h>
#endif

#include <iostream>

#include <Poco/Net/Socket.h>
#include <Poco/Net/StreamSocketImpl.h>

#include "MigratorySocketTransport.hpp"

#include "socketpair.c"

using Poco::Net::Socket;
using Poco::Net::StreamSocketImpl;

MigratorySocketTransport MigratorySocketTransport::create()
{
    poco_socket_t sockets[2];

    if (dumb_socketpair(sockets, 0) != 0)
        throw new std::runtime_error("Failed to create socket pair");
    return MigratorySocketTransport(sockets);
}

MigratorySocketTransport::MigratorySocketTransport(poco_socket_t sockets[2]) :
    Socket(new StreamSocketImpl(sockets[0])),
    _thisIsParent(true)
{
    _sockets[0] = sockets[0];
    _sockets[1] = sockets[1];
}

MigratorySocketTransport::MigratorySocketTransport(std::string string) :
    Socket(new StreamSocketImpl(std::stoi(string))),
    _thisIsParent(false)
{
}

MigratorySocketTransport::~MigratorySocketTransport()
{
    poco_closesocket(_sockets[1]);
}

std::string MigratorySocketTransport::string()
{
    return std::to_string(_sockets[1]);
}

void MigratorySocketTransport::send(const MigratorySocket& socket)
{
#ifndef _WIN32
    struct msghdr msg = {0};
    struct cmsghdr *cmsg;
    char buf[CMSG_SPACE(sizeof(int))];
    int *fdptr;

    msg.msg_control = buf;
    msg.msg_controllen = sizeof buf;
    cmsg = CMSG_FIRSTHDR(&msg);
    cmsg->cmsg_level = SOL_SOCKET;
    cmsg->cmsg_type = SCM_RIGHTS;
    cmsg->cmsg_len = CMSG_LEN(sizeof(int) * 1);

    fdptr = (int *) CMSG_DATA(cmsg);
    *fdptr = socket.sockfd();

    msg.msg_controllen = cmsg->cmsg_len;

    std::cout << "socket.sockfd()=" << socket.sockfd() << std::endl;
    std::cout << "sockfd()=" << sockfd() << std::endl;

    if (sendmsg(sockfd(), &msg, 0) == -1)
    {
        std::cerr << "sendmsg() failed: " << strerror(errno) << std::endl;
    }
#else
#error Add Windows implementation
#endif
}

MigratorySocket MigratorySocketTransport::receive()
{
    struct msghdr msg = {0};
    struct cmsghdr *cmsg;

    char buf[CMSG_SPACE(sizeof(int))];

    msg.msg_control = buf;
    msg.msg_controllen = sizeof buf;
    cmsg = CMSG_FIRSTHDR(&msg);
    cmsg->cmsg_level = SOL_SOCKET;
    cmsg->cmsg_type = SCM_RIGHTS;
    cmsg->cmsg_len = CMSG_LEN(sizeof(int) * 1);

    msg.msg_controllen = cmsg->cmsg_len;

    std::cout << "sockfd()=" << sockfd() << std::endl;

    if (recvmsg(sockfd(), &msg, 0) == -1)
    {
        std::cerr << "recvmsg() failed: " << strerror(errno) << std::endl;
    }

    return MigratorySocket(new StreamSocketImpl((poco_socket_t)(*((int *) CMSG_DATA(cmsg)))));
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
