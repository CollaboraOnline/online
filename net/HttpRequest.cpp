/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "HttpRequest.hpp"

#include <Poco/MemoryStream.h>
#include <Poco/Net/HTTPResponse.h>

#include <chrono>
#include <cstdint>
#include <fstream>
#include <memory>
#include <sstream>
#include <string>
#include <sys/types.h>
#include <netdb.h>

#include "Common.hpp"
#include <utility>
#include "Log.hpp"
#include "Util.hpp"

namespace http
{
/// Returns true iff the character given is a whitespace.
/// FIXME: Technically, we should skip: SP, HTAB, VT (%x0B),
///         FF (%x0C), or bare CR.
static inline bool isWhitespace(const char ch) { return ch == ' ' || ch == '\t' || ch == '\r'; }

/// Skips over space and tab characters starting at off.
/// Returns the offset of the first match, otherwise, len.
static inline int64_t skipSpaceAndTab(const char* p, int64_t off, int64_t len)
{
    for (; off < len; ++off)
    {
        if (!isWhitespace(p[off]))
            return off;
    }

    return len;
}

static inline int64_t skipCRLF(const char* p, int64_t off, int64_t len)
{
    for (; off < len; ++off)
    {
        if (p[off] != '\r' && p[off] != '\n')
            return off;
    }

    return len;
}

/// Find the line-break.
/// Returns the offset to the first LF character,
/// if found, otherwise, len.
/// Ex.: for [xxxCRLFCRLF] the offset to the second LF is returned.
static inline int64_t findLineBreak(const char* p, int64_t off, int64_t len)
{
    // Find the line break, which ends the status line.
    for (; off < len; ++off)
    {
        // We expect CRLF, but LF alone is enough.
        if (p[off] == '\n')
            return off;
    }

    return len;
}

/// Finds the double CRLF that signifies the end
/// of a block, such as a header. The second CRLF
/// is for a blank line, and that's what we seek.
static inline int64_t findBlankLine(const char* p, int64_t off, int64_t len)
{
    for (; off < len;)
    {
        off = findLineBreak(p, off, len);
        // off is at the first LF, and we expect LFCRLF.
        if (off + 2 >= len)
        {
            return len; // Not found.
        }

        if (p[off + 1] == '\r' && p[off + 2] == '\n')
        {
            return off + 2; // Return the second LF.
        }

        off += 3; // Skip over the mismatch.
    }

    return len;
}

/// Find the end of text.
/// Returns the offset to the first whitespace or
/// line-break character if found, otherwise, len.
static inline int64_t findEndOfToken(const char* p, int64_t off, int64_t len)
{
    for (; off < len; ++off)
    {
        if (isWhitespace(p[off]) || p[off] == '\n')
            return off;
    }

    return len;
}

int64_t Header::parse(const char* p, int64_t len)
{
    LOG_TRC("Reading header given " << len << " bytes: " << std::string(p, std::min(len, 80L)));
    if (len < 4)
    {
        // Incomplete; we need at least \r\n\r\n.
        return 0;
    }

    // Make sure we have the full header before parsing.
    const int64_t endPos = findBlankLine(p, 0, len);
    if (endPos == len)
    {
        return 0; // Incomplete.
    }

    try
    {
        //FIXME: implement http header parser!

        // Now parse to preserve folded headers and other
        // corner cases that is conformant to the rfc,
        // detecting any errors and/or invalid entries.
        // NB: request.read() expects full message and will fail.
        Poco::Net::MessageHeader msgHeader;
        Poco::MemoryInputStream data(p, len);
        msgHeader.read(data);
        if (data.tellg() < 0)
        {
            LOG_DBG("Failed to parse http header.");
            return -1;
        }

        // Copy the header entries over to us.
        for (const auto& pair : msgHeader)
        {
            set(Util::trimmed(pair.first), Util::trimmed(pair.second));
        }

        _chunked = getTransferEncoding() == "chunked";

        LOG_TRC("Read " << data.tellg() << " bytes of header:\n"
                        << std::string(p, data.tellg())
                        << "\nhasContentLength: " << hasContentLength()
                        << ", contentLength: " << (hasContentLength() ? getContentLength() : -1)
                        << ", chunked: " << getChunkedTransferEncoding());

        // We consumed the full header, including the blank line.
        return endPos + 1;
    }
    catch (const Poco::Exception& exc)
    {
        LOG_TRC("ERROR while parsing http header: " << exc.displayText());
    }

    return 0;
}

int64_t Header::getContentLength() const
{
    std::string contentLength = get(CONTENT_LENGTH);
    if (contentLength.empty() || contentLength[0] < '0' || contentLength[0] > '9')
    {
        return -1;
    }

    try
    {
        return std::stoll(contentLength);
    }
    catch (std::out_of_range&)
    {
        return -1;
    }
}

/// Parses a Status Line.
/// Returns the state and clobbers the len on succcess to the number of bytes read.
FieldParseState StatusLine::parse(const char* p, int64_t& len)
{
#ifdef DEBUG_HTTP
    LOG_TRC("StatusLine::parse: " << len << " bytes available\n"
                                  << Util::dumpHex(std::string(p, std::min(len, 10 * 1024L))));
#endif //DEBUG_HTTP

    // First line is the status line.
    if (p == nullptr || len < MinStatusLineLen)
        return FieldParseState::Incomplete;

    int64_t off = skipSpaceAndTab(p, 0, len);
    if (off >= MaxStatusLineLen)
        return FieldParseState::Invalid;

    // We still expect the minimum amount of data.
    if ((len - off) < MinStatusLineLen)
        return FieldParseState::Incomplete;

    // We should have the version now.
    assert(off + VersionLen < len && "Expected to have more data.");
    const char* version = &p[off];
    constexpr int VersionMajPos = sizeof("HTTP/") - 1;
    constexpr int VersionDotPos = VersionMajPos + 1;
    constexpr int VersionMinPos = VersionDotPos + 1;
    constexpr int VersionBreakPos = VersionMinPos + 1; // Whitespace past the version.
    const int versionMaj = version[VersionMajPos] - '0';
    const int versionMin = version[VersionMinPos] - '0';
    // Version may not be null-terminated.
    if (!Util::startsWith(std::string(version, VersionLen), "HTTP/") ||
        (versionMaj < 0 || versionMaj > 9) || version[VersionDotPos] != '.' ||
        (versionMin < 0 || versionMin > 9) || !isWhitespace(version[VersionBreakPos]))
    {
        LOG_ERR("StatusLine::parse: Invalid HTTP version [" << std::string(version, VersionLen)
                                                            << "]");
        return FieldParseState::Invalid;
    }

    _httpVersion = std::string(version, VersionLen);
    _versionMajor = versionMaj;
    _versionMinor = versionMin;

    // Find the Status Code.
    off = skipSpaceAndTab(p, off + VersionLen, len);
    if (off >= MaxStatusLineLen)
        return FieldParseState::Invalid;

    // We still expect the Status Code and CRLF.
    if ((len - off) < (MinStatusLineLen - VersionLen))
        return FieldParseState::Incomplete;

    // Read the Status Code now.
    assert(off + StatusCodeLen < len && "Expected to have more data.");
    if (p[off] < '0' || p[off] > '9')
    {
        LOG_ERR("StatusLine::parse: expected valid integer number");
        return FieldParseState::Invalid;
    }
    _statusCode = Util::safe_atoi(&p[off], len - off);
    if (_statusCode < MinValidStatusCode || _statusCode > MaxValidStatusCode)
    {
        LOG_ERR("StatusLine::parse: Invalid StatusCode [" << _statusCode << "]");
        return FieldParseState::Invalid;
    }

    // Find the Reason Phrase.
    off = skipSpaceAndTab(p, off + StatusCodeLen, len);
    if (off >= MaxStatusLineLen)
    {
        LOG_ERR("StatusLine::parse: StatusCode is too long: " << off);
        return FieldParseState::Invalid;
    }

    const int64_t reasonOff = off;

    // Find the line break, which ends the status line.
    off = findLineBreak(p, off, len);
    if (off >= len)
        return FieldParseState::Incomplete;

    for (; off < len; ++off)
    {
        if (p[off] == '\r' || p[off] == '\n')
            break;

        if (off >= MaxStatusLineLen)
        {
            LOG_ERR("StatusLine::parse: StatusCode is too long: " << off);
            return FieldParseState::Invalid;
        }
    }

    int64_t stringSize = off - reasonOff - 1; // Exclude '\r'.
    if (stringSize < 0)
    {
        LOG_ERR("StatusLine::parse: missing line break");
        return FieldParseState::Invalid;
    }
    _reasonPhrase = std::string(&p[reasonOff], stringSize);

    // Consume the line breaks.
    for (; off < len; ++off)
    {
        if (p[off] != '\r' && p[off] != '\n')
            break;
    }

    len = off;
    return FieldParseState::Valid;
}

int64_t Request::readData(const char* p, const int64_t len)
{
    uint64_t available = len;
    if (_stage == Stage::Header)
    {
        // First line is the status line.
        if (p == nullptr || len < MinRequestHeaderLen)
        {
            LOG_TRC("Request::readData: len < MinRequestHeaderLen");
            return 0;
        }

        // Verb.
        uint64_t off = skipSpaceAndTab(p, 0, available);
        uint64_t end = findEndOfToken(p, off, available);
        if (end == available)
        {
            // Incomplete data.
            return 0;
        }

        _verb = std::string(&p[off], end - off);

        // URL.
        off = skipSpaceAndTab(p, end, available);
        end = findEndOfToken(p, off, available);
        if (end == available)
        {
            // Incomplete data.
            return 0;
        }

        _url = std::string(&p[off], end - off);

        // Version.
        off = skipSpaceAndTab(p, end, available);
        if (off + VersionLen >= available)
        {
            // Incomplete data.
            return 0;
        }

        // We should have the version now.
        assert(off + VersionLen < available && "Expected to have more data.");
        const char* version = &p[off];
        constexpr int VersionMajPos = sizeof("HTTP/") - 1;
        constexpr int VersionDotPos = VersionMajPos + 1;
        constexpr int VersionMinPos = VersionDotPos + 1;
        constexpr int VersionBreakPos = VersionMinPos + 1; // Whitespace past the version.
        const int versionMaj = version[VersionMajPos] - '0';
        const int versionMin = version[VersionMinPos] - '0';
        // Version may not be null-terminated.
        if (!Util::startsWith(std::string(version, VersionLen), "HTTP/") ||
            (versionMaj < 0 || versionMaj > 9) || version[VersionDotPos] != '.' ||
            (versionMin < 0 || versionMin > 9) || !isWhitespace(version[VersionBreakPos]))
        {
            LOG_ERR("Request::dataRead: Invalid HTTP version [" << std::string(version, VersionLen)
                                                                << "]");
            return -1;
        }

        _version = std::string(version, VersionLen);

        off += VersionLen;
        end = findLineBreak(p, off, available);
        if (end >= available)
        {
            // Incomplete data.
            return 0;
        }

        ++end; // Skip the LF character.

        // LOG_TRC("performWrites (header): " << headerStr.size() << ": " << headerStr);
        _stage = Stage::Body;
        p += end;
        available -= end;
    }

    if (_stage == Stage::Body)
    {
        const int64_t read = _header.parse(p, available);
        if (read < 0)
        {
            return read;
        }

        if (read > 0)
        {
            available -= read;
            p += read;

#ifdef DEBUG_HTTP
            LOG_TRC("After Header: "
                    << available << " bytes availble\n"
                    << Util::dumpHex(std::string(p, std::min(available, 1 * 1024L))));
#endif //DEBUG_HTTP
        }

        if (_verb == VERB_GET)
        {
            // A payload in a GET request "has no defined semantics".
            return len - available;
        }
        else
        {
            // TODO: Implement POST and HEAD support.
            LOG_ERR("Unsupported HTTP Method [" << _verb << ']');
            return -1;
        }
    }

    return len - available;
}

/// Handles incoming data.
/// Returns the number of bytes consumed, or -1 for error
/// and/or to interrupt transmission.
int64_t Response::readData(const char* p, int64_t len)
{
    LOG_TRC("readData: " << len << " bytes");

    // We got some data.
    _state = State::Incomplete;

    int64_t available = len;
    if (_parserStage == ParserStage::StatusLine)
    {
        int64_t read = available;
        switch (_statusLine.parse(p, read))
        {
            case FieldParseState::Unknown:
            case FieldParseState::Incomplete:
                return 0;
            case FieldParseState::Invalid:
                return -1;
            case FieldParseState::Valid:
                if (read <= 0)
                    return read; // Unexpected, really.
                if (read > 0)
                {
                    //FIXME: Don't consume what we read until we have our header parser.
                    // available -= read;
                    // p += read;
                    _parserStage = ParserStage::Header;
                }
                break;
        }
    }

    if (_parserStage == ParserStage::Header && available)
    {
        const int64_t read = _header.parse(p, available);
        if (read < 0)
        {
            return read;
        }

        if (read > 0)
        {
            available -= read;
            p += read;

#ifdef DEBUG_HTTP
            LOG_TRC("After Header: "
                    << available << " bytes available\n"
                    << Util::dumpHex(std::string(p, std::min(available, 1 * 1024L))));
#endif //DEBUG_HTTP

            // Assume we have a body unless we have reason to expect otherwise.
            _parserStage = ParserStage::Body;

            if (_statusLine.statusCategory() == StatusLine::StatusCodeClass::Informational
                || _statusLine.statusCode() == 204 /*No Content*/
                || _statusLine.statusCode() == 304 /*Not Modified*/) // || HEAD request
            // || 2xx on CONNECT request
            {
                // No body, we are done.
                _parserStage = ParserStage::Finished;
            }
            else
            {
                // We can possibly have a body.
                if (_statusLine.statusCategory() != StatusLine::StatusCodeClass::Successful)
                {
                    // Failed: Store the body (if any) in memory.
                    saveBodyToMemory();
                }

                if (_header.hasContentLength())
                {
                    if (_header.getContentLength() < 0 || !_header.getTransferEncoding().empty())
                    {
                        // Invalid Content-Length or have Transfer-Encoding too.
                        // 3.3.2.  Content-Length
                        // A sender MUST NOT send a Content-Length header field in any message
                        // that contains a Transfer-Encoding header field.
                        LOG_ERR("Unexpected Content-Length header in response: "
                                << _header.getContentLength()
                                << ", Transfer-Encoding: " << _header.getTransferEncoding());
                        return -1;
                    }
                    else if (_header.getContentLength() == 0)
                        _parserStage = ParserStage::Finished; // No body, we are done.
                }

                if (_parserStage != ParserStage::Finished)
                    _parserStage = ParserStage::Body;
            }
        }
    }

    if (_parserStage == ParserStage::Body && available)
    {
        LOG_TRC("ParserStage::Body: " << available);

        if (_header.getChunkedTransferEncoding())
        {
            // This is a chunked transfer.
            // Find the start of the chunk, which is
            // the length of the chunk in hex.
            // each chunk is preceeded by its length in hex.
            while (available)
            {
#ifdef DEBUG_HTTP
                LOG_TRC("New Chunk, "
                        << available << " bytes available\n"
                        << Util::dumpHex(std::string(p, std::min(available, 10 * 1024L))));
#endif //DEBUG_HTTP

                // Read ahead to see if we have enough data
                // to consume the chunk length.
                int64_t off = findLineBreak(p, 0, available);
                if (off == available)
                {
                    LOG_TRC("Not enough data for chunk size");
                    // Not enough data.
                    return len - available; // Don't remove.
                }

                ++off; // Skip the LF itself.

                // Read the chunk length.
                int64_t chunkLen = 0;
                int chunkLenSize = 0;
                for (; chunkLenSize < available; ++chunkLenSize)
                {
                    const int digit = Util::hexDigitFromChar(p[chunkLenSize]);
                    if (digit < 0)
                        break;

                    if (chunkLen >= (std::numeric_limits<int64_t>::max() - digit) / 16)
                    {
                        // Would not fit into chunkLen.
                        return len - available;
                    }
                    chunkLen = chunkLen * 16 + digit;
                }

                LOG_TRC("ChunkLen: " << chunkLen);
                if (chunkLen > 0)
                {
                    // Do we have enough data for this chunk?
                    if (available - off < chunkLen + 2) // + CRLF.
                    {
                        // Not enough data.
                        LOG_TRC("Not enough chunk data. Need " << chunkLen + 2 << " but have only "
                                                               << available - off);
                        return len - available; // Don't remove.
                    }

                    // Skip the chunkLen bytes and any chunk extensions.
                    available -= off;
                    p += off;

                    const int64_t read = _onBodyWriteCb(p, chunkLen);
                    if (read != chunkLen)
                    {
                        LOG_ERR("Error writing http response payload. Write "
                                "handler returned "
                                << read << " instead of " << chunkLen);
                        return -1;
                    }

                    available -= chunkLen;
                    p += chunkLen;
                    _recvBodySize += chunkLen;
                    LOG_TRC("Wrote " << chunkLen << " bytes for a total of " << _recvBodySize);

                    // Skip blank lines.
                    off = skipCRLF(p, 0, available);
                    p += off;
                    available -= off;
                }
                else
                {
                    // That was the last chunk!
                    _parserStage = ParserStage::Finished;
                    available = 0; // Consume all.
                    LOG_TRC("Got LastChunk, finished.");
                    break;
                }
            }
        }
        else
        {
            // Non-chunked payload.
            // Write the body into the output, returns the
            // number of bytes read from the given buffer.
            const int64_t wrote = _onBodyWriteCb(p, available);
            if (wrote < 0)
            {
                LOG_ERR("Error writing http response payload. Write handler returned "
                        << wrote << " instead of " << available);
                return wrote;
            }

            if (wrote > 0)
            {
                available -= wrote;
                _recvBodySize += wrote;
                if (_header.hasContentLength() && _recvBodySize >= _header.getContentLength())
                {
                    LOG_TRC("Wrote all content, finished.");
                    _parserStage = ParserStage::Finished;
                }
            }
        }
    }

    if (_parserStage == ParserStage::Finished)
    {
        complete();
    }

    LOG_TRC("Done consuming response, had " << len << " bytes, consumed " << len - available
                                            << " leaving " << available << " unused.");
    return len - available;
}

std::shared_ptr<Session> Session::create(std::string host, Protocol protocol, int port)
{
    std::string scheme;
    std::string hostname;
    std::string portString;
    if (!net::parseUri(host, scheme, hostname, portString))
    {
        LOG_ERR("Invalid URI [" << host << "] to http::Session::create.");
        return nullptr;
    }

    scheme = Util::toLower(std::move(scheme));
    if (!scheme.empty())
    {
        switch (protocol)
        {
            case Protocol::HttpUnencrypted:
                assert((scheme == "http://" || scheme == "ws://")
                       && "createHttp has a conflicting scheme.");
                break;
            case Protocol::HttpSsl:
                assert((scheme == "https://" || scheme == "wss://")
                       && "createHttp has a conflicting scheme.");
                break;
        }
    }

    if (!hostname.empty())
        host.swap(hostname);

    if (!portString.empty())
    {
        const int portInt = std::stoi(portString);
        assert((port == 0 || port == portInt) && "Two conflicting port numbers given.");
        if (portInt > 0)
            port = portInt;
    }

    port = (port > 0 ? port : getDefaultPort(protocol));
    return std::shared_ptr<Session>(new Session(std::move(host), protocol, port));
}

} // namespace http

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
