/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
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
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>

#include "DocumentBroker.hpp"
#include "LOOLWSD.hpp"
#include "Storage.hpp"
#include <common/Common.hpp>
#include <common/Log.hpp>
#include <common/Protocol.hpp>
#include <common/Session.hpp>
#include <common/Unit.hpp>
#include <common/Util.hpp>

using namespace LOOLProtocol;

using Poco::Path;
using Poco::StringTokenizer;

static std::mutex GlobalSessionMapMutex;
static std::unordered_map<std::string, std::weak_ptr<ClientSession>> GlobalSessionMap;

ClientSession::ClientSession(const std::string& id,
                             const std::shared_ptr<DocumentBroker>& docBroker,
                             const Poco::URI& uriPublic,
                             const bool readOnly) :
    Session("ToClient-" + id, id, readOnly),
    _docBroker(docBroker),
    _uriPublic(uriPublic),
    _isDocumentOwner(false),
    _isAttached(false),
    _isViewLoaded(false),
    _keyEvents(1),
    _clientVisibleArea(0, 0, 0, 0),
    _clientSelectedPart(-1),
    _tileWidthPixel(0),
    _tileHeightPixel(0),
    _tileWidthTwips(0),
    _tileHeightTwips(0),
    _isTextDocument(false)
{
    const size_t curConnections = ++LOOLWSD::NumConnections;
    LOG_INF("ClientSession ctor [" << getName() << "], current number of connections: " << curConnections);

    for (const auto& param : _uriPublic.getQueryParameters())
    {
        if (param.first == "reuse_cookies")
        {
            // Cache the cookies to avoid re-parsing the URI again.
            _cookies = param.second;
            break;
        }
    }

}

void ClientSession::construct()
{
    std::unique_lock<std::mutex> lock(GlobalSessionMapMutex);
    GlobalSessionMap[getId()] = shared_from_this();
}

ClientSession::~ClientSession()
{
    const size_t curConnections = --LOOLWSD::NumConnections;
    LOG_INF("~ClientSession dtor [" << getName() << "], current number of connections: " << curConnections);

    std::unique_lock<std::mutex> lock(GlobalSessionMapMutex);
    GlobalSessionMap.erase(getId());
}

void ClientSession::handleIncomingMessage(SocketDisposition &disposition)
{
    // LOG_TRC("***** ClientSession::handleIncomingMessage()");
    if (UnitWSD::get().filterHandleRequest(
            UnitWSD::TestRequest::Client, disposition, *this))
        return;

    Session::handleIncomingMessage(disposition);
}

