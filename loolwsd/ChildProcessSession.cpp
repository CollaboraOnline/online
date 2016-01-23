/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <iostream>

#include <Poco/File.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/String.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>

#include "Common.hpp"
#include "ChildProcessSession.hpp"
#include "LOKitHelper.hpp"
#include "LOOLProtocol.hpp"
#include "Util.hpp"
#include "Rectangle.hpp"

using namespace LOOLProtocol;

using Poco::File;
using Poco::IOException;
using Poco::JSON::Object;
using Poco::JSON::Parser;
using Poco::Net::WebSocket;
using Poco::Path;
using Poco::Process;
using Poco::ProcessHandle;
using Poco::StringTokenizer;
using Poco::URI;

std::recursive_mutex ChildProcessSession::Mutex;

ChildProcessSession::ChildProcessSession(const std::string& id,
                                         std::shared_ptr<Poco::Net::WebSocket> ws,
                                         LibreOfficeKit* /*loKit*/,
                                         LibreOfficeKitDocument * loKitDocument,
                                         const std::string& jailId,
                                         std::function<LibreOfficeKitDocument*(const std::string&, const std::string&)> onLoad,
                                         std::function<void(const std::string&)> onUnload) :
    LOOLSession(id, Kind::ToMaster, ws),
    _loKitDocument(loKitDocument),
    _multiView(getenv("LOK_VIEW_CALLBACK")),
    _jailId(jailId),
    _viewId(0),
    _clientPart(0),
    _onLoad(onLoad),
    _onUnload(onUnload)
{
    Log::info("ChildProcessSession ctor [" + getName() + "].");
}

ChildProcessSession::~ChildProcessSession()
{
    Log::info("~ChildProcessSession dtor [" + getName() + "].");

    disconnect();
}

void ChildProcessSession::disconnect(const std::string& reason)
{
    if (!isDisconnected())
    {
        std::unique_lock<std::recursive_mutex> lock(Mutex);

        if (_multiView)
            _loKitDocument->pClass->setView(_loKitDocument, _viewId);

        //TODO: Handle saving to temp etc.
        _onUnload(getId());

        LOOLSession::disconnect(reason);
    }
}

bool ChildProcessSession::handleDisconnect(Poco::StringTokenizer& tokens)
{
    return LOOLSession::handleDisconnect(tokens);
}

