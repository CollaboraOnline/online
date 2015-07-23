/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <sys/stat.h>
#include <sys/types.h>

#include <ftw.h>
#include <utime.h>

#include <cassert>
#include <condition_variable>
#include <cstring>
#include <fstream>
#include <iostream>
#include <iterator>
#include <map>
#include <memory>
#include <mutex>
#include <set>

#include <Poco/Net/WebSocket.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>
#include <Poco/Path.h>

#include "ChildProcessSession.hpp"
#include "Util.hpp"
#include "LOOLProtocol.hpp"
#include "LOKitHelper.hpp"

using namespace LOOLProtocol;
using Poco::Net::WebSocket;
using Poco::StringTokenizer;
using Poco::URI;
using Poco::Path;

ChildProcessSession::ChildProcessSession(std::shared_ptr<WebSocket> ws, LibreOfficeKit *loKit) :
    LOOLSession(ws, Kind::ToMaster),
    _loKitDocument(NULL),
    _loKit(loKit),
    _clientPart(0)
{
    std::cout << Util::logPrefix() << "ChildProcessSession ctor this=" << this << " ws=" << _ws.get() << std::endl;
}

ChildProcessSession::~ChildProcessSession()
{
    std::cout << Util::logPrefix() << "ChildProcessSession dtor this=" << this << std::endl;
    if (LIBREOFFICEKIT_HAS(_loKit, registerCallback))
        _loKit->pClass->registerCallback(_loKit, 0, 0);
    Util::shutdownWebSocket(*_ws);
}

