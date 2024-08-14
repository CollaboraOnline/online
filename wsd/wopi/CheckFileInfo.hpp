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

#pragma once

#include <chrono>
#include <condition_variable>
#if MOBILEAPP
#error This file should be excluded from Mobile App builds
#endif // MOBILEAPP

#include <HttpRequest.hpp>
#include <RequestDetails.hpp>
#include <Socket.hpp>
#include <StateEnum.hpp>
#include <wopi/WopiStorage.hpp>
#include <TraceEvent.hpp>

#include <Poco/JSON/Object.h>
#include <Poco/URI.h>

#include <functional>
#include <memory>
#include <string>

class CheckFileInfo
{
public:
    /// The CheckFileInfo State.
    STATE_ENUM(State, None, Active, Timedout, Fail, Pass);

    /// Create an instance with a SocketPoll and a RequestDetails instance.
    CheckFileInfo(const std::shared_ptr<TerminatingPoll>& poll, const Poco::URI& url,
                  std::function<void(CheckFileInfo&)> onFinishCallback)
        : _poll(poll)
        , _url(url)
        , _docKey(RequestDetails::getDocKey(url))
        , _onFinishCallback(std::move(onFinishCallback))
        , _state(State::None)
        , _profileZone("WopiStorage::getWOPIFileInfo", { { "url", url.toString() } })
    {
        assert(_url == RequestDetails::sanitizeURI(url.toString()) && "Expected sanitized URL");

    }

    /// Returns the state of the request.
    State state() const { return _state; }

    bool completed() const { return _state != State::None && _state != State::Active; }

    /// Returns the sanitized document URL.
    const Poco::URI& url() const { return _url; }

    /// Returns our unique DocKey.
    const std::string& docKey() const { return _docKey; }

    /// Returns the parsed response JSON, if any.
    Poco::JSON::Object::Ptr wopiInfo() const { return _wopiInfo; }

    /// Returns the parsed wopiInfo JSON into FileInfo.
    std::unique_ptr<WopiStorage::WOPIFileInfo> wopiFileInfo(const Poco::URI& uriPublic) const;

    /// Start the actual request.
    void checkFileInfo(int redirectionLimit);

    /// Start the request and wait for the response.
    /// In some scenarios we can't proceed without CheckFileInfo results.
    void checkFileInfoSync(int redirectionLimit);

    std::string getSslVerifyMessage()
    {
        if (_httpSession)
            return _httpSession->getSslVerifyMessage();
        return std::string();
    }

private:
    inline void logPrefix(std::ostream& os) const
    {
        if (_httpSession)
        {
            os << '#' << _httpSession->getFD() << ": ";
        }
    }

    std::shared_ptr<TerminatingPoll> _poll;
    Poco::URI _url; //< Sanitized URL to the document. Can change through redirection.
    const std::string _docKey; //< Unique DocKey.
    std::function<void(CheckFileInfo&)> _onFinishCallback;
    std::shared_ptr<http::Session> _httpSession;
    std::atomic<State> _state;
    Poco::JSON::Object::Ptr _wopiInfo;
    ProfileZone _profileZone;
};
