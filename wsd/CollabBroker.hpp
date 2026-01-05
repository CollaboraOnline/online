/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <Poco/JSON/Object.h>

#include <memory>
#include <mutex>
#include <string>
#include <vector>

class CollabSocketHandler;

/// Manages all CollabSocketHandler instances for a single document (docKey).
/// Similar to DocumentBroker, this class groups all collaboration WebSocket
/// connections that share the same WOPI source URL.
class CollabBroker : public std::enable_shared_from_this<CollabBroker>
{
    const std::string _docKey;
    const std::string _wopiSrc;

    /// Mutex protecting _handlers
    mutable std::mutex _mutex;

    /// Connected handlers
    std::vector<std::weak_ptr<CollabSocketHandler>> _handlers;

    /// Counter for generating handler IDs
    uint64_t _handlerIdCounter = 0;

    /// WOPI info from the first authenticated handler (shared by all)
    Poco::JSON::Object::Ptr _wopiInfo;

public:
    CollabBroker(const std::string& docKey, const std::string& wopiSrc);
    ~CollabBroker();

    const std::string& getDocKey() const { return _docKey; }
    const std::string& getWopiSrc() const { return _wopiSrc; }

    /// Add a handler to this broker. Called when handler authenticates.
    void addHandler(const std::shared_ptr<CollabSocketHandler>& handler);

    /// Remove a handler from this broker. Called when handler disconnects.
    void removeHandler(const std::shared_ptr<CollabSocketHandler>& handler);

    /// Returns the number of active handlers
    size_t getHandlerCount() const;

    /// Returns true if there are no active handlers
    bool isEmpty() const;

    /// Set WOPI info (from first authenticated handler)
    void setWopiInfo(Poco::JSON::Object::Ptr wopiInfo);

    /// Get WOPI info
    Poco::JSON::Object::Ptr getWopiInfo() const;

    /// Broadcast a message to all handlers
    void broadcastMessage(const std::string& message);

    /// Get JSON array of current users (excluding the specified handler)
    /// Returns JSON like: {"users": [{"id": "...", "name": "...", "canWrite": true}, ...]}
    std::string getUserListJson(const std::shared_ptr<CollabSocketHandler>& exclude) const;

    /// Notify all handlers that a user joined
    /// Sends: {"type": "user_joined", "user": {"id": "...", "name": "...", "canWrite": true}}
    void notifyUserJoined(const std::shared_ptr<CollabSocketHandler>& handler);

    /// Notify all handlers that a user left
    /// Sends: {"type": "user_left", "user": {"id": "...", "name": "..."}}
    void notifyUserLeft(const std::shared_ptr<CollabSocketHandler>& handler);

private:
    /// Generate a unique ID for a handler
    static std::string generateHandlerId();

    /// Clean up expired weak pointers
    void cleanupExpiredHandlers();
};

/// Global CollabBrokers map and mutex - follows same pattern as DocBrokers
extern std::map<std::string, std::shared_ptr<CollabBroker>> CollabBrokers;
extern std::mutex CollabBrokersMutex;

/// Find or create a CollabBroker for the given docKey.
/// Returns nullptr if shutting down.
std::shared_ptr<CollabBroker> findOrCreateCollabBroker(const std::string& docKey,
                                                        const std::string& wopiSrc);

/// Remove empty CollabBrokers (called during cleanup)
void cleanupCollabBrokers();

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
