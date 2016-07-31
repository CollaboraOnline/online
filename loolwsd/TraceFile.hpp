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
        _stream(path, std::ios::out)
    {
    }

    ~TraceFile()
    {
        _stream.close();
    }

    void write(const std::string& data)
    {
        _stream.write(data.c_str(), data.size());
    }

private:
    std::fstream _stream;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
