/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <memory>
#include <sstream>

#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPServerParams.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTTPServerResponse.h>
#include <Poco/Net/SocketAddress.h>
#include <Poco/Version.h>

#include "Common.hpp"
#include <LOOLWebSocket.hpp>

using Poco::Net::SocketAddress;
using Poco::Net::HTTPServerParams;

/// Unit test stub for a server response
class UnitHTTPServerResponse : public Poco::Net::HTTPServerResponse
{
    bool _sent;
    std::stringstream _dummyStream;

public:
    UnitHTTPServerResponse() :
        _sent(false)
    {
    }
    virtual void sendContinue() override {}
    virtual std::ostream& send() override
    {
        _sent = true;
        return _dummyStream;
    }
    virtual void sendFile(const std::string& /* path */,
                          const std::string& /* mediaType */) override {}
    virtual void sendBuffer(const void* /* buffer */,
                            std::size_t /* length */) override {}
    virtual void redirect(const std::string& /* uri */,
                          HTTPStatus /* status = HTTP_FOUND */) override {}
    virtual void requireAuthentication(const std::string& /* realm */) override {}
    virtual bool sent() const override { return _sent; }
};

/// Unit test stub for server params with a public dtor
class UnitHTTPServerParams : public Poco::Net::HTTPServerParams
{
public:
    ~UnitHTTPServerParams() {}
};

/// Unit test stub for a server request
class UnitHTTPServerRequest : public Poco::Net::HTTPServerRequest
{
private:
    UnitHTTPServerResponse& _response;
    Poco::Net::SocketAddress _clientAddress;
    Poco::Net::SocketAddress _serverAddress;
    std::stringstream _dummyStream;
    UnitHTTPServerParams _dummyParams;

public:
    UnitHTTPServerRequest(UnitHTTPServerResponse& inResponse,
                          const std::string& uri) :
        _response(inResponse),
        _serverAddress(9981) // FIXME: Unix Sockets now ...
    {
        setURI(uri);
    }
    virtual std::istream& stream() override
    {
        return _dummyStream;
    }
#if POCO_VERSION < 0x01080000
    virtual bool expectContinue() const override
    {
        return false;
    }
#endif
#if POCO_VERSION >= 0x01080000
    virtual bool secure() const override
    {
        return true;
    }
#endif
    virtual const SocketAddress& clientAddress() const override
    {
        return _clientAddress;
    }
    virtual const SocketAddress& serverAddress() const override
    {
        return _serverAddress;
    }
    virtual const HTTPServerParams& serverParams() const override
    {
        return _dummyParams;
    }
    virtual Poco::Net::HTTPServerResponse& response() const override
    {
        return _response;
    }
};

namespace UnitHTTP
{
    inline Poco::Net::HTTPClientSession* createSession()
    {
        // HTTP forced in configure hook.
        return new Poco::Net::HTTPClientSession ("127.0.0.1",
                                                 ClientPortNumber);
    }
}

class UnitWebSocket
{
    Poco::Net::HTTPClientSession* _session;
    LOOLWebSocket* _socket;

public:
    /// Get a websocket connected for a given URL
    UnitWebSocket(const std::string& docURL)
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

    ~UnitWebSocket()
    {
        delete _socket;
        delete _session;
    }

    LOOLWebSocket* getLOOLWebSocket() const
    {
        return _socket;
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
