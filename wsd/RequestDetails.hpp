/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <Poco/Net/HTTPRequest.h>

/**
 * A class to encapsulate various useful pieces from the request.
 * as well as path parsing goodness.
 */
class RequestDetails {
    bool _isGet : 1;
    bool _isHead : 1;
    bool _isProxy : 1;
    bool _isWebSocket : 1;
    bool _isMobile : 1;
    std::string _uriString;
    std::string _proxyPrefix;
    std::string _hostUntrusted;
    std::string _documentURI;
    StringVector _pathSegs;
public:
    RequestDetails(Poco::Net::HTTPRequest &request);
    RequestDetails(const std::string &mobileURI);
    // matches the WOPISrc if used. For load balancing
    // must be 2nd element in the path after /lool/<here>
    std::string getDocumentURI() const;
    std::string getURI() const
    {
        return _uriString;
    }
    bool isProxy() const
    {
        return _isProxy;
    }
    const std::string getProxyPrefix() const
    {
        return _proxyPrefix;
    }
    const std::string getHostUntrusted() const
    {
        return _hostUntrusted;
    }
    bool isWebSocket() const
    {
        return _isWebSocket;
    }
    bool isGet() const
    {
        return _isGet;
    }
    bool isGet(const char *path) const
    {
        return _isGet && _uriString == path;
    }
    bool isGetOrHead(const char *path) const
    {
        return (_isGet || _isHead) && _uriString == path;
    }
    bool startsWith(const char *path)
    {
        return !strncmp(_uriString.c_str(), path, strlen(path));
    }
    bool equals(size_t index, const char *string) const
    {
        return _pathSegs.equals(index, string);
    }
    std::string operator[](size_t index) const
    {
        return _pathSegs[index];
    }
    size_t size() const
    {
        return _pathSegs.size();
    }
    std::string toString() const
    {
        std::ostringstream oss;
        oss << _uriString << " " << (_isGet?"G":"")
            << (_isHead?"H":"") << (_isProxy?"Proxy":"")
            << (_isWebSocket?"WebSocket":"");
        oss << " path: " << _pathSegs.size();
        for (size_t i = 0; i < _pathSegs.size(); ++i)
            oss << " '" << _pathSegs[i] << "'";
        return oss.str();
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
