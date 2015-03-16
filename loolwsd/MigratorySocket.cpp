/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <iostream>

#include <Poco/Net/Socket.h>

#include "MigratorySocket.hpp"

using Poco::Net::Socket;

MigratorySocket::MigratorySocket(const Socket& socket) :
    Socket(socket)
{
}

MigratorySocket::MigratorySocket(Poco::Net::SocketImpl* pImpl) :
    Socket(pImpl)
{
}

MigratorySocket::~MigratorySocket()
{
}

poco_socket_t MigratorySocket::sockfd() const
{
    return Socket::sockfd();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
