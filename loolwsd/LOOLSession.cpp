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

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include <Poco/Exception.h>
#include <Poco/File.h>
#include <Poco/Net/HTTPStreamFactory.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/Random.h>
#include <Poco/StreamCopier.h>
#include <Poco/String.h>
#include <Poco/StringTokenizer.h>
#include <Poco/ThreadLocal.h>
#include <Poco/URI.h>
#include <Poco/URIStreamOpener.h>
#include <Poco/Util/Application.h>
#include <Poco/Exception.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/DialogSocket.h>
#include <Poco/Net/SocketAddress.h>

#include "LOKitHelper.hpp"
#include "LOOLProtocol.hpp"
#include "LOOLSession.hpp"
#include "LOOLWSD.hpp"
#include "TileCache.hpp"
#include "Util.hpp"

using namespace LOOLProtocol;

using Poco::File;
using Poco::IOException;
using Poco::Net::HTTPStreamFactory;
using Poco::Net::WebSocket;
using Poco::Path;
using Poco::Process;
using Poco::ProcessHandle;
using Poco::Random;
using Poco::StreamCopier;
using Poco::StringTokenizer;
using Poco::Thread;
using Poco::ThreadLocal;
using Poco::UInt64;
using Poco::URI;
using Poco::URIStreamOpener;
using Poco::Util::Application;
using Poco::Exception;
using Poco::Net::DialogSocket;
using Poco::Net::SocketAddress;
using Poco::Net::WebSocketException;

const std::string LOOLSession::jailDocumentURL = "/user/thedocument";

LOOLSession::LOOLSession(std::shared_ptr<WebSocket> ws, Kind kind) :
    _kind(kind),
    _ws(ws),
    _docURL("")
{
    std::cout << Util::logPrefix() << "LOOLSession ctor this=" << this << " " << _kind << " ws=" << _ws.get() << std::endl;
    if (kind == Kind::ToClient) {
        _kindString = "ToClient";
    }
    else if (kind == Kind::ToMaster) {
        _kindString = "ToMaster";
    }
    else if (kind == Kind::ToPrisoner) {
        _kindString = "ToPrisoner";
    }
}

LOOLSession::~LOOLSession()
{
    std::cout << Util::logPrefix() << "LOOLSession dtor this=" << this << " " << _kind << std::endl;
    Util::shutdownWebSocket(*_ws);
}

void LOOLSession::sendTextFrame(const std::string& text)
{
    std::unique_lock<std::mutex> lock(_mutex);

    _ws->sendFrame(text.data(), text.size());
}

void LOOLSession::sendBinaryFrame(const char *buffer, int length)
{
    std::unique_lock<std::mutex> lock(_mutex);

    if (length > 1000)
    {
        std::string nextmessage = "nextmessage: size=" + std::to_string(length);
        _ws->sendFrame(nextmessage.data(), nextmessage.size());
    }

    _ws->sendFrame(buffer, length, WebSocket::FRAME_BINARY);
}

std::map<Process::PID, UInt64> MasterProcessSession::_childProcesses;

std::set<std::shared_ptr<MasterProcessSession>> MasterProcessSession::_availableChildSessions;
std::mutex MasterProcessSession::_availableChildSessionMutex;
std::condition_variable MasterProcessSession::_availableChildSessionCV;
Random MasterProcessSession::_rng;
std::mutex MasterProcessSession::_rngMutex;

MasterProcessSession::MasterProcessSession(std::shared_ptr<WebSocket> ws, Kind kind) :
    LOOLSession(ws, kind),
    _childId(0),
    _curPart(0)
{
    std::cout << Util::logPrefix() << "MasterProcessSession ctor this=" << this << " ws=" << _ws.get() << std::endl;
}

MasterProcessSession::~MasterProcessSession()
{
    std::cout << Util::logPrefix() << "MasterProcessSession dtor this=" << this << " _peer=" << _peer.lock().get() << std::endl;
    Util::shutdownWebSocket(*_ws);
    auto peer = _peer.lock();
    if (_kind == Kind::ToClient && peer)
    {
        Util::shutdownWebSocket(*(peer->_ws));
    }
}

