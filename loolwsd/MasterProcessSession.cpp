/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

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

MasterProcessSession::MasterProcessSession(const std::string& id,
                                           const Kind kind,
                                           std::shared_ptr<Poco::Net::WebSocket> ws,
                                           std::shared_ptr<DocumentBroker> docBroker,
                                           std::shared_ptr<BasicTileQueue> queue) :
    LOOLSession(id, kind, ws),
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

    // Release the save-as queue.
    _saveAsQueue.put("");
}

bool MasterProcessSession::_handleInput(const char *buffer, int length)
{
    const std::string firstLine = getFirstLine(buffer, length);
    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
    Log::trace(getName() + ": handling [" + firstLine + "].");

    if (LOOLProtocol::tokenIndicatesUserInteraction(tokens[0]))
    {
        // Keep track of timestamps of incoming client messages that indicate user activity.
        updateLastActivityTime();
    }

    if (tokens[0] == "loolclient")
    {
        const auto versionTuple = ParseVersion(tokens[1]);
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

    if (_kind == Kind::ToPrisoner)
    {
        // Note that this handles both forwarding requests from the client to the child process, and
        // forwarding replies from the child process to the client. Or does it?

        // Snoop at some messages and manipulate tile cache information as needed
        auto peer = _peer.lock();

        {
            if (!peer)
            {
                throw Poco::ProtocolException("The session has not been assigned a peer.");
            }

            if (tokens[0] == "unocommandresult:")
            {
                const std::string stringMsg(buffer, length);
                Log::info(getName() + "Command: " + stringMsg);
                const auto index = stringMsg.find_first_of('{');
                if (index != std::string::npos)
                {
                    const std::string stringJSON = stringMsg.substr(index);
                    Poco::JSON::Parser parser;
                    const auto parsedJSON = parser.parse(stringJSON);
                    const auto& object = parsedJSON.extract<Poco::JSON::Object::Ptr>();
                    if (object->get("commandName").toString() == ".uno:Save")
                    {
                        bool success = object->get("success").toString() == "true";
                        std::string result;
                        if (object->has("result"))
                        {
                            const auto parsedResultJSON = object->get("result");
                            const auto& resultObj = parsedResultJSON.extract<Poco::JSON::Object::Ptr>();
                            if (resultObj->get("type").toString() == "string")
                                result = resultObj->get("value").toString();
                        }

                        _docBroker->save(success, result);
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
                        if (Poco::File(path).exists())
                        {
                            url = filePrefix + path.toString().substr(1);
                        }
                        else
                        {
                            // Blank for failure.
                            Log::debug("SaveAs produced no output, producing blank url.");
                            url.clear();
                        }
                    }

                    peer->_saveAsQueue.put(url);
                }

                return true;
            }
            else if (tokens.count() == 2 && tokens[0] == "statechanged:")
            {
                StringTokenizer stateTokens(tokens[1], "=", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
                if (stateTokens.count() == 2 && stateTokens[0] == ".uno:ModifiedStatus")
                {
                    if (_docBroker)
                    {
                        _docBroker->setModified(stateTokens[1] == "true");
                    }
                }
            }
        }

        if (peer && !_isDocPasswordProtected)
        {
            if (tokens[0] == "tile:")
            {
                assert(!"Tile traffic should go through the DocumentBroker-LoKit WS.");
            }
            else if (tokens[0] == "status:")
            {
                _docBroker->setLoaded();
                _docBroker->tileCache().saveTextFile(std::string(buffer, length), "status.txt");

                // Forward the status response to the client.
                forwardToPeer(buffer, length);

                // And let clients know if they hold the edit lock.
                std::string message = "editlock: ";
                message += std::to_string(peer->isEditLocked());
                Log::debug("Forwarding [" + message + "] in response to status.");
                forwardToPeer(message.c_str(), message.size());
                return true;
            }
            else if (tokens[0] == "commandvalues:")
            {
                const std::string stringMsg(buffer, length);
                const auto index = stringMsg.find_first_of('{');
                if (index != std::string::npos)
                {
                    const std::string stringJSON = stringMsg.substr(index);
                    Poco::JSON::Parser parser;
                    const auto result = parser.parse(stringJSON);
                    const auto& object = result.extract<Poco::JSON::Object::Ptr>();
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
            else if (tokens[0] == "invalidatetiles:")
            {
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
             tokens[0] != "downloadas" &&
             tokens[0] != "getchildid" &&
             tokens[0] != "gettextselection" &&
             tokens[0] != "paste" &&
             tokens[0] != "insertfile" &&
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
             tokens[0] != "uno" &&
             tokens[0] != "useractive" &&
             tokens[0] != "userinactive")
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

        // Allow 'downloadas' for all kinds of views irrespective of editlock
        if (_kind == Kind::ToClient && !isEditLocked() && tokens[0] != "downloadas" &&
            tokens[0] != "userinactive" && tokens[0] != "useractive")
        {
            std::string dummyFrame = "dummymsg";
            forwardToPeer(dummyFrame.c_str(), dummyFrame.size());
        }
        else if (tokens[0] != "requestloksession")
        {
            forwardToPeer(buffer, length);
        }
    }
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
    if (!status.empty())
    {
        sendTextFrame(status);

        // And let clients know if they hold the edit lock.
        std::string message = "editlock: ";
        message += std::to_string(isEditLocked());
        Log::debug("Forwarding [" + message + "] in response to status.");
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

void MasterProcessSession::setEditLock(const bool value)
{
    // Update the sate and forward to child.
    _bEditLock = value;
    const auto msg = std::string("editlock: ") + (value ? "1" : "0");
    forwardToPeer(msg.data(), msg.size());
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

void MasterProcessSession::sendTile(const char * /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int part, width, height, tilePosX, tilePosY, tileWidth, tileHeight, id = -1;
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

    size_t index = 8;
    if (tokens.count() > index && tokens[index].find("id") == 0)
    {
        getTokenInteger(tokens[index], "id", id);
        ++index;
    }

    _docBroker->handleTileRequest(part, width, height, tilePosX, tilePosY,
                                  tileWidth, tileHeight, id, shared_from_this());
}

void MasterProcessSession::sendCombinedTiles(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int part, pixelWidth, pixelHeight, tileWidth, tileHeight;
    std::string tilePositionsX, tilePositionsY;
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

    if (part < 0 || pixelWidth <= 0 || pixelHeight <= 0 ||
        tileWidth <= 0 || tileHeight <= 0 ||
        tilePositionsX.empty() || tilePositionsY.empty())
    {
        sendTextFrame("error: cmd=tilecombine kind=invalid");
        return;
    }

    std::string reqTimestamp;
    size_t index = 8;
    if (tokens.count() > index && tokens[index].find("timestamp") == 0)
    {
        getTokenString(tokens[index], "timestamp", reqTimestamp);
        ++index;
    }

    int id = -1;
    if (tokens.count() > index && tokens[index].find("id") == 0)
    {
        getTokenInteger(tokens[index], "id", id);
        ++index;
    }

    StringTokenizer positionXtokens(tilePositionsX, ",", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
    StringTokenizer positionYtokens(tilePositionsY, ",", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    size_t numberOfPositions = positionYtokens.count();

    // check that number of positions for X and Y is the same
    if (numberOfPositions != positionXtokens.count())
    {
        sendTextFrame("error: cmd=tilecombine kind=invalid");
        return;
    }

    for (size_t i = 0; i < numberOfPositions; ++i)
    {
        int x = 0;
        if (!stringToInteger(positionXtokens[i], x))
        {
            sendTextFrame("error: cmd=tilecombine kind=syntax");
            return;
        }

        int y = 0;
        if (!stringToInteger(positionYtokens[i], y))
        {
            sendTextFrame("error: cmd=tilecombine kind=syntax");
            return;
        }

        _docBroker->handleTileRequest(part, pixelWidth, pixelHeight, x, y,
                                      tileWidth, tileHeight, id, shared_from_this());
    }
}

void MasterProcessSession::dispatchChild()
{
    std::ostringstream oss;
    oss << "load";
    oss << " url=" << _docBroker->getPublicUri().toString();
    oss << " jail=" << _docBroker->getJailedUri().toString();

    if (!_userName.empty())
    {
        std::string encodedUserName;
        Poco::URI::encode(_userName, "", encodedUserName);
        oss << " author=" + encodedUserName;
    }

    if (_loadPart >= 0)
        oss << " part=" + std::to_string(_loadPart);

    if (_haveDocPassword)
        oss << " password=" << _docPassword;

    if (!_docOptions.empty())
        oss << " options=" << _docOptions;

    const auto loadRequest = oss.str();
    forwardToPeer(loadRequest.c_str(), loadRequest.size());
}

void MasterProcessSession::forwardToPeer(const char *buffer, int length)
{
    const auto message = getAbbreviatedMessage(buffer, length);

    auto peer = _peer.lock();
    if (!peer)
    {
        throw Poco::ProtocolException(getName() + ": no peer to forward to: [" + message + "].");
    }
    else if (peer->isCloseFrame())
    {
        Log::trace(getName() + ": peer began the closing handshake. Dropping forward message [" + message + "].");
        return;
    }

    Log::trace(getName() + " -> " + peer->getName() + ": " + message);
    peer->sendBinaryFrame(buffer, length);
}

bool MasterProcessSession::shutdownPeer(Poco::UInt16 statusCode, const std::string& message)
{
    auto peer = _peer.lock();
    if (peer && !peer->isCloseFrame() && peer->_ws)
    {
        peer->_ws->shutdown(statusCode, message);
    }

    return peer != nullptr;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
