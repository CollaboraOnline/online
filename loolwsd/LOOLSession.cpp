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

const std::string LOOLSession::jailDocumentURL = "/user/thedocument";

LOOLSession::LOOLSession(std::shared_ptr<WebSocket> ws, Kind kind) :
    _kind(kind),
    _ws(ws),
    _docURL("")
{
    std::cout << Util::logPrefix() << "LOOLSession ctor this=" << this << " " << _kind << " ws=" << _ws.get() << std::endl;
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

std::set<UInt64> MasterProcessSession::_pendingPreSpawnedChildren;
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
    Application::instance().logger().information(Util::logPrefix() + "Input: " + getAbbreviatedMessage(buffer, length));

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
                if (tokens.count() != 8 ||
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
                assert(firstLine.size() == static_cast<std::string::size_type>(length));
                peer->_tileCache->saveStatus(firstLine);
            }
            else if (tokens[0] == "invalidatetiles:")
            {
                assert(firstLine.size() == static_cast<std::string::size_type>(length));
                peer->_tileCache->invalidateTiles(_curPart, firstLine);
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
        if (_pendingPreSpawnedChildren.find(childId) == _pendingPreSpawnedChildren.end())
        {
            sendTextFrame("error: cmd=child kind=notfound");
            return false;
        }
        _pendingPreSpawnedChildren.erase(childId);
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
             tokens[0] != "invalidatetiles" &&
             tokens[0] != "key" &&
             tokens[0] != "mouse" &&
             tokens[0] != "resetselection" &&
             tokens[0] != "saveas" &&
             tokens[0] != "selectgraphic" &&
             tokens[0] != "selecttext" &&
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

namespace
{
    ThreadLocal<std::string> sourceForLinkOrCopy;
    ThreadLocal<Path> destinationForLinkOrCopy;

    int linkOrCopyFunction(const char *fpath,
                           const struct stat *sb,
                           int typeflag,
                           struct FTW *ftwbuf)
    {
        if (strcmp(fpath, sourceForLinkOrCopy->c_str()) == 0)
            return 0;

        assert(fpath[strlen(sourceForLinkOrCopy->c_str())] == '/');
        const char *relativeOldPath = fpath + strlen(sourceForLinkOrCopy->c_str()) + 1;

#ifdef __APPLE__
        if (strcmp(relativeOldPath, "PkgInfo") == 0)
            return 0;
#endif

        Path newPath(*destinationForLinkOrCopy, Path(relativeOldPath));

        switch (typeflag)
        {
        case FTW_F:
            File(newPath.parent()).createDirectories();
            if (link(fpath, newPath.toString().c_str()) == -1)
            {
                Application::instance().logger().error(Util::logPrefix() +
                                                       "link(\"" + fpath + "\",\"" + newPath.toString() + "\") failed: " +
                                                       strerror(errno));
                exit(1);
            }
            break;
        case FTW_DP:
            {
                struct stat st;
                if (stat(fpath, &st) == -1)
                {
                    Application::instance().logger().error(Util::logPrefix() +
                                                           "stat(\"" + fpath + "\") failed: " +
                                                           strerror(errno));
                    return 1;
                }
                File(newPath).createDirectories();
                struct utimbuf ut;
                ut.actime = st.st_atime;
                ut.modtime = st.st_mtime;
                if (utime(newPath.toString().c_str(), &ut) == -1)
                {
                    Application::instance().logger().error(Util::logPrefix() +
                                                           "utime(\"" + newPath.toString() + "\", &ut) failed: " +
                                                           strerror(errno));
                    return 1;
                }
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
            Application::instance().logger().information(Util::logPrefix() +
                                                         "nftw: symlink to nonexistent file: '" + fpath + "', ignored");
            break;
        default:
            assert(false);
        }
        return 0;
    }

    void linkOrCopy(const std::string& source, const Path& destination)
    {
        *sourceForLinkOrCopy = source;
        *destinationForLinkOrCopy = destination;
        if (nftw(source.c_str(), linkOrCopyFunction, 10, FTW_DEPTH) == -1)
            Application::instance().logger().error(Util::logPrefix() +
                                                   "linkOrCopy: nftw() failed for '" + source + "'");
    }
}

void MasterProcessSession::preSpawn()
{
    // Create child-specific subtree that will become its chroot root

    std::unique_lock<std::mutex> rngLock(_rngMutex);
    UInt64 childId = (((UInt64)_rng.next()) << 32) | _rng.next() | 1;
    rngLock.unlock();

    Path jail = getJailPath(childId);
    File(jail).createDirectory();

    Path jailLOInstallation(jail, LOOLWSD::loSubPath);
    jailLOInstallation.makeDirectory();
    File(jailLOInstallation).createDirectory();

    // Copy (link) LO installation and other necessary files into it from the template

    linkOrCopy(LOOLWSD::sysTemplate, jail);
    linkOrCopy(LOOLWSD::loTemplate, jailLOInstallation);

    _pendingPreSpawnedChildren.insert(childId);

    Process::Args args;

#if ENABLE_DEBUG
    if (LOOLWSD::runningAsRoot)
        args.push_back(Application::instance().commandPath());
#endif

    args.push_back("--child=" + std::to_string(childId));
    args.push_back("--port=" + std::to_string(LOOLWSD::portNumber));
    args.push_back("--jail=" + jail.toString());
    args.push_back("--losubpath=" + LOOLWSD::loSubPath);

    std::string executable;

#if ENABLE_DEBUG
    if (LOOLWSD::runningAsRoot)
    {
        args.push_back("--uid=" + std::to_string(LOOLWSD::uid));
        executable = "/usr/bin/sudo";
    }
    else
#endif
    {
        executable = Application::instance().commandPath();
    }

    Application::instance().logger().information(Util::logPrefix() + "Launching child: " + executable + " " + Poco::cat(std::string(" "), args.begin(), args.end()));

#if ENABLE_DEBUG
    ProcessHandle child = Process::launch(executable, args);
#else
    ProcessHandle child = Process::launch(Application::instance().commandPath(), args);
#endif

    _childProcesses[child.id()] = childId;
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

    if (tokens.count() != 8 ||
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

    std::cout << Util::logPrefix() << "_availableChildSessions size=" << _availableChildSessions.size() << " _pendingChildSessions size=" << _pendingPreSpawnedChildren.size() << std::endl;

    if (_availableChildSessions.size() == 0)
    {
        if (_pendingPreSpawnedChildren.size() == 0)
        {
            // Running out of pre-spawned children, so spawn one more
            Application::instance().logger().information(Util::logPrefix() + "Running out of pre-spawned childred, adding one more");
            lock.unlock();
            preSpawn();
            lock.lock();
        }

        std::cout << Util::logPrefix() << "waiting for a child session to become available" << std::endl;
        _availableChildSessionCV.wait(lock, [] { return _availableChildSessions.size() > 0; });
        std::cout << Util::logPrefix() << "waiting done" << std::endl;
    }

    childSession = *(_availableChildSessions.begin());

    _availableChildSessions.erase(childSession);
    std::cout << Util::logPrefix() << "_availableChildSessions size=" << _availableChildSessions.size() << std::endl;
    lock.unlock();

    assert(jailDocumentURL[0] == '/');
    Path copy(getJailPath(childSession->_childId), jailDocumentURL.substr(1));
    Application::instance().logger().information(Util::logPrefix() + "Copying " + _docURL + " to " + copy.toString());

    URIStreamOpener opener;
    opener.registerStreamFactory("http", new HTTPStreamFactory());
    try
    {
        std::istream *input = opener.open(_docURL);
        std::ofstream output(copy.toString());
        if (!output)
        {
            Application::instance().logger().error(Util::logPrefix() + "Could not open " + copy.toString() + " for writing");
            sendTextFrame("error: cmd=load kind=internal");

            // We did not use the child session after all
            lock.lock();
            _availableChildSessions.insert(childSession);
            std::cout << Util::logPrefix() << "_availableChildSessions size=" << _availableChildSessions.size() << std::endl;
            lock.unlock();
            throw IOException(copy.toString());
        }
        StreamCopier::copyStream(*input, output);
        output.close();

        Application::instance().logger().information(Util::logPrefix() + "Copying done");
    }
    catch (IOException& exc)
    {
        Application::instance().logger().error(Util::logPrefix() + "Copying failed: " + exc.message());
        sendTextFrame("error: cmd=load kind=failed");

        lock.lock();
        _availableChildSessions.insert(childSession);
        std::cout << Util::logPrefix() << "_availableChildSessions size=" << _availableChildSessions.size() << std::endl;
        lock.unlock();

        throw;
    }

    _peer = childSession;
    childSession->_peer = shared_from_this();

    std::string loadRequest = "load url=" + _docURL;
    forwardToPeer(loadRequest.c_str(), loadRequest.size());

    // As we took one child process into use, spawn a new one
    preSpawn();
}

void MasterProcessSession::forwardToPeer(const char *buffer, int length)
{
    Application::instance().logger().information(Util::logPrefix() + "forwardToPeer(" + getAbbreviatedMessage(buffer, length) + ")");
    auto peer = _peer.lock();
    if (!peer)
        return;
    peer->sendBinaryFrame(buffer, length);
}

ChildProcessSession::ChildProcessSession(std::shared_ptr<WebSocket> ws, LibreOfficeKit *loKit) :
    LOOLSession(ws, Kind::ToMaster),
    _loKitDocument(NULL),
    _loKit(loKit)
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
        ChildProcessSession *srv = reinterpret_cast<ChildProcessSession *>(pData);

        switch ((LibreOfficeKitCallbackType) nType)
        {
        case LOK_CALLBACK_INVALIDATE_TILES:
            {
                int curPart = srv->_loKitDocument->pClass->getPart(srv->_loKitDocument);
                srv->sendTextFrame("curpart: part=" + std::to_string(curPart));
                srv->sendTextFrame("invalidatetiles: " + std::string(pPayload));
                StringTokenizer tokens(std::string(pPayload), " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
                if (tokens.count() == 4)
                {
                    int width(std::stoi(tokens[0]));
                    int height(std::stoi(tokens[1]));
                    int x(std::stoi(tokens[2]));
                    int y(std::stoi(tokens[3]));
                    srv->sendTextFrame("invalidate:"
                                       " part=" + std::to_string(curPart) +
                                       " x=" + std::to_string(x) +
                                       " y=" + std::to_string(y) +
                                       " width=" + std::to_string(width) +
                                       " height=" + std::to_string(height));
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

    // The URL in the request is the original one, not visible in the chroot jail.
    // The child process uses the fixed name jailDocumentURL.

    if (LIBREOFFICEKIT_HAS(_loKit, registerCallback))
        _loKit->pClass->registerCallback(_loKit, myCallback, this);

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
    int part, width, height, tilePosX, tilePosY, tileWidth, tileHeight;

    if (tokens.count() != 8 ||
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

    _loKitDocument->pClass->postUnoCommand(_loKitDocument, tokens[1].c_str(), Poco::cat(std::string(" "), tokens.begin() + 2, tokens.end()).c_str());

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
