/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <Poco/FileStream.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/URI.h>
#include <Poco/URIStreamOpener.h>

#include "Common.hpp"
#include "LOOLProtocol.hpp"
#include "LOOLSession.hpp"
#include "LOOLWSD.hpp"
#include "MasterProcessSession.hpp"
#include "Rectangle.hpp"
#include "Storage.hpp"
#include "TileCache.hpp"
#include "IoUtil.hpp"
#include "Util.hpp"

using namespace LOOLProtocol;

using Poco::Path;
using Poco::StringTokenizer;

std::map<std::string, std::shared_ptr<MasterProcessSession>> MasterProcessSession::AvailableChildSessions;
std::mutex MasterProcessSession::AvailableChildSessionMutex;
std::condition_variable MasterProcessSession::AvailableChildSessionCV;

MasterProcessSession::MasterProcessSession(const std::string& id,
                                           const Kind kind,
                                           std::shared_ptr<Poco::Net::WebSocket> ws,
                                           std::shared_ptr<DocumentBroker> docBroker,
                                           std::shared_ptr<BasicTileQueue> queue) :
    LOOLSession(id, kind, ws),
    _lastMessageTime(0),
    _idleSaveTime(0),
    _autoSaveTime(0),
    _curPart(0),
    _loadPart(-1),
    _docBroker(docBroker),
    _queue(queue)
{
    Log::info("MasterProcessSession ctor [" + getName() + "].");
}

MasterProcessSession::~MasterProcessSession()
{
    Log::info("~MasterProcessSession dtor [" + getName() + "].");

    try
    {
        // We could be unwinding because our peer's connection
        // died. Handle I/O errors in that case.
        disconnect();
    }
    catch (const std::exception& exc)
    {
        Log::error(std::string("MasterProcessSession::~MasterProcessSession: Exception: ") + exc.what());
    }
}

void MasterProcessSession::disconnect(const std::string& reason)
{
    if (!isDisconnected())
    {
        LOOLSession::disconnect(reason);

        // Release the save-as queue.
        _saveAsQueue.put("");

        auto peer = _peer.lock();
        if (peer)
        {
            peer->disconnect(reason);
        }
    }
}

bool MasterProcessSession::handleDisconnect(Poco::StringTokenizer& tokens)
{
    Log::info("Graceful disconnect on " + getName() + " [" +
              (tokens.count() > 1 ? tokens[1] : std::string("no reason")) +
              "].");

    LOOLSession::handleDisconnect(tokens);

    auto peer = _peer.lock();
    if (peer)
    {
        const auto reason = (tokens.count() > 1 ? Poco::cat(std::string(" "), tokens.begin() + 1, tokens.end()) : "");
        peer->disconnect(reason);
    }

    return false;
}

