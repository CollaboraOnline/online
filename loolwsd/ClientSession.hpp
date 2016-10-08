/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_CLIENTSSESSION_HPP
#define INCLUDED_CLIENTSSESSION_HPP

#include "LOOLSession.hpp"
#include "MessageQueue.hpp"

class DocumentBroker;
class PrisonerSession;

/// Represents a session to a LOOL client, in the WSD process.
class ClientSession final : public LOOLSession, public std::enable_shared_from_this<ClientSession>
{
public:
    ClientSession(const std::string& id,
                  std::shared_ptr<Poco::Net::WebSocket> ws,
                  std::shared_ptr<DocumentBroker> docBroker,
                  bool isReadOnly = false);

    virtual ~ClientSession();

    bool isReadOnly() const { return _isReadOnly; }

    void setPeer(const std::shared_ptr<PrisonerSession>& peer) { _peer = peer; }
    bool shutdownPeer(Poco::UInt16 statusCode, const std::string& message);

    void setUserName(const std::string& userName) { _userName = userName; }

    /**
     * Return the URL of the saved-as document when it's ready. If called
     * before it's ready, the call blocks till then.
     */
    std::string getSaveAsUrl()
    {
        const auto payload = _saveAsQueue.get();
        return std::string(payload.data(), payload.size());
    }

    void setSaveAsUrl(const std::string& url)
    {
        _saveAsQueue.put(url);
    }

    bool isLoadFailed() const { return _loadFailed; }
    void setLoadFailed(const std::string& reason)
    {
        Log::warn("Document load failed: " + reason);
        _loadFailed = true;
    }

    std::shared_ptr<DocumentBroker> getDocumentBroker() const { return _docBroker; }

private:

    virtual bool _handleInput(const char *buffer, int length) override;

    bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens);

    bool getStatus(const char *buffer, int length);
    bool getCommandValues(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool getPartPageRectangles(const char *buffer, int length);

    bool sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool sendCombinedTiles(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool sendFontRendering(const char *buffer, int length, Poco::StringTokenizer& tokens);

    bool forwardToChild(const char *buffer, int length);

private:

    std::shared_ptr<DocumentBroker> _docBroker;

    // Whether the session is opened as readonly
    bool _isReadOnly;

    /// Our peer that connects us to the child.
    std::weak_ptr<PrisonerSession> _peer;

    /// Store URLs of completed 'save as' documents.
    MessageQueue _saveAsQueue;

    /// Marks if document loading failed.
    bool _loadFailed;
    int _loadPart;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
