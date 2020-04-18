/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <fstream>
#include <mutex>
#include <sstream>
#include <string>
#include <vector>

#include <Poco/DateTime.h>
#include <Poco/DateTimeFormatter.h>
#include <Poco/DeflatingStream.h>
#include <Poco/InflatingStream.h>
#include <Poco/URI.h>

#include "Protocol.hpp"
#include "Log.hpp"
#include "Util.hpp"
#include "FileUtil.hpp"

/// Dumps commands and notification trace.
class TraceFileRecord
{
public:
    enum class Direction : char
    {
        Invalid = 0,
        Incoming = '>',
        Outgoing = '<',
        Event = '~'
    };

    TraceFileRecord() :
        _dir(Direction::Invalid),
        _timestampNs(0),
        _pid(0)
    {
    }

    std::string toString() const
    {
        std::ostringstream oss;
        oss << static_cast<char>(_dir) << _pid << static_cast<char>(_dir)
            << _sessionId << static_cast<char>(_dir) << _payload;
        return oss.str();
    }

    void setDir(Direction dir) { _dir = dir; }

    Direction getDir() const { return _dir; }

    void setTimestampNs(unsigned timestampNs) { _timestampNs = timestampNs; }

    unsigned getTimestampNs() const { return _timestampNs; }

    void setPid(unsigned pid) { _pid = pid; }

    unsigned getPid() const { return _pid; }

    void setSessionId(const std::string& sessionId) { _sessionId = sessionId; }

    const std::string& getSessionId() const { return _sessionId; }

    void setPayload(const std::string& payload) { _payload = payload; }

    const std::string& getPayload() const { return _payload; }

private:
    Direction _dir;
    unsigned _timestampNs;
    unsigned _pid;
    std::string _sessionId;
    std::string _payload;
};

/// Trace-file generator class.
/// Writes records into a trace file.
class TraceFileWriter
{
public:
    TraceFileWriter(const std::string& path,
                    const bool recordOugoing,
                    const bool compress,
                    const bool takeSnapshot,
                    const std::vector<std::string>& filters) :
        _epochStart(std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::system_clock::now()
                                                            .time_since_epoch()).count()),
        _recordOutgoing(recordOugoing),
        _compress(compress),
        _takeSnapshot(takeSnapshot),
        _path(Poco::Path(path).parent().toString()),
        _filter(true),
        _stream(processPath(path), compress ? std::ios::binary : std::ios::out),
        _deflater(_stream, Poco::DeflatingStreamBuf::STREAM_GZIP)
    {
        for (const auto& f : filters)
        {
            _filter.deny(f);
        }
    }

    ~TraceFileWriter()
    {
        std::unique_lock<std::mutex> lock(_mutex);

        _deflater.close();
        _stream.close();
    }

    void newSession(const std::string& id, const std::string& sessionId, const std::string& uri, const std::string& localPath)
    {
        std::unique_lock<std::mutex> lock(_mutex);

        std::string snapshot = uri;

        if (_takeSnapshot)
        {
            std::string decodedUri;
            Poco::URI::decode(uri, decodedUri);
            const std::string url = Poco::URI(decodedUri).getPath();
            const auto it = _urlToSnapshot.find(url);
            if (it != _urlToSnapshot.end())
            {
                snapshot = it->second.getSnapshot();
                it->second.getSessionCount()++;
            }
            else
            {
                // Create a snapshot file.
                const Poco::Path origPath(localPath);
                std::string filename = origPath.getBaseName();
                filename += '_' + Poco::DateTimeFormatter::format(Poco::DateTime(), "%Y%m%d_%H-%M-%S");
                filename += '.' + origPath.getExtension();
                snapshot = Poco::Path(_path, filename).toString();

                FileUtil::copyFileTo(localPath, snapshot);
                snapshot = Poco::URI(Poco::URI("file://"), snapshot).toString();

                LOG_TRC("TraceFile: Mapped URL " << url << " to " << snapshot);
                _urlToSnapshot.emplace(url, SnapshotData(snapshot));
            }
        }

        const auto data = "NewSession: " + snapshot;
        writeLocked(id, sessionId, data, static_cast<char>(TraceFileRecord::Direction::Event));
        flushLocked();
    }

    void endSession(const std::string& id, const std::string& sessionId, const std::string& uri)
    {
        std::unique_lock<std::mutex> lock(_mutex);

        std::string snapshot = uri;

        const std::string url = Poco::URI(uri).getPath();
        const auto it = _urlToSnapshot.find(url);
        if (it != _urlToSnapshot.end())
        {
            snapshot = it->second.getSnapshot();
            if (it->second.getSessionCount() == 1)
            {
                // Last session, remove the mapping.
                _urlToSnapshot.erase(it);
            }
            else
            {
                it->second.getSessionCount()--;
            }
        }

        const auto data = "EndSession: " + snapshot;
        writeLocked(id, sessionId, data, static_cast<char>(TraceFileRecord::Direction::Event));
        flushLocked();
    }

    void writeEvent(const std::string& id, const std::string& sessionId, const std::string& data)
    {
        std::unique_lock<std::mutex> lock(_mutex);

        writeLocked(id, sessionId, data, static_cast<char>(TraceFileRecord::Direction::Event));
        flushLocked();
    }

    void writeIncoming(const std::string& id, const std::string& sessionId, const std::string& data)
    {
        std::unique_lock<std::mutex> lock(_mutex);

        if (_filter.match(data))
        {
            // Remap the URL to the snapshot.
            if (LOOLProtocol::matchPrefix("load", data))
            {
                StringVector tokens = LOOLProtocol::tokenize(data);
                if (tokens.size() >= 2)
                {
                    std::string url;
                    if (LOOLProtocol::getTokenString(tokens[1], "url", url))
                    {
                        std::string decodedUrl;
                        Poco::URI::decode(url, decodedUrl);
                        Poco::URI uriPublic = Poco::URI(decodedUrl);
                        if (uriPublic.isRelative() || uriPublic.getScheme() == "file")
                        {
                            uriPublic.normalize();
                        }

                        url = uriPublic.getPath();
                        const auto it = _urlToSnapshot.find(url);
                        if (it != _urlToSnapshot.end())
                        {
                            LOG_TRC("TraceFile: Mapped URL: " << url << " to " << it->second.getSnapshot());
                            tokens[1] = "url=" + it->second.getSnapshot();
                            std::string newData;
                            for (const auto& token : tokens)
                            {
                                newData += tokens.getParam(token) + ' ';
                            }

                            writeLocked(id, sessionId, newData, static_cast<char>(TraceFileRecord::Direction::Incoming));
                            return;
                        }
                    }
                }
            }

            writeLocked(id, sessionId, data, static_cast<char>(TraceFileRecord::Direction::Incoming));
        }
    }

    void writeOutgoing(const std::string& id, const std::string& sessionId, const std::string& data)
    {
        std::unique_lock<std::mutex> lock(_mutex);

        if (_recordOutgoing && _filter.match(data))
        {
            writeLocked(id, sessionId, data, static_cast<char>(TraceFileRecord::Direction::Outgoing));
        }
    }

