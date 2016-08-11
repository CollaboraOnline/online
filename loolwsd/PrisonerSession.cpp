/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "PrisonerSession.hpp"
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
#include "Log.hpp"
#include "ClientSession.hpp"
#include "Rectangle.hpp"
#include "Storage.hpp"
#include "TileCache.hpp"
#include "IoUtil.hpp"
#include "Util.hpp"

using namespace LOOLProtocol;

using Poco::Path;
using Poco::StringTokenizer;

PrisonerSession::PrisonerSession(const std::string& id,
                                 std::shared_ptr<Poco::Net::WebSocket> ws,
                                 std::shared_ptr<DocumentBroker> docBroker) :
    LOOLSession(id, Kind::ToPrisoner, ws),
    _docBroker(std::move(docBroker)),
    _curPart(0)
{
    Log::info("PrisonerSession ctor [" + getName() + "].");
}

PrisonerSession::~PrisonerSession()
{
    Log::info("~PrisonerSession dtor [" + getName() + "].");
}

bool PrisonerSession::_handleInput(const char *buffer, int length)
{
    const std::string firstLine = getFirstLine(buffer, length);
    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
    Log::trace(getName() + ": handling [" + firstLine + "].");

    LOOLWSD::dumpOutgoingTrace(_docBroker->getJailId(), getId(), firstLine);

    if (LOOLProtocol::tokenIndicatesUserInteraction(tokens[0]))
    {
        // Keep track of timestamps of incoming client messages that indicate user activity.
        updateLastActivityTime();
    }

    // Note that this handles both forwarding requests from the client to the child process, and
    // forwarding replies from the child process to the client. Or does it?

    // Snoop at some messages and manipulate tile cache information as needed
    auto peer = _peer.lock();
    if (!peer)
    {
        throw Poco::ProtocolException("The session has not been assigned a peer.");
    }

    bool isBinary = true;
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
    else
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
                    forwardToPeer(_peer, buffer, length, isBinary);
                    peer->setLoadFailed(errorKind);
                    return false;
                }
            }
        }
    }
    else
    if (tokens[0] == "curpart:" &&
        tokens.count() == 2 &&
        getTokenInteger(tokens[1], "part", _curPart))
    {
        return true;
    }
    else
    if (tokens.count() == 2 && tokens[0] == "saveas:")
    {
        std::string url;
        if (!getTokenString(tokens[1], "url", url))
        {
            Log::error("Bad syntax for: " + firstLine);
            return false;
        }

        // Save as completed, inform the other (Kind::ToClient)
        // PrisonerSession about it.

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

        peer->setSaveAsUrl(url);
        return true;
    }
    else if (tokens.count() == 2 && tokens[0] == "statechanged:")
    {
        if (_docBroker)
        {
            StringTokenizer stateTokens(tokens[1], "=", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            if (stateTokens.count() == 2 && stateTokens[0] == ".uno:ModifiedStatus")
            {
                _docBroker->setModified(stateTokens[1] == "true");
            }
        }
    }

    if (!_isDocPasswordProtected)
    {
        if (tokens[0] == "tile:")
        {
            assert(false && "Tile traffic should go through the DocumentBroker-LoKit WS.");
        }
        else if (tokens[0] == "status:")
        {
            _docBroker->setLoaded();

            // Forward the status response to the client.
            forwardToPeer(_peer, buffer, length, isBinary);

            // And let clients know if they hold the edit lock.
            std::string message = "editlock: ";
            message += std::to_string(peer->isEditLocked());
            Log::debug("Forwarding [" + message + "] in response to status.");
            return forwardToPeer(_peer, message.c_str(), message.size(), isBinary);
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
            {
                _docBroker->tileCache().saveTextFile(std::string(buffer, length), "partpagerectangles.txt");
            }
        }
        else if (tokens[0] == "invalidatetiles:")
        {
            assert(firstLine.size() == static_cast<std::string::size_type>(length));
            _docBroker->tileCache().invalidateTiles(firstLine);
        }
        else if (tokens[0] == "invalidatecursor:")
        {
            assert(firstLine.size() == static_cast<std::string::size_type>(length));
            StringTokenizer firstLineTokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            int x = 0;
            int y = 0;
            if (firstLineTokens.count() > 2 &&
                stringToInteger(firstLineTokens[1], x) &&
                stringToInteger(firstLineTokens[2], y))
            {
                _docBroker->invalidateCursor(x, y);
            }
            else
            {
                Log::error("Unable to parse " + firstLine);
            }
        }
        else if (tokens[0] == "renderfont:")
        {
            std::string font;
            if (tokens.count() < 2 ||
                !getTokenString(tokens[1], "font", font))
            {
                Log::error("Bad syntax for: " + firstLine);
                return false;
            }

            assert(firstLine.size() < static_cast<std::string::size_type>(length));
            _docBroker->tileCache().saveRendering(font, "font", buffer + firstLine.size() + 1, length - firstLine.size() - 1);
        }
    }

    // Detect json messages, since we must send those as text even though they are multiline.
    // If not, the UI will read the first line of a binary payload, assuming that's the only
    // text part and the rest is binary.
    isBinary = buffer[length - 1] != '}' && firstLine.find('{') == std::string::npos;

    // Forward everything else.
    forwardToPeer(_peer, buffer, length, isBinary);
    return true;
}

bool PrisonerSession::shutdownPeer(Poco::UInt16 statusCode, const std::string& message)
{
    auto peer = _peer.lock();
    if (peer && !peer->isCloseFrame())
    {
        peer->shutdown(statusCode, message);
    }

    return peer != nullptr;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
