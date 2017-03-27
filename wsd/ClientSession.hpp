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

    SocketHandlerInterface::SocketOwnership handleIncomingMessage() override;

    void setReadOnly();
    bool isReadOnly() const { return _isReadOnly; }

    /// Returns true if a document is loaded (i.e. we got status message).
    bool isLoaded() const { return _isLoaded; }
    void setLoaded() { _isLoaded = true; }

    const std::string getUserId() const { return _userId; }
    void setUserId(const std::string& userId) { _userId = userId; }
    void setUserName(const std::string& userName) { _userName = userName; }
    void setDocumentOwner(const bool documentOwner) { _isDocumentOwner = documentOwner; }
    bool isDocumentOwner() const { return _isDocumentOwner; }

    /// Handle kit-to-client message.
    bool handleKitToClientMessage(const char* data, const int size);

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
        assert (!docBroker || docBroker->isCorrectThread());

        LOG_TRC(getName() << " enqueueing client message " << data->id());
        _senderQueue.enqueue(data);
    }

    bool stopping() const { return _stop || _senderQueue.stopping(); }
    void stop()
    {
        _stop = true;
        _senderQueue.stop();
    }

    /// Set the save-as socket which is used to send convert-to results.
    void setSaveAsSocket(const std::shared_ptr<StreamSocket>& socket)
    {
        _saveAsSocket = socket;
    }

    std::shared_ptr<DocumentBroker> getDocumentBroker() const { return _docBroker.lock(); }

    /// Exact URI (including query params - access tokens etc.) with which
    /// client made the request to us
    const Poco::URI& getPublicUri() const { return _uriPublic; }

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

    /// Whether the session is opened as readonly
    bool _isReadOnly;

    /// Whether this session is the owner of currently opened document
    bool _isDocumentOwner;

    /// The socket to which the converted (saveas) doc is sent.
    std::shared_ptr<StreamSocket> _saveAsSocket;

    bool _isLoaded;

    /// Wopi FileInfo object
    std::unique_ptr<WopiStorage::WOPIFileInfo> _wopiFileInfo;

    SenderQueue<std::shared_ptr<Message>> _senderQueue;
    std::atomic<bool> _stop;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
