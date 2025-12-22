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

#include <cassert>
#include <cstdint>
#include <sstream>

#include <common/FileUtil.hpp>
#include <common/JsonUtil.hpp>
#include <common/RecentFiles.hpp>

#include <Poco/Path.h>
#include <Poco/URI.h>

RecentFiles::RecentFiles()
    : _initialised(false)
{
}

void RecentFiles::load(const std::string& fileName, int maxFiles)
{
    _initialised = true;

    _fileName = fileName;
    _maxFiles = maxFiles;

    std::ifstream stream;

    FileUtil::openFileToIFStream(fileName, stream);
    if (stream.is_open())
    {
        int n = 0;
        while (!stream.eof() && !stream.bad() && n++ < maxFiles)
        {
            Entry entry;
            std::getline(stream, entry.uri);
            if (stream.bad() || entry.uri == "")
                break;
            std::string line;
            std::getline(stream, line);
            if (stream.bad() || line == "")
                break;
            uint64_t count;
            std::istringstream(line) >> count;
            entry.timestamp = std::chrono::time_point<std::chrono::system_clock>(std::chrono::system_clock::duration(count));
            _MRU.push_back(entry);
        }
    }
}

void RecentFiles::add(const std::string& uri)
{
    assert(_initialised);

    // Add entry for the file first in the list, removing old entry for it if it exist.
    for (auto it = _MRU.begin(); it != _MRU.end(); it++)
        if (it->uri == uri)
        {
            _MRU.erase(it);
            break;
        }
    _MRU.insert(_MRU.begin(),
                { uri, std::chrono::time_point<std::chrono::system_clock>(std::chrono::system_clock::now()) });

    // Save the list.
    std::ofstream stream;
    FileUtil::openFileToOFStream(_fileName, stream);
    if (!stream.is_open() || stream.bad())
    {
        LOG_ERR("Could not open '" << _fileName << "' for writing");
        return;
    }
    for (const auto& i : _MRU)
        stream << i.uri << std::endl << i.timestamp.time_since_epoch().count() << std::endl;
}

std::string RecentFiles::serialise()
{
    std::string result;

    result = "[ ";
    for (int i = 0; i < _MRU.size(); i++)
    {
        std::vector<std::string> segments;
        Poco::URI(_MRU[i].uri).getPathSegments(segments);

        assert(!segments.empty());

        result += "{ "
            "\"uri\": \"" + _MRU[i].uri + "\", "
            "\"name\": \"" + JsonUtil::escapeJSONValue(segments.back()) + "\", "
            "\"timestamp\": \"" + std::format("{:%FT%TZ}", _MRU[i].timestamp) + "\""
            " }";
        if (i < _MRU.size() - 1)
            result += ", ";
    }
    result += " ]";

    return result;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
