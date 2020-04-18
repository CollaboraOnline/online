/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iomanip>
#include <map>
#include <regex>
#include <sstream>
#include <string>
#include <vector>

#include <Poco/Net/WebSocket.h>

#include <Util.hpp>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

namespace LOOLProtocol
{
    // Protocol Version Number.
    // See protocol.txt.
    constexpr unsigned ProtocolMajorVersionNumber = 0;
    constexpr unsigned ProtocolMinorVersionNumber = 1;

    inline std::string GetProtocolVersion()
    {
        return std::to_string(ProtocolMajorVersionNumber) + '.'
            + std::to_string(ProtocolMinorVersionNumber);
    }

    // Parse a string into a version tuple.
    // Negative numbers for error.
    std::tuple<int, int, std::string> ParseVersion(const std::string& version);

    bool stringToInteger(const std::string& input, int& value);
    bool stringToUInt32(const std::string& input, uint32_t& value);
    bool stringToUInt64(const std::string& input, uint64_t& value);

    inline
    bool parseNameValuePair(const std::string& token, std::string& name, std::string& value, const char delim = '=')
    {
        const size_t mid = token.find_first_of(delim);
        if (mid != std::string::npos)
        {
            name = token.substr(0, mid);
            value = token.substr(mid + 1);
            return true;
        }

        return false;
    }

    inline
    bool parseNameIntegerPair(const std::string& token, std::string& name, int& value)
    {
        std::string strValue;
        return parseNameValuePair(token, name, strValue, '=') && stringToInteger(strValue, value);
    }

    bool getTokenInteger(const std::string& token, const std::string& name, int& value);
    bool getTokenUInt32(const std::string& token, const std::string& name, uint32_t& value);
    bool getTokenUInt64(const std::string& token, const std::string& name, uint64_t& value);
    bool getTokenString(const std::string& token, const std::string& name, std::string& value);
    bool getTokenKeyword(const std::string& token, const std::string& name, const std::map<std::string, int>& map, int& value);

    bool getTokenKeyword(const StringVector& tokens, const std::string& name, const std::map<std::string, int>& map, int& value);

    bool getTokenInteger(const StringVector& tokens, const std::string& name, int& value);

    inline bool getTokenString(const StringVector& tokens,
                               const std::string& name,
                               std::string& value)
    {
        for (const auto& token : tokens)
        {
            if (getTokenString(tokens.getParam(token), name, value))
            {
                return true;
            }
        }

        return false;
    }

    bool getTokenStringFromMessage(const std::string& message, const std::string& name, std::string& value);
    bool getTokenKeywordFromMessage(const std::string& message, const std::string& name, const std::map<std::string, int>& map, int& value);

    /// Tokenize space-delimited values until we hit new-line or the end.
    inline
    StringVector tokenize(const char* data, const size_t size, const char delimiter = ' ')
    {
        std::vector<StringToken> tokens;
        if (size == 0 || data == nullptr)
        {
            return StringVector(std::string(), {});
        }
        tokens.reserve(8);

        const char* start = data;
        const char* end = data;
        for (size_t i = 0; i < size && data[i] != '\n'; ++i, ++end)
        {
            if (data[i] == delimiter)
            {
                if (start != end && *start != delimiter)
                {
                    tokens.emplace_back(start - data, end - start);
                }

                start = end;
            }
            else if (*start == delimiter)
            {
                ++start;
            }
        }

        if (start != end && *start != delimiter && *start != '\n')
        {
            tokens.emplace_back(start - data, end - start);
        }

        return StringVector(std::string(data, size), tokens);
    }

    inline
    StringVector tokenize(const std::string& s, const char delimiter = ' ')
    {
        return tokenize(s.data(), s.size(), delimiter);
    }

    /// Tokenize according to the regex, potentially skip empty tokens.
    inline
    std::vector<std::string> tokenize(const std::string& s, const std::regex& pattern, bool skipEmpty = false)
    {
        std::vector<std::string> tokens;
        if (skipEmpty)
            std::copy_if(std::sregex_token_iterator(s.begin(), s.end(), pattern, -1), std::sregex_token_iterator(), std::back_inserter(tokens), [](std::string in) { return !in.empty(); });
        else
            std::copy(std::sregex_token_iterator(s.begin(), s.end(), pattern, -1), std::sregex_token_iterator(), std::back_inserter(tokens));
        return tokens;
    }

    inline
    std::vector<int> tokenizeInts(const char* data, const size_t size, const char delimiter = ',')
    {
        std::vector<int> tokens;
        if (size == 0 || data == nullptr)
            return tokens;

        const char* start = data;
        const char* end = data;
        for (size_t i = 0; i < size && data[i] != '\n'; ++i, ++end)
        {
            if (data[i] == delimiter)
            {
                if (start != end && *start != delimiter)
                    tokens.emplace_back(std::atoi(start));

                start = end;
            }
            else if (*start == delimiter)
                ++start;
        }

        if (start != end && *start != delimiter && *start != '\n')
            tokens.emplace_back(std::atoi(start));

        return tokens;
    }

    inline
    std::vector<int> tokenizeInts(const std::string& s, const char delimiter = ',')
    {
        return tokenizeInts(s.data(), s.size(), delimiter);
    }

