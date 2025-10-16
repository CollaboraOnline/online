/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "SlideCache.hpp"

void SlideLayerCacheMap::insert(const std::string& key, const std::shared_ptr<Message> cachedData)
{
    insertion_order.push(key);
    cache_map[key].push_back(cachedData);
}

std::size_t SlideLayerCacheMap::reduceSizeTo(std::size_t desiredSize)
{
    if (cache_map.size() <= desiredSize)
        return 0;

    std::size_t total_deleted_entries = 0;
    while (cache_map.size() > desiredSize)
    {
        cache_map.erase(insertion_order.front());
        insertion_order.pop();
        total_deleted_entries++;
    }

    return total_deleted_entries;
}

void SlideLayerCacheMap::erase_all()
{
    cache_map.clear();
    std::queue<std::string> empty;
    std::swap(insertion_order, empty);
}

std::unordered_map<std::string, std::vector<std::shared_ptr<Message>>>::const_iterator
SlideLayerCacheMap::find(const std::string& key) const
{
    return cache_map.find(key);
}

std::unordered_map<std::string, std::vector<std::shared_ptr<Message>>>::const_iterator
SlideLayerCacheMap::end()
{
    return cache_map.end();
}
