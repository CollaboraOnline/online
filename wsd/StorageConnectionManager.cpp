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

std::shared_ptr<http::Session> StorageConnectionManager::getHttpSession(const Poco::URI& uri)
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

    static int timeoutSec = COOLWSD::getConfigValue<int>("net.connection_timeout_secs", 30);
    httpSession->setTimeout(std::chrono::seconds(timeoutSec));

    return httpSession;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