private:
    void flushLocked()
    {
        Util::assertIsLocked(_mutex);

        _deflater.flush();
        _stream.flush();
    }

    void writeLocked(const std::string& id, const std::string& sessionId, const std::string& data, const char delim)
    {
        Util::assertIsLocked(_mutex);

        const Poco::Int64 usec = std::chrono::duration_cast<std::chrono::microseconds>(std::chrono
                                        ::system_clock::now().time_since_epoch()).count() - _epochStart;
        if (_compress)
        {
            _deflater.write(&delim, 1);
            _deflater << usec;
            _deflater.write(&delim, 1);
            _deflater << id;
            _deflater.write(&delim, 1);
            _deflater << sessionId;
            _deflater.write(&delim, 1);
            _deflater.write(data.c_str(), data.size());
            _deflater.write("\n", 1);
        }
        else
        {
            _stream.write(&delim, 1);
            _stream << usec;
            _stream.write(&delim, 1);
            _stream << id;
            _stream.write(&delim, 1);
            _stream << sessionId;
            _stream.write(&delim, 1);
            _stream.write(data.c_str(), data.size());
            _stream.write("\n", 1);
        }
    }

    static std::string processPath(const std::string& path)
    {
        const size_t pos = path.find('%');
        if (pos == std::string::npos)
        {
            return path;
        }

        std::string res = path.substr(0, pos);
        res += Poco::DateTimeFormatter::format(Poco::DateTime(), "%Y%m%d_%H-%M-%S");
        res += path.substr(pos + 1);
        LOG_INF("Command trace dumping enabled to file: " << res);
        return res;
    }

private:
    struct SnapshotData
    {
        SnapshotData(const std::string& snapshot) :
            _snapshot(snapshot)
        {
            _sessionCount = 1;
        }

        SnapshotData(const SnapshotData& other) :
            _snapshot(other.getSnapshot())
        {
            _sessionCount = other.getSessionCount().load();
        }

        const std::string& getSnapshot() const { return _snapshot; }

        std::atomic<size_t>& getSessionCount() { return _sessionCount; }

        const std::atomic<size_t>& getSessionCount() const { return _sessionCount; }

    private:
        std::string _snapshot;
        std::atomic<size_t> _sessionCount;
    };

