/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOOLSESSION_HPP
#define INCLUDED_LOOLSESSION_HPP

#include <cassert>
#include <map>
#include <ostream>
#include <set>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>

#include <Poco/Net/WebSocket.h>
#include <Poco/Buffer.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Types.h>

#include "TileCache.hpp"

// We have three kinds of Websocket sessions
// 1) Between the master loolwsd server to the end-user LOOL client
// 2) Between the master loolwsd server and a jailed loolwsd child process, in the master process
// 3) Ditto, in the jailed loolwsd process

class LOOLSession
{
public:
    enum class Kind { ToClient, ToPrisoner, ToMaster };

    void sendTextFrame(const std::string& text);

protected:
    LOOLSession(Poco::Net::WebSocket& ws, Kind kind);
    virtual ~LOOLSession();

    static const std::string jailDocumentURL;

    const Kind _kind;

    virtual bool handleInput(char *buffer, int length) = 0;

    void sendBinaryFrame(const char *buffer, int length);

    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) = 0;
    virtual bool getStatus(const char *buffer, int length) = 0;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens) = 0;

    // Fields common to sessions in master and jailed processes:

    // In the master process, the websocket to the LOOL client or the jailed child process. In a
    // jailed process, the websocket to the parent.
    Poco::Net::WebSocket *_ws;

    // In the master, the actual URL. In the child, the copy inside the chroot jail.
    std::string _docURL;

    // The id of the child process
    Poco::UInt64 _childId;

    std::unique_ptr<TileCache> _tileCache;
};

template<typename charT, typename traits>
inline std::basic_ostream<charT, traits> & operator <<(std::basic_ostream<charT, traits> & stream, LOOLSession::Kind kind)
{
    switch (kind)
    {
    case LOOLSession::Kind::ToClient:
        return stream << "TO_CLIENT";
    case LOOLSession::Kind::ToPrisoner:
        return stream << "TO_PRISONER";
    case LOOLSession::Kind::ToMaster:
        return stream << "TO_MASTER";
    default:
        assert(false);
        return stream << "UNK_" + std::to_string(static_cast<int>(kind));
    }
}

class MasterProcessSession final : public LOOLSession
{
public:
    MasterProcessSession(Poco::Net::WebSocket& ws, Kind kind);
    virtual ~MasterProcessSession();

    virtual bool handleInput(char *buffer, int length) override;

    bool haveSeparateProcess();

    static Poco::Path getJailPath(Poco::UInt64 childId);

    // Set up the chroot environment for one child process and start
    // it, in advance of it being actually needed
    static void preSpawn();

    static std::map<Poco::Process::PID, Poco::UInt64> _childProcesses;

protected:
    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) override;
    virtual bool getStatus(const char *buffer, int length);

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens);

    void dispatchChild();
    void forwardToPeer(const char *buffer, int length);

    // If _kind==ToPrisoner and the child process has started and completed its handshake with the
    // parent process: Points to the WebSocketSession for the child process handling the document in
    // question, if any.

    // In the session to the child process, points to the LOOLSession for the LOOL client. This will
    // obvious have to be rethought when we add collaboration and there can be several LOOL clients
    // per document being edited (i.e., per child process).
    MasterProcessSession *_peer;

    // Map from child ids to the corresponding session to the child
    // process.
    static std::map<Poco::UInt64, MasterProcessSession*> _childIdToChildSession;

    // Pre-spawned child processes that haven't yet connected.
    static std::set<Poco::UInt64> _pendingPreSpawnedChildren;

    // Sessions to pre-spawned child processes that have connected but are not yet assigned a
    // document to work on.
    static std::set<MasterProcessSession*> _availableChildSessions;
};

class ChildProcessSession final : public LOOLSession
{
public:
    ChildProcessSession(Poco::Net::WebSocket& ws, LibreOfficeKit *loKit, Poco::UInt64 childId);
    virtual ~ChildProcessSession();

    virtual bool handleInput(char *buffer, int length) override;

protected:
    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) override;
    virtual bool getStatus(const char *buffer, int length);

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens);

    bool keyEvent(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool mouseEvent(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool unoCommand(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool selectText(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool selectGraphic(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool resetSelection(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool saveAs(const char *buffer, int length, Poco::StringTokenizer& tokens);

    std::string _jail;
    std::string _loSubPath;
    LibreOfficeKit *_loKit;
    LibreOfficeKitDocument *_loKitDocument;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
