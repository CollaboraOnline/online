/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "ClientSession.hpp"

#include <fstream>
#include <sstream>
#include <memory>
#include <unordered_map>

#include <Poco/Net/HTTPResponse.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>

#include "DocumentBroker.hpp"
#include "LOOLWSD.hpp"
#include "Storage.hpp"
#include <common/Common.hpp>
#include <common/Log.hpp>
#include <common/Protocol.hpp>
#include <common/Clipboard.hpp>
#include <common/Session.hpp>
#include <common/Unit.hpp>
#include <common/Util.hpp>
#if !MOBILEAPP
#include <net/HttpHelper.hpp>
#endif
using namespace LOOLProtocol;

using Poco::Path;

// rotates regularly
const int ClipboardTokenLengthBytes = 16;
// home-use, disabled by default.
const int ProxyAccessTokenLengthBytes = 32;

static std::mutex GlobalSessionMapMutex;
static std::unordered_map<std::string, std::weak_ptr<ClientSession>> GlobalSessionMap;

ClientSession::ClientSession(
    const std::shared_ptr<ProtocolHandlerInterface>& ws,
    const std::string& id,
    const std::shared_ptr<DocumentBroker>& docBroker,
    const Poco::URI& uriPublic,
    const bool readOnly,
    const RequestDetails &requestDetails) :
    Session(ws, "ToClient-" + id, id, readOnly),
    _docBroker(docBroker),
    _uriPublic(uriPublic),
    _auth(Authorization::create(uriPublic)),
    _isDocumentOwner(false),
    _state(SessionState::DETACHED),
    _keyEvents(1),
    _clientVisibleArea(0, 0, 0, 0),
    _splitX(0),
    _splitY(0),
    _clientSelectedPart(-1),
    _tileWidthPixel(0),
    _tileHeightPixel(0),
    _tileWidthTwips(0),
    _tileHeightTwips(0),
    _kitViewId(-1),
    _serverURL(requestDetails),
    _isTextDocument(false)
{
    const std::size_t curConnections = ++LOOLWSD::NumConnections;
    LOG_INF("ClientSession ctor [" << getName() << "] for URI: [" << _uriPublic.toString()
                                   << "], current number of connections: " << curConnections);

    for (const auto& param : _uriPublic.getQueryParameters())
    {
        if (param.first == "reuse_cookies")
        {
            // Cache the cookies to avoid re-parsing the URI again.
            _cookies = param.second;
            LOG_INF("ClientSession [" << getName() << "] has cookies: [" << _cookies << "].");
            break;
        }
    }

    // populate with random values.
    for (auto it : _clipboardKeys)
        rotateClipboardKey(false);

    // get timestamp set
    setState(SessionState::DETACHED);
}

// Can't take a reference in the constructor.
void ClientSession::construct()
{
    std::unique_lock<std::mutex> lock(GlobalSessionMapMutex);
    MessageHandlerInterface::initialize();
    GlobalSessionMap[getId()] = client_from_this();
}

ClientSession::~ClientSession()
{
    const std::size_t curConnections = --LOOLWSD::NumConnections;
    LOG_INF("~ClientSession dtor [" << getName() << "], current number of connections: " << curConnections);

    std::unique_lock<std::mutex> lock(GlobalSessionMapMutex);
    GlobalSessionMap.erase(getId());
}

static const char *stateToString(ClientSession::SessionState s)
{
    switch (s)
    {
    case ClientSession::SessionState::DETACHED:        return "detached";
    case ClientSession::SessionState::LOADING:         return "loading";
    case ClientSession::SessionState::LIVE:            return "live";
    case ClientSession::SessionState::WAIT_DISCONNECT: return "wait_disconnect";
    }
    return "invalid";
}

void ClientSession::setState(SessionState newState)
{
    LOG_TRC("ClientSession: transition from " << stateToString(_state) <<
            " to " << stateToString(newState));

    // we can get incoming messages while our disconnection is in transit.
    if (_state == SessionState::WAIT_DISCONNECT)
    {
        if (newState != SessionState::WAIT_DISCONNECT)
            LOG_WRN("Unusual race - attempts to transition from " <<
                    stateToString(_state) << " to " <<
                    stateToString(newState));
        return;
    }

    switch (newState)
    {
    case SessionState::DETACHED:
        assert(_state == SessionState::DETACHED);
        break;
    case SessionState::LOADING:
        assert(_state == SessionState::DETACHED);
        break;
    case SessionState::LIVE:
        assert(_state == SessionState::LIVE ||
               _state == SessionState::LOADING);
        break;
    case SessionState::WAIT_DISCONNECT:
        assert(_state == SessionState::LOADING ||
               _state == SessionState::LIVE);
        break;
    }
    _state = newState;
    _lastStateTime = std::chrono::steady_clock::now();
}

bool ClientSession::disconnectFromKit()
{
    assert(_state != SessionState::WAIT_DISCONNECT);
    auto docBroker = getDocumentBroker();
    if (_state == SessionState::LIVE && docBroker)
    {
        setState(SessionState::WAIT_DISCONNECT);

#ifndef IOS
        LOG_TRC("request/rescue clipboard on disconnect for " << getId());
        // rescue clipboard before shutdown.
        docBroker->forwardToChild(getId(), "getclipboard");
#endif
        // handshake nicely; so wait for 'disconnected'
        docBroker->forwardToChild(getId(), "disconnect");

        return false;
    }

    return true; // just get on with it
}

// Allow 20secs for the clipboard and disconnection to come.
bool ClientSession::staleWaitDisconnect(const std::chrono::steady_clock::time_point &now)
{
    if (_state != SessionState::WAIT_DISCONNECT)
        return false;
    return std::chrono::duration_cast<std::chrono::seconds>(now - _lastStateTime).count() >= 20;
}

void ClientSession::rotateClipboardKey(bool notifyClient)
{
    if (_wopiFileInfo && _wopiFileInfo->getDisableCopy())
        return;

    if (_state == SessionState::WAIT_DISCONNECT)
        return;

    _clipboardKeys[1] = _clipboardKeys[0];
    _clipboardKeys[0] = Util::rng::getHardRandomHexString(
        ClipboardTokenLengthBytes);
    LOG_TRC("Clipboard key on [" << getId() << "] set to " << _clipboardKeys[0] <<
            " last was " << _clipboardKeys[1]);
    if (notifyClient)
        sendTextFrame("clipboardkey: " + _clipboardKeys[0]);
}

std::string ClientSession::getClipboardURI(bool encode)
{
    if (_wopiFileInfo && _wopiFileInfo->getDisableCopy())
        return std::string();

    std::string encodedFrom;
    Poco::URI wopiSrc = getDocumentBroker()->getPublicUri();
    wopiSrc.setQueryParameters(Poco::URI::QueryParameters());

    std::string encodeChars = ",/?:@&=+$#"; // match JS encodeURIComponent
    Poco::URI::encode(wopiSrc.toString(), encodeChars, encodedFrom);

    std::string meta = _serverURL.getSubURLForEndpoint(
        "/lool/clipboard?WOPISrc=" + encodedFrom +
        "&ServerId=" + Util::getProcessIdentifier() +
        "&ViewId=" + std::to_string(getKitViewId()) +
        "&Tag=" + _clipboardKeys[0]);

    if (!encode)
        return meta;

    std::string metaEncoded;
    Poco::URI::encode(meta, encodeChars, metaEncoded);

    return metaEncoded;
}

bool ClientSession::matchesClipboardKeys(const std::string &/*viewId*/, const std::string &tag)
{
    if (tag.empty())
    {
        LOG_ERR("Invalid, empty clipboard tag");
        return false;
    }

    // FIXME: check viewId for paranoia if we can.
    return std::any_of(std::begin(_clipboardKeys), std::end(_clipboardKeys),
                       [&tag](const std::string& it) { return it == tag; });
}


