/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <iostream>

#include <Poco/FileStream.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Process.h>
#include <Poco/Random.h>
#include <Poco/URI.h>
#include <Poco/URIStreamOpener.h>

#include "LOOLProtocol.hpp"
#include "LOOLSession.hpp"
#include "LOOLWSD.hpp"
#include "MasterProcessSession.hpp"
#include "Util.hpp"

using namespace LOOLProtocol;

using Poco::Dynamic::Var;
using Poco::Exception;
using Poco::File;
using Poco::IOException;
using Poco::JSON::Object;
using Poco::JSON::Parser;
using Poco::Net::SocketAddress;
using Poco::Net::WebSocket;
using Poco::Path;
using Poco::Process;
using Poco::ProcessHandle;
using Poco::Random;
using Poco::StringTokenizer;
using Poco::Thread;
using Poco::UInt64;
using Poco::URI;

std::map<Process::PID, UInt64> MasterProcessSession::_childProcesses;

std::map<Thread::TID, std::shared_ptr<MasterProcessSession>> MasterProcessSession::_availableChildSessions;
std::mutex MasterProcessSession::_availableChildSessionMutex;
std::condition_variable MasterProcessSession::_availableChildSessionCV;

MasterProcessSession::MasterProcessSession(std::shared_ptr<WebSocket> ws, const Kind kind) :
    LOOLSession(ws, kind),
    _childId(0),
    _pidChild(0),
    _curPart(0),
    _loadPart(-1)
{
    std::cout << Util::logPrefix() << "MasterProcessSession ctor this=" << this << " ws=" << _ws.get() << std::endl;
}

MasterProcessSession::~MasterProcessSession()
{
    std::cout << Util::logPrefix() << "MasterProcessSession dtor this=" << this << " _peer=" << _peer.lock().get() << std::endl;

    auto peer = _peer.lock();
    if (_kind == Kind::ToClient && peer)
    {
        Util::shutdownWebSocket(*(peer->_ws));
    }
}

