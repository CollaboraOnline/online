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

// Clipboard abstraction.

#pragma once

#include <common/Common.hpp>
#include <common/HexUtil.hpp>
#include <common/Log.hpp>
#include <common/Protocol.hpp>
#include <common/Util.hpp>
#include <wsd/Exceptions.hpp>

#include <cstdlib>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

struct ClipboardData
{
    std::vector<std::string> _mimeTypes;
    std::vector<std::string> _content;
    ClipboardData()
    {
    }

    /// Determines if inStream is a list of mimetype-length-bytes tuples, as expected.
    static bool isOwnFormat(std::istream& inStream)
    {
        if (inStream.eof())
        {
            return false;
        }

        std::string mime, hexLen;
        std::getline(inStream, mime, '\n');
        if (mime.empty())
        {
            return false;
        }

        std::getline(inStream, hexLen, '\n');
        if (hexLen.empty())
        {
            return false;
        }

        uint64_t len = strtoll(hexLen.c_str(), nullptr, 16);
        if (len == 0)
        {
            return false;
        }

        return true;
    }

    void read(std::istream& inStream)
    {
        while (!inStream.eof())
        {
            std::string mime, hexLen, newline;
            std::getline(inStream, mime, '\n');
            std::getline(inStream, hexLen, '\n');
            if (mime.length() && hexLen.length() && !inStream.fail())
            {
                uint64_t len = strtoll( hexLen.c_str(), nullptr, 16 );
                std::string content(len, ' ');
                inStream.read(content.data(), len);
                if (inStream.fail())
                    throw ParseError("error during reading the stream");
                std::getline(inStream, newline, '\n');
                if (mime.length() > 0)
                {
                    _mimeTypes.push_back(std::move(mime));
                    _content.push_back(std::move(content));
                }
            }
        }
    }

    std::size_t size() const
    {
        assert(_mimeTypes.size() == _content.size());
        return _mimeTypes.size();
    }

    void dumpState(std::ostream& os)
    {
        os << "Clipboard with " << size() << " entries:\n";
        for (size_t i = 0; i < size(); ++i)
            os << "\t[" << i << "] - size " << _content[i].size() <<
                " type: '" << _mimeTypes[i] << "'\n";
    }

    bool findType(const std::string &mime, std::string &value)
    {
        for (size_t i = 0; i < _mimeTypes.size(); ++i)
        {
            if (_mimeTypes[i] == mime)
            {
                value = _content[i];
                return true;
            }
        }
        value.clear();
        return false;
    }
};

/// Used to store expired view's clipboards
class ClipboardCache
{
    /// Check and expire clipboard-cache entries every 1/10th the lifetime of each.
    static constexpr std::chrono::seconds ExpiryCheckPeriod{ CLIPBOARD_EXPIRY_MINUTES * 60 / 10 };

    std::mutex _mutex;
    struct Entry {
        std::chrono::steady_clock::time_point _inserted;
        std::shared_ptr<std::string> _rawData; // big.

        bool hasExpired(const std::chrono::steady_clock::time_point now) const
        {
            return (now - _inserted) >= std::chrono::minutes(CLIPBOARD_EXPIRY_MINUTES);
        }
    };
    // clipboard key -> data
    std::unordered_map<std::string, Entry> _cache;

    std::chrono::steady_clock::time_point _nextExpiryTime;

public:
    ClipboardCache()
        : _nextExpiryTime(std::chrono::steady_clock::now() + ExpiryCheckPeriod)
    {
    }

    void dumpState(std::ostream& os) const
    {
        os << "Saved clipboards: " << _cache.size() << '\n';
        size_t totalSize = 0;
        auto now = std::chrono::steady_clock::now();
        for (const auto &it : _cache)
        {
            std::shared_ptr<std::string> data = it.second._rawData;
            std::string_view string = *data;

            os << "  size: " << string.size() << " bytes, lifetime: " <<
                std::chrono::duration_cast<std::chrono::seconds>(
                    now - it.second._inserted).count() << " seconds\n";
			HexUtil::dumpHex(os, string.substr(0, 256), "", "  ");
            totalSize += string.size();
        }

        os << "Saved clipboard total size: " << totalSize << " bytes\n";
    }

    void insertClipboard(const std::string key[2],
                         const char *data, std::size_t size)
    {
        if (size == 0)
        {
            LOG_TRC("clipboard cache - ignores empty clipboard data");
            return;
        }
        Entry ent;
        ent._inserted = std::chrono::steady_clock::now();
        ent._rawData = std::make_shared<std::string>(data, size);
        LOG_TRC("Insert cached clipboard: " << key[0] << " and " << key[1]);
        std::lock_guard<std::mutex> lock(_mutex);
        _cache[key[0]] = _cache[key[1]] = std::move(ent);
    }

    std::shared_ptr<std::string> getClipboard(const std::string &key)
    {
        LOG_TRC("Looking up cached clipboard with key [" << key << ']');

        std::lock_guard<std::mutex> lock(_mutex);
        const auto it = _cache.find(key);
        if (it == _cache.end())
        {
            LOG_TRC("Clipboard key [" << key << "] is not present");
            return nullptr;
        }
        else if (it->second.hasExpired(std::chrono::steady_clock::now()))
        {
            LOG_TRC("Clipboard item with key [" << key << "] is expired");
            return nullptr;
        }

        return it->second._rawData;
    }

    void checkexpiry(std::chrono::steady_clock::time_point now)
    {
        if (now < _nextExpiryTime)
        {
            return;
        }

        std::unique_lock<std::mutex> lock(_mutex, std::defer_lock);
        if (!lock.try_lock())
        {
            LOG_DBG("Clipboard cache expiry check was due, but the lock is taken.");
            return;
        }

        LOG_TRC("check expiry of cached clipboards");
        for (auto it = _cache.begin(); it != _cache.end();)
        {
            if (it->second.hasExpired(now))
            {
                LOG_TRC("Expiring cached clipboard entry: " << it->first);
                it = _cache.erase(it);
            }
            else
                ++it;
        }

        _nextExpiryTime = now + ExpiryCheckPeriod;
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
