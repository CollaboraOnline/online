/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
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

#include <StringVector.hpp>
#include <Util.hpp>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

namespace COOLProtocol
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

    inline bool stringToInteger(const std::string& input, int& value)
    {
        bool res;
        std::tie(value, res) = Util::i32FromString(input);
        return res;
    }

    inline bool stringToUInt32(const std::string& input, uint32_t& value)
    {
        bool res;
        std::tie(value, res) = Util::i32FromString(input);
        return res;
    }

    inline bool stringToUInt64(const std::string& input, uint64_t& value)
    {
        bool res;
        std::tie(value, res) = Util::u64FromString(input);
        return res;
    }

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

    bool getTokenInteger(const std::string& token, const std::string& name, int& value);
    bool getTokenUInt32(const std::string& token, const std::string& name, uint32_t& value);
    bool getTokenUInt64(const std::string& token, const std::string& name, uint64_t& value);
    bool getTokenString(const std::string& token, const std::string& name, std::string& value);
    bool getTokenKeyword(const std::string& token, const std::string& name, const std::map<std::string, int>& map, int& value);

    bool getTokenKeyword(const StringVector& tokens, const std::string& name, const std::map<std::string, int>& map, int& value);

    bool getTokenInteger(const StringVector& tokens, const std::string& name, int& value);

    /// Literal-string token names.
    template <std::size_t N>
    inline bool getTokenInteger(const std::string& token, const char (&name)[N], int& value)
    {
        // N includes null termination.
        static_assert(N > 1, "Token name must be at least one character long.");
        if (token.size() > N && token[N - 1] == '=' && token.compare(0, N - 1, name) == 0)
        {
            const char* str = token.data() + N;
            char* endptr = nullptr;
            value = std::strtol(str, &endptr, 10);
            return (endptr > str);
        }

        return false;
    }

    /// Extracts a name and value from token. Returns true if value is a non-negative integer.
    template <std::size_t N>
    inline bool getNonNegTokenInteger(const std::string& token, const char (&name)[N], int& value)
    {
        return getTokenInteger(token, name, value) && value >= 0;
    }

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
        return getTokenInteger(StringVector::tokenize(message), name, value);
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

    /// Returns true if the token is a likely document modifying command.
    /// This is never 100% accurate, but it is needed to filter out tokens
    /// that certainly do not modify the document, such as 'load' and 'save'
    /// commands. Some commands are certainly modifying, e.g. 'key', others
    /// can only potentially be modifying, e.g. 'mouse' while dragging.
    /// Note: this is only used when we don't have the modified flag from
    /// Core so we flag the document as user-modified more accurately.
    inline bool tokenIndicatesDocumentModification(const StringVector& tokens)
    {
        // These keywords are chosen to cover the largest set of
        // commands that may potentially modify the document.
        // We need to assume modification rather than not.
        if (tokens.equals(0, "key") || tokens.equals(0, "outlinestate") ||
            tokens.equals(0, "paste") || tokens.equals(0, "insertfile") ||
            tokens.equals(0, "textinput") || tokens.equals(0, "windowkey") ||
            tokens.equals(0, "windowmouse") || tokens.equals(0, "windowgesture"))
        {
            return true;
        }

        if (tokens.size() > 1 && tokens.equals(0, "uno"))
        {
            // By default, all uno commands are modifying, unless we are certain they don't.
            return !tokens.equals(1, ".uno:SidebarHide") && !tokens.equals(1, ".uno:SidebarShow") &&
                   !tokens.equals(1, ".uno:Copy") && !tokens.equals(1, ".uno:Save");
        }

        return false;
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

    /// Returns an abbreviation of the message (the first line, indicating truncation). We assume
    /// that it adhers to the COOL protocol, i.e. that there is always a first (or only) line that
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
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