bool MasterProcessSession::_handleInput(const char *buffer, int length)
{
    const std::string firstLine = getFirstLine(buffer, length);
    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
    Log::trace(getName() + ": handling [" + firstLine + "].");

    if (tokens[0] == "loolclient")
    {
        const auto versionTuple = ParseVersion(tokens[1]);
        if (std::get<0>(versionTuple) != ProtocolMajorVersionNumber ||
            std::get<1>(versionTuple) != ProtocolMinorVersionNumber)
        {
            sendTextFrame("error: cmd=loolclient kind=badversion");
            return false;
        }

        sendTextFrame("loolserver " + GetProtocolVersion());
        return true;
    }

    if (_kind == Kind::ToPrisoner)
    {
        // Note that this handles both forwarding requests from the client to the child process, and
        // forwarding replies from the child process to the client. Or does it?

        // Snoop at some messages and manipulate tile cache information as needed
        auto peer = _peer.lock();

        {
            if (!peer)
            {
                LOOLSession::disconnect();
                return false;
            }

            if (tokens[0] == "unocommandresult:")
            {
                const std::string stringMsg(buffer, length);
                Log::info(getName() +"Command: " + stringMsg);
                const auto index = stringMsg.find_first_of("{");
                if (index != std::string::npos)
                {
                    const std::string stringJSON = stringMsg.substr(index);
                    Poco::JSON::Parser parser;
                    const auto result = parser.parse(stringJSON);
                    const auto object = result.extract<Poco::JSON::Object::Ptr>();
                    if (object->get("commandName").toString() == ".uno:Save" &&
                        object->get("success").toString() == "true")
                    {
                        _docBroker->save();
                        return true;
                    }
                }
            }

            if (tokens[0] == "error:")
            {
                std::string errorCommand;
                std::string errorKind;
                if (getTokenString(tokens[1], "cmd", errorCommand) &&
                    getTokenString(tokens[2], "kind", errorKind) )
                {
                    if (errorCommand == "load")
                    {
                        if (errorKind == "passwordrequired:to-view" ||
                            errorKind == "passwordrequired:to-modify" ||
                            errorKind == "wrongpassword")
                        {
                            forwardToPeer(buffer, length);
                            peer->_bLoadError = true;
                            return false;
                        }
                    }
                }
            }

            if (tokens[0] == "curpart:" &&
                tokens.count() == 2 &&
                getTokenInteger(tokens[1], "part", _curPart))
            {
                return true;
            }

            if (tokens.count() == 2 && tokens[0] == "saveas:")
            {
                std::string url;
                if (!getTokenString(tokens[1], "url", url))
                    return true;

                if (peer)
                {
                    // Save as completed, inform the other (Kind::ToClient)
                    // MasterProcessSession about it.

                    const std::string filePrefix("file:///");
                    if (url.find(filePrefix) == 0)
                    {
                        // Rewrite file:// URLs, as they are visible to the outside world.
                        const Path path(_docBroker->getJailRoot(), url.substr(filePrefix.length()));
                        url = filePrefix + path.toString().substr(1);
                    }
                    peer->_saveAsQueue.put(url);
                }

                return true;
            }
        }

        if (peer && !_isDocPasswordProtected)
        {
            if (tokens[0] == "tile:")
            {
                int part, width, height, tilePosX, tilePosY, tileWidth, tileHeight;
                if (tokens.count() < 8 ||
                    !getTokenInteger(tokens[1], "part", part) ||
                    !getTokenInteger(tokens[2], "width", width) ||
                    !getTokenInteger(tokens[3], "height", height) ||
                    !getTokenInteger(tokens[4], "tileposx", tilePosX) ||
                    !getTokenInteger(tokens[5], "tileposy", tilePosY) ||
                    !getTokenInteger(tokens[6], "tilewidth", tileWidth) ||
                    !getTokenInteger(tokens[7], "tileheight", tileHeight))
                    assert(false);

                assert(firstLine.size() < static_cast<std::string::size_type>(length));
                _docBroker->tileCache().saveTile(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight, buffer + firstLine.size() + 1, length - firstLine.size() - 1);
            }
            else if (tokens[0] == "status:")
            {
                _docBroker->tileCache().saveTextFile(std::string(buffer, length), "status.txt");

                // let clients know if they hold the edit lock
                std::string message = "editlock ";
                message += std::to_string(peer->isEditLocked());
                forwardToPeer(message.c_str(), message.size());
            }
            else if (tokens[0] == "commandvalues:")
            {
                const std::string stringMsg(buffer, length);
                const auto index = stringMsg.find_first_of("{");
                if (index != std::string::npos)
                {
                    const std::string stringJSON = stringMsg.substr(index);
                    Poco::JSON::Parser parser;
                    const auto result = parser.parse(stringJSON);
                    const auto object = result.extract<Poco::JSON::Object::Ptr>();
                    const std::string commandName = object->get("commandName").toString();
                    if (commandName.find(".uno:CharFontName") != std::string::npos ||
                        commandName.find(".uno:StyleApply") != std::string::npos)
                    {
                        // other commands should not be cached
                        _docBroker->tileCache().saveTextFile(stringMsg, "cmdValues" + commandName + ".txt");
                    }
                }
            }
            else if (tokens[0] == "partpagerectangles:")
            {
                if (tokens.count() > 1 && !tokens[1].empty())
                    _docBroker->tileCache().saveTextFile(std::string(buffer, length), "partpagerectangles.txt");
            }
            else if (tokens[0] == "invalidatecursor:")
            {
                _docBroker->tileCache().setEditing(true);
            }
            else if (tokens[0] == "invalidatetiles:")
            {
                // FIXME temporarily, set the editing on the 1st invalidate, TODO extend
                // the protocol so that the client can set the editing or view only.
                _docBroker->tileCache().setEditing(true);

                assert(firstLine.size() == static_cast<std::string::size_type>(length));
                _docBroker->tileCache().invalidateTiles(firstLine);
            }
            else if (tokens[0] == "renderfont:")
            {
                std::string font;
                if (tokens.count() < 2 ||
                    !getTokenString(tokens[1], "font", font))
                    assert(false);

                assert(firstLine.size() < static_cast<std::string::size_type>(length));
                _docBroker->tileCache().saveRendering(font, "font", buffer + firstLine.size() + 1, length - firstLine.size() - 1);
            }
        }

        forwardToPeer(buffer, length);
        return true;
    }

    if (_kind == Kind::ToPrisoner)
    {
        // Message from child process to be forwarded to client.

        // I think we should never get here
        Log::error(getName() + ": Unexpected request [" + tokens[0] + "].");
        assert(false);
    }
    else if (tokens[0] == "takeedit")
    {
        _docBroker->takeEditLock(getId());
        return true;
    }
    else if (tokens[0] == "load")
    {
        if (_docURL != "")
        {
            sendTextFrame("error: cmd=load kind=docalreadyloaded");
            return false;
        }
        return loadDocument(buffer, length, tokens);
    }
    else if (tokens[0] != "canceltiles" &&
             tokens[0] != "clientzoom" &&
             tokens[0] != "clientvisiblearea" &&
             tokens[0] != "commandvalues" &&
             tokens[0] != "disconnect" &&
             tokens[0] != "downloadas" &&
             tokens[0] != "getchildid" &&
             tokens[0] != "gettextselection" &&
             tokens[0] != "paste" &&
             tokens[0] != "insertfile" &&
             tokens[0] != "invalidatetiles" &&
             tokens[0] != "key" &&
             tokens[0] != "mouse" &&
             tokens[0] != "partpagerectangles" &&
             tokens[0] != "renderfont" &&
             tokens[0] != "requestloksession" &&
             tokens[0] != "resetselection" &&
             tokens[0] != "saveas" &&
             tokens[0] != "selectgraphic" &&
             tokens[0] != "selecttext" &&
             tokens[0] != "setclientpart" &&
             tokens[0] != "setpage" &&
             tokens[0] != "status" &&
             tokens[0] != "tile" &&
             tokens[0] != "tilecombine" &&
             tokens[0] != "unload" &&
             tokens[0] != "uno")
    {
        sendTextFrame("error: cmd=" + tokens[0] + " kind=unknown");
        return false;
    }
    else if (_docURL == "")
    {
        sendTextFrame("error: cmd=" + tokens[0] + " kind=nodocloaded");
        return false;
    }
    else if (tokens[0] == "canceltiles")
    {
        if (!_peer.expired())
            forwardToPeer(buffer, length);
    }
    else if (tokens[0] == "commandvalues")
    {
        return getCommandValues(buffer, length, tokens);
    }
    else if (tokens[0] == "partpagerectangles")
    {
        return getPartPageRectangles(buffer, length);
    }
    else if (tokens[0] == "invalidatetiles")
    {
        return invalidateTiles(buffer, length, tokens);
    }
    else if (tokens[0] == "renderfont")
    {
        sendFontRendering(buffer, length, tokens);
    }
    else if (tokens[0] == "status")
    {
        return getStatus(buffer, length);
    }
    else if (tokens[0] == "tile")
    {
        sendTile(buffer, length, tokens);
    }
    else if (tokens[0] == "tilecombine")
    {
        sendCombinedTiles(buffer, length, tokens);
    }
    else
    {
        // All other commands are such that they always require a
        // LibreOfficeKitDocument session, i.e. need to be handled in
        // a child process.

        if (_peer.expired())
        {
            Log::trace("Dispatching child to handle [" + tokens[0] + "].");
            dispatchChild();
        }

        if (tokens[0] == "setclientpart")
        {
            _docBroker->tileCache().removeFile("status.txt");
        }

        if (_kind == Kind::ToClient && !isEditLocked())
        {
            std::string dummyFrame = "dummymsg";
            forwardToPeer(dummyFrame.c_str(), dummyFrame.size());
        }
        else if (tokens[0] != "requestloksession")
        {
            forwardToPeer(buffer, length);
        }

        if (tokens[0] == "disconnect")
        {
            // This was the last we would hear from the client on this socket.
            return handleDisconnect(tokens);
        }
    }
    return true;
}

