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

#include <config.h>

#include "CollabBroker.hpp"
#include "CollabSocketHandler.hpp"

#include <COOLWSD.hpp>
#include <Log.hpp>
#include <SigUtil.hpp>
#include <Util.hpp>

#include <algorithm>
#include <atomic>

/// Global CollabBrokers map - keyed by docKey
std::map<std::string, std::shared_ptr<CollabBroker>> CollabBrokers;
std::mutex CollabBrokersMutex;

namespace
{
std::atomic<uint64_t> HandlerIdCounter{0};
}

CollabBroker::CollabBroker(const std::string& docKey, const std::string& wopiSrc)
    : _docKey(docKey)
    , _wopiSrc(wopiSrc)
{
    LOG_INF("CollabBroker created for docKey [" << _docKey << ']');
}

CollabBroker::~CollabBroker()
{
    LOG_INF("CollabBroker destroyed for docKey [" << _docKey << ']');
}

std::string CollabBroker::generateHandlerId()
{
    return "collab_" + std::to_string(++HandlerIdCounter);
}

void CollabBroker::addHandler(const std::shared_ptr<CollabSocketHandler>& handler)
{
    std::lock_guard<std::mutex> lock(_mutex);

    const std::string handlerId = generateHandlerId();
    handler->setHandlerId(handlerId);
    _handlers.push_back(handler);

    LOG_INF("CollabBroker [" << _docKey << "]: added handler [" << handlerId
            << "], total handlers: " << _handlers.size());
}

void CollabBroker::removeHandler(const std::shared_ptr<CollabSocketHandler>& handler)
{
    std::lock_guard<std::mutex> lock(_mutex);

    const std::string handlerId = handler->getHandlerId();

    // Use erase-remove idiom to find and remove the specific handler
    auto it = std::find_if(_handlers.begin(), _handlers.end(),
                           [&handler](const std::weak_ptr<CollabSocketHandler>& h) {
                               auto locked = h.lock();
                               return locked && locked.get() == handler.get();
                           });

    if (it != _handlers.end())
    {
        LOG_INF("CollabBroker [" << _docKey << "]: removed handler [" << handlerId << ']');
        _handlers.erase(it);
    }

    cleanupExpiredHandlers();
    LOG_DBG("CollabBroker [" << _docKey << "]: remaining handlers: " << _handlers.size());
}

size_t CollabBroker::getHandlerCount() const
{
    std::lock_guard<std::mutex> lock(_mutex);

    size_t count = 0;
    for (const auto& handler : _handlers)
    {
        if (!handler.expired())
            ++count;
    }
    return count;
}

bool CollabBroker::isEmpty() const
{
    return getHandlerCount() == 0;
}

void CollabBroker::setWopiInfo(Poco::JSON::Object::Ptr wopiInfo)
{
    std::lock_guard<std::mutex> lock(_mutex);
    if (!_wopiInfo)
    {
        _wopiInfo = wopiInfo;
        LOG_DBG("CollabBroker [" << _docKey << "]: WOPI info set");
    }
}

Poco::JSON::Object::Ptr CollabBroker::getWopiInfo() const
{
    std::lock_guard<std::mutex> lock(_mutex);
    return _wopiInfo;
}

void CollabBroker::broadcastMessage(const std::string& message)
{
    std::lock_guard<std::mutex> lock(_mutex);

    LOG_DBG("CollabBroker [" << _docKey << "]: broadcasting message to "
            << _handlers.size() << " handlers");

    for (auto& weakHandler : _handlers)
    {
        if (auto handler = weakHandler.lock())
        {
            handler->sendMessage(message);
        }
    }
}

void CollabBroker::cleanupExpiredHandlers()
{
    // Called with _mutex held - use erase-remove idiom
    _handlers.erase(
        std::remove_if(_handlers.begin(), _handlers.end(),
                       [](const std::weak_ptr<CollabSocketHandler>& h) {
                           return h.expired();
                       }),
        _handlers.end());
}

std::shared_ptr<CollabBroker> findOrCreateCollabBroker(const std::string& docKey,
                                                        const std::string& wopiSrc)
{
    LOG_INF("Find or create CollabBroker for docKey [" << docKey << ']');

    std::unique_lock<std::mutex> lock(CollabBrokersMutex);

    // Check if shutting down
    if (SigUtil::getShutdownRequestFlag())
    {
        LOG_WRN("Shutdown requested, not creating new CollabBroker for docKey [" << docKey << ']');
        return nullptr;
    }

    // Look up existing broker
    auto it = CollabBrokers.find(docKey);
    if (it != CollabBrokers.end() && it->second)
    {
        LOG_DBG("Found existing CollabBroker for docKey [" << docKey << ']');
        return it->second;
    }

    // Create new broker
    LOG_DBG("Creating new CollabBroker for docKey [" << docKey << ']');
    auto broker = std::make_shared<CollabBroker>(docKey, wopiSrc);
    CollabBrokers.emplace(docKey, broker);

    LOG_TRC("Have " << CollabBrokers.size() << " CollabBrokers after inserting [" << docKey << ']');

    return broker;
}

void cleanupCollabBrokers()
{
    std::lock_guard<std::mutex> lock(CollabBrokersMutex);

    for (auto it = CollabBrokers.begin(); it != CollabBrokers.end(); )
    {
        if (it->second && it->second->isEmpty())
        {
            LOG_INF("Removing empty CollabBroker for docKey [" << it->first << ']');
            it = CollabBrokers.erase(it);
        }
        else
        {
            ++it;
        }
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
