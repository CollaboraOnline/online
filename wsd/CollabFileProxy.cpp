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

#include "CollabFileProxy.hpp"

#include <COOLWSD.hpp>
#include <Common.hpp>
#include <HttpHelper.hpp>
#include <Log.hpp>
#include <Protocol.hpp>
#include <RequestDetails.hpp>
#include <SigUtil.hpp>
#include <Storage.hpp>
#include <common/JsonUtil.hpp>
#include <wopi/StorageConnectionManager.hpp>

#include <Poco/URI.h>

#include <iterator>

CollabFileProxy::CollabFileProxy(std::string id, const RequestDetails& requestDetails,
                                 const std::shared_ptr<StreamSocket>& socket,
                                 const std::string& wopiSrc, const std::string& accessToken,
                                 bool isUpload)
    : _id(std::move(id))
    , _requestDetails(requestDetails)
    , _socket(socket)
    , _wopiSrc(wopiSrc)
    , _accessToken(accessToken)
    , _isUpload(isUpload)
    , _logFD(socket->getFD())
{
}

void CollabFileProxy::handleRequest(std::istream& message,
                                    const std::shared_ptr<TerminatingPoll>& poll,
                                    SocketDisposition& disposition)
{
    LOG_INF("CollabFileProxy: handling " << (_isUpload ? "upload" : "download")
            << " request for WOPISrc [" << COOLWSD::anonymizeUrl(_wopiSrc) << ']');

    std::shared_ptr<StreamSocket> socket = _socket.lock();
    if (!socket)
    {
        LOG_ERR("CollabFileProxy: invalid socket for ["
                << COOLWSD::anonymizeUrl(_wopiSrc) << ']');
        return;
    }

    // Build the WOPI URI with access_token
    std::string wopiUrl = _wopiSrc;
    if (wopiUrl.find('?') == std::string::npos)
        wopiUrl += "?access_token=" + _accessToken;
    else
        wopiUrl += "&access_token=" + _accessToken;

    const Poco::URI uriPublic = RequestDetails::sanitizeURI(wopiUrl);

    // Validate storage type
    const StorageBase::StorageType storageType =
        StorageBase::validate(uriPublic, /*takeOwnership=*/false);

    if (storageType != StorageBase::StorageType::Wopi)
    {
        LOG_ERR("CollabFileProxy: unsupported storage type for ["
                << COOLWSD::anonymizeUrl(_wopiSrc) << ']');
        HttpHelper::sendErrorAndShutdown(http::StatusCode::BadRequest, socket);
        return;
    }

    // Save upload body if this is an upload request
    if (_isUpload && _requestDetails.isPost())
    {
        _uploadBody = std::string(std::istreambuf_iterator<char>(message), {});
    }

    // Transfer to poll and start CheckFileInfo
    disposition.setTransfer(*poll,
        [this, &poll, uriPublic](const std::shared_ptr<Socket>& moveSocket)
        {
            LOG_TRC('#' << moveSocket->getFD()
                        << ": CollabFileProxy: starting CheckFileInfo for ["
                        << COOLWSD::anonymizeUrl(_wopiSrc) << ']');

            checkFileInfo(poll, uriPublic, HTTP_REDIRECTION_LIMIT);
        });
}

void CollabFileProxy::handleFetchRequest(const std::string& streamUrl,
                                         const std::shared_ptr<TerminatingPoll>& poll,
                                         SocketDisposition& disposition)
{
    LOG_INF("CollabFileProxy: handling fetch request for stream ["
            << COOLWSD::anonymizeUrl(streamUrl) << ']');

    std::shared_ptr<StreamSocket> socket = _socket.lock();
    if (!socket)
    {
        LOG_ERR("CollabFileProxy: invalid socket for fetch request");
        return;
    }

    // Parse the stream URL and add access token
    std::string fetchUrl = streamUrl;
    if (fetchUrl.find('?') == std::string::npos)
        fetchUrl += "?access_token=" + _accessToken;
    else
        fetchUrl += "&access_token=" + _accessToken;

    Poco::URI uri(fetchUrl);

    // Transfer to poll and start download directly (bypassing CheckFileInfo)
    disposition.setTransfer(*poll,
        [this, &poll, uri](const std::shared_ptr<Socket>& moveSocket)
        {
            LOG_TRC('#' << moveSocket->getFD()
                        << ": CollabFileProxy: starting direct fetch for ["
                        << COOLWSD::anonymizeUrl(uri.toString()) << ']');

            doDownload(poll, uri, HTTP_REDIRECTION_LIMIT);
        });
}

