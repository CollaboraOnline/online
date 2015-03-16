/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_MIGRATORYSOCKET_HPP
#define INCLUDED_MIGRATORYSOCKET_HPP

#include <Poco/Net/Socket.h>

class MigratorySocket: public Poco::Net::Socket
{
public:
    /// Create a socket that can be transported to a child process.
    /// The argument is the actual socket to be transported.
    MigratorySocket(const Poco::Net::Socket& socket);

    virtual ~MigratorySocket();

private:
    /// Socket that is to be migrated
    Poco::Net::Socket _socket;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
