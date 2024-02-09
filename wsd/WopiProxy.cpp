/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <WopiProxy.hpp>

#include "FileUtil.hpp"
#include "HttpHelper.hpp"
#include "HttpRequest.hpp"
#include <COOLWSD.hpp>
#include <StorageConnectionManager.hpp>
#include <Exceptions.hpp>
#include <Log.hpp>
#include <common/JsonUtil.hpp>
#include <Util.hpp>

void WopiProxy::handleRequest([[maybe_unused]] SocketPoll& poll, SocketDisposition& disposition)
{
    std::string url = _requestDetails.getDocumentURI();
    if (Util::startsWith(url, "/wasm/"))
    {
        url = url.substr(6);
    }

    LOG_INF("URL [" << url << "] for WS Request.");
    const auto uriPublic = RequestDetails::sanitizeURI(url);
    const auto docKey = RequestDetails::getDocKey(uriPublic);
    const std::string fileId = Util::getFilenameFromURL(docKey);
    Util::mapAnonymized(fileId, fileId); // Identity mapping, since fileId is already obfuscated

    LOG_INF("Starting GET request handler for session [" << _id << "] on url ["
                                                         << COOLWSD::anonymizeUrl(url) << "].");

    LOG_INF("Sanitized URI [" << COOLWSD::anonymizeUrl(url) << "] to ["
                              << COOLWSD::anonymizeUrl(uriPublic.toString())
                              << "] and mapped to docKey [" << docKey << "] for session [" << _id
                              << "].");

    // Before we create DocBroker with a SocketPoll thread, a ClientSession, and a Kit process,
    // we need to vet this request by invoking CheckFileInfo.
    // For that, we need the storage settings to create a connection.
    const StorageBase::StorageType storageType =
        StorageBase::validate(uriPublic, /*takeOwnership=*/false);
    switch (storageType)
    {
        case StorageBase::StorageType::Unsupported:
            LOG_ERR("Unsupported URI [" << COOLWSD::anonymizeUrl(uriPublic.toString())
                                        << "] or no storage configured");
            throw BadRequestException("No Storage configured or invalid URI " +
                                      COOLWSD::anonymizeUrl(uriPublic.toString()) + ']');

            break;
        case StorageBase::StorageType::Unauthorized:
            LOG_ERR("No authorized hosts found matching the target host [" << uriPublic.getHost()
                                                                           << "] in config");
            HttpHelper::sendErrorAndShutdown(http::StatusCode::Unauthorized, _socket);
            break;

        case StorageBase::StorageType::FileSystem:
            LOG_INF("URI [" << COOLWSD::anonymizeUrl(uriPublic.toString()) << "] on docKey ["
                            << docKey << "] is for a FileSystem document");

            // Remove from the current poll and transfer.
            disposition.setMove(
                [this, docKey, url, uriPublic](const std::shared_ptr<Socket>& moveSocket)
                {
                    LOG_TRC_S('#' << moveSocket->getFD()
                                  << ": Dissociating client socket from "
                                     "ClientRequestDispatcher and creating DocBroker for ["
                                  << docKey << ']');

                    // Send the file contents.
                    std::unique_ptr<std::vector<char>> data =
                        FileUtil::readFile(uriPublic.getPath());
                    if (data)
                    {
                        http::Response response(http::StatusCode::OK);
                        response.setBody(std::string(data->data(), data->size()),
                                         "application/octet-stream");
                        _socket->sendAndShutdown(response);
                    }
                    else
                    {
                        http::Response response(http::StatusCode::NotFound);
                        _socket->sendAndShutdown(response);
                    }
                });
            break;
#if !MOBILEAPP
        case StorageBase::StorageType::Wopi:
            LOG_INF("URI [" << COOLWSD::anonymizeUrl(uriPublic.toString()) << "] on docKey ["
                            << docKey << "] is for a WOPI document");
            // Remove from the current poll and transfer.
            disposition.setMove(
                [this, &poll, docKey, url, uriPublic](const std::shared_ptr<Socket>& moveSocket)
                {
                    LOG_TRC_S('#' << moveSocket->getFD()
                                  << ": Dissociating client socket from "
                                     "ClientRequestDispatcher and invoking CheckFileInfo for ["
                                  << docKey << ']');

                    poll.insertNewSocket(moveSocket);

                    // CheckFileInfo and only when it's good create DocBroker.
                    checkFileInfo(poll, url, uriPublic, docKey, RedirectionLimit);
                });
            break;
#endif //!MOBILEAPP
    }
}

