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

#include "SpecialBrokers.hpp"

#include <atomic>
#include <cassert>
#include <chrono>
#include <ctime>
#include <memory>
#include <string>

#include <Poco/DigestStream.h>
#include <Poco/Exception.h>
#include <Poco/Path.h>
#include <Poco/SHA1Engine.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>

#include "Authorization.hpp"
#include "ClientSession.hpp"
#include "Common.hpp"
#include "COOLWSD.hpp"
#include "FileServer.hpp"
#include "Socket.hpp"
#include "TileCache.hpp"
#include "QuarantineUtil.hpp"
#include <common/JsonUtil.hpp>
#include <common/Log.hpp>
#include <common/Message.hpp>
#include <common/Clipboard.hpp>
#include <common/Protocol.hpp>
#include <common/Unit.hpp>
#include <common/FileUtil.hpp>
#include <common/Uri.hpp>
#include <CommandControl.hpp>

#if !MOBILEAPP
#include <wopi/CheckFileInfo.hpp>
#include <net/HttpHelper.hpp>
#endif
#include <sys/types.h>
#include <sys/wait.h>

using namespace COOLProtocol;

using Poco::JSON::Object;

void StatelessBatchBroker::removeFile(const std::string& uriOrig)
{
    // Remove and report errors on failure.
    FileUtil::removeFile(uriOrig);
    const std::string dir = Poco::Path(uriOrig).parent().toString();
    if (FileUtil::isEmptyDirectory(dir))
        FileUtil::removeFile(dir);
}

static std::atomic<std::size_t> gConvertToBrokerInstanceCouter;

std::size_t ConvertToBroker::getInstanceCount() { return gConvertToBrokerInstanceCouter; }

ConvertToBroker::ConvertToBroker(const std::string& uri, const Poco::URI& uriPublic,
                                 const std::string& docKey, const std::string& format,
                                 const std::string& sOptions, const std::string& lang)
    : StatelessBatchBroker(uri, uriPublic, docKey)
    , _format(format)
    , _sOptions(sOptions)
    , _lang(lang)
{
    LOG_TRC("Created ConvertToBroker: uri: ["
            << uri << "], uriPublic: [" << uriPublic.toString() << "], docKey: [" << docKey
            << "], format: [" << format << "], options: [" << sOptions << "], lang: [" << lang
            << "].");

    CONFIG_STATIC const std::chrono::seconds limit_convert_secs(
        ConfigUtil::getConfigValue<int>("per_document.limit_convert_secs", 100));
    _limitLifeSeconds = limit_convert_secs;
    ++gConvertToBrokerInstanceCouter;
}

ConvertToBroker::~ConvertToBroker() {}

bool ConvertToBroker::startConversion(SocketDisposition& disposition, const std::string& id)
{
    std::shared_ptr<ConvertToBroker> docBroker =
        std::static_pointer_cast<ConvertToBroker>(shared_from_this());

    // Create a session to load the document.
    const bool isReadOnly = docBroker->isReadOnly();
    // FIXME: associate this with moveSocket (?)
    std::shared_ptr<ProtocolHandlerInterface> nullPtr;
    RequestDetails requestDetails("convert-to");
    _clientSession = std::make_shared<ClientSession>(nullPtr, id, docBroker, getPublicUri(),
                                                     isReadOnly, requestDetails);
    _clientSession->construct();

    docBroker->setupTransfer(
        disposition,
        [docBroker](const std::shared_ptr<Socket>& moveSocket)
        {
            auto streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);
            docBroker->_clientSession->setSaveAsSocket(streamSocket);

            // First add and load the session.
            docBroker->addSession(docBroker->_clientSession);

            // Load the document manually and request saving in the target format.
            std::string encodedFrom;
            Poco::URI::encode(docBroker->getPublicUri().getPath(), "", encodedFrom);

            docBroker->sendStartMessage(docBroker->_clientSession, encodedFrom);

            // Save is done in the setLoaded
        });
    return true;
}

void ConvertToBroker::sendStartMessage(const std::shared_ptr<ClientSession>& clientSession,
                                       const std::string& encodedFrom)
{
    // add batch mode, no interactive dialogs
    std::string load = "load url=" + encodedFrom + " batch=true";
    if (!getLang().empty())
        load += " lang=" + getLang();
    std::vector<char> loadRequest(load.begin(), load.end());
    clientSession->handleMessage(loadRequest);
}

void ExtractLinkTargetsBroker::sendStartMessage(const std::shared_ptr<ClientSession>& clientSession,
                                                const std::string& encodedFrom)
{
    ConvertToBroker::sendStartMessage(clientSession, encodedFrom);

    const auto command = "extractlinktargets url=" + encodedFrom;
    forwardToChild(clientSession, command);
}

void ExtractDocumentStructureBroker::sendStartMessage(
    const std::shared_ptr<ClientSession>& clientSession, const std::string& encodedFrom)
{
    ConvertToBroker::sendStartMessage(clientSession, encodedFrom);

    std::string command = "extractdocumentstructure url=" + encodedFrom;
    if (!_filter.empty())
        command += " filter=" + _filter;
    forwardToChild(clientSession, command);
}

void TransformDocumentStructureBroker::sendStartMessage(
    const std::shared_ptr<ClientSession>& clientSession, const std::string& encodedFrom)
{
    ConvertToBroker::sendStartMessage(clientSession, encodedFrom);

    const auto command =
        "transformdocumentstructure url=" + encodedFrom + " transform=" + _transformJSON;
    forwardToChild(clientSession, command);
}

void GetThumbnailBroker::sendStartMessage(const std::shared_ptr<ClientSession>& clientSession,
                                          const std::string& encodedFrom)
{
    clientSession->setThumbnailSession(true);
    clientSession->setThumbnailTarget(_target);

    ConvertToBroker::sendStartMessage(clientSession, encodedFrom);
}

