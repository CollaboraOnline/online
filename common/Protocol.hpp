/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOOLPROTOCOL_HPP
#define INCLUDED_LOOLPROTOCOL_HPP

#include <cstring>
#include <map>
#include <sstream>
#include <string>

#include <Poco/Format.h>
#include <Poco/StringTokenizer.h>

#include <Poco/Net/WebSocket.h>

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
    inline
    bool parseNameValuePair(const std::string& token, std::string& name, std::string& value, const char delim = '=')
    {
        const auto mid = token.find_first_of(delim);
        if (mid != std::string::npos)
        {
            name = token.substr(0, mid);
            value = token.substr(mid + 1);
            return true;
        }

        return false;
    }

    inline
    bool parseNameIntegerPair(const std::string& token, std::string& name, int& value, const char delim = '=')
    {
        std::string strValue;
        return parseNameValuePair(token, name, strValue, delim) && stringToInteger(strValue, value);
    }

    bool getTokenInteger(const std::string& token, const std::string& name, int& value);
    bool getTokenString(const std::string& token, const std::string& name, std::string& value);
    bool getTokenKeyword(const std::string& token, const std::string& name, const std::map<std::string, int>& map, int& value);

    bool getTokenInteger(const Poco::StringTokenizer& tokens, const std::string& name, int& value);
    bool getTokenString(const Poco::StringTokenizer& tokens, const std::string& name, std::string& value);
    bool getTokenKeyword(const Poco::StringTokenizer& tokens, const std::string& name, const std::map<std::string, int>& map, int& value);

    bool getTokenIntegerFromMessage(const std::string& message, const std::string& name, int& value);
    bool getTokenStringFromMessage(const std::string& message, const std::string& name, std::string& value);
    bool getTokenKeywordFromMessage(const std::string& message, const std::string& name, const std::map<std::string, int>& map, int& value);

    // Functions that parse messages. All return false if parsing fails
    bool parseStatus(const std::string& message, LibreOfficeKitDocumentType& type, int& nParts, int& currentPart, int& width, int& height);

    inline
    std::string getDelimitedInitialSubstring(const char *message, const int length, const char delim)
    {
        if (message == nullptr || length <= 0)
        {
            return "";
        }

        const char *founddelim = static_cast<const char *>(std::memchr(message, delim, length));
        const auto size = (founddelim == nullptr ? length : founddelim - message);
        return std::string(message, size);
    }

    /// Returns the first token of a message.
    inline
    std::string getFirstToken(const char *message, const int length, const char delim)
    {
        return getDelimitedInitialSubstring(message, length, delim);
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
    bool matchPrefix(const std::string& prefix, const std::string& message, const bool ignoreWhitespace)
    {
        if (ignoreWhitespace)
        {
            const auto posPre = prefix.find_first_not_of(' ');
            const auto posMsg = message.find_first_not_of(' ');

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
        return getDelimitedInitialSubstring(message, length, '\n');
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
            return "";
        }

        const auto firstLine = getFirstLine(message, std::min(length, 120));

        // If first line is less than the length (minus newline), add ellipsis.
        if (firstLine.size() < static_cast<std::string::size_type>(length) - 1)
        {
            return firstLine + "...";
        }

        return firstLine;
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
        result << " " << length << " bytes";

        if (length > 0 &&
            ((flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) == Poco::Net::WebSocket::FRAME_OP_TEXT ||
             (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) == Poco::Net::WebSocket::FRAME_OP_BINARY))
            result << ": '" << getAbbreviatedMessage(message, length) << "'";
        return result.str();
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