#if !MOBILEAPP
void WopiProxy::checkFileInfo(SocketPoll& poll, const std::string& url, const Poco::URI& uriPublic,
                              const std::string& docKey, int redirectLimit)
{
    const std::string uriAnonym = COOLWSD::anonymizeUrl(uriPublic.toString());

    LOG_DBG("Getting info for wopi uri [" << uriAnonym << ']');
    _httpSession = StorageConnectionManager::getHttpSession(uriPublic);
    Authorization auth = Authorization::create(uriPublic);
    http::Request httpRequest = StorageConnectionManager::createHttpRequest(uriPublic, auth);

    const auto startTime = std::chrono::steady_clock::now();

    LOG_TRC("WOPI::CheckFileInfo request header for URI [" << uriAnonym << "]:\n"
                                                           << httpRequest.header());

    http::Session::FinishedCallback finishedCallback =
        [this, &poll, docKey, startTime, url, uriPublic, uriAnonym,
         redirectLimit](const std::shared_ptr<http::Session>& session)
    {
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
                const std::string& location = httpResponse->get("Location");
                LOG_TRC("WOPI::CheckFileInfo redirect to URI [" << COOLWSD::anonymizeUrl(location)
                                                                << "]");

                checkFileInfo(poll, location, Poco::URI(location), docKey, redirectLimit - 1);
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

        Log::StreamLogger logRes = failed ? Log::error() : Log::trace();
        if (logRes.enabled())
        {
            logRes << "WOPI::CheckFileInfo " << (failed ? "failed" : "returned") << " for URI ["
                   << uriAnonym << "]: " << httpResponse->statusLine().statusCode() << ' '
                   << httpResponse->statusLine().reasonPhrase()
                   << ". Headers: " << httpResponse->header()
                   << (failed ? "\tBody: [" + wopiResponse + ']' : std::string());

            LOG_END_FLUSH(logRes);
        }

        if (failed)
        {
            if (httpResponse->statusLine().statusCode() == http::StatusCode::Forbidden)
            {
                LOG_ERR("Access denied to [" << uriAnonym << ']');
                HttpHelper::sendErrorAndShutdown(http::StatusCode::Forbidden, _socket);
                return;
            }

            LOG_ERR("Invalid URI or access denied to [" << uriAnonym << ']');
            HttpHelper::sendErrorAndShutdown(http::StatusCode::Unauthorized, _socket);
            return;
        }

        Poco::JSON::Object::Ptr object;
        if (!JsonUtil::parseJSON(wopiResponse, object))
        {
            if (COOLWSD::AnonymizeUserData)
                wopiResponse = "obfuscated";

            LOG_ERR("WOPI::CheckFileInfo ("
                    << callDurationMs
                    << ") failed or no valid JSON payload returned. Access denied. "
                       "Original response: ["
                    << wopiResponse << "].");

            throw UnauthorizedRequestException("Access denied. WOPI::CheckFileInfo failed on: " +
                                               uriAnonym);
        }

        // Stream the file contents.

        if (COOLWSD::AnonymizeUserData)
            LOG_DBG("WOPI::CheckFileInfo (" << callDurationMs << "): anonymizing...");
        else
            LOG_DBG("WOPI::CheckFileInfo (" << callDurationMs << "): " << wopiResponse);

        std::size_t size = 0;
        std::string filename, ownerId, lastModifiedTime;

        JsonUtil::findJSONValue(object, "Size", size);
        JsonUtil::findJSONValue(object, "OwnerId", ownerId);
        JsonUtil::findJSONValue(object, "BaseFileName", filename);
        JsonUtil::findJSONValue(object, "LastModifiedTime", lastModifiedTime);

        LocalStorage::FileInfo fileInfo =
            LocalStorage::FileInfo({ filename, ownerId, lastModifiedTime });

        // if (COOLWSD::AnonymizeUserData)
        //     Util::mapAnonymized(Util::getFilenameFromURL(filename),
        //                         Util::getFilenameFromURL(getUri().toString()));

        auto wopiInfo = std::make_unique<WopiStorage::WOPIFileInfo>(fileInfo, object, uriPublic);
        // if (wopiInfo->getSupportsLocks())
        //     lockCtx.initSupportsLocks();

        // If FileUrl is set, we use it for GetFile.
        const std::string fileUrl = wopiInfo->getFileUrl();

        // First try the FileUrl, if provided.
        if (!fileUrl.empty())
        {
            const std::string fileUrlAnonym = COOLWSD::anonymizeUrl(fileUrl);
            try
            {
                LOG_INF("WOPI::GetFile using FileUrl: " << fileUrlAnonym);
                return download(poll, url, Poco::URI(fileUrl), docKey, RedirectionLimit);
            }
            catch (const StorageSpaceLowException&)
            {
                throw; // Bubble-up the exception.
            }
            catch (const std::exception& ex)
            {
                LOG_ERR("Could not download document from WOPI FileUrl [" + fileUrlAnonym +
                            "]. Will use default URL. Error: "
                        << ex.what());
            }
        }

        // Try the default URL, we either don't have FileUrl, or it failed.
        // WOPI URI to download files ends in '/contents'.
        // Add it here to get the payload instead of file info.
        Poco::URI uriObject(uriPublic);
        uriObject.setPath(uriObject.getPath() + "/contents");

        try
        {
            LOG_INF("WOPI::GetFile using default URI: " << uriAnonym);
            download(poll, url, uriObject, docKey, redirectLimit);
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Cannot download document from WOPI storage uri [" + uriAnonym + "]. Error: "
                    << ex.what());
            throw; // Bubble-up the exception.
        }
    };

    _httpSession->setFinishedHandler(std::move(finishedCallback));

    // Run the CheckFileInfo request on the WebServer Poll.
    _httpSession->asyncRequest(httpRequest, poll);
}