bool ChildProcessSession::handleInput(const char *buffer, int length)
{
    std::string firstLine = getFirstLine(buffer, length);
    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    std::cout << Util::logPrefix() + _kindString + ",Input," + getAbbreviatedMessage(buffer, length) << std::endl;

    if (tokens[0] == "load")
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
    else if (tokens[0] == "setclientpart")
    {
        return setClientPart(buffer, length, tokens);
    }
    else if (tokens[0] == "status")
    {
        return getStatus(buffer, length);
    }
    else if (tokens[0] == "tile")
    {
        sendTile(buffer, length, tokens);
    }
    else
    {
        // All other commands are such that they always require a LibreOfficeKitDocument session,
        // i.e. need to be handled in a child process.

        assert(tokens[0] == "gettextselection" ||
               tokens[0] == "key" ||
               tokens[0] == "mouse" ||
               tokens[0] == "uno" ||
               tokens[0] == "selecttext" ||
               tokens[0] == "selectgraphic" ||
               tokens[0] == "resetselection" ||
               tokens[0] == "saveas");

        if (_loKitDocument->pClass->getPart(_loKitDocument) != _clientPart)
        {
            _loKitDocument->pClass->setPart(_loKitDocument, _clientPart);
        }
        if (tokens[0] == "gettextselection")
        {
            return getTextSelection(buffer, length, tokens);
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
        else
        {
            assert(false);
        }
    }
    return true;
}

extern "C"
{
    static void myCallback(int nType, const char* pPayload, void* pData)
    {
        ChildProcessSession *srv = reinterpret_cast<ChildProcessSession *>(pData);

        switch ((LibreOfficeKitCallbackType) nType)
        {
        case LOK_CALLBACK_INVALIDATE_TILES:
            {
                int curPart = srv->_loKitDocument->pClass->getPart(srv->_loKitDocument);
                srv->sendTextFrame("curpart: part=" + std::to_string(curPart));
                StringTokenizer tokens(std::string(pPayload), " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
                if (tokens.count() == 4)
                {
                    int x(std::stoi(tokens[0]));
                    int y(std::stoi(tokens[1]));
                    int width(std::stoi(tokens[2]));
                    int height(std::stoi(tokens[3]));
                    srv->sendTextFrame("invalidatetiles:"
                                       " part=" + std::to_string(curPart) +
                                       " x=" + std::to_string(x) +
                                       " y=" + std::to_string(y) +
                                       " width=" + std::to_string(width) +
                                       " height=" + std::to_string(height));
                }
                else {
                    srv->sendTextFrame("invalidatetiles: " + std::string(pPayload));
                }
            }
            break;
        case LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR:
            srv->sendTextFrame("invalidatecursor: " + std::string(pPayload));
            break;
        case LOK_CALLBACK_TEXT_SELECTION:
            srv->sendTextFrame("textselection: " + std::string(pPayload));
            break;
        case LOK_CALLBACK_TEXT_SELECTION_START:
            srv->sendTextFrame("textselectionstart: " + std::string(pPayload));
            break;
        case LOK_CALLBACK_TEXT_SELECTION_END:
            srv->sendTextFrame("textselectionend: " + std::string(pPayload));
            break;
        case LOK_CALLBACK_CURSOR_VISIBLE:
            srv->sendTextFrame("cursorvisible: " + std::string(pPayload));
            break;
        case LOK_CALLBACK_GRAPHIC_SELECTION:
            srv->sendTextFrame("graphicselection: " + std::string(pPayload));
            break;
        case LOK_CALLBACK_HYPERLINK_CLICKED:
            srv->sendTextFrame("hyperlinkclicked: " + std::string(pPayload));
            break;
        case LOK_CALLBACK_STATE_CHANGED:
            srv->sendTextFrame("statechanged: " + std::string(pPayload));
            break;
        case LOK_CALLBACK_STATUS_INDICATOR_START:
            srv->sendTextFrame("statusindicatorstart:");
            break;
        case LOK_CALLBACK_STATUS_INDICATOR_SET_VALUE:
            srv->sendTextFrame("statusindicatorsetvalue: " + std::string(pPayload));
            break;
        case LOK_CALLBACK_STATUS_INDICATOR_FINISH:
            srv->sendTextFrame("statusindicatorfinish:");
            break;
        case LOK_CALLBACK_SEARCH_NOT_FOUND:
            srv->sendTextFrame("searchnotfound: " + std::string(pPayload));
            break;
        case LOK_CALLBACK_DOCUMENT_SIZE_CHANGED:
            srv->getStatus("", 0);
            break;
        case LOK_CALLBACK_SET_PART:
            srv->sendTextFrame("setpart: " + std::string(pPayload));
            break;
        }
    }
}

bool ChildProcessSession::loadDocument(const char *buffer, int length, StringTokenizer& tokens)
{
    if (tokens.count() != 2)
    {
        sendTextFrame("error: cmd=load kind=syntax");
        return false;
    }

    if (tokens[1].find("url=") == 0)
        _docURL = tokens[1].substr(strlen("url="));
    else
        _docURL = tokens[1];

    URI aUri;
    try
    {
        aUri = URI(_docURL);
    }
    catch(Poco::SyntaxException&)
    {
        sendTextFrame("error: cmd=load kind=URI invalid syntax");
        return false;
    }

    if (aUri.empty())
    {
        sendTextFrame("error: cmd=load kind=URI empty");
        return false;
    }

    // The URL in the request is the original one, not visible in the chroot jail.
    // The child process uses the fixed name jailDocumentURL.

    if (LIBREOFFICEKIT_HAS(_loKit, registerCallback))
        _loKit->pClass->registerCallback(_loKit, myCallback, this);

    if (aUri.isRelative() || aUri.getScheme() == "file")
        aUri = URI( URI("file://"), Path(jailDocumentURL, Path(aUri.getPath()).getFileName()).toString() );

    if ((_loKitDocument = _loKit->pClass->documentLoad(_loKit, aUri.toString().c_str())) == NULL)
    {
        sendTextFrame("error: cmd=load kind=failed");
        return false;
    }

    _loKitDocument->pClass->initializeForRendering(_loKitDocument);

    if (!getStatus(buffer, length))
        return false;
    _loKitDocument->pClass->registerCallback(_loKitDocument, myCallback, this);

    return true;
}

bool ChildProcessSession::getStatus(const char *buffer, int length)
{
    std::string status = "status: " + LOKitHelper::documentStatus(_loKitDocument);

    sendTextFrame(status);

    return true;
}

void ChildProcessSession::sendTile(const char *buffer, int length, StringTokenizer& tokens)
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

    unsigned char *pixmap = new unsigned char[4 * width * height];
    _loKitDocument->pClass->setPart(_loKitDocument, part);
    _loKitDocument->pClass->paintTile(_loKitDocument, pixmap, width, height, tilePosX, tilePosY, tileWidth, tileHeight);

    if (!Util::encodePNGAndAppendToBuffer(pixmap, width, height, output))
    {
        sendTextFrame("error: cmd=tile kind=failure");
        return;
    }

    delete[] pixmap;

    sendBinaryFrame(output.data(), output.size());
}

bool ChildProcessSession::getTextSelection(const char *buffer, int length, StringTokenizer& tokens)
{
    std::string mimeType;

    if (tokens.count() != 2 ||
        !getTokenString(tokens[1], "mimetype", mimeType))
    {
        sendTextFrame("error: cmd=gettextselection kind=syntax");
        return false;
    }

    char *textSelection = _loKitDocument->pClass->getTextSelection(_loKitDocument, mimeType.c_str(), NULL);

    sendTextFrame("textselectioncontent: " + std::string(textSelection));
    return true;
}

bool ChildProcessSession::keyEvent(const char *buffer, int length, StringTokenizer& tokens)
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

    _loKitDocument->pClass->postKeyEvent(_loKitDocument, type, charcode, keycode);

    return true;
}

