/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <assert.h>
#include <ostream>
#include <vector>

#include <Util.hpp>

// Blocks -> we can share from client -> server ... etc.
// headers / and a 'writeV' etc. =)

/**
 * Encapsulate data we need to write.
 */
class Buffer
{
    std::size_t _size;
    std::size_t _offset;
    std::vector<char> _buffer;

public:
    Buffer() : _size(0), _offset(0)
    {
    }

    std::size_t size() const { return _size; }
    bool empty() const { return _size == 0; }

    const char *getBlock() const
    {
        if (_size)
            return &_buffer[_offset];
        return nullptr;
    }

    std::size_t getBlockSize() const
    {
        return _size;
    }

    void eraseFirst(std::size_t len)
    {
        if (len <= 0)
            return;

        assert(_offset + len <= _buffer.size());
        assert(_offset + _size == _buffer.size());

        len = std::min(len, _size); // Avoid accidental damage.

        // avoid regular shuffling down larger chunks of data
        if (_buffer.size() > 16384 && // lots of queued data
            len < _buffer.size() &&   // not a complete erase
            _offset < 16384 * 64 &&   // do cleanup a Mb at a time or so:
            _size > 512)              // early cleanup if what remains is small.
        {
            _offset += len;
            _size -= len;
            return;
        }

        _buffer.erase(_buffer.begin(), _buffer.begin() + _offset + len);
        _offset = 0;
        _size = _buffer.size();
    }

    void append(const char *data, const int len)
    {
        _buffer.insert(_buffer.end(), data, data + len);
        _size = _buffer.size() - _offset;
    }

    void append(const std::string& s) { append(s.c_str(), s.size()); }

    void append(const char ch) { append(&ch, 1); }

    void dumpHex(std::ostream &os, const char *legend, const char *prefix) const
    {
        if (_size > 0 || _offset > 0)
            os << prefix << "Buffer size: " << _size << " offset: " << _offset << '\n';
        if (_buffer.size() > 0)
            Util::dumpHex(os, _buffer, legend, prefix);
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