bool ClientSession::_handleInput(const char *buffer, int length)
{
    LOG_TRC(getName() << ": handling incoming [" << getAbbreviatedMessage(buffer, length) << "].");
    const std::string firstLine = getFirstLine(buffer, length);
    const std::vector<std::string> tokens = LOOLProtocol::tokenize(firstLine.data(), firstLine.size());

    std::shared_ptr<DocumentBroker> docBroker = getDocumentBroker();
    if (!docBroker)
    {
        LOG_ERR("No DocBroker found. Terminating session " << getName());
        return false;
    }

    LOOLWSD::dumpIncomingTrace(docBroker->getJailId(), getId(), firstLine);

    if (LOOLProtocol::tokenIndicatesUserInteraction(tokens[0]))
    {
        // Keep track of timestamps of incoming client messages that indicate user activity.
        updateLastActivityTime();
        docBroker->updateLastActivityTime();
    }
    if (tokens[0] == "loolclient")
    {
        if (tokens.size() < 1)
        {
            sendTextFrame("error: cmd=loolclient kind=badprotocolversion");
            return false;
        }

        const std::tuple<int, int, std::string> versionTuple = ParseVersion(tokens[1]);
        if (std::get<0>(versionTuple) != ProtocolMajorVersionNumber ||
            std::get<1>(versionTuple) != ProtocolMinorVersionNumber)
        {
            sendTextFrame("error: cmd=loolclient kind=badprotocolversion");
            return false;
        }

        // Send LOOL version information
        std::string version, hash;
        Util::getVersionInfo(version, hash);
        std::string versionStr =
            "{ \"Version\":  \"" + version + "\", " +
            "\"Hash\":     \"" + hash + "\", " +
            "\"Protocol\": \"" + GetProtocolVersion() + "\" }";
        sendTextFrame("loolserver " + versionStr);
        // Send LOKit version information
        sendTextFrame("lokitversion " + LOOLWSD::LOKitVersion);

        return true;
    }
    else if (tokens[0] == "load")
    {
        if (getDocURL() != "")
        {
            sendTextFrame("error: cmd=load kind=docalreadyloaded");
            return false;
        }

        return loadDocument(buffer, length, tokens, docBroker);
    }
    else if (tokens[0] != "canceltiles" &&
             tokens[0] != "tileprocessed" &&
             tokens[0] != "clientzoom" &&
             tokens[0] != "clientvisiblearea" &&
             tokens[0] != "outlinestate" &&
             tokens[0] != "commandvalues" &&
             tokens[0] != "closedocument" &&
             tokens[0] != "versionrestore" &&
             tokens[0] != "downloadas" &&
             tokens[0] != "getchildid" &&
             tokens[0] != "gettextselection" &&
             tokens[0] != "paste" &&
             tokens[0] != "insertfile" &&
             tokens[0] != "key" &&
             tokens[0] != "textinput" &&
             tokens[0] != "windowkey" &&
             tokens[0] != "mouse" &&
             tokens[0] != "windowmouse" &&
             tokens[0] != "partpagerectangles" &&
             tokens[0] != "ping" &&
             tokens[0] != "renderfont" &&
             tokens[0] != "requestloksession" &&
             tokens[0] != "resetselection" &&
             tokens[0] != "save" &&
             tokens[0] != "saveas" &&
             tokens[0] != "savetostorage" &&
             tokens[0] != "selectgraphic" &&
             tokens[0] != "selecttext" &&
             tokens[0] != "setclientpart" &&
             tokens[0] != "selectclientpart" &&
             tokens[0] != "moveselectedclientparts" &&
             tokens[0] != "setpage" &&
             tokens[0] != "status" &&
             tokens[0] != "statusupdate" &&
             tokens[0] != "tile" &&
             tokens[0] != "tilecombine" &&
             tokens[0] != "uno" &&
             tokens[0] != "useractive" &&
             tokens[0] != "userinactive" &&
             tokens[0] != "paintwindow" &&
             tokens[0] != "windowcommand" &&
             tokens[0] != "signdocument" &&
             tokens[0] != "asksignaturestatus" &&
             tokens[0] != "uploadsigneddocument" &&
             tokens[0] != "exportsignanduploaddocument" &&
             tokens[0] != "rendershapeselection" &&
             tokens[0] != "removesession" &&
             tokens[0] != "renamefile")
    {
        LOG_ERR("Session [" << getId() << "] got unknown command [" << tokens[0] << "].");
        sendTextFrame("error: cmd=" + tokens[0] + " kind=unknown");
        return false;
    }
    else if (getDocURL() == "")
    {
        sendTextFrame("error: cmd=" + tokens[0] + " kind=nodocloaded");
        return false;
    }
    else if (tokens[0] == "canceltiles")
    {
        docBroker->cancelTileRequests(shared_from_this());
        return true;
    }
    else if (tokens[0] == "commandvalues")
    {
        return getCommandValues(buffer, length, tokens, docBroker);
    }
    else if (tokens[0] == "closedocument")
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
    else if (tokens[0] == "versionrestore")
    {
        if (tokens.size() > 1 && tokens[1] == "prerestore")
        {
            // green signal to WOPI host to restore the version *after* saving
            // any unsaved changes, if any, to the storage
            docBroker->closeDocument("versionrestore: prerestore_ack");
        }
    }
    else if (tokens[0] == "partpagerectangles")
    {
        // We don't support partpagerectangles any more, will be removed in the
        // next version
        sendTextFrame("partpagerectangles: ");
        return true;
    }
    else if (tokens[0] == "ping")
    {
        std::string count = std::to_string(docBroker->getRenderedTileCount());
        sendTextFrame("pong rendercount=" + count);
        return true;
    }
    else if (tokens[0] == "renderfont")
    {
        return sendFontRendering(buffer, length, tokens, docBroker);
    }
    else if (tokens[0] == "status" || tokens[0] == "statusupdate")
    {
        assert(firstLine.size() == static_cast<size_t>(length));
        return forwardToChild(firstLine, docBroker);
    }
    else if (tokens[0] == "tile")
    {
        return sendTile(buffer, length, tokens, docBroker);
    }
    else if (tokens[0] == "tilecombine")
    {
        return sendCombinedTiles(buffer, length, tokens, docBroker);
    }
    else if (tokens[0] == "save")
    {
        if (isReadOnly())
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
    else if (tokens[0] == "savetostorage")
    {
        int force = 0;
        if (tokens.size() > 1)
            getTokenInteger(tokens[1], "force", force);

        if (docBroker->saveToStorage(getId(), true, "" /* This is irrelevant when success is true*/, true))
        {
            docBroker->broadcastMessage("commandresult: { \"command\": \"savetostorage\", \"success\": true }");
        }
    }
    else if (tokens[0] == "clientvisiblearea")
    {
        int x;
        int y;
        int width;
        int height;
        if (tokens.size() != 5 ||
            !getTokenInteger(tokens[1], "x", x) ||
            !getTokenInteger(tokens[2], "y", y) ||
            !getTokenInteger(tokens[3], "width", width) ||
            !getTokenInteger(tokens[4], "height", height))
        {
            sendTextFrame("error: cmd=clientvisiblearea kind=syntax");
            return false;
        }
        else
        {
            _clientVisibleArea = Util::Rectangle(x, y, width, height);
            resetWireIdMap();
            return forwardToChild(std::string(buffer, length), docBroker);
        }
    }
    else if (tokens[0] == "setclientpart")
    {
        if(!_isTextDocument)
        {
            int temp;
            if (tokens.size() != 2 ||
                !getTokenInteger(tokens[1], "part", temp))
            {
                sendTextFrame("error: cmd=setclientpart kind=syntax");
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
    else if (tokens[0] == "selectclientpart")
    {
        if(!_isTextDocument)
        {
            int part;
            int how;
            if (tokens.size() != 3 ||
                !getTokenInteger(tokens[1], "part", part) ||
                !getTokenInteger(tokens[2], "how", how))
            {
                sendTextFrame("error: cmd=selectclientpart kind=syntax");
                return false;
            }
            else
            {
                return forwardToChild(std::string(buffer, length), docBroker);
            }
        }
    }
    else if (tokens[0] == "moveselectedclientparts")
    {
        if(!_isTextDocument)
        {
            int nPosition;
            if (tokens.size() != 2 ||
                !getTokenInteger(tokens[1], "position", nPosition))
            {
                sendTextFrame("error: cmd=moveselectedclientparts kind=syntax");
                return false;
            }
            else
            {
                return forwardToChild(std::string(buffer, length), docBroker);
            }
        }
    }
    else if (tokens[0] == "clientzoom")
    {
        int tilePixelWidth, tilePixelHeight, tileTwipWidth, tileTwipHeight;
        if (tokens.size() != 5 ||
            !getTokenInteger(tokens[1], "tilepixelwidth", tilePixelWidth) ||
            !getTokenInteger(tokens[2], "tilepixelheight", tilePixelHeight) ||
            !getTokenInteger(tokens[3], "tiletwipwidth", tileTwipWidth) ||
            !getTokenInteger(tokens[4], "tiletwipheight", tileTwipHeight))
        {
            sendTextFrame("error: cmd=clientzoom kind=syntax");
            return false;
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
    else if (tokens[0] == "tileprocessed")
    {
        std::string tileID;
        if (tokens.size() != 2 ||
            !getTokenString(tokens[1], "tile", tileID))
        {
            sendTextFrame("error: cmd=tileprocessed kind=syntax");
            return false;
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

        docBroker->sendRequestedTiles(shared_from_this());
        return true;
    }
    else if (tokens[0] == "removesession") {
        std::string sessionId = Util::encodeId(std::stoi(tokens[1]), 4);
        docBroker->broadcastMessage(firstLine);
        docBroker->removeSession(sessionId);
    }
    else if (tokens[0] == "renamefile")
    {
        std::string encodedWopiFilename;
        if (tokens.size() < 2 || !getTokenString(tokens[1], "filename", encodedWopiFilename))
        {
            LOG_ERR("Bad syntax for: " << firstLine);
            sendTextFrame("error: cmd=renamefile kind=syntax");
            return false;
        }
        std::string wopiFilename;
        Poco::URI::decode(encodedWopiFilename, wopiFilename);
        docBroker->saveAsToStorage(getId(), "", wopiFilename, true);
        return true;
    }
    else
    {
        if (tokens[0] == "key")
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
            assert(tokens[0] == "requestloksession");
            return true;
        }
    }

    return false;
}

bool ClientSession::loadDocument(const char* /*buffer*/, int /*length*/,
                                 const std::vector<std::string>& tokens,
                                 const std::shared_ptr<DocumentBroker>& docBroker)
{
    if (tokens.size() < 2)
    {
        // Failed loading ends connection.
        sendTextFrame("error: cmd=load kind=syntax");
        return false;
    }

    LOG_INF("Requesting document load from child.");
    try
    {
        std::string timestamp, doctemplate;
        int loadPart = -1;
        parseDocOptions(tokens, loadPart, timestamp, doctemplate);

        std::ostringstream oss;
        oss << "load";
        oss << " url=" << docBroker->getPublicUri().toString();;

        if (!getUserId().empty() && !getUserName().empty())
        {
            std::string encodedUserId;
            Poco::URI::encode(getUserId(), "", encodedUserId);
            oss << " authorid=" << encodedUserId;
            Poco::URI::encode(LOOLWSD::anonymizeUsername(getUserId()), "", encodedUserId);
            oss << " xauthorid=" << encodedUserId;

            std::string encodedUserName;
            Poco::URI::encode(getUserName(), "", encodedUserName);
            oss << " author=" << encodedUserName;
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
        sendTextFrame("error: cmd=load kind=uriinvalid");
    }

    return false;
}

bool ClientSession::getCommandValues(const char *buffer, int length, const std::vector<std::string>& tokens,
                                     const std::shared_ptr<DocumentBroker>& docBroker)
{
    std::string command;
    if (tokens.size() != 2 || !getTokenString(tokens[1], "command", command))
    {
        return sendTextFrame("error: cmd=commandvalues kind=syntax");
    }

    std::string cmdValues;
    if (docBroker->tileCache().getTextFile("cmdValues" + command + ".txt", cmdValues))
    {
        return sendTextFrame(cmdValues);
    }

    return forwardToChild(std::string(buffer, length), docBroker);
}

bool ClientSession::sendFontRendering(const char *buffer, int length, const std::vector<std::string>& tokens,
                                      const std::shared_ptr<DocumentBroker>& docBroker)
{
    std::string font, text;
    if (tokens.size() < 2 ||
        !getTokenString(tokens[1], "font", font))
    {
        return sendTextFrame("error: cmd=renderfont kind=syntax");
    }

    getTokenString(tokens[2], "char", text);
    const std::string response = "renderfont: " + Poco::cat(std::string(" "), tokens.begin() + 1, tokens.end()) + "\n";

    std::vector<char> output;
    output.resize(response.size());
    std::memcpy(output.data(), response.data(), response.size());

    std::unique_ptr<std::fstream> cachedRendering = docBroker->tileCache().lookupCachedFile(font+text, "font");
    if (cachedRendering && cachedRendering->is_open())
    {
        cachedRendering->seekg(0, std::ios_base::end);
        size_t pos = output.size();
        std::streamsize size = cachedRendering->tellg();
        output.resize(pos + size);
        cachedRendering->seekg(0, std::ios_base::beg);
        cachedRendering->read(output.data() + pos, size);
        cachedRendering->close();

        return sendBinaryFrame(output.data(), output.size());
    }

    return forwardToChild(std::string(buffer, length), docBroker);
}

bool ClientSession::sendTile(const char * /*buffer*/, int /*length*/, const std::vector<std::string>& tokens,
                             const std::shared_ptr<DocumentBroker>& docBroker)
{
    try
    {
        TileDesc tileDesc = TileDesc::parse(tokens);
        tileDesc.setNormalizedViewId(getCanonicalViewId());
        docBroker->handleTileRequest(tileDesc, shared_from_this());
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to process tile command: " << exc.what());
        return sendTextFrame("error: cmd=tile kind=invalid");
    }

    return true;
}

bool ClientSession::sendCombinedTiles(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens,
                                      const std::shared_ptr<DocumentBroker>& docBroker)
{
    try
    {
        TileCombined tileCombined = TileCombined::parse(tokens);
        tileCombined.setNormalizedViewId(getCanonicalViewId());
        docBroker->handleTileCombinedRequest(tileCombined, shared_from_this());
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to process tilecombine command: " << exc.what());
        return sendTextFrame("error: cmd=tile kind=invalid");
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
    StringTokenizer tokens(message, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    // Set allowed flag to false depending on if particular WOPI properties are set
    if (tokens[0] == "downloadas")
    {
        std::string id;
        if (tokens.count() >= 3 && getTokenString(tokens[2], "id", id))
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
    else if (tokens[0] == "gettextselection" || tokens[0] == ".uno:Copy")
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
        if (tokens[0] == "userinactive" || tokens[0] == "useractive" || tokens[0] == "saveas")
        {
            allowed = true;
        }
        else if (tokens[0] == "uno")
        {
            if (tokens.count() > 1 && tokens[1] == ".uno:ExecuteSearch")
            {
                allowed = true;
            }
        }
    }

    return allowed;
}

void ClientSession::setReadOnly()
{
    Session::setReadOnly();
    // Also inform the client
    sendTextFrame("perm: readonly");
}

int ClientSession::getPollEvents(std::chrono::steady_clock::time_point /* now */,
                                 int & /* timeoutMaxMs */)
{
    LOG_TRC(getName() << " ClientSession has " << _senderQueue.size() << " write message(s) queued.");
    int events = POLLIN;
    if (_senderQueue.size())
        events |= POLLOUT;
    return events;
}

void ClientSession::performWrites()
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

#ifndef MOBILEAPP
    LOOLWSD::dumpOutgoingTrace(docBroker->getJailId(), getId(), firstLine);
#endif

    const auto& tokens = payload->tokens();
    if (tokens[0] == "unocommandresult:")
    {
        const std::string stringMsg(buffer, length);
        LOG_INF(getName() << ": Command: " << stringMsg);
        const size_t index = stringMsg.find_first_of('{');
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
                docBroker->saveToStorage(getId(), success, result);

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
                    forwardToClient(payload);
                    return false;
                }
            }
            else
            {
                LOG_WRN("Other than load failure: " << errorKind);
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
#ifndef MOBILEAPP
    else if (tokens.size() == 3 && tokens[0] == "saveas:")
    {
        bool isConvertTo = static_cast<bool>(_saveAsSocket);

        std::string encodedURL;
        if (!getTokenString(tokens[1], "url", encodedURL))
        {
            LOG_ERR("Bad syntax for: " << firstLine);
            // we must not return early with convert-to so that we clean up
            // the session
            if (!isConvertTo)
            {
                sendTextFrame("error: cmd=saveas kind=syntax");
                return false;
            }
        }

        std::string encodedWopiFilename;
        if (!isConvertTo && !getTokenString(tokens[2], "filename", encodedWopiFilename))
        {
            LOG_ERR("Bad syntax for: " << firstLine);
            sendTextFrame("error: cmd=saveas kind=syntax");
            return false;
        }

        // Save-as completed, inform the ClientSession.
        std::string wopiFilename;
        Poco::URI::decode(encodedWopiFilename, wopiFilename);

        // URI constructor implicitly decodes when it gets std::string as param
        Poco::URI resultURL(encodedURL);
        if (resultURL.getScheme() == "file")
        {
            std::string relative(resultURL.getPath());
            if (relative.size() > 0 && relative[0] == '/')
                relative = relative.substr(1);

            // Rewrite file:// URLs, as they are visible to the outside world.
            const Path path(docBroker->getJailRoot(), relative);
            if (Poco::File(path).exists())
            {
                // Encode path for special characters (i.e '%') since Poco::URI::setPath implicitly decodes the input param
                std::string encodedPath;
                Poco::URI::encode(path.toString(), "", encodedPath);

                resultURL.setPath(encodedPath);
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
                docBroker->saveAsToStorage(getId(), resultURL.getPath(), wopiFilename, false);
            }
            else
                sendTextFrame("error: cmd=storage kind=savefailed");
        }
        else
        {
            // using the convert-to REST API
            // TODO: Send back error when there is no output.
            if (!resultURL.getPath().empty())
            {
                const std::string mimeType = "application/octet-stream";
                std::string encodedFilePath;
                Poco::URI::encode(resultURL.getPath(), "", encodedFilePath);
                LOG_TRC("Sending file: " << encodedFilePath);

                const std::string fileName = Poco::Path(resultURL.getPath()).getFileName();
                Poco::Net::HTTPResponse response;
                if (!fileName.empty())
                    response.set("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

                HttpHelper::sendFile(_saveAsSocket, encodedFilePath, mimeType, response);
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
    else if (tokens.size() == 2 && tokens[0] == "statechanged:")
    {
        StringTokenizer stateTokens(tokens[1], "=", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        if (stateTokens.count() == 2 && stateTokens[0] == ".uno:ModifiedStatus")
        {
            docBroker->setModified(stateTokens[1] == "true");
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
    }

    if (!isDocPasswordProtected())
    {
        if (tokens[0] == "tile:")
        {
            assert(false && "Tile traffic should go through the DocumentBroker-LoKit WS.");
        }
        else if (tokens[0] == "status:")
        {
            setViewLoaded();
            docBroker->setLoaded();
            // Wopi post load actions
            if (_wopiFileInfo && !_wopiFileInfo->getTemplateSource().empty())
            {
                std::string result;
                LOG_DBG("Saving template [" << _wopiFileInfo->getTemplateSource() << "] to storage");
                docBroker->saveToStorage(getId(), true, result);
            }

            for(auto &token : tokens)
            {
                // Need to get the initial part id from status message
                int part = -1;
                if(getTokenInteger(token, "current", part))
                {
                    _clientSelectedPart = part;
                    resetWireIdMap();
                }

                // Get document type too
                std::string docType;
                if(getTokenString(token, "type", docType))
                {
                    _isTextDocument = docType.find("text") != std::string::npos;
                }
            }

            // Forward the status response to the client.
            return forwardToClient(payload);
        }
        else if (tokens[0] == "commandvalues:")
        {
            const std::string stringMsg(buffer, length);
            const size_t index = stringMsg.find_first_of('{');
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
                    docBroker->tileCache().saveTextFile(stringMsg, "cmdValues" + commandName + ".txt");
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

            const size_t index = firstLine.find_first_of('{');
            const std::string stringJSON = firstLine.substr(index);
            Poco::JSON::Parser parser;
            const Poco::Dynamic::Var result = parser.parse(stringJSON);
            const auto& object = result.extract<Poco::JSON::Object::Ptr>();
            const std::string rectangle = object->get("rectangle").toString();
            StringTokenizer rectangleTokens(rectangle, ",", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            int x = 0, y = 0, w = 0, h = 0;
            if (rectangleTokens.count() > 2 &&
                stringToInteger(rectangleTokens[0], x) &&
                stringToInteger(rectangleTokens[1], y))
            {
                if (rectangleTokens.count() > 3)
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
            docBroker->tileCache().saveRendering(font+text, "font", buffer + firstLine.size() + 1, length - firstLine.size() - 1);
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
    // If in the correct thread - no need for wakeups.
    if (docBroker)
        docBroker->assertCorrectThread();

    const std::string command = data->firstToken();
    std::unique_ptr<TileDesc> tile;
    if (command == "tile:")
    {
        // Avoid sending tile if it has the same wireID as the previously sent tile
        tile.reset(new TileDesc(TileDesc::parse(data->firstLine())));
        const std::string tileID = generateTileID(*tile);
        auto iter = _oldWireIds.find(tileID);
        if(iter != _oldWireIds.end() && tile->getWireId() != 0 && tile->getWireId() == iter->second)
        {
            LOG_INF("WSD filters out a tile with the same wireID: " <<  tile->serialize("tile:"));
            return;
        }
    }

    LOG_TRC(getName() << " enqueueing client message " << data->id());
    size_t sizeBefore = _senderQueue.size();
    size_t newSize = _senderQueue.enqueue(data);

    // Track sent tile
    if (tile)
    {
        traceTileBySend(*tile, sizeBefore == newSize);
    }
}

Authorization ClientSession::getAuthorization() const
{
    Poco::URI::QueryParameters queryParams = _uriPublic.getQueryParameters();

    // prefer the access_token
    for (auto& param: queryParams)
    {
        if (param.first == "access_token")
        {
            std::string decodedToken;
            Poco::URI::decode(param.second, decodedToken);
            return Authorization(Authorization::Type::Token, decodedToken);
        }
    }

    for (auto& param: queryParams)
    {
        if (param.first == "access_header")
        {
            std::string decodedHeader;
            Poco::URI::decode(param.second, decodedHeader);
            return Authorization(Authorization::Type::Header, decodedHeader);
        }
    }

    return Authorization();
}

void ClientSession::addTileOnFly(const TileDesc& tile)
{
    _tilesOnFly.push_back({generateTileID(tile), std::chrono::steady_clock::now()});
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
        double elapsedTimeMs = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - tileIter->second).count();
        if(elapsedTimeMs > TILE_ROUNDTRIP_TIMEOUT_MS)
        {
            LOG_WRN("Tracker tileID " << tileIter->first << " was dropped because of time out ("
                                      << elapsedTimeMs
                                      << " ms). Tileprocessed message did not arrive in time.");
            _tilesOnFly.erase(tileIter);
        }
        else
            continueLoop = false;
    }
}

size_t ClientSession::countIdenticalTilesOnFly(const TileDesc& tile) const
{
    size_t count = 0;
    std::string tileID = generateTileID(tile);
    for(auto& tileItem : _tilesOnFly)
    {
        if(tileItem.first == tileID)
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
            shutdown();
        }
        else if (!ShutdownRequestFlag)
        {
            // something wrong, with internal exceptions
            LOG_TRC("Abnormal close handshake.");
            closeFrame();
            shutdown(WebSocketHandler::StatusCodes::ENDPOINT_GOING_AWAY);
        }
        else
        {
            LOG_TRC("Server recycling.");
            closeFrame();
            shutdown(WebSocketHandler::StatusCodes::ENDPOINT_GOING_AWAY);
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
       << "\n\t\tisAttached: " << _isAttached
       << "\n\t\tkeyEvents: " << _keyEvents;

    std::shared_ptr<StreamSocket> socket = getSocket().lock();
    if (socket)
    {
        uint64_t sent, recv;
        socket->getIOStats(sent, recv);
        os << "\n\t\tsent/keystroke: " << (double)sent/_keyEvents << "bytes";
    }

    os << "\n";
    _senderQueue.dumpState(os);

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

    // Visible area can have negativ value as position, but we have tiles only in the positive range
    Util::Rectangle normalizedVisArea = getNormalizedVisibleArea();

    std::pair<int, Util::Rectangle> result = TileCache::parseInvalidateMsg(message);
    int part = result.first;
    Util::Rectangle& invalidateRect = result.second;

    // We can ignore the invalidation if it's outside of the visible area
    if(!normalizedVisArea.intersects(invalidateRect))
        return;

    if( part == -1 ) // If no part is specifed we use the part used by the client
        part = _clientSelectedPart;

    int normalizedViewId = getCanonicalViewId();

    std::vector<TileDesc> invalidTiles;
    if(part == _clientSelectedPart || _isTextDocument)
    {
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
                    auto iter = _oldWireIds.find(generateTileID(invalidTiles.back()));
                    if(iter != _oldWireIds.end())
                        oldWireId = iter->second;

                    invalidTiles.back().setOldWireId(oldWireId);
                    invalidTiles.back().setWireId(0);
                }
            }
        }
    }

    if(!invalidTiles.empty())
    {
        TileCombined tileCombined = TileCombined::create(invalidTiles);
        tileCombined.setNormalizedViewId(getCanonicalViewId());
        docBroker->handleTileCombinedRequest(tileCombined, shared_from_this());
    }
}

void ClientSession::resetWireIdMap()
{
    _oldWireIds.clear();
}

void ClientSession::traceTileBySend(const TileDesc& tile, bool deduplicated)
{
    const std::string tileID = generateTileID(tile);

    // Store wireId first
    auto iter = _oldWireIds.find(tileID);
    if(iter != _oldWireIds.end())
    {
        iter->second = tile.getWireId();
    }
    else
    {
        // Track only tile inside the visible area
        if(_clientVisibleArea.hasSurface() &&
           tile.getTilePosX() >= _clientVisibleArea.getLeft() && tile.getTilePosX() <= _clientVisibleArea.getRight() &&
           tile.getTilePosY() >= _clientVisibleArea.getTop() && tile.getTilePosY() <= _clientVisibleArea.getBottom())
        {
            _oldWireIds.insert(std::pair<std::string, TileWireId>(tileID, tile.getWireId()));
        }
    }

    // Record that the tile is sent
    if (!deduplicated)
        addTileOnFly(tile);
}

void ClientSession::traceSubscribeToTile(const std::string& cacheName)
{
    _tilesBeingRendered.insert(cacheName);
}

void ClientSession::traceUnSubscribeToTile(const std::string& cacheName)
{
    _tilesBeingRendered.erase(cacheName);
}

void ClientSession::removeOutdatedTileSubscriptions()
{
    const std::shared_ptr<DocumentBroker> docBroker = getDocumentBroker();
    if(!docBroker)
        return;

    auto iterator = _tilesBeingRendered.begin();
    while(iterator != _tilesBeingRendered.end())
    {
        double elapsedTime = docBroker->tileCache().getTileBeingRenderedElapsedTimeMs(*iterator);
        if(elapsedTime < 0.0 && elapsedTime > 200.0)
        {
            LOG_INF("Tracked TileBeingRendered was dropped because of time out.");
            _tilesBeingRendered.erase(iterator);
        }
        else
            ++iterator;
    }
}

void ClientSession::clearTileSubscription()
{
    _tilesBeingRendered.clear();
}

std::string ClientSession::generateTileID(const TileDesc& tile) const
{
    std::ostringstream tileID;
    tileID << tile.getPart() << ":" << tile.getTilePosX() << ":" << tile.getTilePosY() << ":"
           << tile.getTileWidth() << ":" << tile.getTileHeight() << ":" << tile.getNormalizedViewId();
    return tileID.str();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
