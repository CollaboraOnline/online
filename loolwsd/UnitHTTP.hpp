/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
#ifndef INCLUDED_UNITHTTP_HPP
#define INCLUDED_UNITHTTP_HPP

#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPServerParams.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTTPServerResponse.h>
#include <Poco/Net/SocketAddress.h>

#include "Common.hpp"

using Poco::Net::SocketAddress;
using Poco::Net::HTTPServerParams;

/// Unit test stub for a server response
class UnitHTTPServerResponse : public Poco::Net::HTTPServerResponse
{
    bool _sent;
public:
    UnitHTTPServerResponse() : _sent (false) {}
    virtual void sendContinue() override {}
    virtual std::ostream& send() override
		{ _sent = true; return *(static_cast<std::ostream *>(nullptr)); }
    virtual void sendFile(const std::string& /* path */,
                          const std::string& /* mediaType */) override {}
    virtual void sendBuffer(const void* /* pBuffer */,
                            std::size_t /* length */) override {}
    virtual void redirect(const std::string& /* uri */,
                          HTTPStatus /* status = HTTP_FOUND */) override {}
    virtual void requireAuthentication(const std::string& /* realm */) override {}
    virtual bool sent() const override { return _sent; }
};

/// Unit test stub for a server request
class UnitHTTPServerRequest : public Poco::Net::HTTPServerRequest
{
protected:
    UnitHTTPServerResponse &_response;
    Poco::Net::SocketAddress _clientAddress;
    Poco::Net::SocketAddress _serverAddress;
public:
    UnitHTTPServerRequest(UnitHTTPServerResponse &inResponse,
                          const std::string &uri)
        : _response(inResponse),
          _clientAddress(),
          _serverAddress(MASTER_PORT_NUMBER)
        { setURI(uri); }
    virtual std::istream& stream() override
        { return *(static_cast<std::istream *>(nullptr)); }
#if POCO_VERSION < 0x02000000
    virtual bool expectContinue() const override
        { return false; }
#endif
    virtual bool secure() const { return true; }
	virtual const SocketAddress& clientAddress() const override
        { return _clientAddress; }
	virtual const SocketAddress& serverAddress() const override
        { return _serverAddress; }
	virtual const HTTPServerParams& serverParams() const override
        { return *(static_cast<HTTPServerParams *>(nullptr)); }
    virtual Poco::Net::HTTPServerResponse& response() const override
        { return _response; }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