void CollabFileProxy::handleDirectRequest(std::istream& message,
                                          Poco::JSON::Object::Ptr wopiInfo,
                                          const std::shared_ptr<TerminatingPoll>& poll,
                                          SocketDisposition& disposition)
{
    LOG_INF("CollabFileProxy: handling direct " << (_isUpload ? "upload" : "download")
            << " request for WOPISrc [" << COOLWSD::anonymizeUrl(_wopiSrc) << ']');

    std::shared_ptr<StreamSocket> socket = _socket.lock();
    if (!socket)
    {
        LOG_ERR("CollabFileProxy: invalid socket for direct request");
        return;
    }

    if (!wopiInfo)
    {
        LOG_ERR("CollabFileProxy: no WOPI info for direct request");
        HttpHelper::sendErrorAndShutdown(http::StatusCode::InternalServerError, socket);
        return;
    }

    // Check write permission for upload
    if (_isUpload)
    {
        bool userCanWrite = false;
        JsonUtil::findJSONValue(wopiInfo, "UserCanWrite", userCanWrite);
        if (!userCanWrite)
        {
            LOG_ERR("CollabFileProxy: user cannot write to ["
                    << COOLWSD::anonymizeUrl(_wopiSrc) << ']');
            HttpHelper::sendErrorAndShutdown(http::StatusCode::Forbidden, socket);
            return;
        }
    }

    // Save upload body if this is an upload request
    if (_isUpload && _requestDetails.isPost())
    {
        _uploadBody = std::string(std::istreambuf_iterator<char>(message), {});
    }

    // Build WOPI URL with access token
    std::string wopiUrl = _wopiSrc;
    if (wopiUrl.find('?') == std::string::npos)
        wopiUrl += "?access_token=" + _accessToken;
    else
        wopiUrl += "&access_token=" + _accessToken;

    const Poco::URI baseUri = RequestDetails::sanitizeURI(wopiUrl);

    // Transfer to poll and execute
    disposition.setTransfer(*poll,
        [this, &poll, baseUri, wopiInfo](const std::shared_ptr<Socket>& moveSocket)
        {
            LOG_TRC('#' << moveSocket->getFD()
                        << ": CollabFileProxy: executing direct request for ["
                        << COOLWSD::anonymizeUrl(_wopiSrc) << ']');

            if (!_isUpload)
            {
                // For downloads, check FileUrl first, then default to /contents
                std::string fileUrl;
                JsonUtil::findJSONValue(wopiInfo, "FileUrl", fileUrl);

                if (!fileUrl.empty())
                {
                    try
                    {
                        LOG_INF("CollabFileProxy: GetFile using FileUrl: "
                                << COOLWSD::anonymizeUrl(fileUrl));
                        doDownload(poll, Poco::URI(fileUrl), HTTP_REDIRECTION_LIMIT);
                        return;
                    }
                    catch (const std::exception& ex)
                    {
                        LOG_ERR("CollabFileProxy: FileUrl download failed: " << ex.what());
                        // Fall through to default URL
                    }
                }

                // Use default URL with /contents suffix
                Poco::URI uriObject(baseUri);
                uriObject.setPath(uriObject.getPath() + "/contents");
                doDownload(poll, uriObject, HTTP_REDIRECTION_LIMIT);
            }
            else
            {
                // Upload to /contents
                Poco::URI uriObject(baseUri);
                uriObject.setPath(uriObject.getPath() + "/contents");
                doUpload(poll, uriObject, _uploadBody);
            }
        });
}

