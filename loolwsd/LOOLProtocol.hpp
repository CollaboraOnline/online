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
#include <string>

#include <Poco/StringTokenizer.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

namespace LOOLProtocol
{
    // Protocol Version Number.
    // See protocol.txt.
    constexpr unsigned ProtocolMajorVersionNumber = 0;
    constexpr unsigned ProtocolMinorVersionNumber = 1;

    inline
    std::string GetProtocolVersion()
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
                token.find("state") == std::string::npos);
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

    /// Returns an abbereviation of the message (the first line, indicating truncation).
    inline
    std::string getAbbreviatedMessage(const char *message, const int length)
    {
        if (message == nullptr || length <= 0)
        {
            return "";
        }

        const auto firstLine = getFirstLine(message, length);

        // If first line is less than the length (minus newline), add ellipsis.
        if (firstLine.size() < static_cast<std::string::size_type>(length) - 1)
        {
            return firstLine + "...";
        }

        return firstLine;
    }

    inline
    std::string getAbbreviatedMessage(const std::string& message)
    {
        return getAbbreviatedMessage(message.data(), message.size());
    }

    template <typename T>
    std::string getAbbreviatedMessage(const T& message)
    {
        return getAbbreviatedMessage(message.data(), message.size());
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