bool ChildProcessSession::mouseEvent(const char *buffer, int length, StringTokenizer& tokens)
{
    int type, x, y, count;

    if (tokens.count() != 5 ||
        !getTokenKeyword(tokens[1], "type",
                         {{"buttondown", LOK_MOUSEEVENT_MOUSEBUTTONDOWN},
                          {"buttonup", LOK_MOUSEEVENT_MOUSEBUTTONUP},
                          {"move", LOK_MOUSEEVENT_MOUSEMOVE}},
                         type) ||
        !getTokenInteger(tokens[2], "x", x) ||
        !getTokenInteger(tokens[3], "y", y) ||
        !getTokenInteger(tokens[4], "count", count))
    {
        sendTextFrame("error: cmd=mouse kind=syntax");
        return false;
    }

    _loKitDocument->pClass->postMouseEvent(_loKitDocument, type, x, y, count);

    return true;
}

bool ChildProcessSession::unoCommand(const char *buffer, int length, StringTokenizer& tokens)
{
    if (tokens.count() == 1)
    {
        sendTextFrame("error: cmd=uno kind=syntax");
        return false;
    }

    if (tokens.count() == 2)
    {
        _loKitDocument->pClass->postUnoCommand(_loKitDocument, tokens[1].c_str(), 0);
    }
    else
    {
        _loKitDocument->pClass->postUnoCommand(_loKitDocument, tokens[1].c_str(), Poco::cat(std::string(" "), tokens.begin() + 2, tokens.end()).c_str());
    }

    return true;
}

bool ChildProcessSession::selectText(const char *buffer, int length, StringTokenizer& tokens)
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

    _loKitDocument->pClass->setTextSelection(_loKitDocument, type, x, y);

    return true;
}

bool ChildProcessSession::selectGraphic(const char *buffer, int length, StringTokenizer& tokens)
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
        sendTextFrame("error: cmd=selectghraphic kind=syntax");
        return false;
    }

    _loKitDocument->pClass->setGraphicSelection(_loKitDocument, type, x, y);

    return true;
}

bool ChildProcessSession::resetSelection(const char *buffer, int length, StringTokenizer& tokens)
{
    if (tokens.count() != 1)
    {
        sendTextFrame("error: cmd=resetselection kind=syntax");
        return false;
    }

    _loKitDocument->pClass->resetSelection(_loKitDocument);

    return true;
}

bool ChildProcessSession::saveAs(const char *buffer, int length, StringTokenizer& tokens)
{
    std::string url, format, filterOptions;

    if (tokens.count() < 4 ||
        !getTokenString(tokens[1], "url", url))
    {
        sendTextFrame("error: cmd=saveas kind=syntax");
        return false;
    }

    URI::decode(url, url, true);
    if (getTokenString(tokens[2], "format", format)) {
        URI::decode(format, format, true);
    }

    if (getTokenString(tokens[3], "options", filterOptions)) {
        if (tokens.count() > 4) {
            filterOptions += Poco::cat(std::string(" "), tokens.begin() + 4, tokens.end());
        }
    }

    _loKitDocument->pClass->saveAs(_loKitDocument, url.c_str(), format.c_str(), filterOptions.c_str());

    return true;
}

bool ChildProcessSession::setClientPart(const char *buffer, int length, StringTokenizer& tokens)
{
    if (tokens.count() < 2 ||
        !getTokenInteger(tokens[1], "part", _clientPart))
    {
        return false;
    }
    return true;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
