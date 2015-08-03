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
#include <condition_variable>
#include <map>
#include <memory>
#include <mutex>
#include <ostream>
#include <set>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>

#include <Poco/Net/WebSocket.h>
#include <Poco/Buffer.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/Random.h>
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

    virtual bool getStatus(const char *buffer, int length) = 0;

    virtual bool handleInput(const char *buffer, int length) = 0;

protected:
    LOOLSession(std::shared_ptr<Poco::Net::WebSocket> ws, Kind kind);
    virtual ~LOOLSession();

    static const std::string jailDocumentURL;

    const Kind _kind;

    std::string _kindString;

    void sendBinaryFrame(const char *buffer, int length);

    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) = 0;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens) = 0;

    // Fields common to sessions in master and jailed processes:

    // In the master process, the websocket to the LOOL client or the jailed child process. In a
    // jailed process, the websocket to the parent.
    std::shared_ptr<Poco::Net::WebSocket> _ws;

    // The actual URL, also in the child, even if the child never accesses that.
    std::string _docURL;

private:
    std::mutex _mutex;
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

class MasterProcessSession final : public LOOLSession, public std::enable_shared_from_this<MasterProcessSession>
{
public:
    MasterProcessSession(std::shared_ptr<Poco::Net::WebSocket> ws, Kind kind);
    virtual ~MasterProcessSession();

    virtual bool handleInput(const char *buffer, int length) override;

    bool haveSeparateProcess();

    static Poco::Path getJailPath(Poco::UInt64 childId);

    static std::map<Poco::Process::PID, Poco::UInt64> _childProcesses;

    virtual bool getStatus(const char *buffer, int length);

 protected:
    bool invalidateTiles(const char *buffer, int length, Poco::StringTokenizer& tokens);

    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens);

    void dispatchChild();
    void forwardToPeer(const char *buffer, int length);

    // If _kind==ToPrisoner and the child process has started and completed its handshake with the
    // parent process: Points to the WebSocketSession for the child process handling the document in
    // question, if any.

    // In the session to the child process, points to the LOOLSession for the LOOL client. This will
    // obvious have to be rethought when we add collaboration and there can be several LOOL clients
    // per document being edited (i.e., per child process).
    std::weak_ptr<MasterProcessSession> _peer;

    // Sessions to pre-spawned child processes that have connected but are not yet assigned a
    // document to work on.
    static std::set<std::shared_ptr<MasterProcessSession>> _availableChildSessions;
    static std::mutex _availableChildSessionMutex;
    static std::condition_variable _availableChildSessionCV;

    std::unique_ptr<TileCache> _tileCache;

private:
    // The id of the child process
    Poco::UInt64 _childId;
    static Poco::Random _rng;
    static std::mutex _rngMutex;
    int _curPart;
};

class ChildProcessSession final : public LOOLSession
{
public:
    ChildProcessSession(std::shared_ptr<Poco::Net::WebSocket> ws, LibreOfficeKit *loKit);
    virtual ~ChildProcessSession();

    virtual bool handleInput(const char *buffer, int length) override;

    virtual bool getStatus(const char *buffer, int length);

    LibreOfficeKitDocument *_loKitDocument;
    std::string _docType;

 protected:
    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens);

    bool getTextSelection(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool keyEvent(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool mouseEvent(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool unoCommand(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool selectText(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool selectGraphic(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool resetSelection(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool saveAs(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool setClientPart(const char *buffer, int length, Poco::StringTokenizer& tokens);

    std::string _jail;
    std::string _loSubPath;
    LibreOfficeKit *_loKit;

 private:
    int _clientPart;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
