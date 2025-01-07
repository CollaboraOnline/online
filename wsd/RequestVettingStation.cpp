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

#include <common/Anonymizer.hpp>
#include <COOLWSD.hpp>
#include <RequestDetails.hpp>
#include <TraceEvent.hpp>
#include <Exceptions.hpp>
#include <Log.hpp>
#include <DocumentBroker.hpp>
#include <ClientSession.hpp>
#include <common/JsonUtil.hpp>
#include <Poco/Base64Encoder.h>
#include <Util.hpp>
#include <ServerAuditUtil.hpp>

#if !MOBILEAPP
#include <wopi/CheckFileInfo.hpp>
#endif // !MOBILEAPP

extern std::pair<std::shared_ptr<DocumentBroker>, std::string>
findOrCreateDocBroker(DocumentBroker::ChildType type, const std::string& uri,
                      const std::string& docKey, const std::string& id, const Poco::URI& uriPublic,
                      unsigned mobileAppDocId);

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
    clientSession->sendTextFrame(
        "commandresult: { \"command\": \"load\", \"success\": " + resultstr + ", \"result\": \"" +
        result + "\", \"errorMsg\": \"" + errorMsgFormatted + "\"}");
}

} // anonymous namespace

void RequestVettingStation::handleRequest(const std::string& id)
{
    _id = id;

    const std::string url = _requestDetails.getDocumentURI();

    const auto uriPublic = RequestDetails::sanitizeURI(url);
    const auto docKey = RequestDetails::getDocKey(uriPublic);
    const std::string fileId = Uri::getFilenameFromURL(docKey);
    Anonymizer::mapAnonymized(fileId,
                              fileId); // Identity mapping, since fileId is already obfuscated

    // Check if readonly session is required.
    const bool isReadOnly = Uri::hasReadonlyPermission(uriPublic.toString());

    LOG_INF("URL [" << COOLWSD::anonymizeUrl(url)
                    << "] will be proactively vetted. Sanitized uriPublic: ["
                    << COOLWSD::anonymizeUrl(uriPublic.toString()) << "], docKey: [" << docKey
                    << "], session: [" << _id << "], fileId: [" << fileId << "] "
                    << (isReadOnly ? "(readonly)" : "(writable)"));

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
            sendUnauthorizedErrorAndShutdown();
            break;

        case StorageBase::StorageType::FileSystem:
            LOG_INF("URI [" << COOLWSD::anonymizeUrl(uriPublic.toString()) << "] on docKey ["
                            << docKey << "] is for a FileSystem document");
            break;
#if !MOBILEAPP
        case StorageBase::StorageType::Wopi:
            LOG_INF("URI [" << COOLWSD::anonymizeUrl(uriPublic.toString()) << "] on docKey ["
                            << docKey << "] is for a WOPI document");

            // CheckFileInfo asynchronously.
            checkFileInfo(uriPublic, isReadOnly, HTTP_REDIRECTION_LIMIT);
            break;
#endif //!MOBILEAPP
    }
}

#if !MOBILEAPP

static std::string base64Encode(std::string& input)
{
    std::ostringstream oss;
    Poco::Base64Encoder encoder(oss);
    encoder << input;
    encoder.close();
    return oss.str();
}

#endif

void RequestVettingStation::sendUnauthorizedErrorAndShutdown()
{
    std::string error = "error: cmd=internal kind=unauthorized";

#if !MOBILEAPP
    if (_checkFileInfo)
    {
        std::string sslVerifyResult = _checkFileInfo->getSslVerifyMessage();
        if (!sslVerifyResult.empty())
            error += " code=" + base64Encode(sslVerifyResult);
    }
#endif
    sendErrorAndShutdown(_ws, error,
                         WebSocketHandler::StatusCodes::POLICY_VIOLATION);
}