    inline bool getTokenIntegerFromMessage(const std::string& message, const std::string& name, int& value)
    {
        return getTokenInteger(tokenize(message), name, value);
    }

    /// Returns the first token of a message.
    inline
    std::string getFirstToken(const char *message, const int length, const char delim = ' ')
    {
        return Util::getDelimitedInitialSubstring(message, length, delim);
    }

    template <typename T>
    std::string getFirstToken(const T& message, const char delim = ' ')
    {
        return getFirstToken(message.data(), message.size(), delim);
    }

    inline
    bool matchPrefix(const std::string& prefix, const std::string& message)
    {
        return (message.size() >= prefix.size() &&
                message.compare(0, prefix.size(), prefix) == 0);
    }

    inline
    bool matchPrefix(const std::string& prefix, const std::vector<char>& message)
    {
        return (message.size() >= prefix.size() &&
                prefix.compare(0, prefix.size(), message.data(), prefix.size()) == 0);
    }

    inline
    bool matchPrefix(const std::string& prefix, const std::string& message, const bool ignoreWhitespace)
    {
        if (ignoreWhitespace)
        {
            const size_t posPre = prefix.find_first_not_of(' ');
            const size_t posMsg = message.find_first_not_of(' ');

            return matchPrefix(posPre == std::string::npos ? prefix : prefix.substr(posPre),
                               posMsg == std::string::npos ? message : message.substr(posMsg));
        }
        else
        {
            return matchPrefix(prefix, message);
        }
    }

    /// Returns true if the token is a user-interaction token.
    /// Currently this excludes commands sent automatically.
    /// Notice that this doesn't guarantee editing activity,
    /// rather just user interaction with the UI.
    inline
    bool tokenIndicatesUserInteraction(const std::string& token)
    {
        // Exclude tokens that include these keywords, such as canceltiles statusindicator.

        // FIXME: This is wrong. That the token happens to contain (or not) a certain substring is
        // no guarantee that it "indicates user interaction". It might be like that at the moment,
        // but that is coincidental. We should check what the actual whole token is, at least, not
        // look for a substring.

        return (token.find("tile") == std::string::npos &&
                token.find("status") == std::string::npos &&
                token.find("state") == std::string::npos &&
                token != "userinactive");
    }

    /// Returns the first line of a message.
    inline
    std::string getFirstLine(const char *message, const int length)
    {
        return Util::getDelimitedInitialSubstring(message, length, '\n');
    }

    /// Returns the first line of any data which payload char*.
    template <typename T>
    std::string getFirstLine(const T& message)
    {
        return getFirstLine(message.data(), message.size());
    }

    /// Returns an abbereviation of the message (the first line, indicating truncation). We assume
    /// that it adhers to the LOOL protocol, i.e. that there is always a first (or only) line that
    /// is in printable UTF-8. I.e. no encoding of binary bytes is done. The format of the result is
    /// not guaranteed to be stable. It is to be used for logging purposes only, not for decoding
    /// protocol frames.
    inline
    std::string getAbbreviatedMessage(const char *message, const int length)
    {
        if (message == nullptr || length <= 0)
        {
            return std::string();
        }

        const std::string firstLine = getFirstLine(message, std::min(length, 500));

        // If first line is less than the length (minus newline), add ellipsis.
        if (firstLine.size() < static_cast<std::string::size_type>(length) - 1)
        {
            return firstLine + "...";
        }

        return firstLine;
    }

    inline std::string getAbbreviatedMessage(const std::string& message)
    {
        const size_t pos = Util::getDelimiterPosition(message.data(), std::min<size_t>(message.size(), 501), '\n');

        // If first line is less than the length (minus newline), add ellipsis.
        if (pos < static_cast<std::string::size_type>(message.size()) - 1)
        {
            return message.substr(0, pos) + "...";
        }

        return message;
    }

    template <typename T>
    std::string getAbbreviatedMessage(const T& message)
    {
        return getAbbreviatedMessage(message.data(), message.size());
    }

    // Return a string dump of a WebSocket frame: Its opcode, length, first line (if present),
    // flags. For human-readable logging purposes. Format not guaranteed to be stable. Not to be
    // inspected programmatically.
    inline
    std::string getAbbreviatedFrameDump(const char *message, const int length, const int flags)
    {
        std::ostringstream result;
        switch (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK)
        {
#define CASE(x) case Poco::Net::WebSocket::FRAME_OP_##x: result << #x; break
        CASE(CONT);
        CASE(TEXT);
        CASE(BINARY);
        CASE(CLOSE);
        CASE(PING);
        CASE(PONG);
#undef CASE
        default:
            result << Poco::format("%#x", flags);
            break;
        }
        result << " " << std::setw(3) << length << " bytes";

        if (length > 0 &&
            ((flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) == Poco::Net::WebSocket::FRAME_OP_TEXT ||
             (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) == Poco::Net::WebSocket::FRAME_OP_BINARY ||
             (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) == Poco::Net::WebSocket::FRAME_OP_PING ||
             (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) == Poco::Net::WebSocket::FRAME_OP_PONG))
            result << ": '" << getAbbreviatedMessage(message, length) << "'";
        return result.str();
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
