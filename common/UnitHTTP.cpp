/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <iostream>
#include "UnitHTTP.hpp"

Poco::Net::HTTPClientSession *UnitHTTP::createSession()
{
    // HTTP forced in configure hook.
    return new Poco::Net::HTTPClientSession ("127.0.0.1",
                                             ClientPortNumber);
}

UnitWebSocket::UnitWebSocket(const std::string &docURL)
{
    try {
        UnitHTTPServerResponse response;
        UnitHTTPServerRequest request(response, docURL);

        _session = UnitHTTP::createSession();

        // FIXME: leaking the session - hey ho ... do we need a UnitSocket ?
        _socket = new LOOLWebSocket(*_session, request, response);
    } catch (const Poco::Exception &ex) {
        std::cerr << "Exception creating websocket " << ex.displayText() << std::endl;
        throw;
    }
}

LOOLWebSocket* UnitWebSocket::getLOOLWebSocket() const
{
    return _socket;
}
