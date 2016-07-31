/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <string>
#include <fstream>

/// Dumps commands and notification trace.
class TraceFile
{
public:
    TraceFile(const std::string& path) :
        _epochStart(Poco::Timestamp().epochMicroseconds()),
        _stream(path, std::ios::out)
    {
    }

    ~TraceFile()
    {
        _stream.close();
    }

    void writeIncoming(const std::string& data)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        const Poco::Int64 usec = Poco::Timestamp().epochMicroseconds() - _epochStart;
        _stream.write(">", 1);
        _stream << usec;
        _stream.write(">", 1);
        _stream.write(data.c_str(), data.size());
        _stream.write("\n", 1);
    }

    void writeOutgoing(const std::string& data)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        const Poco::Int64 usec = Poco::Timestamp().epochMicroseconds() - _epochStart;
        _stream.write("<", 1);
        _stream << usec;
        _stream.write("<", 1);
        _stream.write(data.c_str(), data.size());
        _stream.write("\n", 1);
    }

private:
    const Poco::Int64 _epochStart;
    std::fstream _stream;
    std::mutex _mutex;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