void ClientSession::handleClipboardRequest(DocumentBroker::ClipboardRequest     type,
                                           const std::shared_ptr<StreamSocket> &socket,
                                           const std::string                   &tag,
                                           const std::shared_ptr<std::string>  &data)
{
    // Move the socket into our DocBroker.
    auto docBroker = getDocumentBroker();
    docBroker->addSocketToPoll(socket);

    if (_state == SessionState::WAIT_DISCONNECT)
    {
        LOG_TRC("Clipboard request " << tag << " for disconnecting session");
        if (docBroker->lookupSendClipboardTag(socket, tag, false))
            return; // the getclipboard already completed.
        if (type == DocumentBroker::CLIP_REQUEST_SET)
        {
            #if !MOBILEAPP
            HttpHelper::sendErrorAndShutdown(400, socket);
            #endif
        }
        else // will be handled during shutdown
        {
            LOG_TRC("Clipboard request " << tag << " queued for shutdown");
            _clipSockets.push_back(socket);
        }
    }

    std::string specific;
    if (type == DocumentBroker::CLIP_REQUEST_GET_RICH_HTML_ONLY)
        specific = " text/html";

    if (type != DocumentBroker::CLIP_REQUEST_SET)
    {
        LOG_TRC("Session [" << getId() << "] sending getclipboard" + specific);
        docBroker->forwardToChild(getId(), "getclipboard" + specific);
        _clipSockets.push_back(socket);
    }
    else // REQUEST_SET
    {
        // FIXME: manage memory more efficiently.
        LOG_TRC("Session [" << getId() << "] sending setclipboard");
        if (data.get())
        {
            docBroker->forwardToChild(getId(), "setclipboard\n" + *data);

            // FIXME: work harder for error detection ?
            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                << "Date: " << Util::getHttpTimeNow() << "\r\n"
                << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
                << "Content-Length: 0\r\n"
                << "\r\n";
            socket->send(oss.str());
            socket->shutdown();
        }
        else
        {
            #if !MOBILEAPP
            HttpHelper::sendErrorAndShutdown(400, socket);
            #endif
        }
    }
}

