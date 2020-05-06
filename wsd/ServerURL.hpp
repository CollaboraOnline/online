/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <string>
#include <Poco/Net/HTTPRequest.h>
#include "LOOLWSD.hpp"

/** This class helps us to build a URL that will reliably point back
 * at our service. It does very simple splitting of proxy U
 * and handles the proxy prefix feature.
 */
class ServerURL
{
    std::string _schemeProtocol;
    std::string _schemeAuthority;
    std::string _pathPlus;
public:
    ServerURL(const Poco::Net::HTTPRequest &request)
    {
        init(request.getHost(), request.get("ProxyPrefix", ""));
    }

    explicit ServerURL()
    {
        init("nohostname", "");
    }

    void init(const std::string &host, const std::string &proxyPrefix)
    {
        // The user can override the ServerRoot with a new prefix.
        _pathPlus = LOOLWSD::ServiceRoot;

        bool ssl = (LOOLWSD::isSSLEnabled() || LOOLWSD::isSSLTermination());
        std::string serverName = LOOLWSD::ServerName.empty() ? host : LOOLWSD::ServerName;
        _schemeProtocol = (ssl ? "wss://" : "ws://");
        _schemeAuthority = serverName;

        // A well formed ProxyPrefix will override it.
        std::string url = proxyPrefix;
        if (url.size() <= 0)
            return;

        size_t pos = url.find("://");
        if (pos != std::string::npos) {
            pos += 3;
            auto hostEndPos = url.find("/", pos);
            if (hostEndPos != std::string::npos)
            {
                _schemeProtocol = url.substr(0, pos);
                _schemeAuthority = url.substr(pos, hostEndPos - pos);
                _pathPlus = url.substr(hostEndPos);
                return;
            }
            else
                LOG_ERR("Unusual proxy prefix '" << url << "'");
        } else
            LOG_ERR("No http[s]:// in unusual proxy prefix '" << url << "'");
    }

    std::string getResponseRoot() const
    {
        return _pathPlus;
    }

    std::string getWebSocketUrl() const
    {
        return _schemeProtocol + _schemeAuthority;
    }

    std::string getSubURLForEndpoint(const std::string &path) const
    {
        return _schemeProtocol + _schemeAuthority + _pathPlus + path;
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
