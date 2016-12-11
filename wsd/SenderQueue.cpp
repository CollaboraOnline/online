/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "SenderQueue.hpp"

#include <algorithm>

#include <Protocol.hpp>
#include <Log.hpp>

SenderQueue SenderQueue::TheQueue;
SenderThreadPool SenderThreadPool::ThePool;

bool SenderThreadPool::dispatchItem(const size_t timeoutMs)
{
    SendItem item;
    if (SenderQueue::instance().waitDequeue(item, timeoutMs))
    {
        auto session = item.Session.lock();
        if (session)
        {
            try
            {
                const std::vector<char>& data = item.Data->data();
                if (item.Data->isBinary())
                {
                    return session->sendBinaryFrame(data.data(), data.size());
                }
                else
                {
                    return session->sendTextFrame(data.data(), data.size());
                }
            }
            catch (const std::exception& ex)
            {
                LOG_ERR("Failed to send tile to " << session->getName() << ": " << ex.what());
            }
        }
    }

    return false;
}

std::shared_ptr<SenderThreadPool::ThreadData> SenderThreadPool::createThread()
{
    if (!stopping())
    {
        std::shared_ptr<ThreadData> data(std::make_shared<ThreadData>());
        std::thread thread([this, data]{ threadFunction(data); });
        data->swap(thread);
        return data;
    }

    return nullptr;
}

bool SenderThreadPool::rebalance()
{
    std::unique_lock<std::mutex> lock(_mutex, std::defer_lock);
    if (!lock.try_lock())
    {
        // A sibling is likely rebalancing.
        return false;
    }

    const auto threadCount = _threads.size();
    LOG_DBG("SenderThreadPool: rebalancing " << threadCount << " threads.");

    // First cleanup the non-joinables.
    for (int i = _threads.size() - 1; i >= 0; --i)
    {
        if (!_threads[i]->joinable())
        {
            _threads.erase(_threads.begin() + i);
        }
    }

    LOG_DBG("SenderThreadPool: removed " << threadCount - _threads.size() << " dead threads.");

    while (_threads.size() < _optimalThreadCount && !stopping())
    {
        auto newThreadData = createThread();
        if (newThreadData)
        {
            _threads.push_back(newThreadData);
        }
    }

    // Need to reduce?
    return _threads.size() > _optimalThreadCount;
}

void SenderThreadPool::threadFunction(const std::shared_ptr<ThreadData>& data)
{
    LOG_DBG("SenderThread started");
    while (!stopping())
    {
        if (!dispatchItem(HousekeepIdleIntervalMs) && !stopping())
        {
            // We timed out. Seems we have more threads than work.
            if (rebalance())
            {
                // We've been considered expendable.
                LOG_DBG("SenderThread marked to die");
                break;
            }
        }
    }

    data->detach();
    LOG_DBG("SenderThread finished");
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
