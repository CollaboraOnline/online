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
#include "Protocol.hpp"
#include "Session.hpp"
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

PrisonerSession::PrisonerSession(std::shared_ptr<ClientSession> clientSession,
                                 std::shared_ptr<DocumentBroker> docBroker) :
    LOOLSession(clientSession->getId(), Kind::ToPrisoner, nullptr),
    _docBroker(std::move(docBroker)),
    _peer(clientSession),
    _curPart(0)
{
    LOG_INF("PrisonerSession ctor [" << getName() << "].");
}

PrisonerSession::~PrisonerSession()
{
    LOG_INF("~PrisonerSession dtor [" << getName() << "].");
}

bool PrisonerSession::_handleInput(const char *buffer, int length)
{
    LOG_TRC(getName() + ": handling [" << getAbbreviatedMessage(buffer, length) << "].");
    const std::string firstLine = getFirstLine(buffer, length);
    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    LOOLWSD::dumpOutgoingTrace(_docBroker->getJailId(), getId(), firstLine);

    auto peer = _peer.lock();
    if (!peer)
    {
        throw Poco::ProtocolException("The session has not been assigned a peer.");
    }

    bool isBinary = true;
    if (tokens[0] == "unocommandresult:")
    {
        const std::string stringMsg(buffer, length);
        LOG_INF(getName() << ": Command: " << stringMsg);
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

                if (!_docBroker->save(getId(), success, result))
                    LOG_ERR("Saving document to storage failed.");
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
                if (errorKind == "passwordrequired:to-view" ||
                    errorKind == "passwordrequired:to-modify" ||
                    errorKind == "wrongpassword")
                {
                    forwardToPeer(_peer, buffer, length, isBinary);
                    LOG_WRN("Document load failed: " << errorKind);
                    return false;
                }
            }
        }
    }
    else if (tokens[0] == "curpart:" &&
             tokens.count() == 2 &&
             getTokenInteger(tokens[1], "part", _curPart))
    {
        return true;
    }
    else if (tokens.count() == 2 && tokens[0] == "saveas:")
    {
        std::string url;
        if (!getTokenString(tokens[1], "url", url))
        {
            LOG_ERR("Bad syntax for: " << firstLine);
            return false;
        }

        // Save-as completed, inform the ClientSession.
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
                LOG_DBG("SaveAs produced no output, producing blank url.");
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
            return forwardToPeer(_peer, buffer, length, isBinary);
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
                const std::string commandName = object->has("commandName") ? object->get("commandName").toString() : "";
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
            _docBroker->invalidateTiles(firstLine);
        }
        else if (tokens[0] == "invalidatecursor:")
        {
            assert(firstLine.size() == static_cast<std::string::size_type>(length));
            StringTokenizer firstLineTokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            int x = 0, y = 0, w = 0, h = 0;
            if (firstLineTokens.count() > 2 &&
                stringToInteger(firstLineTokens[1], x) &&
                stringToInteger(firstLineTokens[2], y))
            {
                if (firstLineTokens.count() > 3)
                {
                    stringToInteger(firstLineTokens[3], w);
                    stringToInteger(firstLineTokens[4], h);
                }
                _docBroker->invalidateCursor(x, y, w, h);
            }
            else
            {
                LOG_ERR("Unable to parse " << firstLine);
            }
        }
        else if (tokens[0] == "renderfont:")
        {
            std::string font, text, encodedChar;
            if (tokens.count() < 3 ||
                !getTokenString(tokens[1], "font", font))
            {
                LOG_ERR("Bad syntax for: " << firstLine);
                return false;
            }

            getTokenString(tokens[2], "char", text);
            Poco::URI::encode(text, "", encodedChar);
            assert(firstLine.size() < static_cast<std::string::size_type>(length));
            _docBroker->tileCache().saveRendering(font+encodedChar, "font", buffer + firstLine.size() + 1, length - firstLine.size() - 1);
            forwardToPeer(_peer, buffer, length, true);
            return true;
        }
    }
    else
    {
        LOG_INF("Ignoring notification on password protected document: " << firstLine);
    }

    // Detect json messages, since we must send those as text even though they are multiline.
    // If not, the UI will read the first line of a binary payload, assuming that's the only
    // text part and the rest is binary.
    isBinary = buffer[length - 1] != '}' && firstLine.find('{') == std::string::npos;

    // Forward everything else.
    forwardToPeer(_peer, buffer, length, isBinary);
    return true;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
