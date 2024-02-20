/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "HttpRequest.hpp"
#include "Storage.hpp"

#include <chrono>
#include <algorithm>
#include <memory>
#include <cassert>
#include <errno.h>
#include <fstream>
#include <iconv.h>
#include <string>

#include <Poco/Exception.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>

#if !MOBILEAPP

#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/Context.h>
#include <Poco/Net/DNS.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/KeyConsoleHandler.h>
#include <Poco/Net/NameValueCollection.h>
#include <Poco/Net/SSLManager.h>

#endif

#include <Poco/StreamCopier.h>
#include <Poco/URI.h>

#include "Auth.hpp"
#include <Common.hpp>
#include "Exceptions.hpp"
#include <Log.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include "ProofKey.hpp"
#include <common/FileUtil.hpp>
#include <common/JsonUtil.hpp>
#include <common/TraceEvent.hpp>
#include <NetUtil.hpp>
#include <CommandControl.hpp>
#include "HostUtil.hpp"
#include <StorageConnectionManager.hpp>

bool StorageConnectionManager::FilesystemEnabled;
bool StorageConnectionManager::SSLAsScheme = true;
bool StorageConnectionManager::SSLEnabled = false;

namespace
{
// access_token must be decoded
void addWopiProof(Poco::Net::HTTPRequest& request, const Poco::URI& uri,
                  const std::string& access_token)
{
    assert(!uri.isRelative());
    for (const auto& header : GetProofHeaders(access_token, uri.toString()))
        request.set(header.first, header.second);
}

std::map<std::string, std::string> GetQueryParams(const Poco::URI& uri)
{
    std::map<std::string, std::string> result;
    for (const auto& param : uri.getQueryParameters())
        result.emplace(param);
    return result;
}

void initHttpRequest(Poco::Net::HTTPRequest& request, const Poco::URI& uri,
                     const Authorization& auth)
{
    request.set("User-Agent", http::getAgentString());

    auth.authorizeRequest(request);

    // addStorageDebugCookie(request);

    // TODO: Avoid repeated parsing.
    std::map<std::string, std::string> params = GetQueryParams(uri);
    const auto it = params.find("access_token");
    if (it != params.end())
        addWopiProof(request, uri, it->second);

    // Helps wrt. debugging cluster cases from the logs
    request.set("X-COOL-WOPI-ServerId", Util::getProcessIdentifier());
}

} // namespace

http::Request StorageConnectionManager::createHttpRequest(const Poco::URI& uri,
                                                          const Authorization& auth)
{
    http::Request httpRequest(uri.getPathAndQuery());

    //FIXME: Hack Hack Hack! Use own version.
    Poco::Net::HTTPRequest request;
    ::initHttpRequest(request, uri, auth);

    // Copy the headers, including the cookies.
    for (const auto& pair : request)
    {
        httpRequest.header().set(pair.first, pair.second);
    }

    return httpRequest;
}

std::shared_ptr<http::Session>
StorageConnectionManager::getHttpSession(const Poco::URI& uri, std::chrono::seconds timeout)
{
    bool useSSL = false;
    if (SSLAsScheme)
    {
        // the WOPI URI itself should control whether we use SSL or not
        // for whether we verify vs. certificates, cf. above
        useSSL = uri.getScheme() != "http";
    }
    else
    {
        // We decoupled the Wopi communication from client communication because
        // the Wopi communication must have an independent policy.
        // So, we will use here only Storage settings.
        useSSL = SSLEnabled || COOLWSD::isSSLTermination();
    }

    const auto protocol =
        useSSL ? http::Session::Protocol::HttpSsl : http::Session::Protocol::HttpUnencrypted;

    // Create the session.
    auto httpSession = http::Session::create(uri.getHost(), protocol, uri.getPort());

    if (timeout == std::chrono::seconds::zero())
    {
        static std::chrono::seconds defTimeout =
            std::chrono::seconds(COOLWSD::getConfigValue<int>("net.connection_timeout_secs", 30));
        timeout = defTimeout;
    }

    httpSession->setTimeout(timeout);

    return httpSession;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