private:
    const Poco::Int64 _epochStart;
    const bool _recordOutgoing;
    const bool _compress;
    const bool _takeSnapshot;
    const std::string _path;
    Util::RegexListMatcher _filter;
    std::ofstream _stream;
    Poco::DeflatingOutputStream _deflater;
    std::mutex _mutex;
    std::map<std::string, SnapshotData> _urlToSnapshot;
};

/// Trace-file parser class.
/// Reads records from a trace file.
class TraceFileReader
{
public:
    TraceFileReader(const std::string& path) :
        _compressed(path.size() > 2 && path.substr(path.size() - 2) == "gz"),
        _epochStart(0),
        _epochEnd(0),
        _stream(path, _compressed ? std::ios::binary : std::ios::in),
        _inflater(_stream, Poco::InflatingStreamBuf::STREAM_GZIP),
        _index(0),
        _indexIn(-1),
        _indexOut(-1)
    {
        readFile();
    }

    ~TraceFileReader()
    {
        _stream.close();
    }

    Poco::Int64 getEpochStart() const { return _epochStart; }
    Poco::Int64 getEpochEnd() const { return _epochEnd; }

    TraceFileRecord getNextRecord()
    {
        if (_index < _records.size())
        {
            return _records[_index++];
        }

        // Invalid.
        return TraceFileRecord();
    }

    TraceFileRecord getNextRecord(const TraceFileRecord::Direction dir)
    {
        if (dir == TraceFileRecord::Direction::Incoming)
        {
            if (_indexIn < _records.size())
            {
                const TraceFileRecord rec = _records[_indexIn];
                _indexIn = advance(_indexIn, dir);
                return rec;
            }
        }
        else
        {
            if (_indexOut < _records.size())
            {
                const TraceFileRecord rec = _records[_indexOut];
                _indexOut = advance(_indexOut, dir);
                return rec;
            }
        }

        // Invalid.
        return TraceFileRecord();
    }

private:
    void readFile()
    {
        _records.clear();

        std::string line;
        for (;;)
        {
            if (_compressed)
            {
                std::getline(_inflater, line);
            }
            else
            {
                std::getline(_stream, line);
            }

            if (line.empty())
            {
                break;
            }

            TraceFileRecord rec;
            if (extractRecord(line, rec))
                _records.push_back(rec);
            else
                fprintf(stderr, "Invalid trace file record, expected 4 tokens. [%s]\n", line.c_str());
        }

        if (_records.empty() ||
            _records[0].getDir() != TraceFileRecord::Direction::Event ||
            _records[0].getPayload().find("NewSession") != 0)
        {
            fprintf(stderr, "Invalid trace file with %ld records. First record: %s\n", static_cast<long>(_records.size()),
                    _records.empty() ? "<empty>" : _records[0].getPayload().c_str());
            throw std::runtime_error("Invalid trace file.");
        }

        _indexIn = advance(-1, TraceFileRecord::Direction::Incoming);
        _indexOut = advance(-1, TraceFileRecord::Direction::Outgoing);

        _epochStart = _records[0].getTimestampNs();
        _epochEnd = _records[_records.size() - 1].getTimestampNs();
    }

    static bool extractRecord(const std::string& s, TraceFileRecord& rec)
    {
        if (s.length() < 1)
            return false;

        char delimiter = s[0];
        rec.setDir(static_cast<TraceFileRecord::Direction>(delimiter));

        size_t pos = 1;
        int record = 0;
        for (; record < 4 && pos < s.length(); ++record)
        {
            size_t next = s.find(delimiter, pos);

            switch (record)
            {
                case 0:
                    rec.setTimestampNs(std::atoi(s.substr(pos, next - pos).c_str()));
                    break;
                case 1:
                    rec.setPid(std::atoi(s.substr(pos, next - pos).c_str()));
                    break;
                case 2:
                    rec.setSessionId(s.substr(pos, next - pos));
                    break;
                case 3:
                    rec.setPayload(s.substr(pos));
                    return true;
            }

            if (next == std::string::npos)
                break;

            pos = next + 1;
        }

        return false;
    }

    unsigned advance(unsigned index, const TraceFileRecord::Direction dir)
    {
        while (++index < _records.size())
        {
            if (_records[index].getDir() == dir)
            {
                break;
            }
        }

        return index;
    }

private:
    const bool _compressed;
    Poco::Int64 _epochStart;
    Poco::Int64 _epochEnd;
    std::ifstream _stream;
    Poco::InflatingInputStream _inflater;
    std::vector<TraceFileRecord> _records;
    unsigned _index;
    unsigned _indexIn;
    unsigned _indexOut;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