bool ClientSession::_handleInput(const char *buffer, int length)
{
    LOG_TRC(getName() << ": handling incoming [" << getAbbreviatedMessage(buffer, length) << "].");
    const std::string firstLine = getFirstLine(buffer, length);
    const StringVector tokens = Util::tokenize(firstLine.data(), firstLine.size());

    std::shared_ptr<DocumentBroker> docBroker = getDocumentBroker();
    if (!docBroker || docBroker->isMarkedToDestroy())
    {
        LOG_ERR("No DocBroker found, or DocBroker marked to be destroyed. Terminating session " << getName());
        return false;
    }

    if (tokens.size() < 1)
    {
        sendTextFrameAndLogError("error: cmd=empty kind=unknown");
        return false;
    }

    if (tokens.equals(0, "DEBUG"))
    {
        LOG_DBG("From client: " << std::string(buffer, length).substr(strlen("DEBUG") + 1));
        return false;
    }
    else if (tokens.equals(0, "ERROR"))
    {
        LOG_ERR("From client: " << std::string(buffer, length).substr(strlen("ERROR") + 1));
        return false;
    }

    LOOLWSD::dumpIncomingTrace(docBroker->getJailId(), getId(), firstLine);

    if (LOOLProtocol::tokenIndicatesUserInteraction(tokens[0]))
    {
        // Keep track of timestamps of incoming client messages that indicate user activity.
        updateLastActivityTime();
        docBroker->updateLastActivityTime();
    }
    if (tokens.equals(0, "loolclient"))
    {
        if (tokens.size() < 2)
        {
            sendTextFrameAndLogError("error: cmd=loolclient kind=badprotocolversion");
            return false;
        }

        const std::tuple<int, int, std::string> versionTuple = ParseVersion(tokens[1]);
        if (std::get<0>(versionTuple) != ProtocolMajorVersionNumber ||
            std::get<1>(versionTuple) != ProtocolMinorVersionNumber)
        {
            sendTextFrameAndLogError("error: cmd=loolclient kind=badprotocolversion");
            return false;
        }

        // Send LOOL version information
        sendTextFrame("loolserver " + Util::getVersionJSON());
        // Send LOKit version information
        sendTextFrame("lokitversion " + LOOLWSD::LOKitVersion);

        #if !MOBILEAPP
            // If it is not mobile, it must be Linux (for now).
            sendTextFrame(std::string("osinfo ") + Util::getLinuxVersion());
        #endif

        // Send clipboard key
        rotateClipboardKey(true);

        return true;
    }

    if (tokens.equals(0, "jserror"))
    {
        LOG_ERR(std::string(buffer, length));
        return true;
    }
    else if (tokens.equals(0, "load"))
    {
        if (getDocURL() != "")
        {
            sendTextFrameAndLogError("error: cmd=load kind=docalreadyloaded");
            return false;
        }

        return loadDocument(buffer, length, tokens, docBroker);
    }
    else if (tokens.equals(0, "loadwithpassword"))
    {
        std::string docPassword;
        if (tokens.size() > 1 && getTokenString(tokens[1], "password", docPassword))
        {
            if (!docPassword.empty())
            {
                setHaveDocPassword(true);
                setDocPassword(docPassword);
            }
        }
        return loadDocument(buffer, length, tokens, docBroker);
    }
    else if (getDocURL().empty())
    {
        sendTextFrameAndLogError("error: cmd=" + tokens[0] + " kind=nodocloaded");
        return false;
    }
    else if (tokens.equals(0, "canceltiles"))
    {
        docBroker->cancelTileRequests(client_from_this());
        return true;
    }
    else if (tokens.equals(0, "commandvalues"))
    {
        return getCommandValues(buffer, length, tokens, docBroker);
    }
    else if (tokens.equals(0, "closedocument"))
    {
        // If this session is the owner of the file & 'EnableOwnerTermination' feature
        // is turned on by WOPI, let it close all sessions
        if (isDocumentOwner() && _wopiFileInfo && _wopiFileInfo->getEnableOwnerTermination())
        {
            LOG_DBG("Session [" << getId() << "] requested owner termination");
            docBroker->closeDocument("ownertermination");
        }
        else if (docBroker->isDocumentChangedInStorage())
        {
            LOG_DBG("Document marked as changed in storage and user ["
                    << getUserId() << ", " << getUserName()
                    << "] wants to refresh the document for all.");
            docBroker->stop("documentconflict " + getUserName());
        }

        return true;
    }
    else if (tokens.equals(0, "versionrestore"))
    {
        if (tokens.size() > 1 && tokens.equals(1, "prerestore"))
        {
            // green signal to WOPI host to restore the version *after* saving
            // any unsaved changes, if any, to the storage
            docBroker->closeDocument("versionrestore: prerestore_ack");
        }
    }
    else if (tokens.equals(0, "partpagerectangles"))
    {
        // We don't support partpagerectangles any more, will be removed in the
        // next version
        sendTextFrame("partpagerectangles: ");
        return true;
    }
    else if (tokens.equals(0, "ping"))
    {
        std::string count = std::to_string(docBroker->getRenderedTileCount());
        sendTextFrame("pong rendercount=" + count);
        return true;
    }
    else if (tokens.equals(0, "renderfont"))
    {
        return sendFontRendering(buffer, length, tokens, docBroker);
    }
    else if (tokens.equals(0, "status") || tokens.equals(0, "statusupdate"))
    {
        assert(firstLine.size() == static_cast<std::size_t>(length));
        return forwardToChild(firstLine, docBroker);
    }
    else if (tokens.equals(0, "tile"))
    {
        return sendTile(buffer, length, tokens, docBroker);
    }
    else if (tokens.equals(0, "tilecombine"))
    {
        return sendCombinedTiles(buffer, length, tokens, docBroker);
    }
    else if (tokens.equals(0, "save"))
    {
        if (isReadOnly() && !isAllowChangeComments())
        {
            LOG_WRN("The document is read-only, cannot save.");
        }
        else
        {
            int dontTerminateEdit = 1;
            if (tokens.size() > 1)
                getTokenInteger(tokens[1], "dontTerminateEdit", dontTerminateEdit);

            // Don't save unmodified docs by default.
            int dontSaveIfUnmodified = 1;
            if (tokens.size() > 2)
                getTokenInteger(tokens[2], "dontSaveIfUnmodified", dontSaveIfUnmodified);

            std::string extendedData;
            if (tokens.size() > 3)
            {
                getTokenString(tokens[3], "extendedData", extendedData);
                std::string decoded;
                Poco::URI::decode(extendedData, decoded);
                extendedData = decoded;
            }

            constexpr bool isAutosave = false;
            constexpr bool isExitSave = false;
            docBroker->sendUnoSave(getId(), dontTerminateEdit != 0, dontSaveIfUnmodified != 0,
                                    isAutosave, isExitSave, extendedData);
        }
    }
    else if (tokens.equals(0, "savetostorage"))
    {
        // By default savetostorage implies forcing.
        int force = 1;
        if (tokens.size() > 1)
            getTokenInteger(tokens[1], "force", force);

        // The savetostorage command is really only used to resolve save conflicts
        // and it seems to always have force=1. However, we should still honor the
        // contract and do as told, not as we expect the API to be used. Use force if provided.
        docBroker->uploadToStorage(getId(), true, "" /* This is irrelevant when success is true*/, force);
    }
    else if (tokens.equals(0, "clientvisiblearea"))
    {
        int x;
        int y;
        int width;
        int height;
        if ((tokens.size() != 5 && tokens.size() != 7) ||
            !getTokenInteger(tokens[1], "x", x) ||
            !getTokenInteger(tokens[2], "y", y) ||
            !getTokenInteger(tokens[3], "width", width) ||
            !getTokenInteger(tokens[4], "height", height))
        {
            // Be forgiving and log instead of disconnecting.
            // sendTextFrameAndLogError("error: cmd=clientvisiblearea kind=syntax");
            LOG_WRN("Invalid syntax for '" << tokens[0] << "' message: [" << firstLine << "].");
            return true;
        }
        else
        {
            if (tokens.size() == 7)
            {
                int splitX, splitY;
                if (!getTokenInteger(tokens[5], "splitx", splitX) ||
                    !getTokenInteger(tokens[6], "splity", splitY))
                {
                    LOG_WRN("Invalid syntax for '" << tokens[0] << "' message: [" << firstLine << "].");
                    return true;
                }

                _splitX = splitX;
                _splitY = splitY;
            }

            _clientVisibleArea = Util::Rectangle(x, y, width, height);
            resetWireIdMap();
            return forwardToChild(std::string(buffer, length), docBroker);
        }
    }
    else if (tokens.equals(0, "setclientpart"))
    {
        if(!_isTextDocument)
        {
            int temp;
            if (tokens.size() != 2 ||
                !getTokenInteger(tokens[1], "part", temp))
            {
                sendTextFrameAndLogError("error: cmd=setclientpart kind=syntax");
                return false;
            }
            else
            {
                _clientSelectedPart = temp;
                resetWireIdMap();
                return forwardToChild(std::string(buffer, length), docBroker);
            }
        }
    }
    else if (tokens.equals(0, "selectclientpart"))
    {
        if(!_isTextDocument)
        {
            int part;
            int how;
            if (tokens.size() != 3 ||
                !getTokenInteger(tokens[1], "part", part) ||
                !getTokenInteger(tokens[2], "how", how))
            {
                sendTextFrameAndLogError("error: cmd=selectclientpart kind=syntax");
                return false;
            }
            else
            {
                return forwardToChild(std::string(buffer, length), docBroker);
            }
        }
    }
    else if (tokens.equals(0, "moveselectedclientparts"))
    {
        if(!_isTextDocument)
        {
            int nPosition;
            if (tokens.size() != 2 ||
                !getTokenInteger(tokens[1], "position", nPosition))
            {
                sendTextFrameAndLogError("error: cmd=moveselectedclientparts kind=syntax");
                return false;
            }
            else
            {
                return forwardToChild(std::string(buffer, length), docBroker);
            }
        }
    }
    else if (tokens.equals(0, "clientzoom"))
    {
        int tilePixelWidth, tilePixelHeight, tileTwipWidth, tileTwipHeight;
        if (tokens.size() != 5 ||
            !getTokenInteger(tokens[1], "tilepixelwidth", tilePixelWidth) ||
            !getTokenInteger(tokens[2], "tilepixelheight", tilePixelHeight) ||
            !getTokenInteger(tokens[3], "tiletwipwidth", tileTwipWidth) ||
            !getTokenInteger(tokens[4], "tiletwipheight", tileTwipHeight))
        {
            // Be forgiving and log instead of disconnecting.
            // sendTextFrameAndLogError("error: cmd=clientzoom kind=syntax");
            LOG_WRN("Invalid syntax for '" << tokens[0] << "' message: [" << firstLine << "].");
            return true;
        }
        else
        {
            _tileWidthPixel = tilePixelWidth;
            _tileHeightPixel = tilePixelHeight;
            _tileWidthTwips = tileTwipWidth;
            _tileHeightTwips = tileTwipHeight;
            resetWireIdMap();
            return forwardToChild(std::string(buffer, length), docBroker);
        }
    }
    else if (tokens.equals(0, "tileprocessed"))
    {
        std::string tileID;
        if (tokens.size() != 2 ||
            !getTokenString(tokens[1], "tile", tileID))
        {
            // Be forgiving and log instead of disconnecting.
            // sendTextFrameAndLogError("error: cmd=tileprocessed kind=syntax");
            LOG_WRN("Invalid syntax for '" << tokens[0] << "' message: [" << firstLine << "].");
            return true;
        }

        auto iter = std::find_if(_tilesOnFly.begin(), _tilesOnFly.end(),
        [&tileID](const std::pair<std::string, std::chrono::steady_clock::time_point>& curTile)
        {
            return curTile.first == tileID;
        });

        if(iter != _tilesOnFly.end())
            _tilesOnFly.erase(iter);
        else
            LOG_INF("Tileprocessed message with an unknown tile ID");

        docBroker->sendRequestedTiles(client_from_this());
        return true;
    }
    else if (tokens.equals(0, "removesession")) {
        if (tokens.size() > 1 && (_isDocumentOwner || !isReadOnly()))
        {
            std::string sessionId = Util::encodeId(std::stoi(tokens[1]), 4);
            docBroker->broadcastMessage(firstLine);
            docBroker->removeSession(sessionId);
        }
        else
            LOG_WRN("Readonly session '" << getId() << "' trying to kill another view");
    }
    else if (tokens.equals(0, "renamefile"))
    {
        std::string encodedWopiFilename;
        if (tokens.size() < 2 || !getTokenString(tokens[1], "filename", encodedWopiFilename))
        {
            LOG_ERR("Bad syntax for: " << firstLine);
            sendTextFrameAndLogError("error: cmd=renamefile kind=syntax");
            return false;
        }
        std::string wopiFilename;
        Poco::URI::decode(encodedWopiFilename, wopiFilename);
        docBroker->uploadAsToStorage(getId(), "", wopiFilename, true);
        return true;
    }
    else if (tokens.equals(0, "dialogevent") || tokens.equals(0, "formfieldevent"))
    {
        return forwardToChild(firstLine, docBroker);
    }
    else if (tokens.equals(0, "completefunction"))
    {
        return forwardToChild(std::string(buffer, length), docBroker);
    }
    else if (tokens[0] == "outlinestate" ||
             tokens[0] == "downloadas" ||
             tokens[0] == "getchildid" ||
             tokens[0] == "gettextselection" ||
             tokens[0] == "paste" ||
             tokens[0] == "insertfile" ||
             tokens[0] == "key" ||
             tokens[0] == "textinput" ||
             tokens[0] == "windowkey" ||
             tokens[0] == "mouse" ||
             tokens[0] == "windowmouse" ||
             tokens[0] == "windowgesture" ||
             tokens[0] == "requestloksession" ||
             tokens[0] == "resetselection" ||
             tokens[0] == "saveas" ||
             tokens[0] == "selectgraphic" ||
             tokens[0] == "selecttext" ||
             tokens[0] == "windowselecttext" ||
             tokens[0] == "setpage" ||
             tokens[0] == "uno" ||
             tokens[0] == "useractive" ||
             tokens[0] == "userinactive" ||
             tokens[0] == "paintwindow" ||
             tokens[0] == "windowcommand" ||
             tokens[0] == "signdocument" ||
             tokens[0] == "asksignaturestatus" ||
             tokens[0] == "uploadsigneddocument" ||
             tokens[0] == "exportsignanduploaddocument" ||
             tokens[0] == "rendershapeselection" ||
             tokens[0] == "resizewindow" ||
             tokens[0] == "removetextcontext")
    {
        if (tokens.equals(0, "key"))
            _keyEvents++;

        if (!filterMessage(firstLine))
        {
            const std::string dummyFrame = "dummymsg";
            return forwardToChild(dummyFrame, docBroker);
        }
        else if (tokens[0] != "requestloksession")
        {
            return forwardToChild(std::string(buffer, length), docBroker);
        }
        else
        {
            assert(tokens.equals(0, "requestloksession"));
            return true;
        }
    }
    else if (tokens.equals(0, "attemptlock"))
    {
        return attemptLock(docBroker);
    }
    else
    {
        LOG_ERR("Session [" << getId() << "] got unknown command [" << tokens[0] << "].");
        sendTextFrameAndLogError("error: cmd=" + tokens[0] + " kind=unknown");
    }

    return false;
}

