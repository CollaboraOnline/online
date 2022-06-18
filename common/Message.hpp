/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <atomic>
#include <cstring>
#include <string>
#include <vector>
#include <functional>

#include "Protocol.hpp"
#include "StringVector.hpp"
#include "Log.hpp"
#include "Util.hpp"

/// The payload type used to send/receive data.
class Message
{
public:

    enum class Type { Text, JSON, Binary };
    enum class Dir { In, Out };

    /// Construct a text message.
    /// message must include the full first-line.
    Message(const std::string& message,
            const enum Dir dir) :
        _forwardToken(getForwardToken(message.data(), message.size())),
        _data(copyDataAfterOffset(message.data(), message.size(), _forwardToken.size())),
        _tokens(StringVector::tokenize(_data.data(), _data.size())),
        _id(makeId(dir)),
        _type(detectType())
    {
        LOG_TRC("Message " << abbr());
    }

    /// Construct a message from a string with type and
    /// reserve extra space (total, including message).
    /// message must include the full first-line.
    Message(const std::string& message,
            const enum Dir dir,
            const size_t reserve) :
        _forwardToken(getForwardToken(message.data(), message.size())),
        _data(copyDataAfterOffset(message.data(), message.size(), _forwardToken.size())),
        _tokens(StringVector::tokenize(message.data() + _forwardToken.size(), message.size() - _forwardToken.size())),
        _id(makeId(dir)),
        _type(detectType())
    {
        _data.reserve(std::max(reserve, message.size()));
        LOG_TRC("Message " << abbr());
    }

    /// Construct a message from a character array with type.
    /// Note: p must include the full first-line.
    Message(const char* p,
            const size_t len,
            const enum Dir dir) :
        _forwardToken(getForwardToken(p, len)),
        _data(copyDataAfterOffset(p, len, _forwardToken.size())),
        _tokens(StringVector::tokenize(_data.data(), _data.size())),
        _id(makeId(dir)),
        _type(detectType())
    {
        LOG_TRC("Message " << abbr());
    }

    size_t size() const { return _data.size(); }
    const std::vector<char>& data() const { return _data; }

    const StringVector& tokens() const { return _tokens; }
    const std::string& forwardToken() const { return _forwardToken; }
    std::string firstToken() const { return _tokens[0]; }
    bool firstTokenMatches(const std::string& target) const { return _tokens[0] == target; }
    std::string operator[](size_t index) const { return _tokens[index]; }

    /// Find a subarray in the raw message.
    int find(const char* sub, const std::size_t subLen) const
    {
        return Util::findSubArray(&_data[0], _data.size(), sub, subLen);
    }

    /// Returns true iff the subarray exists in the raw message.
    bool contains(const char* p, const std::size_t len) const { return find(p, len) >= 0; }

    const std::string& firstLine()
    {
        assignFirstLineIfEmpty();
        return _firstLine;
    }


    bool getTokenInteger(const std::string& name, int& value)
    {
        return COOLProtocol::getTokenInteger(_tokens, name, value);
    }

    /// Return the abbreviated message for logging purposes.
    std::string abbr() const {
        return _id + ' ' + COOLProtocol::getAbbreviatedMessage(_data.data(), _data.size());
    }
    const std::string& id() const { return _id; }

    /// Returns the json part of the message, if any.
    std::string jsonString() const
    {
        if (_tokens.size() > 1 && _tokens[1].size() && _tokens[1][0] == '{')
        {
            const size_t firstTokenSize = _tokens[0].size();
            return std::string(_data.data() + firstTokenSize, _data.size() - firstTokenSize);
        }

        return std::string();
    }

    /// Append more data to the message.
    void append(const char* p, const size_t len)
    {
        const size_t curSize = _data.size();
        _data.resize(curSize + len);
        std::memcpy(_data.data() + curSize, p, len);
    }

    /// Returns true if and only if the payload is considered Binary.
    bool isBinary() const { return _type == Type::Binary; }

    /// Allows some in-line re-writing of the message
    void rewriteDataBody(const std::function<bool (std::vector<char> &)>& func)
    {
        // Make sure _firstLine is assigned before we change _data
        assignFirstLineIfEmpty();
        if (func(_data))
        {
            // Check - just the body.
            assert(_firstLine == COOLProtocol::getFirstLine(_data.data(), _data.size()));
            assert(_type == detectType());
        }
    }

private:

    /// Constructs a unique ID.
    static std::string makeId(const enum Dir dir)
    {
        static std::atomic<unsigned> Counter;
        return (dir == Dir::In ? 'i' : 'o') + std::to_string(++Counter);
    }

    void assignFirstLineIfEmpty()
    {
        if(_firstLine.empty())
        {
            _firstLine = COOLProtocol::getFirstLine(_data.data(), _data.size());
        }
    }

    Type detectType() const
    {
        if (_tokens.equals(0, "tile:") ||
            _tokens.equals(0, "tilecombine:") ||
            _tokens.equals(0, "delta:") ||
            _tokens.equals(0, "renderfont:") ||
            _tokens.equals(0, "rendersearchresult:") ||
            _tokens.equals(0, "windowpaint:"))
        {
            return Type::Binary;
        }

        if (_data.size() > 0 && _data[_data.size() - 1] == '}')
        {
            return Type::JSON;
        }

        // All others are plain text.
        return Type::Text;
    }

    std::string getForwardToken(const char* buffer, int length)
    {
        std::string forward = COOLProtocol::getFirstToken(buffer, length);
        return (forward.find('-') != std::string::npos ? forward : std::string());
    }

    std::vector<char> copyDataAfterOffset(const char *p, size_t len, size_t fromOffset)
    {
        if (!p || fromOffset >= len)
            return std::vector<char>();

        size_t i;
        for (i = fromOffset; i < len; ++i)
        {
            if (p[i] != ' ')
                break;
        }
        if (i < len)
            return std::vector<char>(p + i, p + len);
        else
            return std::vector<char>();
    }

private:
    const std::string _forwardToken;
    std::vector<char> _data;
    const StringVector _tokens;
    const std::string _id;
    std::string _firstLine;
    const Type _type;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
