/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <ftw.h>

#include <cassert>
#include <cstring>
#include <fstream>
#include <iostream>
#include <map>
#include <memory>
#include <set>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include <Poco/Buffer.h>
#include <Poco/File.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/Random.h>
#include <Poco/String.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>
#include <Poco/Util/Application.h>

#include "LOKitHelper.hpp"
#include "LOOLProtocol.hpp"
#include "LOOLSession.hpp"
#include "LOOLWSD.hpp"
#include "TileCache.hpp"
#include "Util.hpp"

using namespace LOOLProtocol;

using Poco::Buffer;
using Poco::File;
using Poco::Net::WebSocket;
using Poco::Path;
using Poco::Process;
using Poco::ProcessHandle;
using Poco::Random;
using Poco::StringTokenizer;
using Poco::Thread;
using Poco::UInt64;
using Poco::URI;
using Poco::Util::Application;

const std::string LOOLSession::jailDocumentURL = "/user/thedocument";

LOOLSession::LOOLSession(WebSocket& ws, Kind kind) :
    _kind(kind),
    _ws(&ws),
    _docURL("")
{
    std::cout << Util::logPrefix() << "LOOLSession ctor this=" << this << " " << _kind << " ws=" << _ws << std::endl;
}

LOOLSession::~LOOLSession()
{
    std::cout << Util::logPrefix() << "LOOLSession dtor this=" << this << " " << _kind << std::endl;
    Util::shutdownWebSocket(*_ws);
}

void LOOLSession::sendTextFrame(const std::string& text)
{
    _ws->sendFrame(text.data(), text.size());
}

void LOOLSession::sendBinaryFrame(const char *buffer, int length)
{
    _ws->sendFrame(buffer, length, WebSocket::FRAME_BINARY);
}

std::set<UInt64> MasterProcessSession::_pendingPreSpawnedChildren;
std::set<MasterProcessSession*> MasterProcessSession::_availableChildSessions;
std::map<Process::PID, UInt64> MasterProcessSession::_childProcesses;

MasterProcessSession::MasterProcessSession(WebSocket& ws, Kind kind) :
    LOOLSession(ws, kind),
    _peer(nullptr),
    _childId(0)
{
    std::cout << Util::logPrefix() << "MasterProcessSession ctor this=" << this << " ws=" << _ws << std::endl;
}

MasterProcessSession::~MasterProcessSession()
{
    std::cout << Util::logPrefix() << "MasterProcessSession dtor this=" << this << " _peer=" << _peer << std::endl;
    Util::shutdownWebSocket(*_ws);
    if (_kind == Kind::ToClient && _peer != nullptr)
    {
        Util::shutdownWebSocket(*(_peer->_ws));
    }
}

bool MasterProcessSession::handleInput(char *buffer, int length)
{
    Application& app = Application::instance();

    std::string firstLine = getFirstLine(buffer, length);
    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    if (haveSeparateProcess())
    {
        // Note that this handles both forwarding requests from the client to the child process, and
        // forwarding replies from the child process to the client. Or does it?

        // Snoop at tile: and status: messages and cache them
        if (_kind == Kind::ToPrisoner && _peer->_tileCache)
        {
            if (tokens[0] == "tile:")
            {
                int width, height, tilePosX, tilePosY, tileWidth, tileHeight;
                if (tokens.count() != 7 ||
                    !getTokenInteger(tokens[1], "width", width) ||
                    !getTokenInteger(tokens[2], "height", height) ||
                    !getTokenInteger(tokens[3], "tileposx", tilePosX) ||
                    !getTokenInteger(tokens[4], "tileposy", tilePosY) ||
                    !getTokenInteger(tokens[5], "tilewidth", tileWidth) ||
                    !getTokenInteger(tokens[6], "tileheight", tileHeight))
                    assert(false);

                assert(firstLine.size() < static_cast<std::string::size_type>(length));
                _peer->_tileCache->saveTile(width, height, tilePosX, tilePosY, tileWidth, tileHeight, buffer + firstLine.size() + 1, length - firstLine.size() - 1);
            }
            else if (tokens[0] == "status:")
            {
                assert(firstLine.size() == static_cast<std::string::size_type>(length));
                _peer->_tileCache->saveStatus(firstLine);
            }
        }

        forwardToPeer(buffer, length);
        return true;
    }

    app.logger().information(Util::logPrefix() + "Input: " + getAbbreviatedMessage(buffer, length));

    if (tokens[0] == "child")
    {
        if (_kind != Kind::ToPrisoner)
        {
            sendTextFrame("error: cmd=child kind=invalid");
            return false;
        }
        if (_peer != nullptr)
        {
            sendTextFrame("error: cmd=child kind=invalid");
            return false;
        }
        if (tokens.count() != 2)
        {
            sendTextFrame("error: cmd=child kind=syntax");
            return false;
        }
        UInt64 childId = std::stoull(tokens[1]);
        app.logger().information(Util::logPrefix() + "childId=" + std::to_string(childId));
        if (_pendingPreSpawnedChildren.find(childId) == _pendingPreSpawnedChildren.end())
        {
            sendTextFrame("error: cmd=child kind=notfound");
            return false;
        }
        _pendingPreSpawnedChildren.erase(childId);
        _availableChildSessions.insert(this);
        _childId = childId;
    }
    else if (_kind == Kind::ToPrisoner)
    {
        // Message from child process to be forwarded to client.

        // I think we should never get here
        assert(false);

        assert(_peer != nullptr);

        _peer->_ws->sendFrame(buffer, length, WebSocket::FRAME_BINARY);
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
        // All other commands are such that they always require a
        // LibreOfficeKitDocument session, i.e. need to be handled in
        // a child process.

        if (tokens[0] != "key" &&
            tokens[0] != "mouse" &&
            tokens[0] != "uno" &&
            tokens[0] != "selecttext" &&
            tokens[0] != "selectgraphic" &&
            tokens[0] != "resetselection" &&
            tokens[0] != "saveas")
        {
            sendTextFrame("error: cmd=" + tokens[0] + " kind=unknown");
            return false;
        }

        if (!_peer)
            dispatchChild();
        forwardToPeer(buffer, length);
    }
    return true;
}