bool ClientSession::loadDocument(const char* /*buffer*/, int /*length*/,
                                 const StringVector& tokens,
                                 const std::shared_ptr<DocumentBroker>& docBroker)
{
    if (tokens.size() < 2)
    {
        // Failed loading ends connection.
        sendTextFrameAndLogError("error: cmd=load kind=syntax");
        return false;
    }

    _viewLoadStart = std::chrono::steady_clock::now();
    LOG_INF("Requesting document load from child.");
    try
    {
        std::string timestamp, doctemplate;
        int loadPart = -1;
        parseDocOptions(tokens, loadPart, timestamp, doctemplate);

        std::ostringstream oss;
        oss << "load url=" << docBroker->getPublicUri().toString();

        if (!getUserId().empty() && !getUserName().empty())
        {
            std::string encodedUserId;
            Poco::URI::encode(getUserId(), "", encodedUserId);
            oss << " authorid=" << encodedUserId;
            encodedUserId = "";
            Poco::URI::encode(LOOLWSD::anonymizeUsername(getUserId()), "", encodedUserId);
            oss << " xauthorid=" << encodedUserId;

            std::string encodedUserName;
            Poco::URI::encode(getUserName(), "", encodedUserName);
            oss << " author=" << encodedUserName;
            encodedUserName = "";
            Poco::URI::encode(LOOLWSD::anonymizeUsername(getUserName()), "", encodedUserName);
            oss << " xauthor=" << encodedUserName;
        }

        if (!getUserExtraInfo().empty())
        {
            std::string encodedUserExtraInfo;
            Poco::URI::encode(getUserExtraInfo(), "", encodedUserExtraInfo);
            oss << " authorextrainfo=" << encodedUserExtraInfo; //TODO: could this include PII?
        }

        oss << " readonly=" << isReadOnly();

        if (loadPart >= 0)
        {
            oss << " part=" << loadPart;
        }

        if (getHaveDocPassword())
        {
            oss << " password=" << getDocPassword();
        }

        if (!getLang().empty())
        {
            oss << " lang=" << getLang();
        }

        if (!getDeviceFormFactor().empty())
        {
            oss << " deviceFormFactor=" << getDeviceFormFactor();
        }

        if (!getSpellOnline().empty())
        {
            oss << " spellOnline=" << getSpellOnline();
        }

        if (!getWatermarkText().empty())
        {
            std::string encodedWatermarkText;
            Poco::URI::encode(getWatermarkText(), "", encodedWatermarkText);
            oss << " watermarkText=" << encodedWatermarkText;
            oss << " watermarkOpacity=" << LOOLWSD::getConfigValue<double>("watermark.opacity", 0.2);
        }

        if (!getDocOptions().empty())
        {
            oss << " options=" << getDocOptions();
        }

        if (_wopiFileInfo && !_wopiFileInfo->getTemplateSource().empty())
        {
            oss << " template=" << _wopiFileInfo->getTemplateSource();
        }

        return forwardToChild(oss.str(), docBroker);
    }
    catch (const Poco::SyntaxException&)
    {
        sendTextFrameAndLogError("error: cmd=load kind=uriinvalid");
    }

    return false;
}

bool ClientSession::getCommandValues(const char *buffer, int length, const StringVector& tokens,
                                     const std::shared_ptr<DocumentBroker>& docBroker)
{
    std::string command;
    if (tokens.size() != 2 || !getTokenString(tokens[1], "command", command))
        return sendTextFrameAndLogError("error: cmd=commandvalues kind=syntax");

    std::string cmdValues;
    if (docBroker->tileCache().getTextStream(TileCache::StreamType::CmdValues, command, cmdValues))
        return sendTextFrame(cmdValues);

    return forwardToChild(std::string(buffer, length), docBroker);
}

bool ClientSession::sendFontRendering(const char *buffer, int length, const StringVector& tokens,
                                      const std::shared_ptr<DocumentBroker>& docBroker)
{
    std::string font, text;
    if (tokens.size() < 2 ||
        !getTokenString(tokens[1], "font", font))
    {
        return sendTextFrameAndLogError("error: cmd=renderfont kind=syntax");
    }

    getTokenString(tokens[2], "char", text);

    if (docBroker->hasTileCache())
    {
        TileCache::Tile cachedTile = docBroker->tileCache().lookupCachedStream(TileCache::StreamType::Font, font+text);
        if (cachedTile)
        {
            const std::string response = "renderfont: " + tokens.cat(' ', 1) + '\n';
            return sendTile(response, cachedTile);
        }
    }

    return forwardToChild(std::string(buffer, length), docBroker);
}

bool ClientSession::sendTile(const char * /*buffer*/, int /*length*/, const StringVector& tokens,
                             const std::shared_ptr<DocumentBroker>& docBroker)
{
    try
    {
        docBroker->handleTileRequest(tokens, client_from_this());
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to process tile command: " << exc.what());
        return sendTextFrameAndLogError("error: cmd=tile kind=invalid");
    }

    return true;
}

bool ClientSession::sendCombinedTiles(const char* /*buffer*/, int /*length*/, const StringVector& tokens,
                                      const std::shared_ptr<DocumentBroker>& docBroker)
{
    try
    {
        TileCombined tileCombined = TileCombined::parse(tokens);
        tileCombined.setNormalizedViewId(getCanonicalViewId());
        docBroker->handleTileCombinedRequest(tileCombined, client_from_this());
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to process tilecombine command: " << exc.what());
        // Be forgiving and log instead of disconnecting.
        // return sendTextFrameAndLogError("error: cmd=tile kind=invalid");
    }

    return true;
}

bool ClientSession::forwardToChild(const std::string& message,
                                   const std::shared_ptr<DocumentBroker>& docBroker)
{
    return docBroker->forwardToChild(getId(), message);
}

bool ClientSession::filterMessage(const std::string& message) const
{
    bool allowed = true;
    StringVector tokens(Util::tokenize(message, ' '));

    // Set allowed flag to false depending on if particular WOPI properties are set
    if (tokens.equals(0, "downloadas"))
    {
        std::string id;
        if (tokens.size() >= 3 && getTokenString(tokens[2], "id", id))
        {
            if (id == "print" && _wopiFileInfo && _wopiFileInfo->getDisablePrint())
            {
                allowed = false;
                LOG_WRN("WOPI host has disabled print for this session");
            }
            else if (id == "export" && _wopiFileInfo && _wopiFileInfo->getDisableExport())
            {
                allowed = false;
                LOG_WRN("WOPI host has disabled export for this session");
            }
        }
        else
        {
            allowed = false;
            LOG_WRN("No value of id in downloadas message");
        }
    }
    else if (tokens.equals(0, "gettextselection") || tokens.equals(0, ".uno:Copy"))
    {
        if (_wopiFileInfo && _wopiFileInfo->getDisableCopy())
        {
            allowed = false;
            LOG_WRN("WOPI host has disabled copying from the document");
        }
    }
    else if (isReadOnly())
    {
        // By default, don't allow anything
        allowed = false;
        if (tokens.equals(0, "userinactive") || tokens.equals(0, "useractive") || tokens.equals(0, "saveas"))
        {
            allowed = true;
        }
        else if (tokens.equals(0, "uno"))
        {
            if (tokens.size() > 1 && (tokens.equals(1, ".uno:ExecuteSearch")))
            {
                allowed = true;
            }

            if (isAllowChangeComments()
                && tokens.size() > 1
                && (tokens.equals(1, ".uno:EditAnnotation")
                    || tokens.equals(1, ".uno:InsertAnnotation")
                    || tokens.equals(1, ".uno:DeleteAnnotation")))
            {
                allowed = true;
            }
        }
    }

    return allowed;
}