bool MasterProcessSession::invalidateTiles(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int part, tilePosX, tilePosY, tileWidth, tileHeight;

    if (tokens.count() != 6 ||
        !getTokenInteger(tokens[1], "part", part) ||
        !getTokenInteger(tokens[2], "tileposx", tilePosX) ||
        !getTokenInteger(tokens[3], "tileposy", tilePosY) ||
        !getTokenInteger(tokens[4], "tilewidth", tileWidth) ||
        !getTokenInteger(tokens[5], "tileheight", tileHeight))
    {
        sendTextFrame("error: cmd=invalidatetiles kind=syntax");
        return false;
    }

    // FIXME temporarily, set the editing on the 1st invalidate, TODO extend
    // the protocol so that the client can set the editing or view only.
    _docBroker->tileCache().setEditing(true);

    _docBroker->tileCache().invalidateTiles(_curPart, tilePosX, tilePosY, tileWidth, tileHeight);
    return true;
}

bool MasterProcessSession::loadDocument(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    if (tokens.count() < 2)
    {
        sendTextFrame("error: cmd=load kind=syntax");
        return false;
    }

    try
    {
        std::string timestamp;
        parseDocOptions(tokens, _loadPart, timestamp);

        // Finally, wait for the Child to connect to Master,
        // link the document in jail and dispatch load to child.
        Log::trace("Dispatching child to handle [load].");
        dispatchChild();

        return true;
    }
    catch (const Poco::SyntaxException&)
    {
        sendTextFrame("error: cmd=load kind=uriinvalid");
    }

    return false;
}

