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
#include <Rectangle.hpp>
#include <deque>
#include <map>
#include <list>
#include <utility>
#include <unordered_set>

class DocumentBroker;


/// Represents a session to a LOOL client, in the WSD process.
class ClientSession final : public Session, public std::enable_shared_from_this<ClientSession>
{
public:
    ClientSession(const std::string& id,
                  const std::shared_ptr<DocumentBroker>& docBroker,
                  const Poco::URI& uriPublic,
                  const bool isReadOnly = false);

    void construct();

    virtual ~ClientSession();

    void handleIncomingMessage(SocketDisposition &) override;

    void setReadOnly() override;

    /// Returns true if this session is added to a DocBroker.
    bool isAttached() const { return _isAttached; }
    void setAttached() { _isAttached = true; }

    /// Returns true if this session has loaded a view (i.e. we got status message).
    bool isViewLoaded() const { return _isViewLoaded; }
    void setViewLoaded() { _isViewLoaded = true; }

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
    Authorization getAuthorization() const;

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

    int getTileWidthInTwips() const { return _tileWidthTwips; }
    int getTileHeightInTwips() const { return _tileHeightTwips; }

    /// This method updates internal data related to sent tiles (wireID and tiles-on-fly)
    /// Call this method anytime when a new tile is sent to the client
    void traceTileBySend(const TileDesc& tile, bool deduplicated = false);

    /// Trask tiles what we a subscription to
    void traceSubscribeToTile(const std::string& tileCacheName);
    void traceUnSubscribeToTile(const std::string& tileCacheName);
    void removeOutdatedTileSubscriptions();
    void clearTileSubscription();

    size_t getTilesBeingRenderedCount() const {return _tilesBeingRendered.size();}

    /// Clear wireId map anytime when client visible area changes (visible area, zoom, part number)
    void resetWireIdMap();

    bool isTextDocument() const { return _isTextDocument; }
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

    /// Handle invalidation message comming from a kit and transfer it to a tile request.
    void handleTileInvalidation(const std::string& message,
                                const std::shared_ptr<DocumentBroker>& docBroker);

    /// Generate a unique id for a tile
    std::string generateTileID(const TileDesc& tile) const;

private:
    std::weak_ptr<DocumentBroker> _docBroker;

    /// URI with which client made request to us
    const Poco::URI _uriPublic;

    /// The cookies we should pass on to the storage on saving.
    std::string _cookies;

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

    /// Count of key-strokes
    uint64_t _keyEvents;

    SenderQueue<std::shared_ptr<Message>> _senderQueue;

    /// Visible area of the client
    Util::Rectangle _clientVisibleArea;

    /// Selected part of the document viewed by the client (no parts in Writer)
    int _clientSelectedPart;

    /// Zoom properties of the client
    int _tileWidthPixel;
    int _tileHeightPixel;
    int _tileWidthTwips;
    int _tileHeightTwips;

    /// Client is using a text document?
    bool _isTextDocument;

    /// TileID's of the sent tiles. Push by sending and pop by tileprocessed message from the client.
    std::list<std::pair<std::string, std::chrono::steady_clock::time_point>> _tilesOnFly;

    /// Names of tiles requested from kit, which this session is subsrcibed to
    /// Track only non-thumbnail tiles (getId() == -1)
    std::unordered_set<std::string> _tilesBeingRendered;

    /// Requested tiles are stored in this list, before we can send them to the client
    std::deque<TileDesc> _requestedTiles;

    /// Store wireID's of the sent tiles inside the actual visible area
    std::map<std::string, TileWireId> _oldWireIds;
};


#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