void ClientSession::setReadOnly(bool bVal)
{
    Session::setReadOnly(bVal);
    // Also inform the client
    const std::string sPerm = bVal ? "readonly" : "edit";
    sendTextFrame("perm: " + sPerm);
}

void ClientSession::setLockFailed(const std::string& sReason)
{
    _isLockFailed = true;
    setReadOnly();
    sendTextFrame("lockfailed:" + sReason);
}

bool ClientSession::attemptLock(const std::shared_ptr<DocumentBroker>& docBroker)
{
    if (!isReadOnly())
        return true;
    // We are only allowed to change into edit mode if the read-only mode is because of failed lock
    if (!_isLockFailed)
        return false;

    std::string failReason;
    const bool bResult = docBroker->attemptLock(*this, failReason);
    if (bResult)
        setReadOnly(false);
    else
        sendTextFrame("lockfailed:" + failReason);

    return bResult;
}

bool ClientSession::hasQueuedMessages() const
{
    return _senderQueue.size() > 0;
}

    /// Please send them to me then.
void ClientSession::writeQueuedMessages()
{
    LOG_TRC(getName() << " ClientSession: performing writes.");

    std::shared_ptr<Message> item;
    if (_senderQueue.dequeue(item))
    {
        try
        {
            const std::vector<char>& data = item->data();
            if (item->isBinary())
            {
                Session::sendBinaryFrame(data.data(), data.size());
            }
            else
            {
                Session::sendTextFrame(data.data(), data.size());
            }
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Failed to send message " << item->abbr() <<
                    " to " << getName() << ": " << ex.what());
        }
    }

    LOG_TRC(getName() << " ClientSession: performed write.");
}

// NB. also see loleaflet/src/map/Clipboard.js that does this in JS for stubs.
void ClientSession::postProcessCopyPayload(const std::shared_ptr<Message>& payload)
{
    // Insert our meta origin if we can
    payload->rewriteDataBody([=](std::vector<char>& data) {
            std::size_t pos = Util::findInVector(data, "<meta name=\"generator\" content=\"");

            if (pos == std::string::npos)
                pos = Util::findInVector(data, "<meta http-equiv=\"content-type\" content=\"text/html;");

            // cf. TileLayer.js /_dataTransferToDocument/
            if (pos != std::string::npos) // assume text/html
            {
                const std::string meta = getClipboardURI();
                LOG_TRC("Inject clipboard meta origin of '" << meta << '\'');
                const std::string origin = "<meta name=\"origin\" content=\"" + meta + "\"/>\n";
                data.insert(data.begin() + pos, origin.begin(), origin.end());
                return true;
            }
            else
            {
                LOG_DBG("Missing generator in textselectioncontent/clipboardcontent payload.");
                return false;
            }
        });
}