bool MasterProcessSession::haveSeparateProcess()
{
    return _childId != 0;
}

Path MasterProcessSession::getJailPath(Poco::UInt64 childId)
{
    return Path::forDirectory(LOOLWSD::childRoot + Path::separator() + std::to_string(childId));
}

namespace
{
    std::string sourceForLinkOrCopy;
    Path destinationForLinkOrCopy;

    int linkOrCopyFunction(const char *fpath,
                           const struct stat *sb,
                           int typeflag,
                           struct FTW *ftwbuf)
    {
        if (strcmp(fpath, sourceForLinkOrCopy.c_str()) == 0)
            return 0;

        assert(fpath[strlen(sourceForLinkOrCopy.c_str())] == '/');
        const char *relativeOldPath = fpath + strlen(sourceForLinkOrCopy.c_str()) + 1;
        Path newPath(destinationForLinkOrCopy, relativeOldPath);

        switch (typeflag)
        {
        case FTW_F:
            if (link(fpath, newPath.toString().c_str()) == -1)
            {
                Application::instance().logger().error(Util::logPrefix() +
                                                       "link(\"" + fpath + "\",\"" + newPath.toString() + "\") failed: " +
                                                       strerror(errno));
                exit(1);
            }
            break;
        case FTW_D:
            if (mkdir(newPath.toString().c_str(), 0700) == -1)
            {
                Application::instance().logger().error(Util::logPrefix() +
                                                       "mkdir(\"" + newPath.toString() + "\") failed: " +
                                                       strerror(errno));
                return 1;
            }
            break;
        case FTW_DNR:
            Application::instance().logger().error(Util::logPrefix() +
                                                   "Cannot read directory '" + fpath + "'");
            return 1;
        case FTW_NS:
            Application::instance().logger().error(Util::logPrefix() +
                                                   "nftw: stat failed for '" + fpath + "'");
            return 1;
        case FTW_SLN:
            Application::instance().logger().error(Util::logPrefix() +
                                                   "nftw: symlink to nonexistent file: '" + fpath + "'");
            return 1;
        default:
            assert(false);
        }
        return 0;
    }

    void linkOrCopy(const std::string& source, const Path& destination)
    {
        sourceForLinkOrCopy = source;
        destinationForLinkOrCopy = destination;
        nftw(source.c_str(), linkOrCopyFunction, 10, 0);
    }
}

void MasterProcessSession::preSpawn()
{
    // Create child-specific subtree that will become its chroot root

    Random rng;

    rng.seed();
    UInt64 childId = (((UInt64)rng.next()) << 32) | rng.next() | 1;

    Path jail = getJailPath(childId);
    File(jail).createDirectory();

    Path jailLOInstallation(jail, LOOLWSD::loSubPath);
    File(jailLOInstallation).createDirectory();

    // Copy (link) LO installation and other necessary files into it from the template

    linkOrCopy(LOOLWSD::sysTemplate, jail);
    linkOrCopy(LOOLWSD::loTemplate, jailLOInstallation);

    _pendingPreSpawnedChildren.insert(childId);

    Process::Args args;
    args.push_back("--child=" + std::to_string(childId));
    args.push_back("--port=" + std::to_string(LOOLWSD::portNumber));
    args.push_back("--jail=" + jail.toString());
    args.push_back("--losubpath=" + LOOLWSD::loSubPath);

    Application::instance().logger().information(Util::logPrefix() + "Launching child: " + Poco::cat(std::string(" "), args.begin(), args.end()));

    ProcessHandle child = Process::launch(Application::instance().commandPath(), args);
    _childProcesses[child.id()] = childId;
}

