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

#include <RequestVettingStation.hpp>

#include <COOLWSD.hpp>
#include <TraceEvent.hpp>
#include <StorageConnectionManager.hpp>
#include <Exceptions.hpp>
#include <Log.hpp>
#include <DocumentBroker.hpp>
#include <ClientSession.hpp>
#include <common/JsonUtil.hpp>
#include <Util.hpp>

extern std::shared_ptr<DocumentBroker>
findOrCreateDocBroker(const std::shared_ptr<ProtocolHandlerInterface>& proto,
                      DocumentBroker::ChildType type, const std::string& uri,
                      const std::string& docKey, const std::string& id, const Poco::URI& uriPublic,
                      unsigned mobileAppDocId = 0);
namespace
{
void sendLoadResult(const std::shared_ptr<ClientSession>& clientSession, bool success,
                    const std::string& errorMsg)
{
    const std::string result = success ? "" : "Error while loading document";
    const std::string resultstr = success ? "true" : "false";
    // Some sane limit, otherwise we get problems transferring this
    // to the client with large strings (can be a whole webpage)
    // Replace reserved characters
    std::string errorMsgFormatted = COOLProtocol::getAbbreviatedMessage(errorMsg);
    errorMsgFormatted = Poco::translate(errorMsg, "\"", "'");
    clientSession->sendMessage("commandresult: { \"command\": \"load\", \"success\": " + resultstr +
                               ", \"result\": \"" + result + "\", \"errorMsg\": \"" +
                               errorMsgFormatted + "\"}");
}

} // anonymous namespace

void RequestVettingStation::handleRequest(SocketPoll& poll, SocketDisposition& disposition)
{
    const std::string url = _requestDetails.getDocumentURI();

    LOG_INF("URL [" << url << "] for WS Request.");
    const auto uriPublic = RequestDetails::sanitizeURI(url);
    const auto docKey = RequestDetails::getDocKey(uriPublic);
    const std::string fileId = Util::getFilenameFromURL(docKey);
    Util::mapAnonymized(fileId, fileId); // Identity mapping, since fileId is already obfuscated

    LOG_INF("Starting GET request handler for session [" << _id << "] on url ["
                                                         << COOLWSD::anonymizeUrl(url) << ']');

    LOG_INF("Sanitized URI [" << COOLWSD::anonymizeUrl(url) << "] to ["
                              << COOLWSD::anonymizeUrl(uriPublic.toString())
                              << "] and mapped to docKey [" << docKey << "] for session [" << _id
                              << ']');

    // Check if readonly session is required
    bool isReadOnly = false;
    for (const auto& param : uriPublic.getQueryParameters())
    {
        LOG_TRC("Query param: " << param.first << ", value: " << param.second);
        if (param.first == "permission" && param.second == "readonly")
        {
            isReadOnly = true;
        }
    }

    LOG_INF("URL [" << COOLWSD::anonymizeUrl(url) << "] is "
                    << (isReadOnly ? "readonly" : "writable"));

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
            sendErrorAndShutdown(_ws, _socket, "error: cmd=internal kind=unauthorized",
                                 WebSocketHandler::StatusCodes::POLICY_VIOLATION);
            break;

        case StorageBase::StorageType::FileSystem:
            LOG_INF("URI [" << COOLWSD::anonymizeUrl(uriPublic.toString()) << "] on docKey ["
                            << docKey << "] is for a FileSystem document");

            // Remove from the current poll and transfer.
            disposition.setMove(
                [this, docKey, url, uriPublic,
                 isReadOnly](const std::shared_ptr<Socket>& moveSocket)
                {
                    LOG_TRC_S('#' << moveSocket->getFD()
                                  << ": Dissociating client socket from "
                                     "ClientRequestDispatcher and creating DocBroker for ["
                                  << docKey << ']');

                    // Create the DocBroker.
                    createDocBroker(docKey, url, uriPublic, isReadOnly);
                });
            break;
        case StorageBase::StorageType::Wopi:
            LOG_INF("URI [" << COOLWSD::anonymizeUrl(uriPublic.toString()) << "] on docKey ["
                            << docKey << "] is for a WOPI document");
            // Remove from the current poll and transfer.
            disposition.setMove(
                [this, &poll, docKey, url, uriPublic,
                 isReadOnly](const std::shared_ptr<Socket>& moveSocket)
                {
                    LOG_TRC_S('#' << moveSocket->getFD()
                                  << ": Dissociating client socket from "
                                     "ClientRequestDispatcher and invoking CheckFileInfo for ["
                                  << docKey << ']');

                    // CheckFileInfo and only when it's good create DocBroker.
                    checkFileInfo(poll, url, uriPublic, docKey, isReadOnly, RedirectionLimit);
                });
            break;
    }
}

