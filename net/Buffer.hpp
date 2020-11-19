/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <vector>

// Blocks -> we can share from client -> server ... etc.
// headers / and a 'writeV' etc. =)

/**
 * Encapsulate data we need to write.
 */
class Buffer {
    size_t _size;
    std::vector<char> _buffer;
public:
    Buffer() : _size(0)
    {
    }
    size_t size() { return _size; }
    bool empty() { return _size == 0; }

    const char *getBlock()
    {
        return &_buffer[0];
    }
    size_t getBlockSize()
    {
        return _size;
    }
    void eraseFirst(size_t len)
    {
        _buffer.erase(_buffer.begin(), _buffer.begin() + len);
        _size = _buffer.size();
    }
    void append(const char *data, const int len)
    {
        _buffer.insert(_buffer.end(), data, data + len);
        _size = _buffer.size();
    }
    void dumpHex(std::ostream &os, const char *legend, const char *prefix)
    {
        Util::dumpHex(os, legend, prefix, _buffer);
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
