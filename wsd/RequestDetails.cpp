/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "RequestDetails.hpp"

#include <common/HexUtil.hpp>
#include <common/Log.hpp>
#include <common/Util.hpp>
#if !MOBILEAPP
#include <wsd/HostUtil.hpp>
#endif // !MOBILEAPP
#include <wsd/Exceptions.hpp>

#include <Poco/URI.h>

#include <cctype>
#include <sstream>
#include <stdexcept>
#include <utility>

namespace
{

std::map<std::string, std::string> getParams(const std::string& uri)
{
    std::map<std::string, std::string> result;
    for (const auto& param : Poco::URI(uri).getQueryParameters())
    {
        // getQueryParameters() decodes the values. Compare with the URI.
        if (param.first == "WOPISrc" && uri.find(param.second) != std::string::npos)
        {
            LOG_WRN("WOPISrc validation error: unencoded WOPISrc [" << param.second
                                                                    << "] in URL: " << uri);
#if ENABLE_DEBUG
            throw std::runtime_error("WOPISrc must be URI-encoded");
#endif // ENABLE_DEBUG
        }

        std::string key = Uri::decode(param.first);
        std::string value = Uri::decode(param.second);
        LOG_TRC("Decoding param [" << param.first << "] = [" << param.second << "] -> [" << key
                                   << "] = [" << value << ']');

        result.emplace(std::move(key), std::move(value));
    }

    return result;
}
}

RequestDetails::RequestDetails(Poco::Net::HTTPRequest &request, const std::string& serviceRoot)
{
    // Check and remove the ServiceRoot from the request.getURI()
    if (!request.getURI().starts_with(serviceRoot))
        throw BadRequestException("The request does not start with prefix: " + serviceRoot);

    // re-writes ServiceRoot out of request
    _uriString = request.getURI().substr(serviceRoot.length());
    dehexify();
    request.setURI(_uriString);
    _method = stringToMethod(request.getMethod());
    auto it = request.find("ProxyPrefix");
    _isProxy = it != request.end();
    if (_isProxy)
        _proxyPrefix = it->second;
    it = request.find("Upgrade");
    _isWebSocket = it != request.end() && Util::iequal(it->second, "websocket");
    _closeConnection = !request.getKeepAlive(); // HTTP/1.1: closeConnection true w/ "Connection: close" only!
    // request.getHost fires an exception on mobile.
    if constexpr (!Util::isMobileApp())
        _hostUntrusted = request.getHost();

    processURI();
}

RequestDetails::RequestDetails(http::RequestParser& request, const std::string& serviceRoot)
{
    // Check and remove the ServiceRoot from the request.getURI()
    if (!request.getUrl().starts_with(serviceRoot))
        throw BadRequestException("The request does not start with prefix: " + serviceRoot);

    // re-writes ServiceRoot out of request
    _uriString = request.getUrl().substr(serviceRoot.length());
    dehexify();
    request.setUrl(_uriString);
    _method = stringToMethod(request.getVerb());
    _isProxy = request.has("ProxyPrefix");
    if (_isProxy)
        _proxyPrefix = request.get("ProxyPrefix");
    _isWebSocket = Util::iequal(request.get("Upgrade"), "websocket");
    _closeConnection =
        !request.isKeepAlive(); // HTTP/1.1: closeConnection true w/ "Connection: close" only!
    // request.getHost fires an exception on mobile.
    if constexpr (!Util::isMobileApp())
        _hostUntrusted = request.get("Host");

    processURI();
}

RequestDetails::RequestDetails(std::string mobileURI)
    : _uriString(std::move(mobileURI))
    , _method(Method::GET)
    , _isProxy(false)
    , _isWebSocket(false)
    , _closeConnection(false)
{
    dehexify();
    processURI();
}

RequestDetails::RequestDetails(const std::string& wopiSrc, const std::vector<std::string>& options,
                               const std::string& compat)
    : _method(Method::GET)
    , _isProxy(false)
    , _isWebSocket(false)
    , _closeConnection(false)
{
    // /cool/<encoded-document-URI+options>/ws?WOPISrc=<encoded-document-URI>&compat=/ws[/<sessionId>/<command>/<serial>]

    const std::string decodedWopiSrc = Uri::decode(wopiSrc);
    std::string wopiSrcWithOptions = decodedWopiSrc;
    if (!options.empty())
    {
        wopiSrcWithOptions += '?';
    }

    for (const std::string& option : options)
    {
        wopiSrcWithOptions += option;
        wopiSrcWithOptions += '&';
    }

    // To avoid duplicating the complex logic in processURI(),
    // and to have a single canonical implementation, we
    // create a valid URI and let it parse and set the various
    // members, as necessary.
    std::ostringstream oss;
    oss << "/cool/" << Uri::encode(wopiSrcWithOptions);
    oss << "/ws?WOPISrc=" << Uri::encode(decodedWopiSrc);
    oss << "&compat=/ws" << compat;
    _uriString = oss.str();

    processURI();
}

RequestDetails::Method RequestDetails::stringToMethod(const std::string_view method)
{
    if (method == "GET") {
        return Method::GET;
    } else if (method == "HEAD") {
        return Method::HEAD;
    } else if (method == "POST") {
        return Method::POST;
    } else {
        return Method::unknown;
    }
}