bool MasterProcessSession::handleInput(const char *buffer, int length)
{
    Application::instance().logger().information(Util::logPrefix() + _kindString + ",Input," + getAbbreviatedMessage(buffer, length));

    std::string firstLine = getFirstLine(buffer, length);
    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    if (haveSeparateProcess())
    {
        // Note that this handles both forwarding requests from the client to the child process, and
        // forwarding replies from the child process to the client. Or does it?

        // Snoop at some  messages and manipulate tile cache information as needed
        auto peer = _peer.lock();

        if (_kind == Kind::ToPrisoner)
        {
            if (tokens[0] == "curpart:" &&
                tokens.count() == 2 &&
                getTokenInteger(tokens[1], "part", _curPart))
            {
                return true;
            }
        }

        if (_kind == Kind::ToPrisoner && peer && peer->_tileCache)
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
                peer->_tileCache->saveTile(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight, buffer + firstLine.size() + 1, length - firstLine.size() - 1);
            }
            else if (tokens[0] == "status:")
            {
                peer->_tileCache->saveStatus(std::string(buffer, length));
            }
            else if (tokens[0] == "invalidatetiles:")
            {
                // FIXME temporarily, set the editing on the 1st invalidate, TODO extend
                // the protocol so that the client can set the editing or view only.
                peer->_tileCache->setEditing(true);

                assert(firstLine.size() == static_cast<std::string::size_type>(length));
                peer->_tileCache->invalidateTiles(firstLine);
            }
        }

        forwardToPeer(buffer, length);
        return true;
    }

    if (tokens[0] == "child")
    {
        if (_kind != Kind::ToPrisoner)
        {
            sendTextFrame("error: cmd=child kind=invalid");
            return false;
        }
        if (!_peer.expired())
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

        std::unique_lock<std::mutex> lock(_availableChildSessionMutex);
        _availableChildSessions.insert(shared_from_this());
        std::cout << Util::logPrefix() << "Inserted " << this << " id=" << childId << " into _availableChildSessions, size=" << _availableChildSessions.size() << std::endl;
        _childId = childId;
        lock.unlock();
        _availableChildSessionCV.notify_one();
    }
    else if (_kind == Kind::ToPrisoner)
    {
        // Message from child process to be forwarded to client.

        // I think we should never get here
        assert(false);
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
             tokens[0] != "gettextselection" &&
             tokens[0] != "invalidatetiles" &&
             tokens[0] != "key" &&
             tokens[0] != "mouse" &&
             tokens[0] != "resetselection" &&
             tokens[0] != "saveas" &&
             tokens[0] != "selectgraphic" &&
             tokens[0] != "selecttext" &&
             tokens[0] != "setclientpart" &&
             tokens[0] != "setpage" &&
             tokens[0] != "status" &&
             tokens[0] != "tile" &&
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
    else if (tokens[0] == "invalidatetiles")
    {
        return invalidateTiles(buffer, length, tokens);
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

        if (_peer.expired())
            dispatchChild();
        forwardToPeer(buffer, length);

        if ((tokens.count() > 1 && tokens[0] == "uno" && tokens[1] == ".uno:Save")) {
           _tileCache->documentSaved();
        }
    }
    return true;
}

bool MasterProcessSession::haveSeparateProcess()
{
    return _childId != 0;
}

Path MasterProcessSession::getJailPath(UInt64 childId)
{
    return Path::forDirectory(LOOLWSD::childRoot + Path::separator() + std::to_string(childId));
}

bool MasterProcessSession::invalidateTiles(const char *buffer, int length, StringTokenizer& tokens)
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
    _tileCache->setEditing(true);

    _tileCache->invalidateTiles(_curPart, tilePosX, tilePosY, tileWidth, tileHeight);
    return true;
}