bool ClientSession::handleKitToClientMessage(const char* buffer, const int length)
{
    const auto payload = std::make_shared<Message>(buffer, length, Message::Dir::Out);

    LOG_TRC(getName() << ": handling kit-to-client [" << payload->abbr() << "].");
    const std::string& firstLine = payload->firstLine();

    const std::shared_ptr<DocumentBroker> docBroker = _docBroker.lock();
    if (!docBroker)
    {
        LOG_ERR("No DocBroker to handle kit-to-client message: " << firstLine);
        return false;
    }

    const bool isConvertTo = static_cast<bool>(_saveAsSocket);

#if !MOBILEAPP
    LOOLWSD::dumpOutgoingTrace(docBroker->getJailId(), getId(), firstLine);
#endif

    const auto& tokens = payload->tokens();
    if (tokens[0] == "unocommandresult:")
    {
        const std::string stringMsg(buffer, length);
        LOG_INF(getName() << ": Command: " << stringMsg);
        const std::size_t index = stringMsg.find_first_of('{');
        if (index != std::string::npos)
        {
            const std::string stringJSON = stringMsg.substr(index);
            Poco::JSON::Parser parser;
            const Poco::Dynamic::Var parsedJSON = parser.parse(stringJSON);
            const auto& object = parsedJSON.extract<Poco::JSON::Object::Ptr>();
            if (object->get("commandName").toString() == ".uno:Save")
            {
                const bool success = object->get("success").toString() == "true";
                std::string result;
                if (object->has("result"))
                {
                    const Poco::Dynamic::Var parsedResultJSON = object->get("result");
                    const auto& resultObj = parsedResultJSON.extract<Poco::JSON::Object::Ptr>();
                    if (resultObj->get("type").toString() == "string")
                        result = resultObj->get("value").toString();
                }

                // Save to Storage and log result.
                docBroker->handleSaveResponse(getId(), success, result);

                if (!isCloseFrame())
                    forwardToClient(payload);

                return true;
            }
        }
        else
        {
            LOG_WRN("Expected json unocommandresult. Ignoring: " << stringMsg);
        }
    }
    else if (tokens[0] == "error:")
    {
        std::string errorCommand;
        std::string errorKind;
        if (getTokenString(tokens[1], "cmd", errorCommand) &&
            getTokenString(tokens[2], "kind", errorKind) )
        {
            if (errorCommand == "load")
            {
                LOG_WRN("Document load failed: " << errorKind);
                if (errorKind == "passwordrequired:to-view" ||
                    errorKind == "passwordrequired:to-modify" ||
                    errorKind == "wrongpassword")
                {
                    if (isConvertTo)
                    {
                        Poco::Net::HTTPResponse response;
                        response.setStatusAndReason(Poco::Net::HTTPResponse::HTTP_UNAUTHORIZED);
                        response.set("X-ERROR-KIND", errorKind);
                        _saveAsSocket->send(response);

                        // Conversion failed, cleanup fake session.
                        LOG_TRC("Removing save-as ClientSession after conversion error.");
                        // Remove us.
                        docBroker->removeSession(getId());
                        // Now terminate.
                        docBroker->stop("Aborting saveas handler.");
                    }
                    else
                    {
                        forwardToClient(payload);
                    }
                    return false;
                }
            }
            else
            {
                LOG_WRN(errorCommand << " error failure: " << errorKind);
            }
        }
    }
    else if (tokens[0] == "curpart:" && tokens.size() == 2)
    {
        //TODO: Should forward to client?
        int curPart;
        return getTokenInteger(tokens[1], "part", curPart);
    }
    else if (tokens[0] == "setpart:" && tokens.size() == 2)
    {
        if(!_isTextDocument)
        {
            int setPart;
            if(getTokenInteger(tokens[1], "part", setPart))
            {
                _clientSelectedPart = setPart;
                resetWireIdMap();
            }
            else if (stringToInteger(tokens[1], setPart))
            {
                _clientSelectedPart = setPart;
                resetWireIdMap();
            }
            else
                return false;
         }
    }
#if !MOBILEAPP
    else if (tokens.size() == 3 && tokens[0] == "saveas:")
    {

        std::string encodedURL;
        if (!getTokenString(tokens[1], "url", encodedURL))
        {
            LOG_ERR("Bad syntax for: " << firstLine);
            // we must not return early with convert-to so that we clean up
            // the session
            if (!isConvertTo)
            {
                sendTextFrameAndLogError("error: cmd=saveas kind=syntax");
                return false;
            }
        }

        std::string encodedWopiFilename;
        if (!isConvertTo && !getTokenString(tokens[2], "filename", encodedWopiFilename))
        {
            LOG_ERR("Bad syntax for: " << firstLine);
            sendTextFrameAndLogError("error: cmd=saveas kind=syntax");
            return false;
        }

        // Save-as completed, inform the ClientSession.
        std::string wopiFilename;
        Poco::URI::decode(encodedWopiFilename, wopiFilename);

        // URI constructor implicitly decodes when it gets std::string as param
        Poco::URI resultURL(encodedURL);

        // Prepend the jail path in the normal (non-nocaps) case
        if (resultURL.getScheme() == "file" && !LOOLWSD::NoCapsForKit)
        {
            std::string relative;
            if (isConvertTo)
                Poco::URI::decode(resultURL.getPath(), relative);
            else
                relative = resultURL.getPath();

            if (relative.size() > 0 && relative[0] == '/')
                relative = relative.substr(1);

            // Rewrite file:// URLs to be visible to the outside world.
            const Path path(docBroker->getJailRoot(), relative);
            if (Poco::File(path).exists())
            {
                if (!isConvertTo)
                {
                    // Encode path for special characters (i.e '%') since Poco::URI::setPath implicitly decodes the input param
                    std::string encodedPath;
                    Poco::URI::encode(path.toString(), "", encodedPath);

                    resultURL.setPath(encodedPath);
                }
                else
                {
                    resultURL.setPath(path.toString());
                }
            }
            else
            {
                // Blank for failure.
                LOG_DBG("SaveAs produced no output in '" << path.toString() << "', producing blank url.");
                resultURL.clear();
            }
        }

        LOG_TRC("Save-as URL: " << resultURL.toString());

        if (!isConvertTo)
        {
            // Normal SaveAs - save to Storage and log result.
            if (resultURL.getScheme() == "file" && !resultURL.getPath().empty())
            {
                // this also sends the saveas: result
                LOG_TRC("Save-as path: " << resultURL.getPath());
                docBroker->uploadAsToStorage(getId(), resultURL.getPath(), wopiFilename, false);
            }
            else
                sendTextFrameAndLogError("error: cmd=storage kind=savefailed");
        }
        else
        {
            // using the convert-to REST API
            // TODO: Send back error when there is no output.
            if (!resultURL.getPath().empty())
            {
                const std::string mimeType = "application/octet-stream";
                LOG_TRC("Sending file: " << resultURL.getPath());

                const std::string fileName = Poco::Path(resultURL.getPath()).getFileName();
                Poco::Net::HTTPResponse response;
                if (!fileName.empty())
                    response.set("Content-Disposition", "attachment; filename=\"" + fileName + '"');

                HttpHelper::sendFileAndShutdown(_saveAsSocket, resultURL.getPath(), mimeType, &response);
            }

            // Conversion is done, cleanup this fake session.
            LOG_TRC("Removing save-as ClientSession after conversion.");

            // Remove us.
            docBroker->removeSession(getId());

            // Now terminate.
            docBroker->stop("Finished saveas handler.");
        }

        return true;
    }
#endif
    else if (tokens.size() == 2 && tokens.equals(0, "statechanged:"))
    {
        StringVector stateTokens(Util::tokenize(tokens[1], '='));
        if (stateTokens.size() == 2 && stateTokens.equals(0, ".uno:ModifiedStatus"))
        {
            // When the document is saved internally, but saving to storage failed,
            // don't update the client's modified status
            // (otherwise client thinks document is unmodified b/c saving was successful)
            if (!docBroker->isLastStorageUploadSuccessful())
                return false;

            docBroker->setModified(stateTokens.equals(1, "true"));
        }
        else
        {
            // Set the initial settings per the user's request.
            const std::pair<std::string, std::string> unoStatePair = Util::split(tokens[1], '=');

            if (!docBroker->isInitialSettingSet(unoStatePair.first))
            {
                docBroker->setInitialSetting(unoStatePair.first);
                if (unoStatePair.first == ".uno:TrackChanges")
                {
                    if ((unoStatePair.second == "true" &&
                         _wopiFileInfo && _wopiFileInfo->getDisableChangeTrackingRecord() == WopiStorage::WOPIFileInfo::TriState::True) ||
                        (unoStatePair.second == "false" &&
                         _wopiFileInfo && _wopiFileInfo->getDisableChangeTrackingRecord() == WopiStorage::WOPIFileInfo::TriState::False))
                    {
                        // Toggle the TrackChanges state.
                        LOG_DBG("Forcing " << unoStatePair.first << " toggle per user settings.");
                        forwardToChild("uno .uno:TrackChanges", docBroker);
                    }
                }
                else if (unoStatePair.first == ".uno:ShowTrackedChanges")
                {
                    if ((unoStatePair.second == "true" &&
                         _wopiFileInfo && _wopiFileInfo->getDisableChangeTrackingShow() == WopiStorage::WOPIFileInfo::TriState::True) ||
                        (unoStatePair.second == "false" &&
                         _wopiFileInfo && _wopiFileInfo->getDisableChangeTrackingShow() == WopiStorage::WOPIFileInfo::TriState::False))
                    {
                        // Toggle the ShowTrackChanges state.
                        LOG_DBG("Forcing " << unoStatePair.first << " toggle per user settings.");
                        forwardToChild("uno .uno:ShowTrackedChanges", docBroker);
                    }
                }
            }
        }
    } else if (tokens[0] == "textselectioncontent:") {

        postProcessCopyPayload(payload);
        return forwardToClient(payload);

    } else if (tokens[0] == "clipboardcontent:") {

#if !MOBILEAPP // Most likely nothing of this makes sense in a mobile app

        // FIXME: Ash: we need to return different content depending
        // on whether this is a download-everything, or an individual
        // 'download' and/or providing our helpful / user page.

        // for now just for remote sockets.
        LOG_TRC("Got clipboard content of size " << payload->size() << " to send to " <<
                _clipSockets.size() << " sockets in state " << stateToString(_state));

        postProcessCopyPayload(payload);

        std::size_t header;
        for (header = 0; header < payload->size();)
            if (payload->data()[header++] == '\n')
                break;
        const bool empty = header >= payload->size();

        // final cleanup ...
        if (!empty && _state == SessionState::WAIT_DISCONNECT &&
            (!_wopiFileInfo || !_wopiFileInfo->getDisableCopy()))
            LOOLWSD::SavedClipboards->insertClipboard(
                _clipboardKeys, &payload->data()[header], payload->size() - header);

        for (const auto& it : _clipSockets)
        {
            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                << "Last-Modified: " << Util::getHttpTimeNow() << "\r\n"
                << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
                << "Content-Length: " << (empty ? 0 : (payload->size() - header)) << "\r\n"
                << "Content-Type: application/octet-stream\r\n"
                << "X-Content-Type-Options: nosniff\r\n"
                << "\r\n";
            auto socket = it.lock();
            if (!socket)
                continue;

            if (!empty)
            {
                oss.write(&payload->data()[header], payload->size() - header);
                socket->setSocketBufferSize(
                    std::min(payload->size() + 256, std::size_t(Socket::MaximumSendBufferSize)));
            }

            socket->send(oss.str());
            socket->shutdown();
            LOG_INF("Queued " << (empty?"empty":"clipboard") << " response for send.");
        }
#endif
        _clipSockets.clear();
        return true;
    } else if (tokens[0] == "disconnected:") {

        LOG_INF("End of disconnection handshake for " << getId());
        docBroker->finalRemoveSession(getId());
        return true;
    }

    if (!isDocPasswordProtected())
    {
        if (tokens[0] == "tile:")
        {
            assert(false && "Tile traffic should go through the DocumentBroker-LoKit WS.");
        }
        else if (tokens[0] == "status:")
        {
            setState(ClientSession::SessionState::LIVE);
            docBroker->setLoaded();

#if !MOBILEAPP
            Admin::instance().setViewLoadDuration(docBroker->getDocKey(), getId(), std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - _viewLoadStart));
#endif

            // Wopi post load actions
            if (_wopiFileInfo && !_wopiFileInfo->getTemplateSource().empty())
            {
                std::string result;
                LOG_DBG("Saving template [" << _wopiFileInfo->getTemplateSource() << "] to storage");
                docBroker->uploadToStorage(getId(), true, result, /*force=*/false);
            }

            for(auto &token : tokens)
            {
                // Need to get the initial part id from status message
                int part = -1;
                if(getTokenInteger(tokens.getParam(token), "current", part))
                {
                    _clientSelectedPart = part;
                    resetWireIdMap();
                }

                // Get document type too
                std::string docType;
                if(getTokenString(tokens.getParam(token), "type", docType))
                {
                    _isTextDocument = docType.find("text") != std::string::npos;
                }

                // Store our Kit ViewId
                int viewId = -1;
                if(getTokenInteger(tokens.getParam(token), "viewid", viewId))
                    _kitViewId = viewId;
            }

            // Forward the status response to the client.
            return forwardToClient(payload);
        }
        else if (tokens[0] == "commandvalues:")
        {
            const std::string stringMsg(buffer, length);
            const std::size_t index = stringMsg.find_first_of('{');
            if (index != std::string::npos)
            {
                const std::string stringJSON = stringMsg.substr(index);
                Poco::JSON::Parser parser;
                const Poco::Dynamic::Var result = parser.parse(stringJSON);
                const auto& object = result.extract<Poco::JSON::Object::Ptr>();
                const std::string commandName = object->has("commandName") ? object->get("commandName").toString() : "";
                if (commandName == ".uno:CharFontName" ||
                    commandName == ".uno:StyleApply")
                {
                    // other commands should not be cached
                    docBroker->tileCache().saveTextStream(TileCache::StreamType::CmdValues, stringMsg, commandName);
                }
            }
        }
        else if (tokens[0] == "invalidatetiles:")
        {
            assert(firstLine.size() == static_cast<std::string::size_type>(length));

            // First forward invalidation
            bool ret = forwardToClient(payload);

            handleTileInvalidation(firstLine, docBroker);
            return ret;
        }
        else if (tokens[0] == "invalidatecursor:")
        {
            assert(firstLine.size() == static_cast<std::string::size_type>(length));

            const std::size_t index = firstLine.find_first_of('{');
            const std::string stringJSON = firstLine.substr(index);
            Poco::JSON::Parser parser;
            const Poco::Dynamic::Var result = parser.parse(stringJSON);
            const auto& object = result.extract<Poco::JSON::Object::Ptr>();
            const std::string rectangle = object->get("rectangle").toString();
            StringVector rectangleTokens(Util::tokenize(rectangle, ','));
            int x = 0, y = 0, w = 0, h = 0;
            if (rectangleTokens.size() > 2 &&
                stringToInteger(rectangleTokens[0], x) &&
                stringToInteger(rectangleTokens[1], y))
            {
                if (rectangleTokens.size() > 3)
                {
                    stringToInteger(rectangleTokens[2], w);
                    stringToInteger(rectangleTokens[3], h);
                }

                docBroker->invalidateCursor(x, y, w, h);
            }
            else
            {
                LOG_ERR("Unable to parse " << firstLine);
            }
        }
        else if (tokens[0] == "renderfont:")
        {
            std::string font, text;
            if (tokens.size() < 3 ||
                !getTokenString(tokens[1], "font", font))
            {
                LOG_ERR("Bad syntax for: " << firstLine);
                return false;
            }

            getTokenString(tokens[2], "char", text);
            assert(firstLine.size() < static_cast<std::string::size_type>(length));
            docBroker->tileCache().saveStream(TileCache::StreamType::Font, font+text,
                                              buffer + firstLine.size() + 1, length - firstLine.size() - 1);
            return forwardToClient(payload);
        }
    }
    else
    {
        LOG_INF("Ignoring notification on password protected document: " << firstLine);
    }

    // Forward everything else.
    return forwardToClient(payload);
}

