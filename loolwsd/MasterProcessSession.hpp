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

#include <time.h>

#include <Poco/Random.h>

#include "LOOLSession.hpp"
#include "MessageQueue.hpp"
#include "TileCache.hpp"

class DocumentBroker;

class MasterProcessSession final : public LOOLSession, public std::enable_shared_from_this<MasterProcessSession>
{
 public:
    MasterProcessSession(const std::string& id,
                         const Kind kind,
                         std::shared_ptr<Poco::Net::WebSocket> ws,
                         std::shared_ptr<DocumentBroker> docBroker,
                         std::shared_ptr<BasicTileQueue> queue);
    virtual ~MasterProcessSession();

    virtual bool getStatus(const char *buffer, int length) override;

    virtual bool getCommandValues(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual bool getPartPageRectangles(const char *buffer, int length) override;

    virtual void disconnect(const std::string& reason = "") override;
    virtual bool handleDisconnect(Poco::StringTokenizer& tokens) override;

    /**
     * Return the URL of the saved-as document when it's ready. If called
     * before it's ready, the call blocks till then.
     */
    std::string getSaveAs();

    std::shared_ptr<DocumentBroker> getDocumentBroker() const { return _docBroker; }

    std::shared_ptr<BasicTileQueue> getQueue() const { return _queue; }

    void setEditLock(const bool value) { _bEditLock = value; }

    bool isEditLocked() const { return _bEditLock; }

public:
    // Sessions to pre-spawned child processes that have connected but are not yet assigned a
    // document to work on.
    static std::map<std::string, std::shared_ptr<MasterProcessSession>> AvailableChildSessions;
    static std::mutex AvailableChildSessionMutex;
    static std::condition_variable AvailableChildSessionCV;

    time_t _lastMessageTime;
    time_t _idleSaveTime;
    time_t _autoSaveTime;

    // Raise this flag on ToClient from ToPrisoner to let ToClient know of load failures
    bool _bLoadError = false;

 protected:
    bool invalidateTiles(const char *buffer, int length, Poco::StringTokenizer& tokens);

    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendCombinedTiles(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendFontRendering(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

 private:
    void dispatchChild();
    void forwardToPeer(const char *buffer, int length);

    // If _kind==ToPrisoner and the child process has started and completed its handshake with the
    // parent process: Points to the WebSocketSession for the child process handling the document in
    // question, if any.

    // In the session to the child process, points to the LOOLSession for the LOOL client. This will
    // obvious have to be rethought when we add collaboration and there can be several LOOL clients
    // per document being edited (i.e., per child process).
    std::weak_ptr<MasterProcessSession> _peer;

    static
    Poco::Path getJailPath(const std::string& childId);

    virtual bool _handleInput(const char *buffer, int length) override;

    int _curPart;
    int _loadPart;
    /// Kind::ToClient instances store URLs of completed 'save as' documents.
    MessageQueue _saveAsQueue;
    std::shared_ptr<DocumentBroker> _docBroker;
    std::shared_ptr<BasicTileQueue> _queue;

    // If this document holds the edit lock.
    // An edit lock will only allow the current session to make edits,
    // while other session opening the same document can only see
    bool _bEditLock = false;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