bool MasterProcessSession::loadDocument(const char *buffer, int length, StringTokenizer& tokens)
{
    if (tokens.count() < 2 || tokens.count() > 3)
    {
        sendTextFrame("error: cmd=load kind=syntax");
        return false;
    }

    std::string timestamp;
    for (size_t i = 1; i < tokens.count(); ++i)
    {
        if (tokens[i].find("url=") == 0)
            _docURL = tokens[i].substr(strlen("url="));
        else if (tokens[i].find("timestamp=") == 0)
            timestamp = tokens[i].substr(strlen("timestamp="));
    }

    try
    {
        URI aUri(_docURL);
    }
    catch(Poco::SyntaxException&)
    {
        sendTextFrame("error: cmd=load kind=URI invalid syntax");
        return false;
    }

    _tileCache.reset(new TileCache(_docURL, timestamp));

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

    if (_peer.expired())
        dispatchChild();
    forwardToPeer(buffer, length);
    return true;
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

    std::unique_ptr<std::fstream> cachedTile = _tileCache->lookupTile(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
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

void MasterProcessSession::dispatchChild()
{
    // Copy document into jail using the fixed name

    std::shared_ptr<MasterProcessSession> childSession;
    std::unique_lock<std::mutex> lock(_availableChildSessionMutex);

    std::cout << Util::logPrefix() << "_availableChildSessions size=" << _availableChildSessions.size() << std::endl;

    if (_availableChildSessions.size() == 0)
    {
        std::cout << Util::logPrefix() << "waiting for a child session to become available" << std::endl;
        _availableChildSessionCV.wait(lock, [] { return _availableChildSessions.size() > 0; });
        std::cout << Util::logPrefix() << "waiting done" << std::endl;
    }

    childSession = *(_availableChildSessions.begin());

    _availableChildSessions.erase(childSession);
    std::cout << Util::logPrefix() << "_availableChildSessions size=" << _availableChildSessions.size() << std::endl;
    if (_availableChildSessions.size() == 0)
        LOOLWSD::_sharedForkChild.begin()[0] = 1;
    lock.unlock();

    // Assume a valid URI
    URI aUri(_docURL);

    if (aUri.isRelative())
        aUri = URI( URI("file://"), aUri.toString() );

    if (!aUri.empty() && aUri.getScheme() == "file")
    {
        Path aSrcFile(aUri.getPath());
        Path aDstFile(Path(getJailPath(childSession->_childId), jailDocumentURL.substr(1)), aSrcFile.getFileName());
        Path aDstPath(getJailPath(childSession->_childId), jailDocumentURL.substr(1));
        Path aJailFile(jailDocumentURL, aSrcFile.getFileName());

        try
        {
            File(aDstPath).createDirectories();
        }
        catch (Exception& exc)
        {
            Application::instance().logger().error( Util::logPrefix() +
                "createDirectories(\"" + aDstPath.toString() + "\") failed: " + exc.displayText() );

        }

#ifdef __linux
        Application::instance().logger().information(Util::logPrefix() + "Linking " + aSrcFile.toString() + " to " + aDstFile.toString());
        if (link(aSrcFile.toString().c_str(), aDstFile.toString().c_str()) == -1)
        {
            // Failed
            Application::instance().logger().error( Util::logPrefix() +
                "link(\"" + aSrcFile.toString() + "\",\"" + aDstFile.toString() + "\") failed: " + strerror(errno) );
        }
#endif

        try
        {
            //fallback
            if (!File(aDstFile).exists())
            {
                Application::instance().logger().information(Util::logPrefix() + "Copying " + aSrcFile.toString() + " to " + aDstFile.toString());
                File(aSrcFile).copyTo(aDstFile.toString());
            }
        }
        catch (Exception& exc)
        {
            Application::instance().logger().error( Util::logPrefix() +
                "copyTo(\"" + aSrcFile.toString() + "\",\"" + aDstFile.toString() + "\") failed: " + exc.displayText());
        }
    }

    _peer = childSession;
    childSession->_peer = shared_from_this();

    std::string loadRequest = "load url=" + _docURL;
    forwardToPeer(loadRequest.c_str(), loadRequest.size());
}

void MasterProcessSession::forwardToPeer(const char *buffer, int length)
{
    Application::instance().logger().information(Util::logPrefix() + _kindString + ",forwardToPeer," + getAbbreviatedMessage(buffer, length));
    auto peer = _peer.lock();
    if (!peer)
        return;
    peer->sendBinaryFrame(buffer, length);
}

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

    Application::instance().logger().information(Util::logPrefix() + _kindString + ",Input," + getAbbreviatedMessage(buffer, length));

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

        if (_docType != "text" && _loKitDocument->pClass->getPart(_loKitDocument) != _clientPart)
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
                if (srv->_docType == "text")
                {
                    curPart = 0;
                }
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
        Application::instance().logger().information(Util::logPrefix() + "Failed to load: " + aUri.toString() + ", error is: " + _loKit->pClass->getError(_loKit));
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
    StringTokenizer tokens(status, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
    if (!getTokenString(tokens[1], "type", _docType))
    {
        Application::instance().logger().information(Util::logPrefix() + "failed to get document type from" + status);
    }
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
    if (_docType != "text" && part != _loKitDocument->pClass->getPart(_loKitDocument)) {
        _loKitDocument->pClass->setPart(_loKitDocument, part);
    }
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

    getTokenString(tokens[2], "format", format);

    if (getTokenString(tokens[3], "options", filterOptions)) {
        if (tokens.count() > 4) {
            filterOptions += Poco::cat(std::string(" "), tokens.begin() + 4, tokens.end());
        }
    }

    _loKitDocument->pClass->saveAs(_loKitDocument, url.c_str(),
            format.size() == 0 ? NULL :format.c_str(),
            filterOptions.size() == 0 ? NULL : filterOptions.c_str());

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

bool ChildProcessSession::setPage(const char *buffer, int length, StringTokenizer& tokens)
{
    int page;
    if (tokens.count() < 2 ||
        !getTokenInteger(tokens[1], "page", page))
    {
        sendTextFrame("error: cmd=setpage kind=invalid");
        return false;
    }
    _loKitDocument->pClass->setPart(_loKitDocument, page);
    return true;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
