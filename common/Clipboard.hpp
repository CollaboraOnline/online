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
#include <common/FileUtil.hpp>
#include <common/Log.hpp>
#include <common/Protocol.hpp>
#include <common/Util.hpp>
#include <wsd/Exceptions.hpp>

#include <cstdlib>
#include <fstream>
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
    std::mutex _mutex;
    struct ClipFile {
        std::string _file;
        ssize_t _size;

        ClipFile(std::string file, ssize_t size)
            : _file(std::move(file))
            , _size(size)
        {
        }
        ~ClipFile()
        {
            FileUtil::removeFile(_file);
        }
    };
    struct Entry {
        std::chrono::steady_clock::time_point _inserted;
        std::shared_ptr<std::string> _rawData; // cache small buffers in memory
        std::shared_ptr<ClipFile> _cacheFile;  // cache large buffers to disk

        bool hasExpired(const std::chrono::steady_clock::time_point now) const
        {
            return (now - _inserted) >= std::chrono::minutes(CLIPBOARD_EXPIRY_MINUTES);
        }
    };
    // clipboard key -> data
    std::unordered_map<std::string, Entry> _cache;
    std::string _cacheDir;
    int _cacheFileId;
public:
    ClipboardCache()
        : _cacheDir(FileUtil::createRandomTmpDir())
        , _cacheFileId(0)
    {
    }

    ~ClipboardCache()
    {
        FileUtil::removeFile(_cacheDir, true);
    }

    void dumpState(std::ostream& os) const
    {
        os << "Saved clipboards: " << _cache.size() << '\n';
        size_t totalSize = 0;
        auto now = std::chrono::steady_clock::now();
        for (const auto &it : _cache)
        {
            std::shared_ptr<std::string> data = it.second._rawData;
            os << "  memory size: " << (data ? data->size() : 0) << " bytes, lifetime: " <<
                std::chrono::duration_cast<std::chrono::seconds>(
                    now - it.second._inserted).count() << " seconds\n";
            if (it.second._cacheFile)
            {
                os << "  cacheFile: " << it.second._cacheFile->_file << ", disk size:" <<
                    it.second._cacheFile->_size << " bytes\n";
            }
            if (!data)
                continue;
            std::string_view string = *data;
            Util::dumpHex(os, string.substr(0, 256), "", "  ");
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

        if (size > 0x10000)
        {
            std::string tempFile = _cacheDir + '/' + std::to_string(_cacheFileId++);

            std::ofstream fileStream;
            fileStream.open(tempFile, std::ios::binary);
            fileStream.write(data, size);
            fileStream.close();

            if (!fileStream)
                LOG_WRN("Unable to cache clipboard entry to: " << tempFile);
            else
                ent._cacheFile = std::make_shared<ClipFile>(std::move(tempFile), size);
        }

        if (!ent._cacheFile)
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

        if (it->second._cacheFile)
        {
            std::shared_ptr<std::string> res = std::make_shared<std::string>();

            if (it->second._cacheFile->_size != FileUtil::readFile(it->second._cacheFile->_file, *res, it->second._cacheFile->_size))
            {
                LOG_WRN("Unable to read clipboard entry from: " << it->second._cacheFile->_file);
                return nullptr;
            }

            return res;
        }

        return it->second._rawData;
    }

    void checkexpiry()
    {
        std::lock_guard<std::mutex> lock(_mutex);
        auto now = std::chrono::steady_clock::now();
        LOG_TRC("check expiry of cached clipboards");
        for (auto it = _cache.begin(); it != _cache.end();)
        {
            if (it->second.hasExpired(now))
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
