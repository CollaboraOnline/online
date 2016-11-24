/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <fstream>
#include <mutex>
#include <sstream>
#include <string>
#include <vector>

#include <Poco/DeflatingStream.h>
#include <Poco/InflatingStream.h>

#include "Util.hpp"

/// Dumps commands and notification trace.
class TraceFileRecord
{
public:
    enum class Direction : char
    {
        Invalid = 0,
        Incoming = '>',
        Outgoing = '<',
        Event = '-'
    };

    TraceFileRecord() :
        Dir(Direction::Invalid),
        TimestampNs(0),
        Pid(0)
    {
    }

    Direction Dir;
    unsigned TimestampNs;
    unsigned Pid;
    std::string SessionId;
    std::string Payload;
};

/// Trace-file generator class.
/// Writes records into a trace file.
class TraceFileWriter
{
public:
    TraceFileWriter(const std::string& path, const bool recordOugoing, const bool compress,
                    const std::vector<std::string>& filters) :
        _epochStart(Poco::Timestamp().epochMicroseconds()),
        _recordOutgoing(recordOugoing),
        _compress(compress),
        _filter(true),
        _stream(path, compress ? std::ios::binary : std::ios::out),
        _deflater(_stream, Poco::DeflatingStreamBuf::STREAM_GZIP),
        _mutex()
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

    void writeEvent(const std::string& pId, const std::string& sessionId, const std::string& data)
    {
        std::unique_lock<std::mutex> lock(_mutex);

        writeLocked(pId, sessionId, data, static_cast<char>(TraceFileRecord::Direction::Event));
        flushLocked();
    }

    void writeIncoming(const std::string& pId, const std::string& sessionId, const std::string& data)
    {
        std::unique_lock<std::mutex> lock(_mutex);

        if (_filter.match(data))
        {
            writeLocked(pId, sessionId, data, static_cast<char>(TraceFileRecord::Direction::Incoming));
        }
    }

    void writeOutgoing(const std::string& pId, const std::string& sessionId, const std::string& data)
    {
        std::unique_lock<std::mutex> lock(_mutex);

        if (_recordOutgoing && _filter.match(data))
        {
            writeLocked(pId, sessionId, data, static_cast<char>(TraceFileRecord::Direction::Outgoing));
        }
    }

private:
    void flushLocked()
    {
        Util::assertIsLocked(_mutex);

        _deflater.flush();
        _stream.flush();
    }

    void writeLocked(const std::string& pId, const std::string& sessionId, const std::string& data, const char delim)
    {
        Util::assertIsLocked(_mutex);

        const Poco::Int64 usec = Poco::Timestamp().epochMicroseconds() - _epochStart;
        if (_compress)
        {
            _deflater.write(&delim, 1);
            _deflater << usec;
            _deflater.write(&delim, 1);
            _deflater << pId;
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
            _stream << pId;
            _stream.write(&delim, 1);
            _stream << sessionId;
            _stream.write(&delim, 1);
            _stream.write(data.c_str(), data.size());
            _stream.write("\n", 1);
        }
    }

private:
    const Poco::Int64 _epochStart;
    const bool _recordOutgoing;
    const bool _compress;
    Util::RegexListMatcher _filter;
    std::ofstream _stream;
    Poco::DeflatingOutputStream _deflater;
    std::mutex _mutex;
};

/// Trace-file parser class.
/// Reads records from a trace file.
class TraceFileReader
{
public:
    TraceFileReader(const std::string& path) :
        _compressed(path.size() > 2 && path.substr(path.size() - 2) == "gz"),
        _epochStart(0),
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

    Poco::Int64 getEpoch() const { return _epochStart; }

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

            const auto v = split(line, line[0]);
            if (v.size() == 4)
            {
                TraceFileRecord rec;
                rec.Dir = static_cast<TraceFileRecord::Direction>(line[0]);
                unsigned index = 0;
                rec.TimestampNs = std::atoi(v[index++].c_str());
                rec.Pid = std::atoi(v[index++].c_str());
                rec.SessionId = v[index++];
                rec.Payload = v[index++];
                _records.push_back(rec);
            }
            else
            {
                fprintf(stderr, "Invalid trace file record, expected 4 tokens. [%s]\n", line.c_str());
            }
        }

        if (_records.empty() ||
            _records[0].Dir != TraceFileRecord::Direction::Event ||
            _records[0].Payload.find("NewSession") != 0)
        {
            fprintf(stderr, "Invalid trace file with %ld records. First record: %s\n", _records.size(),
                    _records.empty() ? "<empty>" : _records[0].Payload.c_str());
            throw std::runtime_error("Invalid trace file.");
        }

        _indexIn = advance(-1, TraceFileRecord::Direction::Incoming);
        _indexOut = advance(-1, TraceFileRecord::Direction::Outgoing);

        _epochStart = _records[0].TimestampNs;
    }

    std::vector<std::string> split(const std::string& s, const char delim) const
    {
        std::stringstream ss(s);
        std::string item;
        std::vector<std::string> v;
        while (std::getline(ss, item, delim))
        {
            if (!item.empty())
            {
                v.push_back(item);
            }
        }

        return v;
    }

    unsigned advance(unsigned index, const TraceFileRecord::Direction dir)
    {
        while (++index < _records.size())
        {
            if (_records[index].Dir == dir)
            {
                break;
            }
        }

        return index;
    }

private:
    const bool _compressed;
    Poco::Int64 _epochStart;
    std::ifstream _stream;
    Poco::InflatingInputStream _inflater;
    std::vector<TraceFileRecord> _records;
    unsigned _index;
    unsigned _indexIn;
    unsigned _indexOut;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
