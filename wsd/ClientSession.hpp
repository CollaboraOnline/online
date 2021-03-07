/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include "Session.hpp"
#include "Storage.hpp"
#include "MessageQueue.hpp"
#include "SenderQueue.hpp"
#include "ServerURL.hpp"
#include "DocumentBroker.hpp"
#include <Poco/URI.h>
#include <Rectangle.hpp>
#include <deque>
#include <map>
#include <list>
#include <utility>
#include "Util.hpp"

class DocumentBroker;

/// Represents a session to a LOOL client, in the WSD process.
class ClientSession final : public Session
{
public:
    ClientSession(const std::shared_ptr<ProtocolHandlerInterface>& ws,
                  const std::string& id,
                  const std::shared_ptr<DocumentBroker>& docBroker,
                  const Poco::URI& uriPublic,
                  const bool isReadOnly,
                  const RequestDetails &requestDetails);
    void construct();
    virtual ~ClientSession();

    void setReadOnly(bool bValue = true) override;

    void setLockFailed(const std::string& sReason);

    enum SessionState {
        DETACHED,        // initial
        LOADING,         // attached to a DocBroker & waiting for load
        LIVE,            // Document is loaded & editable or viewable.
        WAIT_DISCONNECT  // closed and waiting for Kit's disconnected message
    };

    /// Returns true if this session has loaded a view (i.e. we got status message).
    bool isViewLoaded() const { return _state == SessionState::LIVE; }

    /// returns true if we're waiting for the kit to acknowledge disconnect.
    bool inWaitDisconnected() const { return _state == SessionState::WAIT_DISCONNECT; }

    /// transition to a new state
    void setState(SessionState newState);

    void setDocumentOwner(const bool documentOwner) { _isDocumentOwner = documentOwner; }
    bool isDocumentOwner() const { return _isDocumentOwner; }

    /// Handle kit-to-client message.
    bool handleKitToClientMessage(const char* data, const int size);

    /// Integer id of the view in the kit process, or -1 if unknown
    int getKitViewId() const { return _kitViewId; }

    /// Disconnect the session and do final cleanup, @returns true if we should not wait.
    bool disconnectFromKit();

    // sendTextFrame that takes std::string and string literal.
    using Session::sendTextFrame;

    bool sendBinaryFrame(const char* buffer, int length) override
    {
        auto payload = std::make_shared<Message>(buffer, length, Message::Dir::Out);
        enqueueSendMessage(payload);
        return true;
    }

    bool sendTile(const std::string &header, const TileCache::Tile &tile)
    {
        // FIXME: performance - optimize away this copy ...
        std::vector<char> output;

        output.resize(header.size() + tile->size());
        std::memcpy(output.data(), header.data(), header.size());
        std::memcpy(output.data() + header.size(), tile->data(), tile->size());

        return sendBinaryFrame(output.data(), output.size());
    }

    bool sendTextFrame(const char* buffer, const int length) override
    {
        auto payload = std::make_shared<Message>(buffer, length, Message::Dir::Out);
        enqueueSendMessage(payload);
        return true;
    }


    void enqueueSendMessage(const std::shared_ptr<Message>& data);

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
    Authorization getAuthorization() const { return _auth; }

    const std::string& getCookies() const { return _cookies; }

    /// Set WOPI fileinfo object
    void setWopiFileInfo(std::unique_ptr<WopiStorage::WOPIFileInfo>& wopiFileInfo) { _wopiFileInfo = std::move(wopiFileInfo); }

    /// Get requested tiles waiting for sending to the client
    std::deque<TileDesc>& getRequestedTiles() { return _requestedTiles; }

    /// Mark a new tile as sent
    void addTileOnFly(const TileDesc& tile);
    void clearTilesOnFly();
    size_t getTilesOnFlyCount() const { return _tilesOnFly.size(); }
    void removeOutdatedTilesOnFly();
    size_t countIdenticalTilesOnFly(const TileDesc& tile) const;

    Util::Rectangle getVisibleArea() const { return _clientVisibleArea; }
    /// Visible area can have negative value as position, but we have tiles only in the positive range
    Util::Rectangle getNormalizedVisibleArea() const;

    /// The client's visible area can be divided into a maximum of 4 panes.
    enum SplitPaneName {
        TOPLEFT_PANE,
        TOPRIGHT_PANE,
        BOTTOMLEFT_PANE,
        BOTTOMRIGHT_PANE
    };

    /// Returns true if the given split-pane is currently valid.
    bool isSplitPane(const SplitPaneName) const;

    /// Returns the normalized visible area of a given split-pane.
    Util::Rectangle getNormalizedVisiblePaneArea(const SplitPaneName) const;

    int getTileWidthInTwips() const { return _tileWidthTwips; }
    int getTileHeightInTwips() const { return _tileHeightTwips; }

    /// This method updates internal data related to sent tiles (wireID and tiles-on-fly)
    /// Call this method anytime when a new tile is sent to the client
    void traceTileBySend(const TileDesc& tile, bool deduplicated = false);

    /// Clear wireId map anytime when client visible area changes (visible area, zoom, part number)
    void resetWireIdMap();

    bool isTextDocument() const { return _isTextDocument; }

    /// Do we recognize this clipboard ?
    bool matchesClipboardKeys(const std::string &viewId, const std::string &tag);

    /// Handle a clipboard fetch / put request.
    void handleClipboardRequest(DocumentBroker::ClipboardRequest     type,
                                const std::shared_ptr<StreamSocket> &socket,
                                const std::string                   &tag,
                                const std::shared_ptr<std::string>  &data);