void WopiProxy::download(SocketPoll& poll, const std::string& url, const Poco::URI& uriPublic,
                         const std::string& docKey, int redirectLimit)
{
    const std::string uriAnonym = COOLWSD::anonymizeUrl(uriPublic.toString());

    LOG_DBG("Getting info for wopi uri [" << uriAnonym << ']');
    _httpSession = StorageConnectionManager::getHttpSession(uriPublic);
    Authorization auth = Authorization::create(uriPublic);
    http::Request httpRequest = StorageConnectionManager::createHttpRequest(uriPublic, auth);

    const auto startTime = std::chrono::steady_clock::now();

    LOG_TRC("WOPI::GetFile request header for URI [" << uriAnonym << "]:\n"
                                                     << httpRequest.header());

    http::Session::FinishedCallback finishedCallback =
        [this, &poll, docKey, startTime, url, uriPublic, uriAnonym,
         redirectLimit](const std::shared_ptr<http::Session>& session)
    {
        if (SigUtil::getShutdownRequestFlag())
        {
            LOG_DBG("Shutdown flagged, giving up on in-flight requests");
            return;
        }

        const std::shared_ptr<const http::Response> httpResponse = session->response();
        LOG_TRC("WOPI::GetFile returned " << httpResponse->statusLine().statusCode());

        const http::StatusCode statusCode = httpResponse->statusLine().statusCode();
        if (statusCode == http::StatusCode::MovedPermanently ||
            statusCode == http::StatusCode::Found ||
            statusCode == http::StatusCode::TemporaryRedirect ||
            statusCode == http::StatusCode::PermanentRedirect)
        {
            if (redirectLimit)
            {
                const std::string& location = httpResponse->get("Location");
                LOG_TRC("WOPI::GetFile redirect to URI [" << COOLWSD::anonymizeUrl(location)
                                                          << "]");

                download(poll, location, Poco::URI(location), docKey, redirectLimit - 1);
                return;
            }
            else
            {
                LOG_WRN("WOPI::GetFile redirected too many times. Giving up on URI [" << uriAnonym
                                                                                      << ']');
            }
        }

        std::chrono::milliseconds callDurationMs =
            std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() -
                                                                  startTime);
        (void)callDurationMs;

        // Note: we don't log the response if obfuscation is enabled, except for failures.
        std::string wopiResponse = httpResponse->getBody();
        const bool failed = (httpResponse->statusLine().statusCode() != http::StatusCode::OK);

        Log::StreamLogger logRes = failed ? Log::error() : Log::trace();
        if (logRes.enabled())
        {
            logRes << "WOPI::GetFile " << (failed ? "failed" : "returned") << " for URI ["
                   << uriAnonym << "]: " << httpResponse->statusLine().statusCode() << ' '
                   << httpResponse->statusLine().reasonPhrase()
                   << ". Headers: " << httpResponse->header()
                   << (failed ? "\tBody: [" + wopiResponse + ']' : std::string());

            LOG_END_FLUSH(logRes);
        }

        if (failed)
        {
            if (httpResponse->statusLine().statusCode() == http::StatusCode::Forbidden)
            {
                LOG_ERR("Access denied to [" << uriAnonym << ']');
                HttpHelper::sendErrorAndShutdown(http::StatusCode::Forbidden, _socket);
                return;
            }

            LOG_ERR("Invalid URI or access denied to [" << uriAnonym << ']');
            HttpHelper::sendErrorAndShutdown(http::StatusCode::Unauthorized, _socket);
            return;
        }

        http::Response response(http::StatusCode::OK);
        response.setBody(httpResponse->getBody(), "application/octet-stream");
        _socket->sendAndShutdown(response);
    };

    _httpSession->setFinishedHandler(std::move(finishedCallback));

    // Run the CheckFileInfo request on the WebServer Poll.
    _httpSession->asyncRequest(httpRequest, poll);
}
#endif //!MOBILEAPP

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