bool MasterProcessSession::getStatus(const char *buffer, int length)
{
    const std::string status = _docBroker->tileCache().getTextFile("status.txt");
    if (status.size() > 0)
    {
        sendTextFrame(status);
        // let clients know if they hold the edit lock
        std::string message = "editlock ";
        message += std::to_string(isEditLocked());
        sendTextFrame(message);
        return true;
    }

    if (_peer.expired())
    {
        Log::trace("Dispatching child to handle [getStatus].");
        dispatchChild();
    }
    forwardToPeer(buffer, length);
    return true;
}

bool MasterProcessSession::getCommandValues(const char *buffer, int length, StringTokenizer& tokens)
{
    std::string command;
    if (tokens.count() != 2 || !getTokenString(tokens[1], "command", command))
    {
        sendTextFrame("error: cmd=commandvalues kind=syntax");
        return false;
    }

    const std::string cmdValues = _docBroker->tileCache().getTextFile("cmdValues" + command + ".txt");
    if (cmdValues.size() > 0)
    {
        sendTextFrame(cmdValues);
        return true;
    }

    if (_peer.expired())
        dispatchChild();
    forwardToPeer(buffer, length);
    return true;
}

bool MasterProcessSession::getPartPageRectangles(const char *buffer, int length)
{
    const std::string partPageRectangles = _docBroker->tileCache().getTextFile("partpagerectangles.txt");
    if (partPageRectangles.size() > 0)
    {
        sendTextFrame(partPageRectangles);
        return true;
    }

    if (_peer.expired())
        dispatchChild();
    forwardToPeer(buffer, length);
    return true;
}

std::string MasterProcessSession::getSaveAs()
{
    const auto payload = _saveAsQueue.get();
    return std::string(payload.data(), payload.size());
}

void MasterProcessSession::sendFontRendering(const char *buffer, int length, StringTokenizer& tokens)
{
    std::string font;
    if (tokens.count() < 2 ||
        !getTokenString(tokens[1], "font", font))
    {
        sendTextFrame("error: cmd=renderfont kind=syntax");
        return;
    }

    const std::string response = "renderfont: " + Poco::cat(std::string(" "), tokens.begin() + 1, tokens.end()) + "\n";

    std::vector<char> output;
    output.resize(response.size());
    std::memcpy(output.data(), response.data(), response.size());

    std::unique_ptr<std::fstream> cachedRendering = _docBroker->tileCache().lookupRendering(font, "font");
    if (cachedRendering && cachedRendering->is_open())
    {
        cachedRendering->seekg(0, std::ios_base::end);
        size_t pos = output.size();
        std::streamsize size = cachedRendering->tellg();
        output.resize(pos + size);
        cachedRendering->seekg(0, std::ios_base::beg);
        cachedRendering->read(output.data() + pos, size);
        cachedRendering->close();

        sendBinaryFrame(output.data(), output.size());
        return;
    }

    if (_peer.expired())
        dispatchChild();
    forwardToPeer(buffer, length);
}