void RequestVettingStation::handleRequest(const std::string& id,
                                          const RequestDetails& requestDetails,
                                          const std::shared_ptr<WebSocketHandler>& ws,
                                          const std::shared_ptr<StreamSocket>& socket,
                                          unsigned mobileAppDocId, SocketDisposition& disposition)
{
    _id = id;
    _requestDetails = requestDetails;
    _ws = ws;
    _socket = socket;
    _mobileAppDocId = mobileAppDocId;

    const std::string url = _requestDetails.getDocumentURI();

    const auto uriPublic = RequestDetails::sanitizeURI(url);
    const auto docKey = RequestDetails::getDocKey(uriPublic);
    const std::string fileId = Uri::getFilenameFromURL(docKey);
    Anonymizer::mapAnonymized(fileId,
                              fileId); // Identity mapping, since fileId is already obfuscated

    // Check if readonly session is required.
    const bool isReadOnly = Uri::hasReadonlyPermission(uriPublic.toString());

    LOG_INF("URL [" << COOLWSD::anonymizeUrl(url) << "] for WS Request. Sanitized uriPublic: ["
                    << COOLWSD::anonymizeUrl(uriPublic.toString()) << "], docKey: [" << docKey
                    << "], session: [" << _id << "], fileId: [" << fileId << "] "
                    << (isReadOnly ? "(readonly)" : "(writable)"));

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
            sendUnauthorizedErrorAndShutdown();
            break;

        case StorageBase::StorageType::FileSystem:
            LOG_INF("URI [" << COOLWSD::anonymizeUrl(uriPublic.toString()) << "] on docKey ["
                            << docKey << "] is for a FileSystem document");

            // Remove from the current poll and transfer.
            disposition.setMove(
                [selfLifecycle = shared_from_this(), this, docKey, url, uriPublic,
                 isReadOnly](const std::shared_ptr<Socket>& moveSocket)
                {
                    LOG_TRC_S('#' << moveSocket->getFD()
                                  << ": Dissociating client socket from "
                                     "ClientRequestDispatcher and creating DocBroker for ["
                                  << docKey << ']');

                    // Create the DocBroker.
                    if (createDocBroker(docKey, url, uriPublic))
                    {
                        assert(_docBroker && "Must have docBroker");
                        createClientSession(docKey, url, uriPublic, isReadOnly);
                    }
                });
            break;
#if !MOBILEAPP
        case StorageBase::StorageType::Wopi:
            LOG_INF("URI [" << COOLWSD::anonymizeUrl(uriPublic.toString()) << "] on docKey ["
                            << docKey << "] is for a WOPI document");
            // Remove from the current poll and transfer.
            disposition.setMove(
                [selfLifecycle = shared_from_this(), this, docKey, url, uriPublic,
                 isReadOnly](const std::shared_ptr<Socket>& moveSocket)
                {
                    LOG_TRC_S('#' << moveSocket->getFD()
                                  << ": Dissociating client socket from "
                                     "ClientRequestDispatcher and invoking CheckFileInfo for ["
                                  << docKey << "], "
                                  << (_checkFileInfo ? CheckFileInfo::name(_checkFileInfo->state())
                                                     : "no CheckFileInfo"));

                    // CheckFileInfo and only when it's good create DocBroker.
                    if (_checkFileInfo && _checkFileInfo->state() == CheckFileInfo::State::Active)
                    {
                        // Wait for CheckFileInfo result.
                        LOG_DBG("CheckFileInfo request is in progress. Will resume when done");
                    }
                    else if (_checkFileInfo &&
                             _checkFileInfo->state() == CheckFileInfo::State::Pass &&
                             _checkFileInfo->wopiInfo())
                    {
                        std::string sslVerifyResult = _checkFileInfo->getSslVerifyMessage();
                        // We have a valid CheckFileInfo result; Create the DocBroker.
                        if (createDocBroker(docKey, url, uriPublic))
                        {
                            assert(_docBroker && "Must have docBroker");
                            createClientSession(docKey, url, uriPublic, isReadOnly);
                            // If there is anything dubious about the ssl
                            // connection provide a warning about that.
                            if (!sslVerifyResult.empty())
                            {
                                LOG_WRN_S("SSL verification warning: '" << sslVerifyResult << "' seen on CheckFileInfo for ["
                                              << docKey << "]");
#if !MOBILEAPP && !WASMAPP
                                _docBroker->setCertAuditWarning();
#endif
                            }
                        }
                    }
                    else if (_checkFileInfo == nullptr ||
                             _checkFileInfo->state() == CheckFileInfo::State::None ||
                             _checkFileInfo->state() == CheckFileInfo::State::Timedout)
                    {
                        // We haven't tried or we timed-out. Retry.
                        _checkFileInfo.reset();
                        checkFileInfo(uriPublic, isReadOnly, HTTP_REDIRECTION_LIMIT);
                    }
                    else
                    {
                        // We had a response, but it was empty/error. Meaning the user is unauthorized.
                        assert(_checkFileInfo && !_checkFileInfo->wopiInfo() &&
                               "Unexpected to have wopiInfo");

                        LOG_ERR_S('#'
                                  << moveSocket->getFD() << ": CheckFileInfo failed for [" << docKey
                                  << "], "
                                  << (_checkFileInfo ? CheckFileInfo::name(_checkFileInfo->state())
                                                     : "no CheckFileInfo"));

                        sendUnauthorizedErrorAndShutdown();
                    }
                });
            break;
#endif //!MOBILEAPP
    }
}