void CollabFileProxy::checkFileInfo(const std::shared_ptr<TerminatingPoll>& poll,
                                    const Poco::URI& uri, int redirectLimit)
{
    auto cfiContinuation = [this, poll, uri](CheckFileInfo& /* checkFileInfo */)
    {
        const std::string uriAnonym = COOLWSD::anonymizeUrl(uri.toString());

        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (!socket)
        {
            LOG_ERR("CollabFileProxy: invalid socket during CheckFileInfo for ["
                    << uriAnonym << ']');
            return;
        }

        if (_checkFileInfo && _checkFileInfo->state() == CheckFileInfo::State::Pass &&
            _checkFileInfo->wopiInfo())
        {
            Poco::JSON::Object::Ptr object = _checkFileInfo->wopiInfo();

            // Check if user has write permission for upload
            if (_isUpload)
            {
                bool userCanWrite = false;
                JsonUtil::findJSONValue(object, "UserCanWrite", userCanWrite);
                if (!userCanWrite)
                {
                    LOG_ERR("CollabFileProxy: user cannot write to ["
                            << uriAnonym << ']');
                    HttpHelper::sendErrorAndShutdown(http::StatusCode::Forbidden, socket);
                    return;
                }
            }

            // For downloads, check FileUrl first, then default to /contents
            if (!_isUpload)
            {
                std::string fileUrl;
                JsonUtil::findJSONValue(object, "FileUrl", fileUrl);

                if (!fileUrl.empty())
                {
                    try
                    {
                        LOG_INF("CollabFileProxy: GetFile using FileUrl: "
                                << COOLWSD::anonymizeUrl(fileUrl));
                        doDownload(poll, Poco::URI(fileUrl), HTTP_REDIRECTION_LIMIT);
                        return;
                    }
                    catch (const std::exception& ex)
                    {
                        LOG_ERR("CollabFileProxy: FileUrl download failed: " << ex.what());
                        // Fall through to default URL
                    }
                }

                // Use default URL with /contents suffix
                Poco::URI uriObject(uri);
                uriObject.setPath(uriObject.getPath() + "/contents");
                doDownload(poll, uriObject, HTTP_REDIRECTION_LIMIT);
            }
            else
            {
                // Upload to /contents
                Poco::URI uriObject(uri);
                uriObject.setPath(uriObject.getPath() + "/contents");
                doUpload(poll, uriObject, _uploadBody);
            }
            return;
        }

        LOG_ERR("CollabFileProxy: CheckFileInfo failed for [" << uriAnonym << ']');
        HttpHelper::sendErrorAndShutdown(http::StatusCode::Unauthorized, socket);
    };

    _checkFileInfo = std::make_shared<CheckFileInfo>(poll, uri, std::move(cfiContinuation));
    _checkFileInfo->checkFileInfo(redirectLimit);
}

void CollabFileProxy::doDownload(const std::shared_ptr<TerminatingPoll>& poll,
                                 const Poco::URI& uri, int redirectLimit)
{
    const std::string uriAnonym = COOLWSD::anonymizeUrl(uri.toString());
    LOG_DBG("CollabFileProxy: downloading from [" << uriAnonym << ']');

    _httpSession = StorageConnectionManager::getHttpSession(uri);
    Authorization auth = Authorization::create(uri);
    http::Request httpRequest = StorageConnectionManager::createHttpRequest(uri, auth);

    const auto startTime = std::chrono::steady_clock::now();

    http::Session::FinishedCallback finishedCallback =
        [this, &poll, startTime, uriAnonym, redirectLimit](
            const std::shared_ptr<http::Session>& session)
    {
        if (SigUtil::getShutdownRequestFlag())
        {
            LOG_DBG("CollabFileProxy: shutdown flagged, aborting download");
            return;
        }

        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (!socket)
        {
            LOG_ERR("CollabFileProxy: invalid socket while downloading ["
                    << uriAnonym << ']');
            return;
        }

        const std::shared_ptr<const http::Response> httpResponse = session->response();
        const http::StatusCode statusCode = httpResponse->statusLine().statusCode();

        LOG_TRC("CollabFileProxy: GetFile returned " << statusCode);

        // Handle redirects
        if (statusCode == http::StatusCode::MovedPermanently ||
            statusCode == http::StatusCode::Found ||
            statusCode == http::StatusCode::TemporaryRedirect ||
            statusCode == http::StatusCode::PermanentRedirect)
        {
            if (redirectLimit > 0)
            {
                const std::string& location = httpResponse->get("Location");
                LOG_TRC("CollabFileProxy: redirect to ["
                        << COOLWSD::anonymizeUrl(location) << ']');
                doDownload(poll, Poco::URI(location), redirectLimit - 1);
                return;
            }
            else
            {
                LOG_WRN("CollabFileProxy: too many redirects for ["
                        << uriAnonym << ']');
                HttpHelper::sendErrorAndShutdown(http::StatusCode::BadGateway, socket);
                return;
            }
        }

        const auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - startTime);

        if (statusCode != http::StatusCode::OK)
        {
            LOG_ERR("CollabFileProxy: GetFile failed with " << statusCode
                    << " for [" << uriAnonym << ']');
            HttpHelper::sendErrorAndShutdown(
                statusCode == http::StatusCode::Forbidden
                    ? http::StatusCode::Forbidden
                    : http::StatusCode::BadGateway,
                socket);
            return;
        }

        LOG_INF("CollabFileProxy: downloaded " << httpResponse->getBody().size()
                << " bytes from [" << uriAnonym << "] in " << duration);

        // Send the file to the client
        http::Response response(http::StatusCode::OK);
        response.setBody(httpResponse->getBody(), "application/octet-stream");
        socket->sendAndShutdown(response);
    };

    _httpSession->setFinishedHandler(std::move(finishedCallback));
    _httpSession->asyncRequest(httpRequest, poll, false);
}