void MasterProcessSession::sendTile(const char *buffer, int length, StringTokenizer& tokens)
{
    int part, width, height, tilePosX, tilePosY, tileWidth, tileHeight;

    if (tokens.count() < 8 ||
        !getTokenInteger(tokens[1], "part", part) ||
        !getTokenInteger(tokens[2], "width", width) ||
        !getTokenInteger(tokens[3], "height", height) ||
        !getTokenInteger(tokens[4], "tileposx", tilePosX) ||
        !getTokenInteger(tokens[5], "tileposy", tilePosY) ||
        !getTokenInteger(tokens[6], "tilewidth", tileWidth) ||
        !getTokenInteger(tokens[7], "tileheight", tileHeight))
    {
        sendTextFrame("error: cmd=tile kind=syntax");
        return;
    }

    if (part < 0 ||
        width <= 0 ||
        height <= 0 ||
        tilePosX < 0 ||
        tilePosY < 0 ||
        tileWidth <= 0 ||
        tileHeight <= 0)
    {
        sendTextFrame("error: cmd=tile kind=invalid");
        return;
    }

    std::string response = "tile: " + Poco::cat(std::string(" "), tokens.begin() + 1, tokens.end()) + "\n";

    std::vector<char> output;
    output.reserve(4 * width * height);
    output.resize(response.size());
    std::memcpy(output.data(), response.data(), response.size());

    std::unique_ptr<std::fstream> cachedTile = _docBroker->tileCache().lookupTile(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
    if (cachedTile && cachedTile->is_open())
    {
        cachedTile->seekg(0, std::ios_base::end);
        size_t pos = output.size();
        std::streamsize size = cachedTile->tellg();
        output.resize(pos + size);
        cachedTile->seekg(0, std::ios_base::beg);
        cachedTile->read(output.data() + pos, size);
        cachedTile->close();

        sendBinaryFrame(output.data(), output.size());

        return;
    }

    if (_peer.expired())
        dispatchChild();
    forwardToPeer(buffer, length);
}

void MasterProcessSession::sendCombinedTiles(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int part, pixelWidth, pixelHeight, tileWidth, tileHeight;
    std::string tilePositionsX, tilePositionsY;
    std::string reqTimestamp;

    if (tokens.count() < 8 ||
        !getTokenInteger(tokens[1], "part", part) ||
        !getTokenInteger(tokens[2], "width", pixelWidth) ||
        !getTokenInteger(tokens[3], "height", pixelHeight) ||
        !getTokenString (tokens[4], "tileposx", tilePositionsX) ||
        !getTokenString (tokens[5], "tileposy", tilePositionsY) ||
        !getTokenInteger(tokens[6], "tilewidth", tileWidth) ||
        !getTokenInteger(tokens[7], "tileheight", tileHeight))
    {
        sendTextFrame("error: cmd=tilecombine kind=syntax");
        return;
    }

    if (part < 0 || pixelWidth <= 0 || pixelHeight <= 0
       || tileWidth <= 0 || tileHeight <= 0
       || tilePositionsX.empty() || tilePositionsY.empty())
    {
        sendTextFrame("error: cmd=tilecombine kind=invalid");
        return;
    }

    if (tokens.count() > 8)
        getTokenString(tokens[8], "timestamp", reqTimestamp);

    Util::Rectangle renderArea;

    StringTokenizer positionXtokens(tilePositionsX, ",", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
    StringTokenizer positionYtokens(tilePositionsY, ",", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    size_t numberOfPositions = positionYtokens.count();

    // check that number of positions for X and Y is the same
    if (numberOfPositions != positionYtokens.count())
    {
        sendTextFrame("error: cmd=tilecombine kind=invalid");
        return;
    }

    std::string forwardTileX;
    std::string forwardTileY;

    for (size_t i = 0; i < numberOfPositions; i++)
    {
        int x, y;

        if (!stringToInteger(positionXtokens[i], x))
        {
            sendTextFrame("error: cmd=tilecombine kind=syntax");
            return;
        }
        if (!stringToInteger(positionYtokens[i], y))
        {
            sendTextFrame("error: cmd=tilecombine kind=syntax");
            return;
        }

        std::unique_ptr<std::fstream> cachedTile = _docBroker->tileCache().lookupTile(part, pixelWidth, pixelHeight, x, y, tileWidth, tileHeight);

        if (cachedTile && cachedTile->is_open())
        {
            std::ostringstream oss;
            oss << "tile: part=" << part
                << " width=" << pixelWidth
                << " height=" << pixelHeight
                << " tileposx=" << x
                << " tileposy=" << y
                << " tilewidth=" << tileWidth
                << " tileheight=" << tileHeight;

            if (!reqTimestamp.empty())
            {
                oss << " timestamp=" << reqTimestamp;
            }

            oss << "\n";
            const std::string response = oss.str();

            std::vector<char> output;
            output.reserve(4 * pixelWidth * pixelHeight);
            output.resize(response.size());
            std::memcpy(output.data(), response.data(), response.size());
            cachedTile->seekg(0, std::ios_base::end);
            const size_t pos = output.size();
            const std::streamsize size = cachedTile->tellg();
            output.resize(pos + size);
            cachedTile->seekg(0, std::ios_base::beg);
            cachedTile->read(output.data() + pos, size);
            cachedTile->close();

            sendBinaryFrame(output.data(), output.size());
        }
        else
        {
            if (!forwardTileX.empty())
                forwardTileX += ",";
            forwardTileX += std::to_string(x);

            if (!forwardTileY.empty())
                forwardTileY += ",";
            forwardTileY += std::to_string(y);
        }
    }

    if (forwardTileX.empty() && forwardTileY.empty())
        return;

    if (_peer.expired())
        dispatchChild();

    std::string forward = "tilecombine part=" + std::to_string(part) +
                               " width=" + std::to_string(pixelWidth) +
                               " height=" + std::to_string(pixelHeight) +
                               " tileposx=" + forwardTileX +
                               " tileposy=" + forwardTileY +
                               " tilewidth=" + std::to_string(tileWidth) +
                               " tileheight=" + std::to_string(tileHeight);

    if (!reqTimestamp.empty())
        forward += " timestamp=" + reqTimestamp;

    forwardToPeer(forward.c_str(), forward.size());
}

void MasterProcessSession::dispatchChild()
{
    int retries = 3;
    bool isFound = false;

    // Wait until the child has connected with Master.
    std::shared_ptr<MasterProcessSession> childSession;
    std::unique_lock<std::mutex> lock(AvailableChildSessionMutex);

    Log::debug() << "Waiting for child session [" << getId() << "] to connect." << Log::end;
    while (retries-- && !isFound)
    {
        AvailableChildSessionCV.wait_for(
            lock,
            std::chrono::milliseconds(3000),
            [&isFound, this]
            {
                return (isFound = AvailableChildSessions.find(getId()) != AvailableChildSessions.end());
            });

        if (!isFound)
        {
            Log::info() << "Retrying child permission... " << retries << Log::end;
            // request again new URL session
            const std::string message = "request " + getId() + " " + _docBroker->getDocKey() + '\n';
            Log::trace("MasterToBroker: " + message.substr(0, message.length()-1));
            IoUtil::writeFIFO(LOOLWSD::BrokerWritePipe, message);
        }
    }

    if (!isFound)
    {
        Log::error(getName() + ": Failed to connect to child. Shutting down socket.");
        IoUtil::shutdownWebSocket(_ws);
        throw std::runtime_error("Failed to connect to child.");
    }

    Log::debug("Waiting child session permission, done!");
    childSession = AvailableChildSessions[getId()];
    AvailableChildSessions.erase(getId());

    _peer = childSession;
    childSession->_peer = shared_from_this();
    childSession->_docBroker = _docBroker;
    Log::debug("Connected " + getName() + " - " + childSession->getName() + ".");

    std::ostringstream oss;
    oss << "load";
    oss << " url=" << _docBroker->getPublicUri().toString();
    oss << " jail=" << _docBroker->getJailedUri().toString();

    if (_loadPart >= 0)
        oss << " part=" + std::to_string(_loadPart);

    if (_isDocPasswordProvided)
        oss << " password=" << _docPassword;

    if (!_docOptions.empty())
        oss << " options=" << _docOptions;

    const auto loadRequest = oss.str();
    forwardToPeer(loadRequest.c_str(), loadRequest.size());
}

void MasterProcessSession::forwardToPeer(const char *buffer, int length)
{
    const auto message = getAbbreviatedMessage(buffer, length);
    Log::trace(getName() + " Forward: " + message);

    auto peer = _peer.lock();
    if (!peer)
    {
        Log::error(getName() + ": no peer to forward to.");
        return;
    }

    peer->sendBinaryFrame(buffer, length);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
