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

#include <Poco/Process.h>
#include <Poco/Types.h>
#include <Poco/Random.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Util/Application.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Path.h>
#include <Poco/URI.h>
#include <Poco/File.h>
#include <Poco/Exception.h>

#include "MasterProcessSession.hpp"
#include "Util.hpp"
#include "LOOLProtocol.hpp"
#include "LOOLWSD.hpp"

using namespace LOOLProtocol;
using Poco::Process;
using Poco::UInt64;
using Poco::Random;
using Poco::Net::WebSocket;
using Poco::Util::Application;
using Poco::StringTokenizer;
using Poco::Path;
using Poco::URI;
using Poco::File;
using Poco::Exception;

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
    std::cout << Util::logPrefix() << "MasterProcessSession ctor this=" << this << " ws=" << _ws.get() << " kind="<< _kind << std::endl;
}

MasterProcessSession::~MasterProcessSession()
{
    std::cout << Util::logPrefix() << "MasterProcessSession dtor this=" << this << " _peer=" << _peer.lock().get() <<" kind="<< _kind << std::endl;
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
                peer->_tileCache->saveStatus(firstLine);
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

        if ((tokens.count() > 1 && tokens[0] == "uno" && tokens[1] == ".uno:Save") ||
               tokens[0] == "saveas") {
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
    if (tokens.count() != 2)
    {
        sendTextFrame("error: cmd=load kind=syntax");
        return false;
    }

    if (tokens[1].find("url=") == 0)
        _docURL = tokens[1].substr(strlen("url="));
    else
        _docURL = tokens[1];

    try
    {
        URI aUri(_docURL);
    }
    catch(Poco::SyntaxException&)
    {
        sendTextFrame("error: cmd=load kind=URI invalid syntax");
        return false;
    }

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
    lock.unlock();

    if (_availableChildSessions.size() == 0)
    {
        LOOLWSD::_namedMutexLOOL.lock();
        std::cout << Util::logPrefix() << "No available child sessions, queue new child session" << std::endl;
        LOOLWSD::_sharedForkChild.begin()[0] = (LOOLWSD::_sharedForkChild.begin()[0] > 0 ? LOOLWSD::_sharedForkChild.begin()[0] + 1 : 1);
        LOOLWSD::_namedMutexLOOL.unlock();
    }

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

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