bool ClientSession::forwardToClient(const std::shared_ptr<Message>& payload)
{
    if (isCloseFrame())
    {
        LOG_TRC(getName() << ": peer began the closing handshake. Dropping forward message [" << payload->abbr() << "].");
        return true;
    }

    enqueueSendMessage(payload);
    return true;
}

void ClientSession::enqueueSendMessage(const std::shared_ptr<Message>& data)
{
    const std::shared_ptr<DocumentBroker> docBroker = _docBroker.lock();
    LOG_CHECK_RET(docBroker && "Null DocumentBroker instance", );
    docBroker->assertCorrectThread();

    const std::string command = data->firstToken();
    std::unique_ptr<TileDesc> tile;
    if (command == "tile:")
    {
        // Avoid sending tile if it has the same wireID as the previously sent tile
        tile = Util::make_unique<TileDesc>(TileDesc::parse(data->firstLine()));
        auto iter = _oldWireIds.find(tile->generateID());
        if(iter != _oldWireIds.end() && tile->getWireId() != 0 && tile->getWireId() == iter->second)
        {
            LOG_INF("WSD filters out a tile with the same wireID: " <<  tile->serialize("tile:"));
            return;
        }
    }

    LOG_TRC(getName() << " enqueueing client message " << data->id());
    std::size_t sizeBefore = _senderQueue.size();
    std::size_t newSize = _senderQueue.enqueue(data);

    // Track sent tile
    if (tile)
    {
        traceTileBySend(*tile, sizeBefore == newSize);
    }
}

void ClientSession::addTileOnFly(const TileDesc& tile)
{
    _tilesOnFly.emplace_back(tile.generateID(), std::chrono::steady_clock::now());
}

void ClientSession::clearTilesOnFly()
{
    _tilesOnFly.clear();
}

void ClientSession::removeOutdatedTilesOnFly()
{
    // Check only the beginning of the list, tiles are ordered by timestamp
    bool continueLoop = true;
    while(!_tilesOnFly.empty() && continueLoop)
    {
        auto tileIter = _tilesOnFly.begin();
        const auto elapsedTimeMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - tileIter->second);
        if (elapsedTimeMs > std::chrono::milliseconds(TILE_ROUNDTRIP_TIMEOUT_MS))
        {
            LOG_WRN("Tracker tileID " << tileIter->first << " was dropped because of time out ("
                                      << elapsedTimeMs
                                      << "). Tileprocessed message did not arrive in time.");
            _tilesOnFly.erase(tileIter);
        }
        else
            continueLoop = false;
    }
}

std::size_t ClientSession::countIdenticalTilesOnFly(const TileDesc& tile) const
{
    std::size_t count = 0;
    const std::string tileID = tile.generateID();
    for (const auto& tileItem : _tilesOnFly)
    {
        if (tileItem.first == tileID)
            ++count;
    }
    return count;
}

Util::Rectangle ClientSession::getNormalizedVisibleArea() const
{
    Util::Rectangle normalizedVisArea;
    normalizedVisArea.setLeft(std::max(_clientVisibleArea.getLeft(), 0));
    normalizedVisArea.setTop(std::max(_clientVisibleArea.getTop(), 0));
    normalizedVisArea.setRight(_clientVisibleArea.getRight());
    normalizedVisArea.setBottom(_clientVisibleArea.getBottom());
    return normalizedVisArea;
}

void ClientSession::onDisconnect()
{
    LOG_INF(getName() << " Disconnected, current number of connections: " << LOOLWSD::NumConnections);

    const std::shared_ptr<DocumentBroker> docBroker = getDocumentBroker();
    LOG_CHECK_RET(docBroker && "Null DocumentBroker instance", );
    docBroker->assertCorrectThread();
    const std::string docKey = docBroker->getDocKey();

    // Keep self alive, so that our own dtor runs only at the end of this function. Without this,
    // removeSession() may destroy us and then we can't call our own member functions anymore.
    std::shared_ptr<ClientSession> session = client_from_this();
    try
    {
        // Connection terminated. Destroy session.
        LOG_DBG(getName() << " on docKey [" << docKey << "] terminated. Cleaning up.");

        docBroker->removeSession(getId());
    }
    catch (const UnauthorizedRequestException& exc)
    {
        LOG_ERR("Error in client request handler: " << exc.toString());
        const std::string status = "error: cmd=internal kind=unauthorized";
        LOG_TRC("Sending to Client [" << status << "].");
        sendMessage(status);
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Error in client request handler: " << exc.what());
    }

    try
    {
        if (isCloseFrame())
        {
            LOG_TRC("Normal close handshake.");
            // Client initiated close handshake
            // respond with close frame
            shutdownNormal();
        }
        else if (!SigUtil::getShutdownRequestFlag())
        {
            // something wrong, with internal exceptions
            LOG_TRC("Abnormal close handshake.");
            closeFrame();
            shutdownGoingAway();
        }
        else
        {
            LOG_TRC("Server recycling.");
            closeFrame();
            shutdownGoingAway();
        }
    }
    catch (const std::exception& exc)
    {
        LOG_WRN(getName() << ": Exception while closing socket for docKey [" << docKey << "]: " << exc.what());
    }
}

