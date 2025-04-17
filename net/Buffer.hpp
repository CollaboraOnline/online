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

#pragma once

#include <common/HexUtil.hpp>
#include <common/Util.hpp>

#include <assert.h>
#include <ostream>
#include <vector>

// Blocks -> we can share from client -> server ... etc.
// headers / and a 'writeV' etc. =)

/**
 * Encapsulate data we need to write.
 */
class Buffer
{
    std::size_t _offset;  /// offset into _buffer of data
    std::vector<char> _buffer;

    void resetOffset()
    {
        // reset underlying capacity of previously large buffers
        if (_buffer.empty() && _buffer.capacity() > 32768)
            _buffer.shrink_to_fit();
        _offset = 0;
    }

public:
    Buffer() : _offset(0)
    {
    }

    typedef std::vector<char>::iterator iterator;
    typedef std::vector<char>::const_iterator const_iterator;

    std::size_t size() const { return _buffer.size() - _offset; }
    std::size_t capacity() const { return _buffer.capacity(); }
    bool empty() const { return _offset == _buffer.size(); }

    const char *getBlock() const
    {
        if (!empty())
            return &_buffer[_offset];
        return nullptr;
    }

    std::size_t getBlockSize() const
    {
        return size();
    }

    void eraseFirst(std::size_t len)
    {
        if (len <= 0)
            return;

        assert(_offset + len <= _buffer.size());
        assert(_offset + size() == _buffer.size());

        len = std::min(len, size()); // Avoid accidental damage.

        // avoid regular shuffling down larger chunks of data
        if (_buffer.size() > 16384 && // lots of queued data
            len < size() &&           // not a complete erase
            _offset < 16384 * 64 &&   // do cleanup a Mb at a time or so:
            size() > 512)             // early cleanup if what remains is small.
        {
            _offset += len;
            return;
        }

        _buffer.erase(_buffer.begin(), _buffer.begin() + _offset + len);
        resetOffset();
    }

    void append(const char *data, const int len)
    {
        _buffer.insert(_buffer.end(), data, data + len);
    }

    void append(const std::string& s) { append(s.c_str(), s.size()); }

    /// Append a literal string, with compile-time size capturing.
    template <std::size_t N> void append(const char (&s)[N])
    {
        static_assert(N > 1, "Cannot append empty strings.");
        append(s, N - 1); // Minus null termination.
    }

    void dumpHex(std::ostream &os, const char *legend, const char *prefix) const
    {
        if (size() > 0 || _offset > 0)
            os << prefix << "Buffer size: " << size() << " offset: " << _offset << '\n';
        if (_buffer.size() > 0)
            HexUtil::dumpHex(os, _buffer, legend, prefix);
    }

    // various std::vector API compatibility functions

    void clear()
    {
        _buffer.clear();
        resetOffset();
    }

    iterator begin() { return _buffer.begin() + _offset; }

    const_iterator begin() const { return _buffer.begin() + _offset; }

    iterator end() { return _buffer.end(); }

    const_iterator end() const { return _buffer.end(); }

    char operator[](int index) const { return _buffer[_offset + index]; }

    char& operator[](int index) { return _buffer[_offset + index]; }

    const char* data() const { return _buffer.data() + _offset; }

    char* data() { return _buffer.data() + _offset; }

    iterator erase(iterator first, iterator last)
    {
        if (first == begin())
        {
            eraseFirst(last - begin());
            return begin();
        }
        iterator ret = _buffer.erase(first, last);
        return ret;
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