void RequestDetails::dehexify()
{
    // For now, we only hexify cool/ URLs.
    constexpr std::string_view Prefix = "cool/0x";
    constexpr auto PrefixLen = Prefix.size();

    const auto hexPos = _uriString.find(Prefix);
    if (hexPos != std::string::npos)
    {
        // The start of the hex token.
        const auto start = hexPos + PrefixLen;
        // Find the next '/' after the hex token.
        const auto end = _uriString.find_first_of('/', start);

        std::string res = _uriString.substr(0, start - 2); // The prefix, without '0x'.

        const std::string encoded =
            _uriString.substr(start, (end == std::string::npos) ? end : end - start);
        std::string decoded;
        HexUtil::dataFromHexString(encoded, decoded);
        res += decoded;

        res += _uriString.substr(end); // Concatenate the remainder.

        _uriString = std::move(res); // Replace the original uri with the decoded one.
    }
}

void RequestDetails::processURI()
{
    // Poco::SyntaxException is thrown when the syntax is invalid.
    _params = getParams(_uriString);

    // First tokenize by '/' then by '?'.
    std::vector<StringToken> tokens;
    const auto len = _uriString.size();
    if (len > 0)
    {
        std::size_t i, start;
        for (i = start = 0; i < len; ++i)
        {
            if (_uriString[i] == '/' || _uriString[i] == '?')
            {
                if (i - start > 0) // ignore empty
                    tokens.emplace_back(start, i - start);
                start = i + 1;
            }
        }
        if (i - start > 0) // ignore empty
            tokens.emplace_back(start, i - start);
        _pathSegs = StringVector(_uriString, std::move(tokens));
    }


    std::size_t off = 0;
    std::size_t posDocUri = _uriString.find_first_of('/');
    if (posDocUri == 0)
    {
        off = 1;
        posDocUri = _uriString.find_first_of('/', 1);
    }

    _fields[Field::Type] = _uriString.substr(off, posDocUri - off); // The first is always the type.
    std::string uriRes = _uriString.substr(posDocUri + 1);

    const auto posLastWS = uriRes.rfind("/ws");
    // DocumentURI is the second segment in cool URIs.
    if (_pathSegs.equals(0, "cool") || _pathSegs.equals(0, "wasm"))
    {
        // Find the DocumentURI proper.
        std::size_t end = uriRes.find_first_of("/?", 0, 2);
        _fields[Field::DocumentURI] = Uri::decode(uriRes.substr(0, end));
    }
    else // Otherwise, it's the full URI.
    {
        _fields[Field::DocumentURI] = _uriString;
    }

    _docUriParams = getParams(_fields[Field::DocumentURI]);

    _fields[Field::WOPISrc] = getParam("WOPISrc");

    // &compat=
    std::string compat = getParam("compat");
    if (!compat.empty())
        _fields[Field::Compat] = std::move(compat);

    // /ws[/<sessionId>/<command>/<serial>]
    if (posLastWS != std::string::npos)
    {
        std::string lastWS = uriRes.substr(posLastWS);
        const auto proxyTokens = StringVector::tokenize(std::move(lastWS), '/');
        if (proxyTokens.size() > 1)
        {
            _fields[Field::SessionId] = proxyTokens[1];
            if (proxyTokens.size() > 2)
            {
                _fields[Field::Command] = proxyTokens[2];
                if (proxyTokens.size() > 3)
                {
                    _fields[Field::Serial] = proxyTokens[3];
                }
            }
        }
    }
}

Poco::URI RequestDetails::sanitizeURI(const std::string& uri)
{
    // The URI of the document is url-encoded, except that in a mobile app it isn't?
    Poco::URI uriPublic((Util::isMobileApp() ? uri : Uri::decode(uri)));

    if (uriPublic.isRelative() || uriPublic.getScheme() == "file")
    {
        // TODO: Validate and limit access to local paths!
        uriPublic.normalize();
#ifdef _WIN32
        // Change a bogus path like /C:/Users/tml/foo.odt to C:/Users/tml/foo.odt. If this path then
        // later is changed back into a file: URI, as in ClientSession::loadDocument(), we can't
        // just prefix "file://" but need one more slash. So maybe it would in fact be simpler to
        // just keep the seemingly bogus /C:/Users/tml/foo.odt?
        std::string p = uriPublic.getPath();
        if (p.length() > 4 && p[0] == '/' && std::isalpha(p[1]) && p[2] == ':' && p[3] == '/')
            uriPublic.setPath(p.substr(1));
#endif
    }

    if (uriPublic.getPath().empty())
    {
        throw std::runtime_error("Invalid URI.");
    }

    // We decoded access token before embedding it in cool.html
    // So, we need to decode it now to get its actual value
    Poco::URI::QueryParameters queryParams = uriPublic.getQueryParameters();
    for (auto& param : queryParams)
    {
        // look for encoded query params (access token as of now)
        if (param.first == "access_token")
        {
            param.second = Uri::decode(param.second);
        }
    }

    uriPublic.setQueryParameters(queryParams);

    LOG_DBG("Sanitized URI [" << uri << "] to [" << uriPublic.toString() << ']');
    return uriPublic;
}

std::string RequestDetails::getLineModeKey(const std::string& /*access_token*/) const
{
    // This key is based on the WOPISrc and the access_token only.
    // However, we strip the host:port and scheme from the WOPISrc.
    return Poco::URI(getField(RequestDetails::Field::WOPISrc)).getPath();
}

#if !defined(BUILDING_TESTS)
std::string RequestDetails::getDocKey(const Poco::URI& uri)
{
    // resolve aliases
#if !MOBILEAPP
    const std::string newUri = HostUtil::getNewUri(uri);
    if (newUri != uri.toString())
    {
        LOG_TRC("Canonicalized URI [" << uri.toString() << "] to [" << newUri << ']');
    }
#else
    const std::string& newUri = uri.getPath();
#endif

    std::string docKey = Uri::encode(newUri);
    LOG_INF("DocKey from URI [" << uri.toString() << "] => [" << docKey << ']');
    return docKey;
}
#endif // !defined(BUILDING_TESTS)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