bool MasterProcessSession::handleInput(const char *buffer, int length)
{
    Log::trace(_kindString + ",Recv," + getAbbreviatedMessage(buffer, length));

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
                        Path path(MasterProcessSession::getJailPath(_childId), url.substr(filePrefix.length()));
                        url = filePrefix + path.toString().substr(1);
                    }
                    peer->_saveAsQueue.put(url);
                }

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
                peer->_tileCache->saveTextFile(std::string(buffer, length), "status.txt");
            }
            else if (tokens[0] == "commandvalues:")
            {
                std::string stringMsg(buffer, length);
                std::string stringJSON = stringMsg.substr(stringMsg.find_first_of("{"));
                Parser parser;
                Var result = parser.parse(stringJSON);
                Object::Ptr object = result.extract<Object::Ptr>();
                std::string commandName = object->get("commandName").toString();
                if (commandName.find(".uno:CharFontName") != std::string::npos ||
                    commandName.find(".uno:StyleApply") != std::string::npos)
                {
                    // other commands should not be cached
                    peer->_tileCache->saveTextFile(std::string(buffer, length), "cmdValues" + commandName + ".txt");
                }
            }
            else if (tokens[0] == "partpagerectangles:")
            {
                peer->_tileCache->saveTextFile(std::string(buffer, length), "partpagerectangles.txt");
            }
            else if (tokens[0] == "invalidatecursor:")
            {
                peer->_tileCache->setEditing(true);
            }
            else if (tokens[0] == "invalidatetiles:")
            {
                // FIXME temporarily, set the editing on the 1st invalidate, TODO extend
                // the protocol so that the client can set the editing or view only.
                peer->_tileCache->setEditing(true);

                assert(firstLine.size() == static_cast<std::string::size_type>(length));
                peer->_tileCache->invalidateTiles(firstLine);
            }
            else if (tokens[0] == "renderfont:")
            {
                std::string font;
                if (tokens.count() < 2 ||
                    !getTokenString(tokens[1], "font", font))
                    assert(false);

                assert(firstLine.size() < static_cast<std::string::size_type>(length));
                peer->_tileCache->saveRendering(font, "font", buffer + firstLine.size() + 1, length - firstLine.size() - 1);
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
        if (tokens.count() != 4)
        {
            sendTextFrame("error: cmd=child kind=syntax");
            return false;
        }

        UInt64 childId = std::stoull(tokens[1]);
        Thread::TID tId = std::stoull(tokens[2]);
        Process::PID pidChild = std::stoull(tokens[3]);

        std::unique_lock<std::mutex> lock(_availableChildSessionMutex);
        _availableChildSessions.insert(std::pair<Thread::TID, std::shared_ptr<MasterProcessSession>> (tId, shared_from_this()));
        std::cout << Util::logPrefix() << _kindString << ",Inserted " << this << " id=" << childId << " into _availableChildSessions, size=" << _availableChildSessions.size() << std::endl;
        std::cout << Util::logPrefix() << "Inserted " << this << " id=" << childId << " into _availableChildSessions, size=" << _availableChildSessions.size() << std::endl;
        _childId = childId;
        _pidChild = pidChild;
        lock.unlock();
        _availableChildSessionCV.notify_one();

        // log first lokit child pid information
        if ( LOOLWSD::doTest )
        {
            Poco::FileOutputStream filePID(LOOLWSD::LOKIT_PIDLOG);
            if (filePID.good())
                filePID << pidChild;
        }
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
             tokens[0] != "clientzoom" &&
             tokens[0] != "commandvalues" &&
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
    else
    {
        // All other commands are such that they always require a
        // LibreOfficeKitDocument session, i.e. need to be handled in
        // a child process.

        if (_peer.expired())
            dispatchChild();
        if (tokens[0] != "requestloksession")
        {
            forwardToPeer(buffer, length);
        }

        if ((tokens.count() > 1 && tokens[0] == "uno" && tokens[1] == ".uno:Save"))
        {
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
    _tileCache->setEditing(true);

    _tileCache->invalidateTiles(_curPart, tilePosX, tilePosY, tileWidth, tileHeight);
    return true;
}

bool MasterProcessSession::loadDocument(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    if (tokens.count() < 2)
    {
        sendTextFrame("error: cmd=load kind=syntax");
        return false;
    }

    std::string timestamp;
    parseDocOptions(tokens, _loadPart, timestamp);

    try
    {
        URI aUri(_docURL);

        // request new URL session
        std::string aMessage = "request " + std::to_string(Thread::currentTid()) + " " + _docURL + "\r\n";
        Util::writeFIFO(LOOLWSD::writerBroker, aMessage.c_str(), aMessage.length());
    }
    catch(Poco::SyntaxException&)
    {
        sendTextFrame("error: cmd=load kind=uriinvalid");
        return false;
    }

    _tileCache.reset(new TileCache(_docURL, timestamp));

    return true;
}

bool MasterProcessSession::getStatus(const char *buffer, int length)
{
    std::string status;

    status = _tileCache->getTextFile("status.txt");
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

bool MasterProcessSession::getCommandValues(const char *buffer, int length, StringTokenizer& tokens)
{
    std::string command;
    if (tokens.count() != 2 || !getTokenString(tokens[1], "command", command))
    {
        sendTextFrame("error: cmd=commandvalues kind=syntax");
        return false;
    }

    std::string cmdValues = _tileCache->getTextFile("cmdValues" + command + ".txt");
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
    std::string partPageRectangles = _tileCache->getTextFile("partpagerectangles.txt");
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
    return _saveAsQueue.get();
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

    std::string response = "renderfont: " + Poco::cat(std::string(" "), tokens.begin() + 1, tokens.end()) + "\n";

    std::vector<char> output;
    output.resize(response.size());
    std::memcpy(output.data(), response.data(), response.size());

    std::unique_ptr<std::fstream> cachedRendering = _tileCache->lookupRendering(font, "font");
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
    short nRequest = 3;
    bool  bFound = false;

    // Copy document into jail using the fixed name

    std::shared_ptr<MasterProcessSession> childSession;
    std::unique_lock<std::mutex> lock(_availableChildSessionMutex);

    std::cout << Util::logPrefix() << "waiting for a child session permission for " << Thread::currentTid() << std::endl;
    while (nRequest-- && !bFound)
    {
        _availableChildSessionCV.wait_for(
            lock,
            std::chrono::milliseconds(2000),
            [&bFound]
            {
                return (bFound = _availableChildSessions.find(Thread::currentTid()) != _availableChildSessions.end());
            });

        if (!bFound)
        {
            std::cout << Util::logPrefix() << "trying ..." << nRequest << std::endl;
            // request again new URL session
            std::string aMessage = "request " + std::to_string(Thread::currentTid()) + " " + _docURL + "\r\n";
            Util::writeFIFO(LOOLWSD::writerBroker, aMessage.c_str(), aMessage.length());
        }
    }

    if ( bFound )
    {
        std::cout << Util::logPrefix() << "waiting child session permission, done!" << std::endl;
        childSession = _availableChildSessions[Thread::currentTid()];
        _availableChildSessions.erase(Thread::currentTid());
    }

    lock.unlock();

    if ( !nRequest && !bFound )
    {
        // it cannot get connected.  shutdown.
        Util::shutdownWebSocket(*_ws);
        return;
    }

    // Assume a valid URI
    URI aUri(_docURL);

    if (aUri.isRelative())
        aUri = URI( URI("file://"), aUri.toString() );

    if (!aUri.empty() && aUri.getScheme() == "file")
    {
        std::string aJailDoc = jailDocumentURL.substr(1) + Path::separator() + std::to_string(childSession->_pidChild);
        Path aSrcFile(aUri.getPath());
        Path aDstFile(Path(getJailPath(childSession->_childId), aJailDoc), aSrcFile.getFileName());
        Path aDstPath(getJailPath(childSession->_childId), aJailDoc);
        Path aJailFile(aJailDoc, aSrcFile.getFileName());

        try
        {
            File(aDstPath).createDirectories();
        }
        catch (Exception& exc)
        {
            Log::error(
                "createDirectories(\"" + aDstPath.toString() + "\") failed: " + exc.displayText() );

        }

        // cleanup potential leftovers from the last time
        File aToCleanup(aDstFile);
        if (aToCleanup.exists())
            aToCleanup.remove();

#ifdef __linux
        Log::info("Linking " + aSrcFile.toString() + " to " + aDstFile.toString());
        if (!File(aDstFile).exists() && link(aSrcFile.toString().c_str(), aDstFile.toString().c_str()) == -1)
        {
            // Failed
            Log::error("link(\"" + aSrcFile.toString() + "\",\"" + aDstFile.toString() + "\") failed.");
        }
#endif

        try
        {
            //fallback
            if (!File(aDstFile).exists())
            {
                Log::info("Copying " + aSrcFile.toString() + " to " + aDstFile.toString());
                File(aSrcFile).copyTo(aDstFile.toString());
            }
        }
        catch (Exception& exc)
        {
            Log::error("copyTo(\"" + aSrcFile.toString() + "\",\"" + aDstFile.toString() + "\") failed: " + exc.displayText());
        }
    }

    _peer = childSession;
    childSession->_peer = shared_from_this();

    const std::string loadRequest = "load" + (_loadPart >= 0 ?  " part=" + std::to_string(_loadPart) : "")
                                  + " url=" + _docURL + (!_docOptions.empty() ? " options=" + _docOptions : "");
    forwardToPeer(loadRequest.c_str(), loadRequest.size());
}

void MasterProcessSession::forwardToPeer(const char *buffer, int length)
{
    Log::trace(_kindString + ",forwardToPeer," + getAbbreviatedMessage(buffer, length));
    auto peer = _peer.lock();
    if (!peer)
    {
        Log::error("Error: no peer to forward to.");
        return;
    }
    peer->sendBinaryFrame(buffer, length);
}

