/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>
#include <Poco/URI.h>
#include "LOOLWSD.hpp"
#include "Exceptions.hpp"
#include "RequestDetails.hpp"

RequestDetails::RequestDetails(Poco::Net::HTTPRequest &request)
    : _isMobile(false)
{
    // Check and remove the ServiceRoot from the request.getURI()
    if (!Util::startsWith(request.getURI(), LOOLWSD::ServiceRoot))
        throw BadRequestException("The request does not start with prefix: " + LOOLWSD::ServiceRoot);

    // re-writes ServiceRoot out of request
    _uriString = request.getURI().substr(LOOLWSD::ServiceRoot.length());
    request.setURI(_uriString);
    const std::string &method = request.getMethod();
    _isGet = method == "GET";
    _isHead = method == "HEAD";
    auto it = request.find("ProxyPrefix");
	_isProxy = it != request.end();
    if (_isProxy)
        _proxyPrefix = it->second;
    it = request.find("Upgrade");
    _isWebSocket = it != request.end() && (Poco::icompare(it->second, "websocket") == 0);
#if MOBILEAPP
    // request.getHost fires an exception on mobile.
#else
	_hostUntrusted = request.getHost();
#endif

    std::vector<StringToken> tokens;
    if (_uriString.size() > 0)
    {
        size_t i, start;
        for (i = start = 0; i < _uriString.size(); ++i)
        {
            if (_uriString[i] == '/' || _uriString[i] == '?')
            {
                if (i - start > 1) // ignore empty
                    tokens.emplace_back(start, i - start);
                start = i + 1;
            }
        }
        if (i - start > 1) // ignore empty
            tokens.emplace_back(start, i - start);
        _pathSegs = StringVector(_uriString, tokens);
    }
}

RequestDetails::RequestDetails(const std::string &mobileURI)
    : _isGet(false)
    , _isHead(false)
    , _isProxy(false)
    , _isWebSocket(false)
{
    _isMobile = true;
    _uriString = mobileURI;
}

std::string RequestDetails::getDocumentURI() const
{
    if (_isMobile)
        return _uriString;

    assert(equals(0, "lool"));
    std::string docURI;
    Poco::URI::decode(_pathSegs[1], docURI);
    return docURI;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