    /// Create URI for transient clipboard content.
    std::string getClipboardURI(bool encode = true);

    /// Adds and/or modified the copied payload before sending on to the client.
    void postProcessCopyPayload(const std::shared_ptr<Message>& payload);

    /// Returns true if we're expired waiting for a clipboard and should be removed
    bool staleWaitDisconnect(const std::chrono::steady_clock::time_point &now);

    /// Generate and rotate a new clipboard hash, sending it if appropriate
    void rotateClipboardKey(bool notifyClient);

    /// Generate an access token for this session via proxy protocol.
    const std::string &getOrCreateProxyAccess();

private:
    std::shared_ptr<ClientSession> client_from_this()
    {
        return std::static_pointer_cast<ClientSession>(shared_from_this());
    }

    /// SocketHandler: disconnection event.
    void onDisconnect() override;

    /// Does SocketHandler: have messages to send ?
    bool hasQueuedMessages() const override;

    /// SocketHandler: send those messages
    void writeQueuedMessages(std::size_t capacity) override;

    virtual bool _handleInput(const char* buffer, int length) override;

    bool loadDocument(const char* buffer, int length, const StringVector& tokens,
                      const std::shared_ptr<DocumentBroker>& docBroker);
    bool getStatus(const char* buffer, int length,
                   const std::shared_ptr<DocumentBroker>& docBroker);
    bool getCommandValues(const char* buffer, int length, const StringVector& tokens,
                          const std::shared_ptr<DocumentBroker>& docBroker);
    bool sendTile(const char* buffer, int length, const StringVector& tokens,
                  const std::shared_ptr<DocumentBroker>& docBroker);
    bool sendCombinedTiles(const char* buffer, int length, const StringVector& tokens,
                           const std::shared_ptr<DocumentBroker>& docBroker);

    bool sendFontRendering(const char* buffer, int length, const StringVector& tokens,
                           const std::shared_ptr<DocumentBroker>& docBroker);

    bool forwardToChild(const std::string& message,
                        const std::shared_ptr<DocumentBroker>& docBroker);

    bool forwardToClient(const std::shared_ptr<Message>& payload);

    /// Returns true if given message from the client should be allowed or not
    /// Eg. in readonly mode only few messages should be allowed
    bool filterMessage(const std::string& msg) const;

    void dumpState(std::ostream& os) override;

    /// Handle invalidation message comming from a kit and transfer it to a tile request.
    void handleTileInvalidation(const std::string& message,
                                const std::shared_ptr<DocumentBroker>& docBroker);

    bool isTileInsideVisibleArea(const TileDesc& tile) const;

    /// If this session is read-only because of failed lock, try to unlock and make it read-write.
    bool attemptLock(const std::shared_ptr<DocumentBroker>& docBroker);

private:
    std::weak_ptr<DocumentBroker> _docBroker;

    /// URI with which client made request to us
    const Poco::URI _uriPublic;

    /// Authorization data - either access_token or access_header.
    const Authorization _auth;

    /// The cookies we should pass on to the storage on saving.
    std::string _cookies;

    /// Whether this session is the owner of currently opened document
    bool _isDocumentOwner;

    /// If it is allowed to try to switch from read-only to edit mode,
    /// because it's read-only just because of transient lock failure.
    bool _isLockFailed = false;

    /// The socket to which the converted (saveas) doc is sent.
    std::shared_ptr<StreamSocket> _saveAsSocket;

    /// The phase of our lifecycle that we're in.
    SessionState _state;

    /// Time of last state transition
    std::chrono::steady_clock::time_point _lastStateTime;

    /// Wopi FileInfo object
    std::unique_ptr<WopiStorage::WOPIFileInfo> _wopiFileInfo;

    /// Count of key-strokes
    uint64_t _keyEvents;

    SenderQueue<std::shared_ptr<Message>> _senderQueue;

    /// Visible area of the client
    Util::Rectangle _clientVisibleArea;

    /// Split position that defines the current split panes
    int _splitX;
    int _splitY;

    /// Selected part of the document viewed by the client (no parts in Writer)
    int _clientSelectedPart;

    /// Zoom properties of the client
    int _tileWidthPixel;
    int _tileHeightPixel;
    int _tileWidthTwips;
    int _tileHeightTwips;

    /// The integer id of the view in the Kit process
    int _kitViewId;

    /// How to find our service from the client.
    const ServerURL _serverURL;

    /// Client is using a text document?
    bool _isTextDocument;

    /// Rotating clipboard remote access identifiers - protected by GlobalSessionMapMutex
    std::string _clipboardKeys[2];

    /// TileID's of the sent tiles. Push by sending and pop by tileprocessed message from the client.
    std::vector<std::pair<std::string, std::chrono::steady_clock::time_point>> _tilesOnFly;

    /// Requested tiles are stored in this list, before we can send them to the client
    std::deque<TileDesc> _requestedTiles;

    /// Store wireID's of the sent tiles inside the actual visible area
    std::map<std::string, TileWireId> _oldWireIds;

    /// Sockets to send binary selection content to
    std::vector<std::weak_ptr<StreamSocket>> _clipSockets;

    /// Time when loading of view started
    std::chrono::steady_clock::time_point _viewLoadStart;

    /// Secure session id token for proxyprotocol authentication
    std::string _proxyAccess;

    /// Store last sent payload of form field button, so we can filter out redundant messages.
    std::string _lastSentFormFielButtonMessage;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