void RequestVettingStation::checkFileInfo(SocketPoll& poll, const std::string& url,
                                          const Poco::URI& uriPublic, const std::string& docKey,
                                          bool isReadOnly, int redirectLimit)
{
    ProfileZone profileZone("WopiStorage::getWOPIFileInfo", { { "url", url } }); // Move to ctor.

    const std::string uriAnonym = COOLWSD::anonymizeUrl(uriPublic.toString());

    LOG_DBG("Getting info for wopi uri [" << uriAnonym << ']');
    _httpSession = StorageConnectionManager::getHttpSession(uriPublic);
    Authorization auth = Authorization::create(uriPublic);
    http::Request httpRequest = StorageConnectionManager::createHttpRequest(uriPublic, auth);

    const auto startTime = std::chrono::steady_clock::now();

    LOG_TRC("WOPI::CheckFileInfo request header for URI [" << uriAnonym << "]:\n"
                                                           << httpRequest.header());

    http::Session::FinishedCallback finishedCallback =
        [this, &poll, docKey, startTime, url, uriPublic, isReadOnly, uriAnonym,
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

                checkFileInfo(poll, location, Poco::URI(location), docKey, isReadOnly,
                              redirectLimit - 1);
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
                sendErrorAndShutdown(_ws, _socket, "error: cmd=storage kind=unauthorized",
                                     WebSocketHandler::StatusCodes::POLICY_VIOLATION);
                return;
            }

            LOG_ERR("Invalid URI or access denied to [" << uriAnonym << ']');
            sendErrorAndShutdown(_ws, _socket, "error: cmd=storage kind=unauthorized",
                                 WebSocketHandler::StatusCodes::POLICY_VIOLATION);
            return;
        }

        Poco::JSON::Object::Ptr wopiInfo;
        if (JsonUtil::parseJSON(wopiResponse, wopiInfo))
        {
            if (COOLWSD::AnonymizeUserData)
                LOG_DBG("WOPI::CheckFileInfo (" << callDurationMs << "): anonymizing...");
            else
                LOG_DBG("WOPI::CheckFileInfo (" << callDurationMs << "): " << wopiResponse);
        }
        else
        {
            if (COOLWSD::AnonymizeUserData)
                wopiResponse = "obfuscated";

            LOG_ERR("WOPI::CheckFileInfo ("
                    << callDurationMs
                    << ") failed or no valid JSON payload returned. Access denied. "
                       "Original response: ["
                    << wopiResponse << ']');

            throw UnauthorizedRequestException("Access denied. WOPI::CheckFileInfo failed on: " +
                                               uriAnonym);
        }

        createDocBroker(docKey, url, uriPublic, isReadOnly, std::move(wopiInfo));
    };

    _httpSession->setFinishedHandler(finishedCallback);

    // Run the CheckFileInfo request on the WebServer Poll.
    _httpSession->asyncRequest(httpRequest, poll);
}

