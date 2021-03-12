/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Clipboard abstraction.

#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include <mutex>

#include <stdlib.h>
#include <Log.hpp>
#include <Exceptions.hpp>
#include <Poco/MemoryStream.h>

struct ClipboardData
{
    std::vector<std::string> _mimeTypes;
    std::vector<std::string> _content;
    ClipboardData()
    {
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
                inStream.read(&content[0], len);
                if (inStream.fail())
                    throw ParseError("error during reading the stream");
                std::getline(inStream, newline, '\n');
                if (mime.length() > 0)
                {
                    _mimeTypes.push_back(mime);
                    _content.push_back(content);
                }
            }
        }
    }

    size_t size()
    {
        assert(_mimeTypes.size() == _content.size());
        return _mimeTypes.size();
    }

    void dumpState(std::ostream& os)
    {
        os << "Clipboard with " << size() << " entries\n";
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
        value = "";
        return false;
    }
};

/// Used to store expired view's clipboards
class ClipboardCache
{
    std::mutex _mutex;
    struct Entry {
        std::chrono::steady_clock::time_point _inserted;
        std::shared_ptr<std::string> _rawData; // big.
    };
    // clipboard key -> data
    std::unordered_map<std::string, Entry> _cache;
public:
    ClipboardCache()
    {
    }

    void insertClipboard(const std::string key[2],
                         const char *data, size_t size)
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
        _cache[key[0]] = ent;
        _cache[key[1]] = ent;
    }

    std::shared_ptr<std::string> getClipboard(const std::string &key)
    {
        std::lock_guard<std::mutex> lock(_mutex);
        std::shared_ptr<std::string> data;
        auto it = _cache.find(key);
        if (it != _cache.end())
            data = it->second._rawData;
        return data;
    }

    void checkexpiry()
    {
        std::lock_guard<std::mutex> lock(_mutex);
        auto now = std::chrono::steady_clock::now();
        LOG_TRC("check expiry of cached clipboards");
        for (auto it = _cache.begin(); it != _cache.end();)
        {
            if (std::chrono::duration_cast<std::chrono::minutes>(now - it->second._inserted).count() >= 10)
            {
                LOG_TRC("expiring expiry of cached clipboard: " + it->first);
                it = _cache.erase(it);
            }
            else
                ++it;
        }
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
