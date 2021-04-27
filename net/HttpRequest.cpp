/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

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
/// Skips over space and tab characters starting at off.
/// Returns the offset of the first match, otherwise, len.
/// FIXME: Technically, we should skip: SP, HTAB, VT (%x0B),
///         FF (%x0C), or bare CR.
static inline int64_t skipSpaceAndTab(const char* p, int64_t off, int64_t len)
{
    for (; off < len; ++off)
    {
        if (p[off] != ' ' && p[off] != '\t')
            return off;
    }

    return len;
}

static inline int64_t skipCRLF(const char* p, int64_t len, int64_t off = 0)
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
static inline int64_t findLineBreak(const char* p, int64_t len, int64_t off = 0)
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

int64_t Header::parse(const char* p, int64_t len)
{
    LOG_TRC("Reading header given " << len << " bytes: " << std::string(p, std::min(len, 80L)));
    try
    {
        //FIXME: implement http header parser!
        Poco::MemoryInputStream data(p, len);
        Poco::Net::HTTPResponse response;
        response.read(data);

        // Copy the header entries over to us.
        for (const auto& pair : response)
        {
            set(pair.first, pair.second);
        }

        if (response.hasContentLength())
            setContentLength(response.getContentLength());
        setContentType(response.getContentType());
        _chunked = response.getChunkedTransferEncoding();

        LOG_TRC("Read " << data.tellg() << " bytes of header:\n"
                        << std::string(p, data.tellg())
                        << "\nhasContentLength: " << hasContentLength()
                        << ", contentLength: " << (hasContentLength() ? getContentLength() : -1)
                        << ", chunked: " << getChunkedTransferEncoding());
        return data.tellg();
    }
    catch (const Poco::Exception& exc)
    {
        LOG_TRC("ERROR: " << exc.displayText());
    }

    return 0;
}

/// Parses a Status Line.
/// Returns the state and clobbers the len on succcess to the number of bytes read.
FieldParseState StatusLine::parse(const char* p, int64_t& len)
{
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
    const int versionMaj = version[VersionMajPos] - '0';
    const int versionMin = version[VersionMinPos] - '0';
    // Version may not be null-terminated.
    if (!Util::startsWith(std::string(version, VersionLen), "HTTP/") || (versionMaj < 0 || versionMaj > 9)
        || version[VersionDotPos] != '.' || (versionMin < 0 || versionMin > 9))
    {
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
    _statusCode = std::atoi(&p[off]);
    if (_statusCode < MinValidStatusCode || _statusCode > MaxValidStatusCode)
        return FieldParseState::Invalid;

    // Find the Reason Phrase.
    off = skipSpaceAndTab(p, off + StatusCodeLen, len);
    if (off >= MaxStatusLineLen)
        return FieldParseState::Invalid;

    const int64_t reasonOff = off;

    // Find the line break, which ends the status line.
    for (; off < len; ++off)
    {
        if (p[off] == '\r' || p[off] == '\n')
            break;

        if (off >= MaxStatusLineLen)
            return FieldParseState::Invalid;
    }

    if (off >= len)
        return FieldParseState::Incomplete;

    _reasonPhrase = std::string(&p[reasonOff], off - reasonOff);

    // Consume the line breaks.
    for (; off < len; ++off)
    {
        if (p[off] != '\r' && p[off] != '\n')
            break;
    }

    len = off;
    return FieldParseState::Valid;
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
            case FieldParseState::Complete:
            case FieldParseState::Incomplete:
                return 0;
            case FieldParseState::Invalid:
                _state = State::Error;
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
            _state = State::Error;
            return read;
        }

        if (read > 0)
        {
            available -= read;
            p += read;

            std::ostringstream oss;
            Util::dumpHex(oss, "", "", std::string(p, std::min(available, 1 * 1024L)));
            LOG_TRC("After Header: " << available << " bytes availble\n" << oss.str());

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
                        _state = State::Error;
                        _parserStage = ParserStage::Finished;
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
                std::ostringstream oss;
                Util::dumpHex(oss, "", "", std::string(p, std::min(available, 10 * 1024L)));
                LOG_TRC("New Chunk, " << available << " bytes availble\n" << oss.str());

                // Read ahead to see if we have enough data
                // to consume the chunk length.
                int64_t off = findLineBreak(p, available);
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
                        _state = State::Error;
                        return -1;
                    }

                    available -= chunkLen;
                    p += chunkLen;
                    _recvBodySize += chunkLen;
                    LOG_TRC("Wrote " << chunkLen << " bytes for a total of " << _recvBodySize);

                    // Skip blank lines.
                    off = skipCRLF(p, available);
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
            const int64_t read = _onBodyWriteCb(p, available);
            if (read < 0)
            {
                LOG_ERR("Error writing http response payload. Write handler returned "
                        << read << " instead of " << available);
                _state = State::Error;
                return read;
            }

            if (read > 0)
            {
                available -= read;
                _recvBodySize += read;
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

} // namespace http

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
