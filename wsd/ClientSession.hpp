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

#include "Session.hpp"
#include "Storage.hpp"
#include "MessageQueue.hpp"
#include "SenderQueue.hpp"
#include "DocumentBroker.hpp"
#include <Poco/URI.h>

class DocumentBroker;

/// Represents a session to a LOOL client, in the WSD process.
class ClientSession final : public Session, public std::enable_shared_from_this<ClientSession>
{
public:
    ClientSession(const std::string& id,
                  const std::shared_ptr<DocumentBroker>& docBroker,
                  const Poco::URI& uriPublic,
                  const bool isReadOnly = false);

    virtual ~ClientSession();

    void handleIncomingMessage(SocketDisposition &) override;

    void setReadOnly() override;

    /// Returns true if this session is added to a DocBroker.
    bool isAttached() const { return _isAttached; }
    void setAttached() { _isAttached = true; }

    /// Returns true if this session has loaded a view (i.e. we got status message).
    bool isViewLoaded() const { return _isViewLoaded; }
    void setViewLoaded() { _isViewLoaded = true; }

    const std::string getUserId() const { return _userId; }
    void setUserId(const std::string& userId) { _userId = userId; }
    void setUserName(const std::string& userName) { _userName = userName; }
    void setUserExtraInfo(const std::string& userExtraInfo) { _userExtraInfo = userExtraInfo; }
    void setDocumentOwner(const bool documentOwner) { _isDocumentOwner = documentOwner; }
    bool isDocumentOwner() const { return _isDocumentOwner; }

    /// Handle kit-to-client message.
    bool handleKitToClientMessage(const char* data, const int size);

    // sendTextFrame that takes std::string and string literal.
    using Session::sendTextFrame;

    bool sendBinaryFrame(const char* buffer, int length) override
    {
        auto payload = std::make_shared<Message>(buffer, length, Message::Dir::Out);
        enqueueSendMessage(payload);
        return true;
    }

    bool sendTextFrame(const char* buffer, const int length) override
    {
        auto payload = std::make_shared<Message>(buffer, length, Message::Dir::Out);
        enqueueSendMessage(payload);
        return true;
    }

    void enqueueSendMessage(const std::shared_ptr<Message>& data)
    {
        const auto docBroker = _docBroker.lock();
        // If in the correct thread - no need for wakeups.
        if (docBroker)
            docBroker->assertCorrectThread();

        LOG_TRC(getName() << " enqueueing client message " << data->id());
        _senderQueue.enqueue(data);
    }

    /// Set the save-as socket which is used to send convert-to results.
    void setSaveAsSocket(const std::shared_ptr<StreamSocket>& socket)
    {
        _saveAsSocket = socket;
    }

    std::shared_ptr<DocumentBroker> getDocumentBroker() const { return _docBroker.lock(); }

    /// Exact URI (including query params - access tokens etc.) with which
    /// client made the request to us
    ///
    /// Note: This URI is unsafe - when connecting to existing sessions, we must
    /// ignore everything but the access_token, and use the access_token with
    /// the URI of the initial request.
    const Poco::URI& getPublicUri() const { return _uriPublic; }

    /// The access token of this session.
    std::string getAccessToken() const;

    /// Set WOPI fileinfo object
    void setWopiFileInfo(std::unique_ptr<WopiStorage::WOPIFileInfo>& wopiFileInfo) { _wopiFileInfo = std::move(wopiFileInfo); }

private:

    /// SocketHandler: disconnection event.
    void onDisconnect() override;
    /// Does SocketHandler: have data or timeouts to setup.
    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int & /* timeoutMaxMs */) override;
    /// SocketHandler: write to socket.
    void performWrites() override;

    virtual bool _handleInput(const char* buffer, int length) override;

    bool loadDocument(const char* buffer, int length, const std::vector<std::string>& tokens,
                      const std::shared_ptr<DocumentBroker>& docBroker);
    bool getStatus(const char* buffer, int length,
                   const std::shared_ptr<DocumentBroker>& docBroker);
    bool getCommandValues(const char* buffer, int length, const std::vector<std::string>& tokens,
                          const std::shared_ptr<DocumentBroker>& docBroker);
    bool sendTile(const char* buffer, int length, const std::vector<std::string>& tokens,
                  const std::shared_ptr<DocumentBroker>& docBroker);
    bool sendCombinedTiles(const char* buffer, int length, const std::vector<std::string>& tokens,
                           const std::shared_ptr<DocumentBroker>& docBroker);

    bool sendFontRendering(const char* buffer, int length, const std::vector<std::string>& tokens,
                           const std::shared_ptr<DocumentBroker>& docBroker);

    bool forwardToChild(const std::string& message,
                        const std::shared_ptr<DocumentBroker>& docBroker);

    bool forwardToClient(const std::shared_ptr<Message>& payload);

    /// Returns true if given message from the client should be allowed or not
    /// Eg. in readonly mode only few messages should be allowed
    bool filterMessage(const std::string& msg) const;

    void dumpState(std::ostream& os) override;

private:
    std::weak_ptr<DocumentBroker> _docBroker;

    /// URI with which client made request to us
    const Poco::URI _uriPublic;

    /// Whether this session is the owner of currently opened document
    bool _isDocumentOwner;

    /// The socket to which the converted (saveas) doc is sent.
    std::shared_ptr<StreamSocket> _saveAsSocket;

    /// If we are added to a DocBroker.
    bool _isAttached;

    /// If we have loaded a view.
    bool _isViewLoaded;

    /// Wopi FileInfo object
    std::unique_ptr<WopiStorage::WOPIFileInfo> _wopiFileInfo;

    SenderQueue<std::shared_ptr<Message>> _senderQueue;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
