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

#include <Poco/Random.h>

#include "DocumentStoreManager.hpp"
#include "LOOLSession.hpp"
#include "TileCache.hpp"

class MasterProcessSession final : public LOOLSession, public std::enable_shared_from_this<MasterProcessSession>
{
public:
    MasterProcessSession(const std::string& id,
                         const Kind kind,
                         std::shared_ptr<Poco::Net::WebSocket> ws,
                         std::shared_ptr<DocumentStoreManager> docStoreManager);
    virtual ~MasterProcessSession();

    bool haveSeparateProcess();

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

    std::shared_ptr<DocumentStoreManager> getDocumentStoreManager() const { return _docStoreManager; }

 protected:
    bool invalidateTiles(const char *buffer, int length, Poco::StringTokenizer& tokens);

    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendCombinedTiles(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendFontRendering(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

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
    static std::map<std::string, std::shared_ptr<MasterProcessSession>> AvailableChildSessions;
    static std::mutex AvailableChildSessionMutex;
    static std::condition_variable AvailableChildSessionCV;

    std::unique_ptr<TileCache> _tileCache;

private:

    static
    Poco::Path getJailPath(const std::string& childId);

    virtual bool _handleInput(const char *buffer, int length) override;

private:
    // The pid of the child process
    std::string _childId;
    int _curPart;
    int _loadPart;
    /// Kind::ToClient instances store URLs of completed 'save as' documents.
    MessageQueue _saveAsQueue;
    std::shared_ptr<DocumentStoreManager> _docStoreManager;
};

#endif

