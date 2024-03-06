/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#if MOBILEAPP
#error This file should be excluded from Mobile App builds
#endif // MOBILEAPP

#include "RequestDetails.hpp"
#include "wopi/CheckFileInfo.hpp"
#include <Storage.hpp>

#include <string>
#include <utility>

/// Responsible for HTTP-serving a Wopi document, after authenticating.
class WopiProxy
{
public:
    WopiProxy(std::string id, const RequestDetails& requestDetails,
              const std::shared_ptr<StreamSocket>& socket)
        : _id(std::move(id))
        , _requestDetails(requestDetails)
        , _socket(socket)
    {
    }

    void handleRequest(const std::shared_ptr<TerminatingPoll>& poll,
                       SocketDisposition& disposition);

private:
    inline void logPrefix(std::ostream& os) const { os << '#' << _socket->getFD() << ": "; }

    void checkFileInfo(const std::shared_ptr<TerminatingPoll>& poll, const Poco::URI& uri,
                       int redirectionLimit);
    void download(const std::shared_ptr<TerminatingPoll>& poll, const std::string& url,
                  const Poco::URI& uriPublic, int redirectionLimit);

    const std::string _id;
    const RequestDetails _requestDetails;
    const std::shared_ptr<StreamSocket> _socket;
    std::shared_ptr<http::Session> _httpSession;
    std::unique_ptr<CheckFileInfo> _checkFileInfo;
};
