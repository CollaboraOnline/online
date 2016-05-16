/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_PRISONERSESSION_HPP
#define INCLUDED_PRISONERSESSION_HPP

#include <time.h>

#include <Poco/Random.h>

#include "MasterProcessSession.hpp"
#include "LOOLSession.hpp"
#include "MessageQueue.hpp"

class DocumentBroker;
class ClientSession;

class PrisonerSession final : public MasterProcessSession//, public std::enable_shared_from_this<PrisonerSession>
{
public:
    using MasterProcessSession::MasterProcessSession;

    virtual ~PrisonerSession();

    void setPeer(const std::shared_ptr<ClientSession>& peer) { MasterProcessSession::_peer = _peer = peer; }

private:

    virtual bool _handleInput(const char *buffer, int length) override;

private:

    std::weak_ptr<ClientSession> _peer;
#if 0
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

    /**
     * Return the URL of the saved-as document when it's ready. If called
     * before it's ready, the call blocks till then.
     */
    std::string getSaveAs();

    std::shared_ptr<DocumentBroker> getDocumentBroker() const { return _docBroker; }

    std::shared_ptr<BasicTileQueue> getQueue() const { return _queue; }

    bool shutdownPeer(Poco::UInt16 statusCode, const std::string& message);

public:
    // Raise this flag on ToClient from ToPrisoner to let ToClient know of load failures
    bool _bLoadError = false;

 protected:
    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens);

    virtual void sendCombinedTiles(const char *buffer, int length, Poco::StringTokenizer& tokens);

    virtual void sendFontRendering(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

 private:
    void dispatchChild();
    void forwardToPeer(const char *buffer, int length);

    int _curPart;
    int _loadPart;
    /// Kind::ToClient instances store URLs of completed 'save as' documents.
    MessageQueue _saveAsQueue;
    std::shared_ptr<DocumentBroker> _docBroker;
    std::shared_ptr<BasicTileQueue> _queue;
#endif
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
