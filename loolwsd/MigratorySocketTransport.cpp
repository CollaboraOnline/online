/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

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

MigratorySocketTransport::MigratorySocketTransport(poco_socket_t sockets[2]):
    Socket(new StreamSocketImpl(sockets[0])),
    _thisIsParent(true)
{
    _sockets[0] = sockets[0];
    _sockets[1] = sockets[1];
}

MigratorySocketTransport::MigratorySocketTransport(std::string string):
    Socket(new StreamSocketImpl(std::stoi(string))),
    _thisIsParent(false)
{
}

MigratorySocketTransport::~MigratorySocketTransport()
{
}

std::string MigratorySocketTransport::string()
{
    return std::to_string(sockfd());
}

void MigratorySocketTransport::send(MigratorySocket socket)
{
}

MigratorySocket MigratorySocketTransport::receive()
{
    return MigratorySocket(Socket());
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