#if !MOBILEAPP
void RequestVettingStation::checkFileInfo(const Poco::URI& uri, bool isReadOnly, int redirectLimit)
{
    auto cfiContinuation = [this, isReadOnly](CheckFileInfo& checkFileInfo)
    {
        assert(&checkFileInfo == _checkFileInfo.get() && "Unknown CheckFileInfo instance");
        if (_checkFileInfo && _checkFileInfo->state() == CheckFileInfo::State::Pass &&
            _checkFileInfo->wopiInfo())
        {
            // The final URL might be different due to redirection.
            const std::string url = checkFileInfo.url().toString();
            const auto uriPublic = RequestDetails::sanitizeURI(url);
            const auto docKey = RequestDetails::getDocKey(uriPublic);
            LOG_DBG("WOPI::CheckFileInfo succeeded and will create DocBroker ["
                    << docKey << "] now with URL: [" << url << ']');

            if (createDocBroker(docKey, url, uriPublic))
            {
                assert(_docBroker && "Must have docBroker");
                if (_ws)
                {
                    // If we don't have the WebSocket, defer creating the client session.
                    createClientSession(docKey, url, uriPublic, isReadOnly);
                }
                else
                {
                    LOG_DBG("WOPI::CheckFileInfo succeeded but we don't have the client's "
                            "WebSocket yet. Deferring the ClientSession creation.");
                }
            }
        }
        else
        {
            if (_ws)
            {
                LOG_DBG("WOPI::CheckFileInfo failed, sending error and closing connection now");
                sendUnauthorizedErrorAndShutdown();
            }
            else
            {
                LOG_DBG("WOPI::CheckFileInfo failed but no client WebSocket to send error to");
            }
        }
    };

    // CheckFileInfo asynchronously.
    assert(_checkFileInfo == nullptr);
    _checkFileInfo = std::make_unique<CheckFileInfo>(_poll, uri, std::move(cfiContinuation));
    _checkFileInfo->checkFileInfo(redirectLimit);
}
#endif //!MOBILEAPP

bool RequestVettingStation::createDocBroker(const std::string& docKey, const std::string& url,
                                            const Poco::URI& uriPublic)
{
    // Request a kit process for this doc.
    const auto [docBroker, error] =
        findOrCreateDocBroker(DocumentBroker::ChildType::Interactive, url, docKey, _id, uriPublic,
                              _mobileAppDocId);

    _docBroker = docBroker;
    if (_docBroker)
    {
        // Indicate to the client that we're connecting to the docbroker.
        if (_ws)
        {
            static constexpr const char* const statusConnect = "progress: { \"id\":\"connect\" }";
            LOG_TRC("Sending to Client [" << statusConnect << ']');
            _ws->sendMessage(statusConnect);
        }

        LOG_DBG("DocBroker [" << docKey << "] acquired for [" << url << ']');
        return true;
    }

    // Failed.
    LOG_ERR("Failed to create DocBroker [" << docKey << "]: " << error);
    if (_ws)
    {
        sendErrorAndShutdown(_ws, error, WebSocketHandler::StatusCodes::UNEXPECTED_CONDITION);
    }

    return false;
}