bool ChildProcessSession::_handleInput(const char *buffer, int length)
{
    const std::string firstLine = getFirstLine(buffer, length);
    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    if (tokens[0] == "canceltiles")
    {
        // this command makes sense only on the command queue level, nothing
        // to do here
        return true;
    }
    else if (tokens[0] == "commandvalues")
    {
        return getCommandValues(buffer, length, tokens);
    }
    else if (tokens[0] == "partpagerectangles")
    {
        return getPartPageRectangles(buffer, length);
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
    else if (_docURL == "")
    {
        sendTextFrame("error: cmd=" + tokens[0] + " kind=nodocloaded");
        return false;
    }
    else if (tokens[0] == "renderfont")
    {
        sendFontRendering(buffer, length, tokens);
    }
    else if (tokens[0] == "setclientpart")
    {
        return setClientPart(buffer, length, tokens);
    }
    else if (tokens[0] == "setpage")
    {
        return setPage(buffer, length, tokens);
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
        // All other commands are such that they always require a LibreOfficeKitDocument session,
        // i.e. need to be handled in a child process.

        assert(tokens[0] == "clientzoom" ||
               tokens[0] == "disconnect" ||
               tokens[0] == "downloadas" ||
               tokens[0] == "getchildid" ||
               tokens[0] == "gettextselection" ||
               tokens[0] == "paste" ||
               tokens[0] == "insertfile" ||
               tokens[0] == "key" ||
               tokens[0] == "mouse" ||
               tokens[0] == "uno" ||
               tokens[0] == "selecttext" ||
               tokens[0] == "selectgraphic" ||
               tokens[0] == "resetselection" ||
               tokens[0] == "saveas" ||
               tokens[0] == "unload");

        {
            std::unique_lock<std::recursive_mutex> lock(Mutex);

            if (_multiView)
                _loKitDocument->pClass->setView(_loKitDocument, _viewId);

            if (_docType != "text" && _loKitDocument->pClass->getPart(_loKitDocument) != _clientPart)
            {
                _loKitDocument->pClass->setPart(_loKitDocument, _clientPart);
            }
        }

        if (tokens[0] == "clientzoom")
        {
            return clientZoom(buffer, length, tokens);
        }
        else if (tokens[0] == "disconnect")
        {
            // This was the last we would hear from the client on this socket.
            return handleDisconnect(tokens);
        }
        else if (tokens[0] == "downloadas")
        {
            return downloadAs(buffer, length, tokens);
        }
        else if (tokens[0] == "getchildid")
        {
            return getChildId();
        }
        else if (tokens[0] == "gettextselection")
        {
            return getTextSelection(buffer, length, tokens);
        }
        else if (tokens[0] == "paste")
        {
            return paste(buffer, length, tokens);
        }
        else if (tokens[0] == "insertfile")
        {
            return insertFile(buffer, length, tokens);
        }
        else if (tokens[0] == "key")
        {
            return keyEvent(buffer, length, tokens);
        }
        else if (tokens[0] == "mouse")
        {
            return mouseEvent(buffer, length, tokens);
        }
        else if (tokens[0] == "uno")
        {
            return unoCommand(buffer, length, tokens);
        }
        else if (tokens[0] == "selecttext")
        {
            return selectText(buffer, length, tokens);
        }
        else if (tokens[0] == "selectgraphic")
        {
            return selectGraphic(buffer, length, tokens);
        }
        else if (tokens[0] == "resetselection")
        {
            return resetSelection(buffer, length, tokens);
        }
        else if (tokens[0] == "saveas")
        {
            return saveAs(buffer, length, tokens);
        }
        else if (tokens[0] == "unload")
        {
            //FIXME: Implement.
            assert(!"Not implemented");
        }
        else
        {
            assert(false);
        }
    }
    return true;
}

bool ChildProcessSession::loadDocument(const char * /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int part = -1;
    if (tokens.count() < 2)
    {
        sendTextFrame("error: cmd=load kind=syntax");
        return false;
    }

    std::string timestamp;
    parseDocOptions(tokens, part, timestamp);

    assert(!_docURL.empty());
    assert(!_jailedFilePath.empty());

    _loKitDocument = _onLoad(getId(), _jailedFilePath);

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _viewId = _loKitDocument->pClass->getView(_loKitDocument);

    std::string renderingOptions;
    if (!_docOptions.empty())
    {
        Poco::JSON::Parser parser;
        Poco::Dynamic::Var var = parser.parse(_docOptions);
        Poco::JSON::Object::Ptr object = var.extract<Poco::JSON::Object::Ptr>();
        renderingOptions = object->get("rendering").toString();
    }

    _loKitDocument->pClass->initializeForRendering(_loKitDocument, (renderingOptions.empty() ? nullptr : renderingOptions.c_str()));

    if (_docType != "text" && part != -1)
    {
        _clientPart = part;
        _loKitDocument->pClass->setPart(_loKitDocument, part);
    }

    // Respond by the document status, which has no arguments.
    if (!getStatus(nullptr, 0))
        return false;

    Log::info("Loaded session " + getId());
    return true;
}

void ChildProcessSession::sendFontRendering(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    std::string font, decodedFont;

    if (tokens.count() < 2 ||
        !getTokenString(tokens[1], "font", font))
    {
        sendTextFrame("error: cmd=renderfont kind=syntax");
        return;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
       _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    URI::decode(font, decodedFont);
    std::string response = "renderfont: " + Poco::cat(std::string(" "), tokens.begin() + 1, tokens.end()) + "\n";

    std::vector<char> output;
    output.resize(response.size());
    std::memcpy(output.data(), response.data(), response.size());

    Poco::Timestamp timestamp;
    int width, height;
    unsigned char *pixmap = _loKitDocument->pClass->renderFont(_loKitDocument, decodedFont.c_str(), &width, &height);
    Log::trace("renderFont [" + font + "] rendered in " + std::to_string(timestamp.elapsed()/1000.) + "ms");

    if (pixmap != nullptr)
    {
        if (!Util::encodeBufferToPNG(pixmap, width, height, output, LOK_TILEMODE_RGBA))
        {
            sendTextFrame("error: cmd=renderfont kind=failure");
            delete[] pixmap;
            return;
        }
        delete[] pixmap;
    }

    sendBinaryFrame(output.data(), output.size());
}

bool ChildProcessSession::getStatus(const char* /*buffer*/, int /*length*/)
{
    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    const std::string status = "status: " + LOKitHelper::documentStatus(_loKitDocument);
    StringTokenizer tokens(status, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
    if (!getTokenString(tokens[1], "type", _docType))
    {
        Log::error("failed to get document type from status [" + status + "].");
        return false;
    }

    sendTextFrame(status);

    return true;
}

bool ChildProcessSession::getCommandValues(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    std::string command;
    if (tokens.count() != 2 || !getTokenString(tokens[1], "command", command))
    {
        sendTextFrame("error: cmd=commandvalues kind=syntax");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    sendTextFrame("commandvalues: " + std::string(_loKitDocument->pClass->getCommandValues(_loKitDocument, command.c_str())));
    return true;
}

bool ChildProcessSession::getPartPageRectangles(const char* /*buffer*/, int /*length*/)
{
    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    sendTextFrame("partpagerectangles: " + std::string(_loKitDocument->pClass->getPartPageRectangles(_loKitDocument)));
    return true;
}

void ChildProcessSession::sendTile(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
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

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    const std::string response = "tile: " + Poco::cat(std::string(" "), tokens.begin() + 1, tokens.end()) + "\n";

    std::vector<char> output;
    output.reserve(response.size() + (4 * width * height));
    output.resize(response.size());
    std::memcpy(output.data(), response.data(), response.size());

    std::vector<unsigned char> pixmap;
    pixmap.resize(4 * width * height);

    if (_docType != "text" && part != _loKitDocument->pClass->getPart(_loKitDocument))
    {
        _loKitDocument->pClass->setPart(_loKitDocument, part);
    }

    Poco::Timestamp timestamp;
    _loKitDocument->pClass->paintTile(_loKitDocument, pixmap.data(), width, height, tilePosX, tilePosY, tileWidth, tileHeight);
    Log::trace() << "paintTile at [" << tilePosX << ", " << tilePosY
                 << "] rendered in " << (timestamp.elapsed()/1000.) << " ms" << Log::end;

    LibreOfficeKitTileMode mode = static_cast<LibreOfficeKitTileMode>(_loKitDocument->pClass->getTileMode(_loKitDocument));
    if (!Util::encodeBufferToPNG(pixmap.data(), width, height, output, mode))
    {
        sendTextFrame("error: cmd=tile kind=failure");
        return;
    }

    sendBinaryFrame(output.data(), output.size());
}

void ChildProcessSession::sendCombinedTiles(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
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

    if (part < 0 || pixelWidth <= 0 || pixelHeight <= 0
       || tileWidth <= 0 || tileHeight <= 0
       || tilePositionsX.empty() || tilePositionsY.empty())
    {
        sendTextFrame("error: cmd=tilecombine kind=invalid");
        return;
    }

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

    std::vector<Util::Rectangle> tiles;
    tiles.reserve(numberOfPositions);

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

        Util::Rectangle rectangle(x, y, tileWidth, tileHeight);

        if (tiles.empty())
        {
            renderArea = rectangle;
        }
        else
        {
            renderArea.extend(rectangle);
        }

        tiles.push_back(rectangle);
    }

    if (_docType != "text" && part != _loKitDocument->pClass->getPart(_loKitDocument))
    {
        _loKitDocument->pClass->setPart(_loKitDocument, part);
    }

    LibreOfficeKitTileMode mode = static_cast<LibreOfficeKitTileMode>(_loKitDocument->pClass->getTileMode(_loKitDocument));

    int tilesByX = renderArea.getWidth() / tileWidth;
    int tilesByY = renderArea.getHeight() / tileHeight;

    int pixmapWidth = tilesByX * pixelWidth;
    int pixmapHeight = tilesByY * pixelHeight;

    const size_t pixmapSize = 4 * pixmapWidth * pixmapHeight;

    std::vector<unsigned char> pixmap(pixmapSize, 0);

    Poco::Timestamp timestamp;
    _loKitDocument->pClass->paintTile(_loKitDocument, pixmap.data(), pixmapWidth, pixmapHeight,
                                      renderArea.getLeft(), renderArea.getTop(),
                                      renderArea.getWidth(), renderArea.getHeight());

    Log::debug() << "paintTile (Multiple) called, tile at [" << renderArea.getLeft() << ", " << renderArea.getTop() << "]"
                << " (" << renderArea.getWidth() << ", " << renderArea.getHeight() << ") rendered in "
                << double(timestamp.elapsed())/1000 <<  "ms" << Log::end;

    for (Util::Rectangle& tileRect : tiles)
    {
        std::string response = "tile: part=" + std::to_string(part) +
                               " width=" + std::to_string(pixelWidth) +
                               " height=" + std::to_string(pixelHeight) +
                               " tileposx=" + std::to_string(tileRect.getLeft()) +
                               " tileposy=" + std::to_string(tileRect.getTop()) +
                               " tilewidth=" + std::to_string(tileWidth) +
                               " tileheight=" + std::to_string(tileHeight) + "\n";

        std::vector<char> output;
        output.reserve(pixelWidth * pixelHeight * 4 + response.size());
        output.resize(response.size());

        std::copy(response.begin(), response.end(), output.begin());

        int positionX = (tileRect.getLeft() - renderArea.getLeft()) / tileWidth;
        int positionY = (tileRect.getTop() - renderArea.getTop())  / tileHeight;

        if (!Util::encodeSubBufferToPNG(pixmap.data(), positionX * pixelWidth, positionY * pixelHeight, pixelWidth, pixelHeight, pixmapWidth, pixmapHeight, output, mode))
        {
            sendTextFrame("error: cmd=tile kind=failure");
            return;
        }

        sendBinaryFrame(output.data(), output.size());
    }
}

bool ChildProcessSession::clientZoom(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
   int tilePixelWidth, tilePixelHeight, tileTwipWidth, tileTwipHeight;

    if (tokens.count() != 5 ||
        !getTokenInteger(tokens[1], "tilepixelwidth", tilePixelWidth) ||
        !getTokenInteger(tokens[2], "tilepixelheight", tilePixelHeight) ||
        !getTokenInteger(tokens[3], "tiletwipwidth", tileTwipWidth) ||
        !getTokenInteger(tokens[4], "tiletwipheight", tileTwipHeight))
    {
        sendTextFrame("error: cmd=clientzoom kind=syntax");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    _loKitDocument->pClass->setClientZoom(_loKitDocument, tilePixelWidth, tilePixelHeight, tileTwipWidth, tileTwipHeight);
    return true;
}

bool ChildProcessSession::downloadAs(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    std::string name, id, format, filterOptions;

    if (tokens.count() < 5 ||
        !getTokenString(tokens[1], "name", name) ||
        !getTokenString(tokens[2], "id", id))
    {
        sendTextFrame("error: cmd=downloadas kind=syntax");
        return false;
    }

    getTokenString(tokens[3], "format", format);

    if (getTokenString(tokens[4], "options", filterOptions))
    {
        if (tokens.count() > 5)
        {
            filterOptions += Poco::cat(std::string(" "), tokens.begin() + 5, tokens.end());
        }
    }

    const auto tmpDir = Util::createRandomDir(JailedDocumentRoot);
    const auto url = JailedDocumentRoot + tmpDir + "/" + name;

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    //TODO: Cleanup the file after downloading.
    _loKitDocument->pClass->saveAs(_loKitDocument, url.c_str(),
            format.size() == 0 ? nullptr :format.c_str(),
            filterOptions.size() == 0 ? nullptr : filterOptions.c_str());

    sendTextFrame("downloadas: jail=" + _jailId + " dir=" + tmpDir + " name=" + name +
                  " port=" + std::to_string(ClientPortNumber) + " id=" + id);
    return true;
}

bool ChildProcessSession::getChildId()
{
    sendTextFrame("getchildid: id=" + _jailId);
    return true;
}

bool ChildProcessSession::getTextSelection(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    std::string mimeType;

    if (tokens.count() != 2 ||
        !getTokenString(tokens[1], "mimetype", mimeType))
    {
        sendTextFrame("error: cmd=gettextselection kind=syntax");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    char *textSelection = _loKitDocument->pClass->getTextSelection(_loKitDocument, mimeType.c_str(), nullptr);

    sendTextFrame("textselectioncontent: " + std::string(textSelection));
    return true;
}

bool ChildProcessSession::paste(const char* buffer, int length, StringTokenizer& tokens)
{
    std::string mimeType;

    if (tokens.count() < 2 || !getTokenString(tokens[1], "mimetype", mimeType))
    {
        sendTextFrame("error: cmd=paste kind=syntax");
        return false;
    }

    const std::string firstLine = getFirstLine(buffer, length);
    const char* data = buffer + firstLine.size() + 1;
    size_t size = length - firstLine.size() - 1;

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    _loKitDocument->pClass->paste(_loKitDocument, mimeType.c_str(), data, size);

    return true;
}

bool ChildProcessSession::insertFile(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    std::string name, type;

    if (tokens.count() != 3 ||
        !getTokenString(tokens[1], "name", name) ||
        !getTokenString(tokens[2], "type", type))
    {
        sendTextFrame("error: cmd=insertfile kind=syntax");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (type == "graphic")
    {
        std::string fileName = "file://" + JailedDocumentRoot + "insertfile/" + name;
        std::string command = ".uno:InsertGraphic";
        std::string arguments = "{"
            "\"FileName\":{"
                "\"type\":\"string\","
                "\"value\":\"" + fileName + "\""
            "}}";
        if (_multiView)
            _loKitDocument->pClass->setView(_loKitDocument, _viewId);

        _loKitDocument->pClass->postUnoCommand(_loKitDocument, command.c_str(), arguments.c_str(), false);
    }

    return true;
}

bool ChildProcessSession::keyEvent(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int type, charcode, keycode;

    if (tokens.count() != 4 ||
        !getTokenKeyword(tokens[1], "type",
                         {{"input", LOK_KEYEVENT_KEYINPUT}, {"up", LOK_KEYEVENT_KEYUP}},
                         type) ||
        !getTokenInteger(tokens[2], "char", charcode) ||
        !getTokenInteger(tokens[3], "key", keycode))
    {
        sendTextFrame("error: cmd=key kind=syntax");
        return false;
    }

    // Don't close LO window!
    constexpr auto KEY_CTRL = 0x2000;
    constexpr auto KEY_W    = 0x0216;
    if (keycode == (KEY_CTRL | KEY_W))
        return true;

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    _loKitDocument->pClass->postKeyEvent(_loKitDocument, type, charcode, keycode);

    return true;
}

bool ChildProcessSession::mouseEvent(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int type, x, y, count, buttons, modifier;

    if (tokens.count() != 7 ||
        !getTokenKeyword(tokens[1], "type",
                         {{"buttondown", LOK_MOUSEEVENT_MOUSEBUTTONDOWN},
                          {"buttonup", LOK_MOUSEEVENT_MOUSEBUTTONUP},
                          {"move", LOK_MOUSEEVENT_MOUSEMOVE}},
                         type) ||
        !getTokenInteger(tokens[2], "x", x) ||
        !getTokenInteger(tokens[3], "y", y) ||
        !getTokenInteger(tokens[4], "count", count) ||
        !getTokenInteger(tokens[5], "buttons", buttons) ||
        !getTokenInteger(tokens[6], "modifier", modifier))
    {
        sendTextFrame("error: cmd=mouse kind=syntax");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    _loKitDocument->pClass->postMouseEvent(_loKitDocument, type, x, y, count, buttons, modifier);

    return true;
}

bool ChildProcessSession::unoCommand(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    if (tokens.count() == 1)
    {
        sendTextFrame("error: cmd=uno kind=syntax");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    // we need to get LOK_CALLBACK_UNO_COMMAND_RESULT callback when saving
    const bool bNotify = (tokens[1] == ".uno:Save");

    if (tokens.count() == 2)
    {
        _loKitDocument->pClass->postUnoCommand(_loKitDocument, tokens[1].c_str(), nullptr, bNotify);
    }
    else
    {
        _loKitDocument->pClass->postUnoCommand(_loKitDocument, tokens[1].c_str(),
                                               Poco::cat(std::string(" "), tokens.begin() + 2, tokens.end()).c_str(),
                                               bNotify);
    }

    return true;
}

bool ChildProcessSession::selectText(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int type, x, y;

    if (tokens.count() != 4 ||
        !getTokenKeyword(tokens[1], "type",
                         {{"start", LOK_SETTEXTSELECTION_START},
                          {"end", LOK_SETTEXTSELECTION_END},
                          {"reset", LOK_SETTEXTSELECTION_RESET}},
                         type) ||
        !getTokenInteger(tokens[2], "x", x) ||
        !getTokenInteger(tokens[3], "y", y))
    {
        sendTextFrame("error: cmd=selecttext kind=syntax");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    _loKitDocument->pClass->setTextSelection(_loKitDocument, type, x, y);

    return true;
}

bool ChildProcessSession::selectGraphic(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int type, x, y;

    if (tokens.count() != 4 ||
        !getTokenKeyword(tokens[1], "type",
                         {{"start", LOK_SETGRAPHICSELECTION_START},
                          {"end", LOK_SETGRAPHICSELECTION_END}},
                         type) ||
        !getTokenInteger(tokens[2], "x", x) ||
        !getTokenInteger(tokens[3], "y", y))
    {
        sendTextFrame("error: cmd=selectgraphic kind=syntax");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    _loKitDocument->pClass->setGraphicSelection(_loKitDocument, type, x, y);

    return true;
}

bool ChildProcessSession::resetSelection(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    if (tokens.count() != 1)
    {
        sendTextFrame("error: cmd=resetselection kind=syntax");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    _loKitDocument->pClass->resetSelection(_loKitDocument);

    return true;
}

bool ChildProcessSession::saveAs(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    std::string url, format, filterOptions;

    if (tokens.count() < 4 ||
        !getTokenString(tokens[1], "url", url))
    {
        sendTextFrame("error: cmd=saveas kind=syntax");
        return false;
    }

    getTokenString(tokens[2], "format", format);

    if (getTokenString(tokens[3], "options", filterOptions))
    {
        if (tokens.count() > 4)
        {
            filterOptions += Poco::cat(std::string(" "), tokens.begin() + 4, tokens.end());
        }
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    bool success = _loKitDocument->pClass->saveAs(_loKitDocument, url.c_str(),
            format.size() == 0 ? nullptr :format.c_str(),
            filterOptions.size() == 0 ? nullptr : filterOptions.c_str());

    sendTextFrame("saveas: url=" + url);
    std::string successStr = success ? "true" : "false";
    sendTextFrame("unocommandresult: {"
            "\"commandName\":\"saveas\","
            "\"success\":\"" + successStr + "\"}");

    return true;
}

bool ChildProcessSession::setClientPart(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    if (tokens.count() < 2 ||
        !getTokenInteger(tokens[1], "part", _clientPart))
    {
        return false;
    }
    return true;
}

bool ChildProcessSession::setPage(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int page;
    if (tokens.count() < 2 ||
        !getTokenInteger(tokens[1], "page", page))
    {
        sendTextFrame("error: cmd=setpage kind=invalid");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->pClass->setView(_loKitDocument, _viewId);

    _loKitDocument->pClass->setPart(_loKitDocument, page);
    return true;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
