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

#include "CheckFileInfo.hpp"

#include <COOLWSD.hpp>
#include <RequestDetails.hpp>
#include <TraceEvent.hpp>
#include <wopi/StorageConnectionManager.hpp>
#include <Exceptions.hpp>
#include <Log.hpp>
#include <DocumentBroker.hpp>
#include <ClientSession.hpp>
#include <common/JsonUtil.hpp>
#include <Util.hpp>

bool CheckFileInfo::checkFileInfo(int redirectLimit)
{
    const std::string uriAnonym = COOLWSD::anonymizeUrl(_url.toString());

    LOG_DBG("Getting info for wopi uri [" << uriAnonym << ']');
    _httpSession = StorageConnectionManager::getHttpSession(_url);
    Authorization auth = Authorization::create(_url);
    http::Request httpRequest = StorageConnectionManager::createHttpRequest(_url, auth);

    const auto startTime = std::chrono::steady_clock::now();

    LOG_TRC("WOPI::CheckFileInfo request header for URI [" << uriAnonym << "]:\n"
                                                           << httpRequest.header());

    http::Session::FinishedCallback finishedCallback =
        [this, startTime, uriAnonym, redirectLimit](const std::shared_ptr<http::Session>& session)
    {
        _profileZone.end(); // Finish profiling.

        if (SigUtil::getShutdownRequestFlag())
        {
            LOG_DBG("Shutdown flagged, giving up on in-flight requests");
            return;
        }

        const std::shared_ptr<const http::Response> httpResponse = session->response();
        LOG_TRC("WOPI::CheckFileInfo returned " << httpResponse->statusLine().statusCode());

        const http::StatusCode statusCode = httpResponse->statusLine().statusCode();
        if (statusCode == http::StatusCode::MovedPermanently ||
            statusCode == http::StatusCode::Found ||
            statusCode == http::StatusCode::TemporaryRedirect ||
            statusCode == http::StatusCode::PermanentRedirect)
        {
            if (redirectLimit)
            {
                const std::string location = httpResponse->get("Location");
                LOG_INF("WOPI::CheckFileInfo redirect to URI [" << COOLWSD::anonymizeUrl(location)
                                                                << "]");

                _url = RequestDetails::sanitizeURI(location);
                checkFileInfo(redirectLimit - 1);
                return;
            }
            else
            {
                LOG_WRN("WOPI::CheckFileInfo redirected too many times. Giving up on URI ["
                        << uriAnonym << ']');
            }
        }

        std::chrono::milliseconds callDurationMs =
            std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() -
                                                                  startTime);

        // Note: we don't log the response if obfuscation is enabled, except for failures.
        std::string wopiResponse = httpResponse->getBody();
        const bool failed = (httpResponse->statusLine().statusCode() != http::StatusCode::OK);

        Log::Level level = failed ? Log::Level::ERR : Log::Level::TRC;
        if (Log::isEnabled(level))
        {
            std::ostringstream oss;
            oss << "WOPI::CheckFileInfo " << (failed ? "failed" : "returned") << " for URI ["
                << uriAnonym << "]: " << httpResponse->statusLine().statusCode() << ' '
                << httpResponse->statusLine().reasonPhrase()
                << ". Headers: " << httpResponse->header()
                << (failed ? "\tBody: [" + wopiResponse + ']' : std::string());
            LOG_END_FLUSH(oss);
            Log::log(level, oss.str());
        }

        if (failed)
        {
            _state = State::Fail;

            if (httpResponse->statusLine().statusCode() == http::StatusCode::Forbidden)
            {
                LOG_ERR("Access denied to [" << uriAnonym << ']');
                return;
            }

            LOG_ERR("Invalid URI or access denied to [" << uriAnonym << ']');
            return;
        }

        if (JsonUtil::parseJSON(wopiResponse, _wopiInfo))
        {
            if (COOLWSD::AnonymizeUserData)
                LOG_DBG("WOPI::CheckFileInfo (" << callDurationMs << "): anonymizing...");
            else
                LOG_DBG("WOPI::CheckFileInfo (" << callDurationMs << "): " << wopiResponse);

            _state = State::Pass;
        }
        else
        {
            _state = State::Fail;

            if (COOLWSD::AnonymizeUserData)
                wopiResponse = "obfuscated";

            LOG_ERR("WOPI::CheckFileInfo ("
                    << callDurationMs
                    << ") failed or no valid JSON payload returned. Access denied. "
                       "Original response: ["
                    << wopiResponse << ']');
        }

        if (_onFinishCallback)
        {
            _onFinishCallback(*this);
        }
    };

    _httpSession->setFinishedHandler(std::move(finishedCallback));

    // Run the CheckFileInfo request on the WebServer Poll.
    if (!_httpSession->asyncRequest(httpRequest, *_poll))
    {
        _state = State::Fail;
        LOG_ERR("Failed to start an async CheckFileInfo request");

        if (_onFinishCallback)
        {
            _onFinishCallback(*this);
        }

        return false;
    }

    // We're in business.
    _state = State::Active;
    return true;
}

void CheckFileInfo::checkFileInfoSync(int redirectionLimit)
{
    if (checkFileInfo(redirectionLimit))
    {
        assert(_poll);

        std::chrono::steady_clock::time_point deadline =
            std::chrono::steady_clock::now() +
            std::chrono::seconds(30); // hmm ?
        while (!completed())
        {
            const auto now = std::chrono::steady_clock::now();
            if (now > deadline)
            {
                LOG_WRN("timed out waiting for CheckFileInfo");
                break;
            }
            _poll->poll(std::chrono::duration_cast<
                        std::chrono::microseconds>(deadline - now));
        }
    }
}

std::unique_ptr<WopiStorage::WOPIFileInfo>
CheckFileInfo::wopiFileInfo(const Poco::URI& uriPublic) const
{
    std::unique_ptr<WopiStorage::WOPIFileInfo> wopiFileInfo;
    if (_wopiInfo)
    {
        std::size_t size = 0;
        std::string filename;
        std::string ownerId;
        std::string modifiedTime;
        if (_wopiInfo)
        {
            JsonUtil::findJSONValue(_wopiInfo, "Size", size);
            JsonUtil::findJSONValue(_wopiInfo, "OwnerId", ownerId);
            JsonUtil::findJSONValue(_wopiInfo, "BaseFileName", filename);
            JsonUtil::findJSONValue(_wopiInfo, "LastModifiedTime", modifiedTime);
        }

        Poco::JSON::Object::Ptr wopiInfo = _wopiInfo;
        wopiFileInfo = std::make_unique<WopiStorage::WOPIFileInfo>(
            StorageBase::FileInfo(size, filename, ownerId, modifiedTime), wopiInfo, uriPublic);
    }

    return wopiFileInfo;
}
