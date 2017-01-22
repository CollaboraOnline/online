/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_MESSAGE_HPP
#define INCLUDED_MESSAGE_HPP

#include <atomic>
#include <string>
#include <vector>

/// The payload type used to send/receive data.
class MessagePayload
{
public:

    enum class Type { Text, JSON, Binary };
    enum class Dir { In, Out };

    /// Construct a text message.
    /// message must include the full first-line.
    MessagePayload(const std::string& message,
                   const enum Dir dir,
                   const enum Type type = Type::Text) :
        _data(message.data(), message.data() + message.size()),
        _tokens(LOOLProtocol::tokenize(_data.data(), _data.size())),
        _id(makeId(dir)),
        _firstLine(LOOLProtocol::getFirstLine(_data.data(), _data.size())),
        _abbreviation(_id + ' ' + LOOLProtocol::getAbbreviatedMessage(_data.data(), _data.size())),
        _type(type)
    {
    }

    /// Construct a message from a string with type and
    /// reserve extra space (total, including message).
    /// message must include the full first-line.
    MessagePayload(const std::string& message,
                   const enum Dir dir,
                   const enum Type type,
                   const size_t reserve) :
        _data(std::max(reserve, message.size())),
        _tokens(LOOLProtocol::tokenize(message)),
        _id(makeId(dir)),
        _firstLine(LOOLProtocol::getFirstLine(message)),
        _abbreviation(_id + ' ' + LOOLProtocol::getAbbreviatedMessage(message)),
        _type(type)
    {
        _data.resize(message.size());
        std::memcpy(_data.data(), message.data(), message.size());
    }

    /// Construct a message from a character array with type.
    /// data must be include the full first-line.
    MessagePayload(const char* p,
                   const size_t len,
                   const enum Dir dir,
                   const enum Type type) :
        _data(p, p + len),
        _tokens(LOOLProtocol::tokenize(_data.data(), _data.size())),
        _id(makeId(dir)),
        _firstLine(LOOLProtocol::getFirstLine(_data.data(), _data.size())),
        _abbreviation(_id + ' ' + LOOLProtocol::getAbbreviatedMessage(_data.data(), _data.size())),
        _type(type)
    {
    }

    size_t size() const { return _data.size(); }
    const std::vector<char>& data() const { return _data; }

    const std::vector<std::string>& tokens() const { return _tokens; }
    const std::string& firstToken() const { return _tokens[0]; }
    const std::string& firstLine() const { return _firstLine; }
    const std::string& abbreviation() const { return _abbreviation; }
    const std::string& id() const { return _id; }

    /// Returns the json part of the message, if any.
    std::string jsonString() const
    {
        if (_tokens.size() > 1 && _tokens[1] == "{")
        {
            const auto firstTokenSize = _tokens[0].size();
            return std::string(_data.data() + firstTokenSize, _data.size() - firstTokenSize);
        }

        return std::string();
    }

    /// Append more data to the message.
    void append(const char* p, const size_t len)
    {
        const auto curSize = _data.size();
        _data.resize(curSize + len);
        std::memcpy(_data.data() + curSize, p, len);
    }

    /// Returns true if and only if the payload is considered Binary.
    bool isBinary() const { return _type == Type::Binary; }

private:

    /// Constructs a unique ID.
    static std::string makeId(const enum Dir dir)
    {
        static std::atomic<unsigned> Counter;
        return (dir == Dir::In ? 'i' : 'o') + std::to_string(++Counter);
    }

private:
    std::vector<char> _data;
    const std::vector<std::string> _tokens;
    const std::string _id;
    const std::string _firstLine;
    const std::string _abbreviation;
    const Type _type;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