void RequestVettingStation::createDocBroker(const std::string& docKey, const std::string& url,
                                            const Poco::URI& uriPublic, const bool isReadOnly,
                                            Poco::JSON::Object::Ptr wopiInfo)
{
    // Request a kit process for this doc.
    std::shared_ptr<DocumentBroker> docBroker = findOrCreateDocBroker(
        std::static_pointer_cast<ProtocolHandlerInterface>(_ws),
        DocumentBroker::ChildType::Interactive, url, docKey, _id, uriPublic, _mobileAppDocId);
    if (!docBroker)
    {
        LOG_ERR("Failed to create DocBroker [" << docKey << ']');
        sendErrorAndShutdown(_ws, _socket, "error: cmd=internal kind=load",
                             WebSocketHandler::StatusCodes::UNEXPECTED_CONDITION);
        return;
    }

    LOG_DBG("DocBroker [" << docKey << "] acquired for [" << url << ']');
    std::shared_ptr<ClientSession> clientSession =
        docBroker->createNewClientSession(_ws, _id, uriPublic, isReadOnly, _requestDetails);
    if (!clientSession)
    {
        LOG_ERR("Failed to create Client Session [" << _id << "] on docKey [" << docKey << ']');
        sendErrorAndShutdown(_ws, _socket, "error: cmd=internal kind=load",
                             WebSocketHandler::StatusCodes::UNEXPECTED_CONDITION);
        return;
    }

    LOG_DBG("ClientSession [" << clientSession->getName() << "] for [" << docKey
                              << "] acquired for [" << url << ']');

    // Transfer the client socket to the DocumentBroker when we get back to the poll:
    docBroker->setupTransfer(
        _socket,
        [docBroker, clientSession, uriPublic, wopiInfo,
         this](const std::shared_ptr<Socket>& moveSocket) mutable
        {
            try
            {
                LOG_DBG_S("Transfering docBroker [" << docBroker->getDocKey() << ']');

                auto streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);

                // Set WebSocketHandler's socket after its construction for shared_ptr goodness.
                streamSocket->setHandler(_ws);

                LOG_DBG_S('#' << moveSocket->getFD() << " handler is " << clientSession->getName());

                std::unique_ptr<WopiStorage::WOPIFileInfo> wopiFileInfo;
                if (wopiInfo)
                {
                    std::size_t size = 0;
                    std::string filename, ownerId, lastModifiedTime;

                    JsonUtil::findJSONValue(wopiInfo, "Size", size);
                    JsonUtil::findJSONValue(wopiInfo, "OwnerId", ownerId);
                    JsonUtil::findJSONValue(wopiInfo, "BaseFileName", filename);
                    JsonUtil::findJSONValue(wopiInfo, "LastModifiedTime", lastModifiedTime);

                    StorageBase::FileInfo fileInfo =
                        StorageBase::FileInfo({ filename, ownerId, lastModifiedTime });

                    wopiFileInfo =
                        std::make_unique<WopiStorage::WOPIFileInfo>(fileInfo, wopiInfo, uriPublic);
                }

                // Add and load the session.
                // Will download synchronously, but in own docBroker thread.
                docBroker->addSession(clientSession, std::move(wopiFileInfo));

                COOLWSD::checkDiskSpaceAndWarnClients(true);
                // Users of development versions get just an info
                // when reaching max documents or connections
                COOLWSD::checkSessionLimitsAndWarnClients();

                sendLoadResult(clientSession, true, "");
            }
            catch (const UnauthorizedRequestException& exc)
            {
                LOG_ERR_S("Unauthorized Request while starting session on "
                          << docBroker->getDocKey() << " for socket #" << moveSocket->getFD()
                          << ". Terminating connection. Error: " << exc.what());
                sendErrorAndShutdown(_ws, moveSocket, "error: cmd=internal kind=unauthorized",
                                     WebSocketHandler::StatusCodes::POLICY_VIOLATION);
            }
            catch (const StorageConnectionException& exc)
            {
                LOG_ERR_S("Storage error while starting session on "
                          << docBroker->getDocKey() << " for socket #" << moveSocket->getFD()
                          << ". Terminating connection. Error: " << exc.what());
                sendErrorAndShutdown(_ws, moveSocket, "error: cmd=storage kind=loadfailed",
                                     WebSocketHandler::StatusCodes::POLICY_VIOLATION);
            }
            catch (const StorageSpaceLowException& exc)
            {
                LOG_ERR_S("Disk-Full error while starting session on "
                          << docBroker->getDocKey() << " for socket #" << moveSocket->getFD()
                          << ". Terminating connection. Error: " << exc.what());
                const std::string msg = "error: cmd=internal kind=diskfull";
                _ws->shutdown(WebSocketHandler::StatusCodes::UNEXPECTED_CONDITION, msg);
                moveSocket->ignoreInput();
            }
            catch (const std::exception& exc)
            {
                LOG_ERR_S("Error while starting session on "
                          << docBroker->getDocKey() << " for socket #" << moveSocket->getFD()
                          << ". Terminating connection. Error: " << exc.what());
                sendErrorAndShutdown(_ws, moveSocket, "error: cmd=storage kind=loadfailed",
                                     WebSocketHandler::StatusCodes::POLICY_VIOLATION);
            }
        });
}

void RequestVettingStation::sendErrorAndShutdown(const std::shared_ptr<WebSocketHandler>& ws,
                                                 const std::shared_ptr<Socket>& socket,
                                                 const std::string& msg,
                                                 WebSocketHandler::StatusCodes statusCode)
{
    ws->sendMessage(msg);
    ws->shutdown(statusCode, msg);
    socket->ignoreInput();
}