void ConvertToBroker::dispose()
{
    if (!_uriOrig.empty())
    {
        gConvertToBrokerInstanceCouter--;
        removeFile(_uriOrig);
        _uriOrig.clear();
    }
}

void ConvertToBroker::setLoaded()
{
    DocumentBroker::setLoaded();

    if (isGetThumbnail())
        return;

    // FIXME: Check for security violations.
    Poco::Path toPath(getPublicUri().getPath());
    toPath.setExtension(_format);

    // file:///user/docs/filename.ext normally, file:///<jail-root>/user/docs/filename.ext in the nocaps case
    const std::string toJailURL = "file://" + (COOLWSD::NoCapsForKit ? getJailRoot() : "") +
                                  std::string(JAILED_DOCUMENT_ROOT) + toPath.getFileName();

    std::string encodedTo;
    Poco::URI::encode(toJailURL, "", encodedTo);

    // Convert it to the requested format.
    const std::string saveAsCmd =
        "saveas url=" + encodedTo + " format=" + _format + " options=" + _sOptions;

    // Send the save request ...
    std::vector<char> saveasRequest(saveAsCmd.begin(), saveAsCmd.end());

    _clientSession->handleMessage(saveasRequest);
}

static std::atomic<std::size_t> gRenderSearchResultBrokerInstanceCouter;

std::size_t RenderSearchResultBroker::getInstanceCount()
{
    return gRenderSearchResultBrokerInstanceCouter;
}

RenderSearchResultBroker::RenderSearchResultBroker(
    std::string const& uri, Poco::URI const& uriPublic, std::string const& docKey,
    std::shared_ptr<std::vector<char>> const& pSearchResultContent)
    : StatelessBatchBroker(uri, uriPublic, docKey)
    , _pSearchResultContent(pSearchResultContent)
{
    LOG_TRC("Created RenderSearchResultBroker: uri: ["
            << uri << "], uriPublic: [" << uriPublic.toString() << "], docKey: [" << docKey
            << "].");
    gConvertToBrokerInstanceCouter++;
}

RenderSearchResultBroker::~RenderSearchResultBroker() {}

bool RenderSearchResultBroker::executeCommand(SocketDisposition& disposition, std::string const& id)
{
    std::shared_ptr<RenderSearchResultBroker> docBroker =
        std::static_pointer_cast<RenderSearchResultBroker>(shared_from_this());

    const bool isReadOnly = true;

    std::shared_ptr<ProtocolHandlerInterface> emptyProtocolHandler;
    RequestDetails requestDetails("render-search-result");
    _clientSession = std::make_shared<ClientSession>(emptyProtocolHandler, id, docBroker,
                                                     getPublicUri(), isReadOnly, requestDetails);
    _clientSession->construct();

    docBroker->setupTransfer(
        disposition,
        [docBroker](std::shared_ptr<Socket> const& moveSocket)
        {
            docBroker->setResponseSocket(std::static_pointer_cast<StreamSocket>(moveSocket));

            // First add and load the session.
            docBroker->addSession(docBroker->_clientSession);

            // Load the document manually.
            std::string encodedFrom;
            Poco::URI::encode(docBroker->getPublicUri().getPath(), "", encodedFrom);
            // add batch mode, no interactive dialogs
            const std::string _load = "load url=" + encodedFrom + " batch=true";
            std::vector<char> loadRequest(_load.begin(), _load.end());
            docBroker->_clientSession->handleMessage(loadRequest);
        });

    return true;
}

void RenderSearchResultBroker::setLoaded()
{
    DocumentBroker::setLoaded();

    // Send the rendersearchresult request ...
    const std::string renderSearchResultCmd = "rendersearchresult ";
    std::vector<char> renderSearchResultRequest(renderSearchResultCmd.begin(),
                                                renderSearchResultCmd.end());
    renderSearchResultRequest.resize(renderSearchResultCmd.size() + _pSearchResultContent->size());
    std::copy(_pSearchResultContent->begin(), _pSearchResultContent->end(),
              renderSearchResultRequest.begin() + renderSearchResultCmd.size());
    _clientSession->handleMessage(renderSearchResultRequest);
}

void RenderSearchResultBroker::dispose()
{
    if (!_uriOrig.empty())
    {
        gRenderSearchResultBrokerInstanceCouter--;
        removeFile(_uriOrig);
        _uriOrig.clear();
    }
}

bool RenderSearchResultBroker::handleInput(const std::shared_ptr<Message>& message)
{
    bool bResult = DocumentBroker::handleInput(message);

    if (bResult)
    {
        auto const& messageData = message->data();

        static std::string commandString = "rendersearchresult:\n";
        static std::vector<char> commandStringVector(commandString.begin(), commandString.end());

        if (messageData.size() >= commandStringVector.size())
        {
            bool bEquals = std::equal(commandStringVector.begin(), commandStringVector.end(),
                                      messageData.begin());
            if (bEquals)
            {
                _aResposeData.resize(messageData.size() - commandStringVector.size());
                std::copy(messageData.begin() + commandStringVector.size(), messageData.end(),
                          _aResposeData.begin());

                http::Response httpResponse(http::StatusCode::OK);
                FileServerRequestHandler::hstsHeaders(httpResponse);
                // really not ideal that the response works only with std::string
                httpResponse.setBody(std::string(_aResposeData.data(), _aResposeData.size()),
                                     "image/png");
                httpResponse.header().setConnectionToken(http::Header::ConnectionToken::Close);
                _socket->sendAndShutdown(httpResponse);

                removeSession(_clientSession);
                stop("Finished RenderSearchResult handler.");
            }
        }
    }
    return bResult;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