void ClientSession::dumpState(std::ostream& os)
{
    Session::dumpState(os);

    os << "\t\tisReadOnly: " << isReadOnly()
       << "\n\t\tisDocumentOwner: " << isDocumentOwner()
       << "\n\t\tstate: " << stateToString(_state)
       << "\n\t\tkeyEvents: " << _keyEvents
//       << "\n\t\tvisibleArea: " << _clientVisibleArea
       << "\n\t\tclientSelectedPart: " << _clientSelectedPart
       << "\n\t\ttile size Pixel: " << _tileWidthPixel << 'x' << _tileHeightPixel
       << "\n\t\ttile size Twips: " << _tileWidthTwips << 'x' << _tileHeightTwips
       << "\n\t\tkit ViewId: " << _kitViewId
       << "\n\t\tour URL (un-trusted): " << _serverURL.getSubURLForEndpoint("")
       << "\n\t\tisTextDocument: " << _isTextDocument
       << "\n\t\tclipboardKeys[0]: " << _clipboardKeys[0]
       << "\n\t\tclipboardKeys[1]: " << _clipboardKeys[1]
       << "\n\t\tclip sockets: " << _clipSockets.size()
       << "\n\t\tproxy access:: " << _proxyAccess;

    if (_protocol)
    {
        uint64_t sent = 0, recv = 0;
        _protocol->getIOStats(sent, recv);
        os << "\n\t\tsent/keystroke: " << (double)sent/_keyEvents << "bytes";
    }

    os << '\n';
    _senderQueue.dumpState(os);

}

const std::string &ClientSession::getOrCreateProxyAccess()
{
    if (_proxyAccess.size() <= 0)
        _proxyAccess = Util::rng::getHardRandomHexString(
            ProxyAccessTokenLengthBytes);
    return _proxyAccess;
}

void ClientSession::handleTileInvalidation(const std::string& message,
    const std::shared_ptr<DocumentBroker>& docBroker)
{
    docBroker->invalidateTiles(message, getCanonicalViewId());

    // Skip requesting new tiles if we don't have client visible area data yet.
    if(!_clientVisibleArea.hasSurface() ||
       _tileWidthPixel == 0 || _tileHeightPixel == 0 ||
       _tileWidthTwips == 0 || _tileHeightTwips == 0 ||
       (_clientSelectedPart == -1 && !_isTextDocument))
    {
        return;
    }

    std::pair<int, Util::Rectangle> result = TileCache::parseInvalidateMsg(message);
    int part = result.first;
    Util::Rectangle& invalidateRect = result.second;

    constexpr SplitPaneName panes[4] = {
        TOPLEFT_PANE,
        TOPRIGHT_PANE,
        BOTTOMLEFT_PANE,
        BOTTOMRIGHT_PANE
    };
    Util::Rectangle paneRects[4];
    int numPanes = 0;
    for(int i = 0; i < 4; ++i)
    {
        if(!isSplitPane(panes[i]))
            continue;

        Util::Rectangle rect = getNormalizedVisiblePaneArea(panes[i]);
        if (rect.intersects(invalidateRect)) {
            paneRects[numPanes++] = rect;
        }
    }

    // We can ignore the invalidation if it's outside of all split-panes.
    if(!numPanes)
        return;

    if( part == -1 ) // If no part is specified we use the part used by the client
        part = _clientSelectedPart;

    int normalizedViewId = getCanonicalViewId();

    std::vector<TileDesc> invalidTiles;
    if(part == _clientSelectedPart || _isTextDocument)
    {
        for(int paneIdx = 0; paneIdx < numPanes; ++paneIdx)
        {
            const Util::Rectangle& normalizedVisArea = paneRects[paneIdx];
            // Iterate through visible tiles
            for(int i = std::ceil(normalizedVisArea.getTop() / _tileHeightTwips);
                        i <= std::ceil(normalizedVisArea.getBottom() / _tileHeightTwips); ++i)
            {
                for(int j = std::ceil(normalizedVisArea.getLeft() / _tileWidthTwips);
                    j <= std::ceil(normalizedVisArea.getRight() / _tileWidthTwips); ++j)
                {
                    // Find tiles affected by invalidation
                    Util::Rectangle tileRect (j * _tileWidthTwips, i * _tileHeightTwips, _tileWidthTwips, _tileHeightTwips);
                    if(invalidateRect.intersects(tileRect))
                    {
                        invalidTiles.emplace_back(normalizedViewId, part, _tileWidthPixel, _tileHeightPixel, j * _tileWidthTwips, i * _tileHeightTwips, _tileWidthTwips, _tileHeightTwips, -1, 0, -1, false);

                        TileWireId oldWireId = 0;
                        auto iter = _oldWireIds.find(invalidTiles.back().generateID());
                        if(iter != _oldWireIds.end())
                            oldWireId = iter->second;

                        invalidTiles.back().setOldWireId(oldWireId);
                        invalidTiles.back().setWireId(0);
                    }
                }
            }
        }
    }

    if(!invalidTiles.empty())
    {
        TileCombined tileCombined = TileCombined::create(invalidTiles);
        tileCombined.setNormalizedViewId(normalizedViewId);
        docBroker->handleTileCombinedRequest(tileCombined, client_from_this());
    }
}

bool ClientSession::isSplitPane(const SplitPaneName paneName) const
{
    if (paneName == BOTTOMRIGHT_PANE)
        return true;

    if (paneName == TOPLEFT_PANE)
        return (_splitX && _splitY);

    if (paneName == TOPRIGHT_PANE)
        return _splitY;

    if (paneName == BOTTOMLEFT_PANE)
        return _splitX;

    return false;
}

Util::Rectangle ClientSession::getNormalizedVisiblePaneArea(const SplitPaneName paneName) const
{
    Util::Rectangle normalizedVisArea = getNormalizedVisibleArea();
    if (!_splitX && !_splitY)
        return paneName == BOTTOMRIGHT_PANE ? normalizedVisArea : Util::Rectangle();

    int freeStartX = normalizedVisArea.getLeft() + _splitX;
    int freeStartY = normalizedVisArea.getTop()  + _splitY;
    int freeWidth = normalizedVisArea.getWidth() - _splitX;
    int freeHeight = normalizedVisArea.getHeight() - _splitY;

    switch (paneName)
    {
    case BOTTOMRIGHT_PANE:
        return Util::Rectangle(freeStartX, freeStartY, freeWidth, freeHeight);
    case TOPLEFT_PANE:
        return (_splitX && _splitY) ? Util::Rectangle(0, 0, _splitX, _splitY) : Util::Rectangle();
    case TOPRIGHT_PANE:
        return _splitY ? Util::Rectangle(freeStartX, 0, freeWidth, _splitY) : Util::Rectangle();
    case BOTTOMLEFT_PANE:
        return _splitX ? Util::Rectangle(0, freeStartY, _splitX, freeHeight) : Util::Rectangle();
    default:
        assert(false && "Unknown split-pane name");
    }

    return Util::Rectangle();
}

bool ClientSession::isTileInsideVisibleArea(const TileDesc& tile) const
{
    if (!_splitX && !_splitY)
    {
        return (tile.getTilePosX() >= _clientVisibleArea.getLeft() && tile.getTilePosX() <= _clientVisibleArea.getRight() &&
            tile.getTilePosY() >= _clientVisibleArea.getTop() && tile.getTilePosY() <= _clientVisibleArea.getBottom());
    }

    constexpr SplitPaneName panes[4] = {
        TOPLEFT_PANE,
        TOPRIGHT_PANE,
        BOTTOMLEFT_PANE,
        BOTTOMRIGHT_PANE
    };

    for (int i = 0; i < 4; ++i)
    {
        if (!isSplitPane(panes[i]))
            continue;

        Util::Rectangle paneRect = getNormalizedVisiblePaneArea(panes[i]);
        if (tile.getTilePosX() >= paneRect.getLeft() && tile.getTilePosX() <= paneRect.getRight() &&
            tile.getTilePosY() >= paneRect.getTop() && tile.getTilePosY() <= paneRect.getBottom())
            return true;
    }

    return false;
}

void ClientSession::resetWireIdMap()
{
    _oldWireIds.clear();
}

void ClientSession::traceTileBySend(const TileDesc& tile, bool deduplicated)
{
    const std::string tileID = tile.generateID();

    // Store wireId first
    auto iter = _oldWireIds.find(tileID);
    if(iter != _oldWireIds.end())
    {
        iter->second = tile.getWireId();
    }
    else
    {
        // Track only tile inside the visible area
        if(_clientVisibleArea.hasSurface() && isTileInsideVisibleArea(tile))
        {
            _oldWireIds.insert(std::pair<std::string, TileWireId>(tileID, tile.getWireId()));
        }
    }

    // Record that the tile is sent
    if (!deduplicated)
        addTileOnFly(tile);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