void CollabFileProxy::doUpload(const std::shared_ptr<TerminatingPoll>& poll,
                               const Poco::URI& uri, const std::string& body)
{
    const std::string uriAnonym = COOLWSD::anonymizeUrl(uri.toString());
    LOG_DBG("CollabFileProxy: uploading " << body.size()
            << " bytes to [" << uriAnonym << ']');

    _httpSession = StorageConnectionManager::getHttpSession(uri);
    Authorization auth = Authorization::create(uri);
    http::Request httpRequest = StorageConnectionManager::createHttpRequest(uri, auth);

    httpRequest.setVerb(http::Request::VERB_POST);
    httpRequest.set("X-WOPI-Override", "PUT");
    httpRequest.setContentType("application/octet-stream");
    httpRequest.setContentLength(body.size());
    httpRequest.setBody(body);

    const auto startTime = std::chrono::steady_clock::now();

    http::Session::FinishedCallback finishedCallback =
        [this, startTime, uriAnonym, bodySize = body.size()](
            const std::shared_ptr<http::Session>& session)
    {
        if (SigUtil::getShutdownRequestFlag())
        {
            LOG_DBG("CollabFileProxy: shutdown flagged, aborting upload");
            return;
        }

        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (!socket)
        {
            LOG_ERR("CollabFileProxy: invalid socket while uploading ["
                    << uriAnonym << ']');
            return;
        }

        const std::shared_ptr<const http::Response> httpResponse = session->response();
        const http::StatusCode statusCode = httpResponse->statusLine().statusCode();

        const auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - startTime);

        LOG_INF("CollabFileProxy: PutFile returned " << statusCode
                << " for " << bodySize << " bytes to [" << uriAnonym
                << "] in " << duration);

        if (statusCode == http::StatusCode::OK)
        {
            // Return the WOPI response (contains LastModifiedTime etc.)
            http::Response response(http::StatusCode::OK);
            response.setBody(httpResponse->getBody(), "application/json; charset=utf-8");
            socket->sendAndShutdown(response);
        }
        else if (statusCode == http::StatusCode::Conflict)
        {
            // Document was modified externally
            http::Response response(http::StatusCode::Conflict);
            response.setBody(httpResponse->getBody(), "application/json; charset=utf-8");
            socket->sendAndShutdown(response);
        }
        else if (statusCode == http::StatusCode::Unauthorized ||
                 statusCode == http::StatusCode::Forbidden)
        {
            HttpHelper::sendErrorAndShutdown(http::StatusCode::Forbidden, socket);
        }
        else
        {
            LOG_ERR("CollabFileProxy: PutFile failed with " << statusCode);
            HttpHelper::sendErrorAndShutdown(http::StatusCode::BadGateway, socket);
        }
    };

    _httpSession->setFinishedHandler(std::move(finishedCallback));
    _httpSession->asyncRequest(httpRequest, poll, false);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