bool MasterProcessSession::loadDocument(const char *buffer, int length, StringTokenizer& tokens)
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

    _tileCache.reset(new TileCache(_docURL));

    return true;
}

bool MasterProcessSession::getStatus(const char *buffer, int length)
{
    std::string status;

    status = _tileCache->getStatus();
    if (status.size() > 0)
    {
        sendTextFrame(status);
        return true;
    }

    if (!_peer)
        dispatchChild();
    forwardToPeer(buffer, length);
    return true;
}

void MasterProcessSession::sendTile(const char *buffer, int length, StringTokenizer& tokens)
{
    int width, height, tilePosX, tilePosY, tileWidth, tileHeight;

    if (tokens.count() != 7 ||
        !getTokenInteger(tokens[1], "width", width) ||
        !getTokenInteger(tokens[2], "height", height) ||
        !getTokenInteger(tokens[3], "tileposx", tilePosX) ||
        !getTokenInteger(tokens[4], "tileposy", tilePosY) ||
        !getTokenInteger(tokens[5], "tilewidth", tileWidth) ||
        !getTokenInteger(tokens[6], "tileheight", tileHeight))
    {
        sendTextFrame("error: cmd=tile kind=syntax");
        return;
    }

    if (width <= 0 ||
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

    if (!_peer)
        dispatchChild();
    forwardToPeer(buffer, length);
}

void MasterProcessSession::dispatchChild()
{
    // Copy document into jail using the fixed name

    assert(_availableChildSessions.size() > 0);

    MasterProcessSession *childSession = *(_availableChildSessions.begin());

    _availableChildSessions.erase(childSession);

    assert(jailDocumentURL[0] == '/');
    Path copy(getJailPath(childSession->_childId), jailDocumentURL.substr(1));
    Application::instance().logger().information(Util::logPrefix() + "Copying " + _docURL + " to " + copy.toString());

    File(_docURL).copyTo(copy.toString());

    _peer = childSession;
    childSession->_peer = this;

    std::string loadRequest = "load url=" + _docURL;
    forwardToPeer(loadRequest.c_str(), loadRequest.size());

    // As we took one child process into use, spawn a new one
    preSpawn();
}

void MasterProcessSession::forwardToPeer(const char *buffer, int length)
{
    Application::instance().logger().information(Util::logPrefix() + "forwardToPeer(" + getAbbreviatedMessage(buffer, length) + ")");
    assert(_peer != nullptr);
    _peer->_ws->sendFrame(buffer, length, WebSocket::FRAME_BINARY);
}

ChildProcessSession::ChildProcessSession(WebSocket& ws, LibreOfficeKit *loKit) :
    LOOLSession(ws, Kind::ToMaster),
    _loKit(loKit),
    _loKitDocument(NULL)
{
    std::cout << Util::logPrefix() << "ChildProcessSession ctor this=" << this << " ws=" << _ws << std::endl;
}

ChildProcessSession::~ChildProcessSession()
{
    std::cout << Util::logPrefix() << "ChildProcessSession dtor this=" << this << std::endl;
    Util::shutdownWebSocket(*_ws);
}

bool ChildProcessSession::handleInput(char *buffer, int length)
{
    Application& app = Application::instance();

    std::string firstLine = getFirstLine(buffer, length);
    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    app.logger().information(Util::logPrefix() + "Input: " + getAbbreviatedMessage(buffer, length));

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

        assert(tokens[0] == "key" ||
               tokens[0] == "mouse" ||
               tokens[0] == "uno" ||
               tokens[0] == "selecttext" ||
               tokens[0] == "selectgraphic" ||
               tokens[0] == "resetselection" ||
               tokens[0] == "saveas");

        if (tokens[0] == "key")
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
        LOOLSession *srv = reinterpret_cast<LOOLSession *>(pData);

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
        case LOK_CALLBACK_STATE_CHANGED:
            srv->sendTextFrame("statechanged: " + std::string(pPayload));
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

    // The URL in the request is the original one, not visible in the chroot jail.
    // The child process uses the fixed name jailDocumentURL.

    if ((_loKitDocument = _loKit->pClass->documentLoad(_loKit, jailDocumentURL.c_str())) == NULL)
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
    int width, height, tilePosX, tilePosY, tileWidth, tileHeight;

    if (tokens.count() != 7 ||
        !getTokenInteger(tokens[1], "width", width) ||
        !getTokenInteger(tokens[2], "height", height) ||
        !getTokenInteger(tokens[3], "tileposx", tilePosX) ||
        !getTokenInteger(tokens[4], "tileposy", tilePosY) ||
        !getTokenInteger(tokens[5], "tilewidth", tileWidth) ||
        !getTokenInteger(tokens[6], "tileheight", tileHeight))
    {
        sendTextFrame("error: cmd=tile kind=syntax");
        return;
    }

    if (width <= 0 ||
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
    _loKitDocument->pClass->paintTile(_loKitDocument, pixmap, width, height, tilePosX, tilePosY, tileWidth, tileHeight);

    if (!Util::encodePNGAndAppendToBuffer(pixmap, width, height, output))
    {
        sendTextFrame("error: cmd=tile kind=failure");
        return;
    }

    delete[] pixmap;

    sendBinaryFrame(output.data(), output.size());
}

bool ChildProcessSession::keyEvent(const char *buffer, int length, Poco::StringTokenizer& tokens)
{
    int type, charcode, keycode;

    if (tokens.count() != 4 ||
        !getTokenInteger(tokens[1], "type", type) ||
        !getTokenInteger(tokens[2], "char", charcode) ||
        !getTokenInteger(tokens[3], "key", keycode))
    {
        sendTextFrame("error: cmd=key kind=syntax");
        return false;
    }

    _loKitDocument->pClass->postKeyEvent(_loKitDocument, type, charcode, keycode);

    return true;
}

bool ChildProcessSession::mouseEvent(const char *buffer, int length, Poco::StringTokenizer& tokens)
{
    int type, x, y, count;

    if (tokens.count() != 5 ||
        !getTokenInteger(tokens[1], "type", type) ||
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

bool ChildProcessSession::unoCommand(const char *buffer, int length, Poco::StringTokenizer& tokens)
{
    if (tokens.count() == 1)
    {
        sendTextFrame("error: cmd=uno kind=syntax");
        return false;
    }

    _loKitDocument->pClass->postUnoCommand(_loKitDocument, tokens[1].c_str(), Poco::cat(std::string(" "), tokens.begin() + 2, tokens.end()).c_str());

    return true;
}

bool ChildProcessSession::selectText(const char *buffer, int length, Poco::StringTokenizer& tokens)
{
    int type, x, y;

    if (tokens.count() != 4 ||
        !getTokenInteger(tokens[1], "type", type) ||
        !getTokenInteger(tokens[2], "x", x) ||
        !getTokenInteger(tokens[3], "y", y))
    {
        sendTextFrame("error: cmd=selecttext kind=syntax");
        return false;
    }

    _loKitDocument->pClass->setTextSelection(_loKitDocument, type, x, y);

    return true;
}

bool ChildProcessSession::selectGraphic(const char *buffer, int length, Poco::StringTokenizer& tokens)
{
    int type, x, y;

    if (tokens.count() != 4 ||
        !getTokenInteger(tokens[1], "type", type) ||
        !getTokenInteger(tokens[2], "x", x) ||
        !getTokenInteger(tokens[3], "y", y))
    {
        sendTextFrame("error: cmd=selectghraphic kind=syntax");
        return false;
    }

    _loKitDocument->pClass->setGraphicSelection(_loKitDocument, type, x, y);

    return true;
}

bool ChildProcessSession::resetSelection(const char *buffer, int length, Poco::StringTokenizer& tokens)
{
    if (tokens.count() != 1)
    {
        sendTextFrame("error: cmd=resetselection kind=syntax");
        return false;
    }

    _loKitDocument->pClass->resetSelection(_loKitDocument);

    return true;
}

bool ChildProcessSession::saveAs(const char *buffer, int length, Poco::StringTokenizer& tokens)
{
    std::string url, format, filterOptions;

    if (tokens.count() < 4 ||
        !getTokenString(tokens[1], "url", url) ||
        !getTokenString(tokens[2], "format", format) ||
        !getTokenString(tokens[3], "options", filterOptions))
    {
        sendTextFrame("error: cmd=saveas kind=syntax");
        return false;
    }

    URI::decode(url, url, true);
    URI::decode(format, format, true);

    if (tokens.count() > 4)
        filterOptions += Poco::cat(std::string(" "), tokens.begin() + 4, tokens.end());

    _loKitDocument->pClass->saveAs(_loKitDocument, url.c_str(), format.c_str(), filterOptions.c_str());

    return true;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
