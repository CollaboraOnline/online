/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_MASTERPROCESSSESSION_HPP
#define INCLUDED_MASTERPROCESSSESSION_HPP

#include <memory>

#include <Poco/Random.h>

#include "LOOLSession.hpp"
#include "TileCache.hpp"

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

#endif
