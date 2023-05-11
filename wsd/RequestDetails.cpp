/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "COOLWSD.hpp"
#include "RequestDetails.hpp"
#include "Util.hpp"
#include "common/Log.hpp"
#include "HostUtil.hpp"

#include <Poco/URI.h>
#include "Exceptions.hpp"

namespace
{

std::map<std::string, std::string> getParams(const std::string& uri)
{
    std::map<std::string, std::string> result;
    for (const auto& param : Poco::URI(uri).getQueryParameters())
    {
        std::string key = Util::decodeURIComponent(param.first);
        std::string value = Util::decodeURIComponent(param.second);
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
    if (!Util::startsWith(request.getURI(), serviceRoot))
        throw BadRequestException("The request does not start with prefix: " + serviceRoot);

    // re-writes ServiceRoot out of request
    _uriString = request.getURI().substr(serviceRoot.length());
    dehexify();
    request.setURI(_uriString);
    const std::string &method = request.getMethod();
    _isGet = method == "GET";
    _isHead = method == "HEAD";
    auto it = request.find("ProxyPrefix");
	_isProxy = it != request.end();
    if (_isProxy)
        _proxyPrefix = it->second;
    it = request.find("Upgrade");
    _isWebSocket = it != request.end() && Util::iequal(it->second, "websocket");
#if MOBILEAPP
    // request.getHost fires an exception on mobile.
#else
	_hostUntrusted = request.getHost();
#endif

    processURI();
}

RequestDetails::RequestDetails(const std::string &mobileURI)
    : _isGet(true)
    , _isHead(false)
    , _isProxy(false)
    , _isWebSocket(false)
{
    _uriString = mobileURI;
    dehexify();
    processURI();
}

void RequestDetails::dehexify()
{
    // For now, we only hexify cool/ URLs.
    constexpr auto Prefix = "cool/0x";
    constexpr auto PrefixLen = sizeof(Prefix) - 1;

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
        Util::dataFromHexString(encoded, decoded);
        res += decoded;

        res += _uriString.substr(end); // Concatinate the remainder.

        _uriString = res; // Replace the original uri with the decoded one.
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
    if (_pathSegs.equals(0, "cool"))
    {
        //FIXME: For historic reasons the DocumentURI includes the WOPISrc.
        // This is problematic because decoding a URI that embeds not one, but
        // *two* encoded URIs within it is bound to produce an invalid URI.
        // Potentially three '?' might exist in the result (after decoding).
        std::size_t end = uriRes.rfind("/ws?");
        if (end != std::string::npos)
        {
            // Until the end of the WOPISrc.
            // e.g. <encoded-document-URI+options>/ws?WOPISrc=<encoded-document-URI>&compat=
            end = uriRes.find_first_of("/?", end + 4, 2); // Start searching after '/ws?'.
        }
        else
        {
            end = (posLastWS != std::string::npos ? posLastWS : uriRes.find('/'));
            if (end == std::string::npos)
                end = uriRes.find('?'); // e.g. /cool/clipboard?WOPISrc=file%3A%2F%2F%2Ftmp%2Fcopypasteef324307_empty.ods...
        }

        const std::string docUri = uriRes.substr(0, end);

        _fields[Field::LegacyDocumentURI] = Util::decodeURIComponent(docUri);

        // Find the DocumentURI proper.
        end = uriRes.find_first_of("/?", 0, 2);
        _fields[Field::DocumentURI] = Util::decodeURIComponent(uriRes.substr(0, end));
    }
    else // Otherwise, it's the full URI.
    {
        _fields[Field::LegacyDocumentURI] = _uriString;
        _fields[Field::DocumentURI] = _uriString;
    }

    _docUriParams = getParams(_fields[Field::DocumentURI]);

    _fields[Field::WOPISrc] = getParam("WOPISrc");

    // &compat=
    const std::string compat = getParam("compat");
    if (!compat.empty())
        _fields[Field::Compat] = compat;

    // /ws[/<sessionId>/<command>/<serial>]
    if (posLastWS != std::string::npos)
    {
        std::string lastWS = uriRes.substr(posLastWS);
        const auto proxyTokens = StringVector::tokenize(lastWS, '/');
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
    // The URI of the document should be url-encoded.
#if !MOBILEAPP
    Poco::URI uriPublic(Util::decodeURIComponent(uri));
#else
    Poco::URI uriPublic(uri);
#endif

    if (uriPublic.isRelative() || uriPublic.getScheme() == "file")
    {
        // TODO: Validate and limit access to local paths!
        uriPublic.normalize();
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
            param.second = Util::decodeURIComponent(param.second);
        }
    }

    uriPublic.setQueryParameters(queryParams);

    LOG_DBG("Sanitized URI [" << uri << "] to [" << uriPublic.toString() << ']');
    return uriPublic;
}

#if !defined(BUILDING_TESTS)
std::string RequestDetails::getDocKey(const Poco::URI& uri)
{
    // resolve aliases
#if !MOBILEAPP
    const std::string newUri = HostUtil::getNewUri(uri);
#else
    const std::string newUri = uri.getPath();
#endif

    std::string docKey = Util::encodeURIComponent(newUri);
    LOG_INF("DocKey from URI [" << uri.toString() << "] => [" << docKey << ']');
    return docKey;
}
#endif // !defined(BUILDING_TESTS)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
