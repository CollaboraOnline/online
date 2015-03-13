/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <cstring>
#include <fstream>
#include <iostream>
#include <memory>

#include <png.h>

#include <Poco/Util/Application.h>
#include <Poco/String.h>
#include <Poco/StringTokenizer.h>

#include "LOOLSession.hpp"
#include "TileCache.hpp"

using Poco::Net::WebSocket;
using Poco::Util::Application;
using Poco::StringTokenizer;

LOOLSession::LOOLSession(WebSocket& ws, LibreOfficeKit *loKit) :
    _haveSeparateProcess(false),
    _ws(ws),
    _loKit(loKit),
    _loKitDocument(NULL)
{
}

LOOLSession::~LOOLSession()
{
    _ws.shutdown();
    if (_loKitDocument)
        _loKitDocument->pClass->destroy(_loKitDocument);
}

bool LOOLSession::handleInput(char *buffer, int length)
{
    Application& app = Application::instance();

    char *endl = (char *) memchr(buffer, '\n', length);
    std::string commandline;
    if (endl == NULL)
        commandline = std::string(buffer, length);
    else
        commandline = std::string(buffer, endl-buffer);

    app.logger().information("Command: " + commandline);

    StringTokenizer tokens(commandline, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    if (tokens[0] == "load")
    {
        if (_loKitDocument)
        {
            sendTextFrame("error: cms=load kind=docalreadyloaded");
            return false;
        }
        loadDocument(tokens);
    }
    else if (!_loKitDocument)
    {
        sendTextFrame("error: cmd=" + tokens[0] + " kind=nodocloaded");
        return false;
    }
    else if (tokens[0] == "status")
    {
        sendTextFrame(getStatus());
    }
    else if (tokens[0] == "tile")
    {
        sendTile(tokens);
    }
    return true;
}

bool LOOLSession::haveSeparateProcess() const
{
    return _haveSeparateProcess;
}

void LOOLSession::sendTextFrame(std::string text)
{
    _ws.sendFrame(text.data(), text.size());
}

void LOOLSession::sendBinaryFrame(const char *buffer, int length)
{
    _ws.sendFrame(buffer, length, WebSocket::FRAME_BINARY);
}

extern "C"
{
    static void myCallback(int nType, const char* pPayload, void* pData)
    {
        LOOLSession *srv = (LOOLSession *) pData;

        switch ((LibreOfficeKitCallbackType) nType)
        {
        case LOK_CALLBACK_INVALIDATE_TILES:
            srv->sendTextFrame("invalidatetiles: " + std::string(pPayload));
            break;
        case LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR:
            srv->sendTextFrame("invalidatecursor:");
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
        }
    }
}

void LOOLSession::loadDocument(StringTokenizer& tokens)
{
    if (tokens.count() != 2)
    {
        sendTextFrame("error: cmd=load kind=syntax");
        return;
    }

    _docURL = tokens[1];
    _tileCache.reset(new TileCache(_docURL));

    if ((_loKitDocument = _loKit->pClass->documentLoad(_loKit, _docURL.c_str())) != NULL)
    {
        sendTextFrame(getStatus());
        _loKitDocument->pClass->registerCallback(_loKitDocument, myCallback, this);
    }
}

std::string LOOLSession::getStatus()
{
    std::string status = _tileCache->getStatus();
    if (status.size() > 0)
        return status;

    LibreOfficeKitDocumentType type = (LibreOfficeKitDocumentType) _loKitDocument->pClass->getDocumentType(_loKitDocument);
    std::string typeString;
    switch (type)
    {
    case LOK_DOCTYPE_TEXT:
        typeString = "text";
        break;
    case LOK_DOCTYPE_SPREADSHEET:
        typeString = "spreadsheet";
        break;
    case LOK_DOCTYPE_PRESENTATION:
        typeString = "presentation";
        break;
    case LOK_DOCTYPE_DRAWING:
        typeString = "drawing";
        break;
    default:
        typeString = "other";
        break;
    }
    long width, height;
    _loKitDocument->pClass->getDocumentSize(_loKitDocument, &width, &height);
    std::string result = ("status: type=" + typeString + " "
                          "parts=" + std::to_string(_loKitDocument->pClass->getParts(_loKitDocument)) + " "
                          "current=" + std::to_string(_loKitDocument->pClass->getPart(_loKitDocument)) + " "
                          "width=" + std::to_string(width) + " "
                          "height=" + std::to_string(height));
    _tileCache->saveStatus(result);

    return result;
}

namespace {
    bool getTokenInteger(const std::string& token, const std::string& name, int *value)
    {
        size_t nextIdx;
        try
        {
            if (token.size() < name.size() + 2 ||
                token.substr(0, name.size()) != name ||
                token[name.size()] != '=' ||
                (*value = std::stoi(token.substr(name.size() + 1), &nextIdx), false) ||
                nextIdx != token.size() - name.size() - 1)
            {
                throw std::invalid_argument("bah");
            }
        }
        catch (std::invalid_argument&)
        {
            return false;
        }
        return true;
    }
}

// Callback functions for libpng

extern "C"
{
    static void user_write_status_fn(png_structp, png_uint_32, int)
    {
    }

    static void user_write_fn(png_structp png_ptr, png_bytep data, png_size_t length)
    {
        std::vector<char> *outputp = (std::vector<char> *) png_get_io_ptr(png_ptr);
        size_t oldsize = outputp->size();
        outputp->resize(oldsize + length);
        memcpy(outputp->data() + oldsize, data, length);
    }

    static void user_flush_fn(png_structp)
    {
    }
}

void LOOLSession::sendTile(StringTokenizer& tokens)
{
    int width, height, tilePosX, tilePosY, tileWidth, tileHeight;

    if (tokens.count() != 7 ||
        !getTokenInteger(tokens[1], "width", &width) ||
        !getTokenInteger(tokens[2], "height", &height) ||
        !getTokenInteger(tokens[3], "tileposx", &tilePosX) ||
        !getTokenInteger(tokens[4], "tileposy", &tilePosY) ||
        !getTokenInteger(tokens[5], "tilewidth", &tileWidth) ||
        !getTokenInteger(tokens[6], "tileheight", &tileHeight))
    {
        sendTextFrame("error: cmd=tile kind=syntax");
        return;
    }

    std::string response = "tile: " + Poco::cat(std::string(" "), tokens.begin() + 1, tokens.end()) + "\n";

    std::vector<char> output;
    output.reserve(4 * width * height);
    output.resize(response.size());
    memcpy(output.data(), response.data(), response.size());

    std::unique_ptr<std::fstream> cachedTile = _tileCache->lookupTile(width, height, tilePosX, tilePosY, tileWidth, tileHeight);
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

    unsigned char *buffer = new unsigned char[4 * width * height];
    int rowStride;
    _loKitDocument->pClass->paintTile(_loKitDocument, buffer, width, height, &rowStride, tilePosX, tilePosY, tileWidth, tileHeight);

    png_structp png_ptr = png_create_write_struct(PNG_LIBPNG_VER_STRING, NULL, NULL, NULL);

    png_infop info_ptr = png_create_info_struct(png_ptr);

    if (setjmp(png_jmpbuf(png_ptr)))
    {
        png_destroy_write_struct(&png_ptr, NULL);
        sendTextFrame("error: cmd=tile kind=failure");
        return;
    }

    png_set_IHDR(png_ptr, info_ptr, width, height, 8, PNG_COLOR_TYPE_RGB_ALPHA, PNG_INTERLACE_NONE, PNG_COMPRESSION_TYPE_DEFAULT, PNG_FILTER_TYPE_DEFAULT);

    png_set_write_fn(png_ptr, &output, user_write_fn, user_flush_fn);
    png_set_write_status_fn(png_ptr, user_write_status_fn);

    png_write_info(png_ptr, info_ptr);

    for (int y = 0; y < height; ++y)
        png_write_row(png_ptr, buffer + y * width * 4);

    png_write_end(png_ptr, info_ptr);

    png_destroy_write_struct(&png_ptr, NULL);

    delete[] buffer;

    _tileCache->saveTile(width, height, tilePosX, tilePosY, tileWidth, tileHeight, output.data() + response.size(), output.size() - response.size());

    sendBinaryFrame(output.data(), output.size());
}

void LOOLSession::forkOff()
{
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
