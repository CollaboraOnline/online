/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_MIGRATORYSOCKETTRANSPORT_HPP
#define INCLUDED_MIGRATORYSOCKETTRANSPORT_HPP

#include <Poco/Net/Socket.h>

#include "MigratorySocket.hpp"

class MigratorySocketTransport: public Poco::Net::Socket
{
public:
    /// Create the parent process end
    static MigratorySocketTransport create();

    /// Create the child process end
    MigratorySocketTransport(std::string string);

    ~MigratorySocketTransport();

    /// Parent side: String to be passed to child process (for
    /// instance on the command line) for use in the child process in
    /// the child kind of our constructor.
    std::string string();

    /// Parent side: Send a socket to the child
    void send(const MigratorySocket& socket);

    /// Child side: Receive a socket sent from an ancestor process
    MigratorySocket receive();
    
private:
    /// Create the parent process end
    MigratorySocketTransport(poco_socket_t sockets[2]);

    bool _thisIsParent;

    /// Socket used for transport. A socket pair with one end used in
    /// the parent instance, one in the child.
    poco_socket_t _sockets[2];
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
