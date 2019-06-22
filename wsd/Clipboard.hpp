/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Clipboard abstraction.
#ifndef INCLUDED_CLIPBOARD_HPP
#define INCLUDED_CLIPBOARD_HPP

#include <string>
#include <vector>
#include <stdlib.h>
#include <Log.hpp>
#include <Exceptions.hpp>

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
            uint64_t len = strtoll( hexLen.c_str(), nullptr, 16 );
            std::string content(len, ' ');
            inStream.read(&content[0], len);
            std::getline(inStream, newline, '\n');
            if (newline.length() > 0)
                throw ParseError("trailing stream content expecting plain newline got: '" +
                                 newline + "' length: " + hexLen);
            if (mime.length() > 0)
            {
                _mimeTypes.push_back(mime);
                _content.push_back(content);
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

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