void RequestVettingStation::createClientSession(const std::string& docKey, const std::string& url,
                                                const Poco::URI& uriPublic, const bool isReadOnly)
{
    assert(_docBroker && "Must have DocBroker");
    assert(_ws && "Must have WebSocket");

    std::shared_ptr<ClientSession> clientSession =
        _docBroker->createNewClientSession(_ws, _id, uriPublic, isReadOnly, _requestDetails);
    if (!clientSession)
    {
        LOG_ERR("Failed to create Client Session [" << _id << "] on docKey [" << docKey << ']');
        sendErrorAndShutdown(_ws, "error: cmd=internal kind=load",
                             WebSocketHandler::StatusCodes::UNEXPECTED_CONDITION);
        return;
    }

    LOG_DBG("ClientSession [" << clientSession->getName() << "] for [" << docKey
                              << "] acquired for [" << url << ']');

    std::unique_ptr<WopiStorage::WOPIFileInfo> realWopiFileInfo;
#if !MOBILEAPP
    assert((!_checkFileInfo || _checkFileInfo->wopiInfo()) &&
           "Must have WopiInfo when CheckFileInfo exists");
    realWopiFileInfo = _checkFileInfo ? _checkFileInfo->wopiFileInfo(uriPublic) : nullptr;
#endif // !MOBILEAPP

    // std::unique_ptr is not copyable, so cannot be captured in a std::function-wrapped lambda.
    std::shared_ptr<std::unique_ptr<WopiStorage::WOPIFileInfo>> wopiFileInfo =
        std::make_shared<std::unique_ptr<WopiStorage::WOPIFileInfo>>(std::move(realWopiFileInfo));

    // Transfer the client socket to the DocumentBroker when we get back to the poll:
    const auto ws = _ws;
    const auto docBroker = _docBroker;
    _docBroker->setupTransfer(
        _socket,
        [clientSession=std::move(clientSession), uriPublic, wopiFileInfo=std::move(wopiFileInfo),
         ws, docBroker](const std::shared_ptr<Socket>& moveSocket) mutable
        {
            try
            {
                LOG_DBG_S("Transfering docBroker [" << docBroker->getDocKey() << ']');

                auto streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);

                // Set WebSocketHandler's socket after its construction for shared_ptr goodness.
                streamSocket->setHandler(ws);

                LOG_DBG_S('#' << moveSocket->getFD() << " handler is " << clientSession->getName());

                // Add and load the session.
                // Will download synchronously, but in own docBroker thread.
                docBroker->addSession(clientSession, std::move(*wopiFileInfo));

                COOLWSD::checkDiskSpaceAndWarnClients(true);
                // Users of development versions get just an info
                // when reaching max documents or connections
                COOLWSD::checkSessionLimitsAndWarnClients();

                sendLoadResult(clientSession, /*success=*/true, /*errorMsg=*/std::string());
            }
            catch (const UnauthorizedRequestException& exc)
            {
                LOG_ERR_S("Unauthorized Request while starting session on "
                          << docBroker->getDocKey() << " for socket #" << moveSocket->getFD()
                          << ". Terminating connection. Error: " << exc.what());
                sendErrorAndShutdown(ws, "error: cmd=internal kind=unauthorized",
                                     WebSocketHandler::StatusCodes::POLICY_VIOLATION);
            }
            catch (const StorageConnectionException& exc)
            {
                LOG_ERR_S("Storage error while starting session on "
                          << docBroker->getDocKey() << " for socket #" << moveSocket->getFD()
                          << ". Terminating connection. Error: " << exc.what());
                sendErrorAndShutdown(ws, "error: cmd=storage kind=loadfailed",
                                     WebSocketHandler::StatusCodes::POLICY_VIOLATION);
            }
            catch (const StorageSpaceLowException& exc)
            {
                LOG_ERR_S("Disk-Full error while starting session on "
                          << docBroker->getDocKey() << " for socket #" << moveSocket->getFD()
                          << ". Terminating connection. Error: " << exc.what());
                sendErrorAndShutdown(ws, "error: cmd=internal kind=diskfull",
                                     WebSocketHandler::StatusCodes::UNEXPECTED_CONDITION);
            }
            catch (const std::exception& exc)
            {
                LOG_ERR_S("Error while starting session on "
                          << docBroker->getDocKey() << " for socket #" << moveSocket->getFD()
                          << ". Terminating connection. Error: " << exc.what());
                sendErrorAndShutdown(ws, "error: cmd=storage kind=loadfailed",
                                     WebSocketHandler::StatusCodes::POLICY_VIOLATION);
            }
        });
}

void RequestVettingStation::sendErrorAndShutdown(const std::shared_ptr<WebSocketHandler>& ws,
                                                 const std::string& msg,
                                                 WebSocketHandler::StatusCodes statusCode)
{
    if (ws)
    {
        ws->sendMessage(msg);
        ws->shutdown(statusCode, msg); // And ignore input (done in shutdown()).
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
