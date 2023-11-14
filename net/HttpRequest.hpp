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

#include <config_version.h>

#include <fcntl.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/stat.h>

#include <chrono>
#include <cstdint>
#include <iostream>
#include <fstream>
#include <memory>
#include <sstream>
#include <string>
#include <netdb.h>

#include <Common.hpp>
#include <common/StateEnum.hpp>
#include <NetUtil.hpp>
#include <net/Socket.hpp>
#include <utility>
#if ENABLE_SSL
#include <net/SslSocket.hpp>
#endif
#include "Log.hpp"
#include "Util.hpp"

#ifndef APP_NAME
static_assert(false, "config.h must be included in the .cpp being compiled");
#endif

// This is a partial implementation of RFC 7230
// and its related RFCs, with focus on the core
// HTTP/1.1 messaging of GET and POST requests.
//
// There is no attempt to support all possible
// features of the RFC. However, we do attempt
// to be maximally compatible and accommodating
// to server and client implementations in the
// wild. This code is designed to work primarily
// on the client side, with provision for being
// on the server side as well.
//
// Design Principles:
// -----------------
//
// The goal here is primarily to have an async
// HTTP implementation that is performant.
// To that end, the design is modular and with
// well-defined state-machine for each component.
// To support async requests, an instance of
// SocketPoll is associated with http::Session,
// and events are triggered via callbacks.
// Clients interested in acting on the results
// of their http::Request should register
// callbacks and implement the necessary
// continuation logic. For working examples
// see HttpRequestTests.cpp.
//
// Code Structure:
// ---------------
//
// http::Session is the primary class that is
// used for all requests. It is created for a
// specific host. Because http::Session is
// designed to be reusable, the connection itself
// can also be reused, improving efficiency.
//
// An http::Session takes an http::Request and,
// only after initiating a new request, access
// to the current/last request's response is
// accessible via http::Session::response().
//
// To make a request, an http::Request is created
// with a given URL and any necessary header
// entries are set via the http::Header member.
// A request is made by simply passing an
// http::Request instance to an http::Session
// instance's asyncRequest (or syncRequest).
//
// http::Response is the server's response.
// It communicates the readiness of the response
// via a well-defined set of states, which
// can be introspected at any time.
// http::Response::done() returns true when the
// request is completed, regardless of the
// outcome, which must be checked via the
// http::Response::state() member.
//
// A timeout can be set on the http::Session
// instance, which, when hit, will disconnect
// and fire the onFinished handler. The client
// should introspect the state of the
// http::Response, which is reached via the
// http::Session argument's response() member.
//
// To upload or download files, convenient
// API exists.
// To upload a file via POST, http::Request
// supports setting the file path via
// setBodyFile(), or setBodySource() which is
// a generic callback to provide the payload
// data to upload, whereupon the file contents
// will be set in the body of the POST request
// message.
// To download a file via GET, http::Response
// has saveBodyToFile() member that accepts
// a path to file where the response body
// is stored. Similarly, saveBodyToMemory will
// store the body as a string to be retrieved
// via getBody(). saveBodyToHandler() is
// also provided as a generic handler.
// Note that when the response status code
// is anything but success (i.e. not 200 status
// code), the body is instead stored in memory
// to be read via getBody(). The state of
// the http::Response will indicate success
// or failure.
// Incidentally, http::Response exposes the
// response status line via statusLine(),
// which contains the status code, reason,
// and a convenient status category.
//
// Finally, if a synchronous request is needed,
// http::Session provides syncRequest that
// blocks until the request completes. However,
// the onFinished callback is still triggered
// as expected and all other APIs behave as
// with the async case. Indeed, internally
// the async logic is used, which
// guarantees consistency.

namespace http
{
/// The parse-state of a field.
STATE_ENUM(FieldParseState,
           Unknown, //< Not yet parsed.
           Incomplete, //< Not enough data to parse this field. Need more data.
           Invalid, //< The field is invalid/unexpected/long.
           Valid //< The field is both complete and valid.
);

/// Named HTTP Status Codes.
/// See https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
enum class StatusCode : unsigned
{
    // Informational
    Continue = 100,
    SwitchingProtocols = 101,
    Processing = 102, // RFC 2518 (WebDAV)
    EarlyHints = 103, // RFC 8297

    // Successful
    OK = 200,
    Created = 201,
    Accepted = 202,
    NonAuthoritativeInformation = 203,
    NoContent = 204,
    ResetContent = 205,
    PartialContent = 206,
    MultiStatus = 207, // RFC 4918 (WebDAV)
    AlreadyReported = 208, // RFC 5842 (WebDAV)
    IMUsed = 226, // RFC 3229

    // Redirection
    MultipleChoices = 300,
    MovedPermanently = 301,
    Found = 302,
    SeeOther = 303,
    NotModified = 304,
    UseProxy = 305,
    // Unused: 306
    TemporaryRedirect = 307,
    PermanentRedirect = 308,

    // Client Error
    BadRequest = 400,
    Unauthorized = 401,
    PaymentRequired = 402,
    Forbidden = 403,
    NotFound = 404,
    MethodNotAllowed = 405,
    NotAcceptable = 406,
    ProxyAuthenticationRequired = 407,
    RequestTimeout = 408,
    Conflict = 409,
    Gone = 410,
    LengthRequired = 411,
    PreconditionFailed = 412,
    PayloadTooLarge = 413, // Previously called "Request Entity Too Large"
    URITooLong = 414, // Previously called "Request-URI Too Long"
    UnsupportedMediaType = 415,
    RangeNotSatisfiable = 416, // Previously called "Requested Range Not Satisfiable"
    ExpectationFailed = 417,
    ImATeapot = 418, // RFC 2324, RFC 7168 (April's fool)
    MisdirectedRequest = 421, // RFC 7540
    UnprocessableEntity = 422, // RFC 4918 (WebDAV)
    Locked = 423, // RFC 4918 (WebDAV)
    FailedDependency = 424, // RFC 4918 (WebDAV)
    TooEarly = 425, // RFC 8470
    UpgradeRequired = 426,
    PreconditionRequired = 428, // RFC 6585
    TooManyRequests = 429, // RFC 6585
    RequestHeaderFieldsTooLarge = 431, // RFC 6585
    LoginTimeout = 440, // IIS
    RetryWith = 449, // IIS
    UnavailableForLegalReasons = 451, // RFC 7725 and IIS Redirect

    // Server Error
    InternalServerError = 500,
    NotImplemented = 501,
    BadGateway = 502,
    ServiceUnavailable = 503,
    GatewayTimeout = 504,
    HTTPVersionNotSupported = 505,
    InsufficientStorage = 507, // RFC 4918 (WebDAV)
    LoopDetected = 508, // RFC 5842 (WebDAV)
    NotExtended = 510, // RFC 2774
    NetworkAuthenticationRequired = 511, // RFC 6585
};

/// Returns the Reason Phrase for a given HTTP Status Code.
/// If not defined, "Unknown" is returned.
/// The Reason Phrase is informational only, but it helps
/// to use the canonical one for consistency.
/// See https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
static inline const char* getReasonPhraseForCode(int code)
{
#define CASE(C, R)                                                                                 \
    case C:                                                                                        \
        return R;
    switch (code)
    {
        // Informational
        CASE(100, "Continue");
        CASE(101, "Switching Protocols");
        CASE(102, "Processing"); // RFC 2518 (WebDAV)
        CASE(103, "Early Hints"); // RFC 8297

        // Successful
        CASE(200, "OK");
        CASE(201, "Created");
        CASE(202, "Accepted");
        CASE(203, "Non Authoritative Information");
        CASE(204, "No Content");
        CASE(205, "Reset Content");
        CASE(206, "Partial Content");
        CASE(207, "Multi Status"); // RFC 4918 (WebDAV)
        CASE(208, "Already Reported"); // RFC 5842 (WebDAV)
        CASE(226, "IM Used"); // RFC 3229

        // Redirection
        CASE(300, "Multiple Choices");
        CASE(301, "Moved Permanently");
        CASE(302, "Found");
        CASE(303, "See Other");
        CASE(304, "Not Modified");
        CASE(305, "Use Proxy");
        CASE(307, "Temporary Redirect");

        // Client Error
        CASE(400, "Bad Request");
        CASE(401, "Unauthorized");
        CASE(402, "Payment Required");
        CASE(403, "Forbidden");
        CASE(404, "Not Found");
        CASE(405, "Method Not Allowed");
        CASE(406, "Not Acceptable");
        CASE(407, "Proxy Authentication Required");
        CASE(408, "Request Timeout");
        CASE(409, "Conflict");
        CASE(410, "Gone");
        CASE(411, "Length Required");
        CASE(412, "Precondition Failed");
        CASE(413, "Payload Too Large"); // Previously called "Request Entity Too Large"
        CASE(414, "URI Too Long"); // Previously called "Request-URI Too Long"
        CASE(415, "Unsupported Media Type");
        CASE(416, "Range Not Satisfiable"); // Previously called "Requested Range Not Satisfiable"
        CASE(417, "Expectation Failed");
        CASE(418, "I'm A Teapot"); // RFC 2324, RFC 7168 (April's fool)
        CASE(421, "Misdirected Request"); // RFC 7540
        CASE(422, "Unprocessable Entity"); // RFC 4918 (WebDAV)
        CASE(423, "Locked"); // RFC 4918 (WebDAV)
        CASE(424, "Failed Dependency"); // RFC 4918 (WebDAV)
        CASE(425, "Too Early"); // RFC 8470
        CASE(426, "Upgrade Required");
        CASE(428, "Precondition Required"); // RFC 6585
        CASE(429, "Too Many Requests"); // RFC 6585
        CASE(431, "Request Header Fields Too Large"); // RFC 6585
        CASE(440, "Login Time-out"); // IIS
        CASE(449, "Retry With"); // IIS
        CASE(451, "Unavailable For Legal Reasons"); // RFC 7725 and IIS Redirect

        // Server Error
        CASE(500, "Internal Server Error");
        CASE(501, "Not Implemented");
        CASE(502, "Bad Gateway");
        CASE(503, "Service Unavailable");
        CASE(504, "Gateway Timeout");
        CASE(505, "HTTP Version Not Supported");
        CASE(507, "Insufficient Storage"); // RFC 4918 (WebDAV)
        CASE(508, "Loop Detected"); // RFC 5842 (WebDAV)
        CASE(510, "Not Extended"); // RFC 2774
        CASE(511, "Network Authentication Required"); // RFC 6585
    }
#undef CASE

    return "Unknown";
}

static inline const char* getReasonPhraseForCode(StatusCode statusCode)
{
    return getReasonPhraseForCode(static_cast<unsigned>(statusCode));
}

/// The callback signature for handling IO writes.
/// Returns the number of bytes read from the buffer,
/// -1 for error (terminates the transfer).
/// The second argument is the data size in the buffer.
using IoWriteFunc = std::function<int64_t(const char*, int64_t)>;

/// The callback signature for handling IO reads.
/// Returns the number of bytes written to the buffer,
/// 0 when no more data is left to read,
/// -1 for error (terminates the transfer).
/// The second argument is the buffer size.
using IoReadFunc = std::function<int64_t(char*, int64_t)>;

/// HTTP Header.
class Header
{
public:
    static constexpr const char* CONTENT_TYPE = "Content-Type";
    static constexpr const char* CONTENT_LENGTH = "Content-Length";
    static constexpr const char* TRANSFER_ENCODING = "Transfer-Encoding";
    static constexpr const char* COOKIE = "Cookie";

    static constexpr int64_t MaxNumberFields = 128; // Arbitrary large number.
    static constexpr int64_t MaxNameLen = 512;
    static constexpr int64_t MaxValueLen = 9 * 1024; // 8000 bytes recommended by rfc.
    static constexpr int64_t MaxFieldLen = MaxNameLen + MaxValueLen;
    static constexpr int64_t MaxHeaderLen = MaxNumberFields * MaxFieldLen; // ~1.18 MB.

    /// Describes the header state during parsing.
    STATE_ENUM(State, New,
               Incomplete, //< Haven't reached the end yet.
               InvalidField, //< Too long, no colon, etc.
               TooManyFields, //< Too many fields to accept.
               Complete //< Header is complete and valid.
    );

    using Container = std::vector<std::pair<std::string, std::string>>;
    using ConstIterator = std::vector<std::pair<std::string, std::string>>::const_iterator;

    ConstIterator begin() const { return _headers.begin(); }
    ConstIterator end() const { return _headers.end(); }

    /// Parse the given data as an HTTP header.
    /// Returns the number of bytes consumed (and must be removed from the input).
    int64_t parse(const char* p, int64_t len);

    /// Add an HTTP header field.
    void add(std::string key, std::string value)
    {
        _headers.emplace_back(std::move(key), std::move(value));
    }

    /// Set an HTTP header field, replacing an earlier value, if exists.
    void set(const std::string& key, std::string value)
    {
        for (auto& pair : _headers)
        {
            if (pair.first == key)
            {
                pair.second.swap(value);
                return;
            }
        }

        _headers.emplace_back(key, std::move(value));
    }

    bool has(const std::string& key) const
    {
        for (const auto& pair : _headers)
        {
            if (Util::iequal(pair.first, key))
                return true;
        }

        return false;
    }

    /// Get a header entry value by key, if found, defaulting to @def, if missing.
    std::string get(const std::string& key, const std::string& def = std::string()) const
    {
        // There are typically half a dozen header
        // entries, rarely much more. A map would
        // probably not be faster but would add complexity.
        for (const auto& pair : _headers)
        {
            if (Util::iequal(pair.first, key))
                return pair.second;
        }

        return def;
    }

    /// Set the Content-Type header.
    void setContentType(std::string type) { set(CONTENT_TYPE, std::move(type)); }
    /// Get the Content-Type header.
    std::string getContentType() const { return get(CONTENT_TYPE); }
    /// Returns true iff a Content-Type header exists.
    bool hasContentType() const { return has(CONTENT_TYPE); }

    /// Set the Content-Length header.
    void setContentLength(int64_t length) { set(CONTENT_LENGTH, std::to_string(length)); }
    /// Get the Content-Length header.
    int64_t getContentLength() const;
    /// Returns true iff a Content-Length header exists.
    bool hasContentLength() const { return has(CONTENT_LENGTH); }

    /// Get the Transfer-Encoding header, if any.
    std::string getTransferEncoding() const { return get(TRANSFER_ENCODING); }

    /// Return true iff Transfer-Encoding is set to chunked (the last entry).
    bool getChunkedTransferEncoding() const { return _chunked; }

    /// Adds a new "Cookie" header entry with the given cookies.
    void addCookies(const Container& pairs)
    {
        std::string s;
        s.reserve(256);
        for (const auto& pair : pairs)
        {
            if (!s.empty())
                s += "; ";
            s += pair.first;
            s += '=';
            s += pair.second;
        }

        add(COOKIE, s);
    }

    /// Gets the name=value pairs of all "Cookie" header entries.
    Container getCookies() const
    {
        Container cookies;
        //FIXME: IMPLEMENT!!
        // for (const auto& pair : _headers)
        // {
        // }

        return cookies;
    }

    bool writeData(Buffer& out) const
    {
        // Note: we don't add the end-of-header '\r\n'
        // to allow for manually extending the headers.
        for (const auto& pair : _headers)
        {
            out.append(pair.first);
            out.append(": ");
            out.append(pair.second);
            out.append("\r\n");
        }

        return true;
    }

    /// Serialize the header to an output stream.
    template <typename T> T& serialize(T& os) const
    {
        // Note: we don't add the end-of-header '\r\n'.
        for (const auto& pair : _headers)
        {
            os << pair.first << ": " << pair.second << "\r\n";
        }

        return os;
    }

    /// Serialize the header to string. For logging only.
    std::string toString() const
    {
        std::ostringstream oss;
        return serialize(oss).str();
    }

private:
    /// The headers are ordered key/value pairs.
    /// This isn't designed for lookup performance, but to preserve order.
    //TODO: We might not need this and get away with a map.
    Container _headers;
    bool _chunked = false;
};

/// An HTTP Request made over Session.
class Request final
{
public:
    static constexpr int64_t VersionLen = 8;
    static constexpr int64_t MinRequestHeaderLen = sizeof("GET / HTTP/0.0\r\n") - 1;
    static constexpr const char* VERB_GET = "GET";
    static constexpr const char* VERB_POST = "POST";
    static constexpr const char* VERS_1_1 = "HTTP/1.1";

    /// The stages of processing the request.
    STATE_ENUM(Stage,
               Header, //< Communicate the header.
               Body, //< Communicate the body (if any).
               Finished //< Done.
    );

    /// Create a Request given a @url, http @verb, @header, and http @version.
    /// All are optional, since they can be overwritten later.
    explicit Request(std::string url = "/", std::string verb = VERB_GET, Header headerObj = Header(),
                     std::string version = VERS_1_1)
        : _header(std::move(headerObj))
        , _url(std::move(url))
        , _verb(std::move(verb))
        , _version(std::move(version))
        , _bodyReaderCb([](const char*, int64_t) { return 0; })
        , _stage(Stage::Header)
    {
    }

    /// Set the request URL.
    void setUrl(const std::string& url) { _url = url; }
    /// Get the request URL.
    const std::string& getUrl() const { return _url; }

    /// Set the request verb (typically GET or POST).
    void setVerb(const std::string& verb) { _verb = verb; }
    /// Get the request verb.
    const std::string& getVerb() const { return _verb; }

    /// Set the protocol version (typically HTTP/1.1).
    void setVersion(const std::string& version) { _version = version; }
    /// Get the protocol version.
    const std::string& getVersion() const { return _version; }

    /// The header object to populate.
    /// Deprecated: Use set and add directly.
    Header& header() { return _header; }
    const Header& header() const { return _header; }

    /// Add an HTTP header field.
    void add(std::string key, std::string value) { _header.add(std::move(key), std::move(value)); }

    /// Set an HTTP header field, replacing an earlier value, if exists.
    void set(const std::string& key, std::string value) { _header.set(key, std::move(value)); }

    /// Get a header entry value by key, if found, defaulting to @def, if missing.
    std::string get(const std::string& key, const std::string& def = std::string()) const
    {
        return _header.get(key, def);
    }

    /// Set the request body source to upload some data. Meaningful for POST.
    /// Size is needed to set the Content-Length.
    void setBodySource(IoReadFunc bodyReaderCb, int64_t size)
    {
        _header.setContentLength(size);
        _bodyReaderCb = std::move(bodyReaderCb);
    }

    /// Set the file to send as the body of the request.
    void setBodyFile(const std::string& path)
    {
        auto ifs = std::make_shared<std::ifstream>(path, std::ios::binary);

        ifs->seekg(0, std::ios_base::end);
        const int64_t size = ifs->tellg();
        ifs->seekg(0, std::ios_base::beg);

        setBodySource(
            [ ifs=std::move(ifs) ](char* buf, int64_t len) -> int64_t
            {
                ifs->read(buf, len);
                return ifs->gcount();
            },
            size);
    }

    void setBody(const std::string& body, std::string contentType = "text/html charset=UTF-8")
    {
        if (!body.empty()) // Type is only meaningful if there is a body.
            _header.setContentType(std::move(contentType));

        auto iss = std::make_shared<std::istringstream>(body, std::ios::binary);

        setBodySource(
            [ iss=std::move(iss) ](char* buf, int64_t len) -> int64_t
            {
                iss->read(buf, len);
                return iss->gcount();
            },
            body.size());
    }

    Stage stage() const { return _stage; }

    bool writeData(Buffer& out, std::size_t capacity)
    {
        const std::size_t buffered_size = out.size();
        if (_stage == Stage::Header)
        {
            LOG_TRC("performWrites (request header)");

            out.append(getVerb());
            out.append(" ");
            out.append(getUrl());
            out.append(" ");
            out.append(getVersion());
            out.append("\r\n");

            _header.writeData(out);
            out.append("\r\n"); // End the header.

            _stage = Stage::Body;
        }

        if (_stage == Stage::Body)
        {
            LOG_TRC("performWrites (request body)");

            // Get the data to write into the socket
            // from the client's callback. This is
            // used to upload files, or other data.
            char buffer[64 * 1024];
            std::size_t wrote = 0;
            do
            {
                const int64_t read = _bodyReaderCb(buffer, sizeof(buffer));
                if (read < 0)
                {
                    LOG_ERR("Error reading the data to send as the HTTP request body: " << read);
                    return false;
                }

                if (read == 0)
                {
                    LOG_TRC("performWrites (request body): finished, total: " << out.size() -
                                                                                     buffered_size);
                    _stage = Stage::Finished;
                    break;
                }

                out.append(buffer, read);
                wrote += read;
                LOG_TRC("performWrites (request body): " << read << " bytes, total: "
                                                         << out.size() - buffered_size);
            } while (wrote < capacity);
        }

#ifdef DEBUG_HTTP
        LOG_TRC("Request::writeData: " << buffered_size << " bytes buffered\n"
                                       << Util::dumpHex(out));
#endif //DEBUG_HTTP

        return true;
    }

    /// Handles incoming data.
    /// Returns the number of bytes consumed, or -1 for error
    /// and/or to interrupt transmission.
    int64_t readData(const char* p, int64_t len);

private:
    Header _header;
    std::string _url; //< The URL to request, without hostname.
    std::string _verb; //< Used as-is, but only POST supported.
    std::string _version; //< The protocol version, currently 1.1.
    IoReadFunc _bodyReaderCb;
    Stage _stage;
};

/// HTTP Status Line is the first line of a response sent by a server.
class StatusLine
{
public:
    static constexpr int64_t VersionLen = 8;
    static constexpr int64_t StatusCodeLen = 3;
    static constexpr int64_t MaxReasonPhraseLen = 512; // Arbitrary large number.
    static constexpr int64_t MinStatusLineLen =
        sizeof("HTTP/0.0 000\r\n") - 1; // Reason phrase is optional.
    static constexpr int64_t MaxStatusLineLen = VersionLen + StatusCodeLen + MaxReasonPhraseLen;
    static constexpr int64_t MinValidStatusCode = 100;
    static constexpr int64_t MaxValidStatusCode = 599;

    static constexpr const char* HTTP_1_1 = "HTTP/1.1";
    static constexpr const char* OK = "OK";

    /// Construct an invalid StatusLine, used for parsing.
    StatusLine()
        : _versionMajor(1)
        , _versionMinor(1)
        , _statusCode(0)
    {
    }

    /// Construct a StatusLine with a given code and
    /// the default protocol version.
    StatusLine(unsigned statusCodeNumber)
        : _httpVersion(HTTP_1_1)
        , _versionMajor(1)
        , _versionMinor(1)
        , _statusCode(statusCodeNumber)
        , _reasonPhrase(getReasonPhraseForCode(statusCodeNumber))
    {
    }

    StatusLine(StatusCode statusCode)
        : StatusLine(static_cast<unsigned>(statusCode))
    {
    }

    /// The Status Code class of the response.
    /// None of these implies complete receipt of the response.
    STATE_ENUM(StatusCodeClass,
               Invalid, //< Not a valid Status Code.
               Informational, //< Request being processed, not final response.
               Successful, //< Successfully processed request, response on the way.
               Redirection, //< Redirected to a different resource.
               Client_Error, //< Bad request, cannot respond.
               Server_Error //< Bad server, cannot respond.
    );

    StatusCodeClass statusCategory() const
    {
        if (_statusCode >= 500 && _statusCode < 600)
            return StatusCodeClass::Server_Error;
        if (_statusCode >= 400)
            return StatusCodeClass::Client_Error;
        if (_statusCode >= 300)
            return StatusCodeClass::Redirection;
        if (_statusCode >= 200)
            return StatusCodeClass::Successful;
        if (_statusCode >= 100)
            return StatusCodeClass::Informational;
        return StatusCodeClass::Invalid;
    }

    /// Parses a Status Line.
    /// Returns the state and clobbers the len on succcess to the number of bytes read.
    FieldParseState parse(const char* p, int64_t& len);

    bool writeData(Buffer& out) const
    {
        out.append(_httpVersion);
        out.append(" ");
        out.append(std::to_string(_statusCode));
        out.append(" ");
        out.append(_reasonPhrase);
        out.append("\r\n");
        return true;
    }

    const std::string& httpVersion() const { return _httpVersion; }
    unsigned versionMajor() const { return _versionMajor; }
    unsigned versionMinor() const { return _versionMinor; }
    StatusCode statusCode() const { return static_cast<StatusCode>(_statusCode); }
    const std::string& reasonPhrase() const { return _reasonPhrase; }

private:
    std::string _httpVersion; //< Typically "HTTP/1.1"
    unsigned _versionMajor; //< The first version digit (typically 1).
    unsigned _versionMinor; //< The second version digit (typically 1).
    unsigned _statusCode;
    std::string _reasonPhrase; //< A client SHOULD ignore the reason-phrase content.
};

/// The response for an HTTP request.
class Response final
{
public:
    using FinishedCallback = std::function<void()>;

    /// A response received from a server.
    /// Used for parsing an incoming response.
    explicit Response(FinishedCallback finishedCallback, int fd = -1)
        : _state(State::New)
        , _parserStage(ParserStage::StatusLine)
        , _recvBodySize(0)
        , _finishedCallback(std::move(finishedCallback))
        , _fd(fd)
    {
        // By default we store the body in memory.
        saveBodyToMemory();
    }

    /// A response received from a server.
    /// Used for parsing an incoming response.
    Response()
        : Response(nullptr)
    {
    }

    /// A response sent from a server.
    /// Used for generating an outgoing response.
    explicit Response(StatusLine statusLineObj, int fd = -1)
        : _statusLine(std::move(statusLineObj))
        , _state(State::New)
        , _parserStage(ParserStage::StatusLine)
        , _recvBodySize(0)
        , _fd(fd)
    {
        _header.add("Date", Util::getHttpTimeNow());
        _header.add("Server", HTTP_SERVER_STRING);
    }

    /// A response sent from a server.
    /// Used for generating an outgoing response.
    explicit Response(StatusCode statusCode, int fd = -1)
        : Response(StatusLine(statusCode), fd)
    {
    }

    /// The state of an incoming response, when parsing.
    STATE_ENUM(State,
               New, //< Valid but meaningless.
               Incomplete, //< In progress, no errors.
               Error, //< This is for protocol errors, not 400 and 500 reponses.
               Timeout, //< The request has exceeded the time allocated.
               Complete //< Successfully completed (does *not* imply 200 OK).
    );

    /// The state of the Response (for the server's response use statusLine).
    State state() const { return _state; }

    /// Returns true iff there is no more data to expect and the state is final.
    bool done() const
    {
        return (_state == State::Error || _state == State::Timeout || _state == State::Complete);
    }

    const StatusLine& statusLine() const { return _statusLine; }

    const Header& header() const { return _header; }

    /// Add an HTTP header field.
    void add(std::string key, std::string value) { _header.add(std::move(key), std::move(value)); }

    /// Set an HTTP header field, replacing an earlier value, if exists.
    void set(const std::string& key, std::string value) { _header.set(key, std::move(value)); }

    /// Set the Content-Type header.
    void setContentType(std::string type) { _header.setContentType(std::move(type)); }

    /// Set the Content-Length header.
    void setContentLength(int64_t length) { _header.setContentLength(length); }

    /// Get a header entry value by key, if found, defaulting to @def, if missing.
    std::string get(const std::string& key, const std::string& def = std::string()) const
    {
        return _header.get(key, def);
    }

    /// Redirect the response body, if any, to a file.
    /// If the server responds with a non-success status code (i.e. not 2xx)
    /// the body is redirected to memory to be read via getBody().
    /// Check the statusLine().statusCategory() for the status code.
    void saveBodyToFile(const std::string& path)
    {
        _bodyFile.open(path, std::ios_base::out | std::ios_base::binary);
        _onBodyWriteCb = [this](const char* p, int64_t len)
        {
            LOG_TRC("Writing " << len << " bytes");
            if (_bodyFile.good())
                _bodyFile.write(p, len);
            return _bodyFile.good() ? len : -1;
        };
    }

    /// Generic handler for the body payload.
    /// See IoWriteFunc documentation for the contract.
    void saveBodyToHandler(IoWriteFunc onBodyWriteCb) { _onBodyWriteCb = std::move(onBodyWriteCb); }

    /// The response body, if any, is stored in memory.
    /// Use getBody() to read it.
    void saveBodyToMemory()
    {
        _onBodyWriteCb = [this](const char* p, int64_t len)
        {
            _body.insert(_body.end(), p, p + len);
            // LOG_TRC("Body: " << len << "\n" << _body);
            return len;
        };
    }

    /// Returns the body, assuming it wasn't redirected to file or callback.
    const std::string& getBody() const { return _body; }

    /// Set the body to be sent to the client.
    /// Also sets Content-Length and Content-Type.
    void setBody(std::string body, std::string contentType = "text/html charset=UTF-8")
    {
        _body = std::move(body);
        _header.setContentLength(_body.size()); // Always set it, even if 0.
        if (!_body.empty()) // Type is only meaningful if there is a body.
            _header.setContentType(std::move(contentType));
    }

    /// Append a chunk to the body. Must have Transfer-Encoding: chunked.
    void appendChunk(const std::string& chunk)
    {
        std::stringstream ss;
        ss << std::hex << chunk.size() << "\r\n" << chunk << "\r\n";
        _body.append(ss.str());
    }

    /// Handles incoming data (from the Server) in the Client.
    /// Returns the number of bytes consumed, or -1 for error
    /// and/or to interrupt transmission.
    int64_t readData(const char* p, int64_t len);

    /// Serializes the Server Response into the given buffer.
    bool writeData(Buffer& out) const
    {
        _statusLine.writeData(out);
        _header.writeData(out);
        out.append("\r\n"); // End of header.
        out.append(_body);
        return true;
    }

    /// Signifies that we got all the data we expected
    /// and cleans up and updates the states.
    void complete()
    {
        LOG_TRC("State::Complete");
        finish(State::Complete);
    }

    /// The request has exceeded the expected duration
    /// and has ended prematurely.
    void timeout()
    {
        LOG_TRC("State::Timeout");
        finish(State::Timeout);
    }

    /// If not already in done state, finish with State::Error.
    void finish()
    {
        // We expect to have completed successfully, or timed out,
        // anything else means we didn't get complete data.
        LOG_TRC("State::Error");
        finish(State::Error);
    }

    /// Sets the context used by logPrefix.
    void setLogContext(int fd) { _fd = fd; }

private:
    inline void logPrefix(std::ostream& os) const { os << '#' << _fd << ": "; }

    void finish(State newState)
    {
        if (!done())
        {
            LOG_TRC("Finishing: " << name(newState));
            _bodyFile.close();
            _state = newState;
            if (_finishedCallback)
                _finishedCallback();
        }
    }

    /// The stage we're at in consuming the received data.
    STATE_ENUM(ParserStage, StatusLine, Header, Body, Finished);

    StatusLine _statusLine;
    Header _header;
    std::atomic<State> _state; //< The state of the Response.
    ParserStage _parserStage; //< The parser's state.
    int64_t _recvBodySize; //< The amount of data we received (compared to the Content-Length).
    std::string _body; //< Used when _bodyHandling is InMemory.
    std::ofstream _bodyFile; //< Used when _bodyHandling is OnDisk.
    IoWriteFunc _onBodyWriteCb; //< Used to handling body receipt in all cases.
    FinishedCallback _finishedCallback; //< Called when response is finished.
    int _fd; //< The socket file-descriptor.
};

/// A client socket to make asynchronous HTTP requests.
/// Designed to be reused for multiple requests.
class Session final : public ProtocolHandlerInterface
{
public:
    STATE_ENUM(Protocol, HttpUnencrypted, HttpSsl, );

private:
    /// Construct a Session instance from a hostname, protocol and port.
    /// @hostname is *not* a URI, it's either an IP or a domain name.
    Session(std::string hostname, Protocol protocolType, int portNumber)
        : _host(std::move(hostname))
        , _port(std::to_string(portNumber))
        , _protocol(protocolType)
        , _fd(-1)
        , _timeout(getDefaultTimeout())
        , _connected(false)
    {
        assert(!_host.empty() && portNumber > 0 && !_port.empty() &&
               "Invalid hostname and portNumber for http::Sesssion");
#if ENABLE_DEBUG
        std::string scheme;
        std::string hostString;
        std::string portString;
        assert(net::parseUri(_host, scheme, hostString, portString) && scheme.empty() && portString.empty()
               && hostString == _host && "http::Session expects a hostname and not a URI");
#endif
    }

    /// Returns the given protocol's scheme.
    static const char* getProtocolScheme(Protocol protocol)
    {
        switch (protocol)
        {
            case Protocol::HttpUnencrypted:
                return "http";
            case Protocol::HttpSsl:
                return "https";
        }

        return "";
    }

public:
    /// Create a new HTTP Session to the given host.
    /// The port defaults to the protocol's default port.
    static std::shared_ptr<Session> create(std::string host, Protocol protocol, int port = 0);

    /// Create a new unencrypted HTTP Session to the given host.
    /// @port <= 0 will default to the http default port.
    static std::shared_ptr<Session> createHttp(std::string host, int port = 0)
    {
        return create(std::move(host), Protocol::HttpUnencrypted, port);
    }

    /// Create a new SSL HTTP Session to the given host.
    /// @port <= 0 will default to the https default port.
    static std::shared_ptr<Session> createHttpSsl(std::string host, int port = 0)
    {
        return create(std::move(host), Protocol::HttpSsl, port);
    }

    /// Create a new HTTP Session to the given URI.
    /// The @uri must include the scheme, e.g. https://domain.com:9980
    static std::shared_ptr<Session> create(const std::string& uri)
    {
        std::string scheme;
        std::string hostname;
        std::string portString;
        if (!net::parseUri(uri, scheme, hostname, portString))
        {
            LOG_ERR_S("Invalid URI [" << uri << "] to http::Session::create");
            return nullptr;
        }

        scheme = Util::toLower(std::move(scheme));
        const bool secure = (scheme == "https://" || scheme == "wss://");
        const auto protocol = secure ? Protocol::HttpSsl : Protocol::HttpUnencrypted;
        if (portString.empty())
            return create(hostname, protocol, getDefaultPort(protocol));

        const std::pair<std::int32_t, bool> portPair = Util::i32FromString(portString);
        if (portPair.second && portPair.first > 0)
            return create(hostname, protocol, portPair.first);

        LOG_ERR_S("Invalid port [" << portString << "] in URI [" << uri
                                   << "] to http::Session::create");
        return nullptr;
    }

    /// Returns the given protocol's default port.
    static int getDefaultPort(Protocol protocol)
    {
        switch (protocol)
        {
            case Protocol::HttpUnencrypted:
                return 80;
            case Protocol::HttpSsl:
                return 443;
        }

        return 0;
    }

    /// Returns the default timeout.
    static constexpr std::chrono::milliseconds getDefaultTimeout()
    {
        return std::chrono::seconds(30);
    }

    /// Returns the current protocol scheme.
    const char* getProtocolScheme() const { return getProtocolScheme(_protocol); }

    const std::string& host() const { return _host; }
    const std::string& port() const { return _port; }
    Protocol protocol() const { return _protocol; }
    bool isSecure() const { return _protocol == Protocol::HttpSsl; }
    bool isConnected() const { return _connected; };

    /// Set the timeout, in microseconds.
    void setTimeout(const std::chrono::microseconds timeout) { _timeout = timeout; }
    /// Get the timeout, in microseconds.
    std::chrono::microseconds getTimeout() const { return _timeout; }

    std::shared_ptr<Response> response() { return _response; }
    const std::shared_ptr<Response>& response() const { return _response; }
    const std::string& getUrl() const { return _request.getUrl(); }

    /// The onFinished callback handler signature.
    using FinishedCallback = std::function<void(const std::shared_ptr<Session>& session)>;

    /// Set a callback to handle onFinished events from this session.
    /// onFinished is triggered whenever a request has finished,
    /// regardless of the reason (error, timeout, completion).
    void setFinishedHandler(FinishedCallback onFinished) { _onFinished = std::move(onFinished); }

    /// Make a synchronous request to download a file to the given path.
    /// Note: when the server returns an error, the response body,
    /// if any, will be stored in memory and can be read via getBody().
    /// I.e. when statusLine().statusCategory() != StatusLine::StatusCodeClass::Successful.
    const std::shared_ptr<const Response>
    syncDownload(const Request& req, const std::string& saveToFilePath, SocketPoll& poller)
    {
        LOG_TRC_S("syncDownload: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
                                   << req.getUrl());

        newRequest(req);

        if (!saveToFilePath.empty())
            _response->saveBodyToFile(saveToFilePath);

        syncRequestImpl(poller);
        return _response;
    }

    /// Make a synchronous request to download a file to the given path.
    const std::shared_ptr<const Response> syncDownload(const Request& req,
                                                       const std::string& saveToFilePath)
    {
        TerminatingPoll poller("HttpSynReqPoll");
        poller.runOnClientThread();
        return syncDownload(req, saveToFilePath, poller);
    }

    /// Make a synchronous request.
    /// The payload body of the response, if any, can be read via getBody().
    const std::shared_ptr<const Response> syncRequest(const Request& req, SocketPoll& poller)
    {
        LOG_TRC_S("syncRequest: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
                                  << req.getUrl());

        newRequest(req);
        syncRequestImpl(poller);
        return _response;
    }

    /// Make a synchronous request.
    /// The payload body of the response, if any, can be read via getBody().
    const std::shared_ptr<const Response> syncRequest(const Request& req)
    {
        TerminatingPoll poller("HttpSynReqPoll");
        poller.runOnClientThread();
        return syncRequest(req, poller);
    }

    /// Make a synchronous request with the given timeout.
    /// After returning the timeout set by setTimeout is restored.
    const std::shared_ptr<const Response> syncRequest(const Request& req,
                                                      std::chrono::milliseconds timeout)
    {
        LOG_TRC("syncRequest: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
                                << req.getUrl());

        const auto origTimeout = getTimeout();
        setTimeout(timeout);

        auto responsePtr = syncRequest(req);

        setTimeout(origTimeout);

        return responsePtr;
    }

    /// Start an asynchronous request on the given SocketPoll.
    /// Return true when it dispatches the socket to the SocketPoll.
    /// Note: when reusing this Session, it is assumed that the socket
    /// is already added to the SocketPoll on a previous call (do not
    /// use multiple SocketPoll instances on the same Session).
    bool asyncRequest(const Request& req, SocketPoll& poll)
    {
        LOG_TRC("new asyncRequest: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
                                     << req.getUrl());

        newRequest(req);

        if (!isConnected())
        {
            std::shared_ptr<StreamSocket> socket = connect();
            if (!socket)
            {
                LOG_ERR("Failed to connect to " << _host << ':' << _port);
                return false;
            }

            LOG_ASSERT_MSG(_socket.lock(), "Connect must set the _socket member.");
            LOG_ASSERT_MSG(_socket.lock()->getFD() == socket->getFD(),
                           "Socket FD's mismatch after connect().");
            LOG_TRC("Inserting in poller after connecting");
            poll.insertNewSocket(socket);
        }
        else
        {
            // Technically, there is a race here. The socket can
            // get disconnected and removed right after isConnected.
            // In that case, we will timeout and no request will be sent.
            poll.wakeup();
        }

        LOG_DBG("starting asyncRequest: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
                                          << req.getUrl());

        return true;
    }

    void asyncShutdown()
    {
        LOG_TRC("asyncShutdown");
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (socket)
        {
            socket->shutdown();
        }
    }

    void disconnect()
    {
        LOG_TRC("disconnect");
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (socket)
        {
            socket->closeConnection();
        }
    }


private:
    inline void logPrefix(std::ostream& os) const { os << '#' << _fd << ": "; }

    /// Make a synchronous request.
    bool syncRequestImpl(SocketPoll& poller)
    {
        const std::chrono::microseconds timeout = getTimeout();
        const auto deadline = std::chrono::steady_clock::now() + timeout;

        assert(!!_response && "Response must be set!");

        if (!isConnected())
        {
            std::shared_ptr<StreamSocket> socket = connect();
            if (!socket)
            {
                LOG_ERR("Failed to connect to " << _host << ':' << _port);
                return false;
            }

            poller.insertNewSocket(socket);
        }

        LOG_TRC("Starting syncRequest: " << _request.getVerb() << ' ' << host() << ':' << port()
                                         << ' ' << _request.getUrl());

        poller.poll(timeout);
        while (!_response->done())
        {
            const auto now = std::chrono::steady_clock::now();
            checkTimeout(now);

            const auto remaining =
                std::chrono::duration_cast<std::chrono::microseconds>(deadline - now);
            poller.poll(remaining);
        }

        return _response->state() == Response::State::Complete;
    }

    /// Set up a new request and response.
    void newRequest(const Request& req)
    {
        _startTime = std::chrono::steady_clock::now();

        // Called when the response is finished.
        // We really need only delegate it to our client.
        // We need to do this extra hop because Response
        // doesn't have our (Session) reference. Also,
        // it's good that we are notified that the request
        // has retired, so we can perform housekeeping.
        Response::FinishedCallback onFinished = [this]()
        {
            LOG_TRC("onFinished");
            assert(_response && "Must have response object");
            assert(_response->state() != Response::State::New &&
                   "Unexpected response in New state");
            assert(_response->state() != Response::State::Incomplete &&
                   "Unexpected response in Incomplete state");
            assert(_response->done() && "Must have response in done state");
            if (_onFinished)
            {
                LOG_TRC("onFinished calling client");
                try
                {
                    _onFinished(std::static_pointer_cast<Session>(shared_from_this()));
                }
                catch (const std::exception& exc)
                {
                    LOG_ERR("Error while invoking onFinished client callback: " << exc.what());
                }
            }

            if (_response->get("Connection", "") == "close")
            {
                LOG_TRC("Our peer has sent the 'Connection: close' token. Disconnecting.");
                onDisconnect();
                assert(isConnected() == false);
            }
        };

        _response.reset();
        _response = std::make_shared<Response>(onFinished, _fd);

        _request = req;

        std::string host = _host;

        if (_port != "80" && _port != "443")
        {
            host.append(":");
            host.append(_port);
        }
        _request.set("Host", host); // Make sure the host is set.
        _request.set("Date", Util::getHttpTimeNow());
        _request.set("User-Agent", HTTP_AGENT_STRING);
    }

    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        if (socket)
        {
            _fd = socket->getFD();
            _response->setLogContext(_fd);
            LOG_TRC("Connected");
            _connected = true;
        }
        else
        {
            LOG_DBG("Error: onConnect without a valid socket");
            _fd = -1;
            _connected = false;
        }
    }

    void shutdown(bool /*goingAway*/, const std::string& /*statusMessage*/) override
    {
        LOG_TRC("shutdown");
    }

    void getIOStats(uint64_t& sent, uint64_t& recv) override
    {
        LOG_TRC("getIOStats");
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (socket)
            socket->getIOStats(sent, recv);
        else
        {
            sent = 0;
            recv = 0;
        }
    }

    int getPollEvents(std::chrono::steady_clock::time_point /*now*/,
                      int64_t& /*timeoutMaxMicroS*/) override
    {
        int events = POLLIN;
        if (_request.stage() != Request::Stage::Finished)
            events |= POLLOUT;
        return events;
    }

    void handleIncomingMessage(SocketDisposition& disposition) override
    {
        LOG_TRC("handleIncomingMessage");
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (isConnected() && socket)
        {
            // Consume the incoming data by parsing and processing the body.
            Buffer& data = socket->getInBuffer();
            if (data.empty())
            {
                LOG_DBG("No data to process from the socket");
                return;
            }

            LOG_TRC("HandleIncomingMessage: buffer has:\n"
                    << Util::dumpHex(std::string(data.data(), std::min<size_t>(data.size(), 256UL))));

            const int64_t read = _response->readData(data.data(), data.size());
            if (read >= 0)
            {
                // Remove consumed data.
                if (read)
                    data.eraseFirst(read);
                return;
            }
        }
        else
        {
            LOG_ERR("handleIncomingMessage called when not connected");
            assert(!socket && "Expected no socket when not connected");
            assert(!isConnected() && "Expected not connected when no socket");
        }

        // Protocol error: Interrupt the transfer.
        disposition.setClosed();
        onDisconnect();
    }

    void performWrites(std::size_t capacity) override
    {
        // We may get called after disconnecting and freeing the Socket instance.
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (socket)
        {
            Buffer& out = socket->getOutBuffer();
            LOG_TRC("performWrites: sending request (buffered: "
                    << out.size() << " bytes, capacity: " << capacity << ')');

            if (!socket->send(_request))
            {
                LOG_ERR("Error while writing to socket");
            }
        }
    }

    void onDisconnect() override
    {
        // Make sure the socket is disconnected and released.
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (socket)
        {
            LOG_TRC("onDisconnect");

            socket->shutdown(); // Flag for shutdown for housekeeping in SocketPoll.
            socket->closeConnection(); // Immediately disconnect.
            _socket.reset();
        }

        _connected = false;
        if (_response)
            _response->finish();

        _fd = -1; // No longer our socket fd.
    }

    std::shared_ptr<StreamSocket> connect()
    {
        _socket.reset(); // Reset to make sure we are disconnected.
        std::shared_ptr<StreamSocket> socket =
            net::connect(_host, _port, isSecure(), shared_from_this());
        assert((!socket || _fd == socket->getFD()) &&
               "The socket FD must have been set in onConnect");

        // When used with proxy.php we may indeed get nullptr here.
        // assert(socket && "Unexpected nullptr returned from net::connect");
        _socket = socket; // Hold a weak pointer to it.
        return socket; // Return the shared pointer.
    }

    void checkTimeout(std::chrono::steady_clock::time_point now) override
    {
        if (!_response || _response->done())
            return;

        const auto duration =
            std::chrono::duration_cast<std::chrono::milliseconds>(now - _startTime);
        if (now < _startTime || duration > getTimeout() || SigUtil::getTerminationFlag())
        {
            LOG_WRN("Timed out while requesting [" << _request.getVerb() << ' ' << _host
                                                   << _request.getUrl() << "] after " << duration);

            // Flag that we timed out.
            _response->timeout();

            // Disconnect and trigger the right events and handlers.
            // Note that this is the right way to end a request in HTTP, it's also
            // no good maintaining a poor connection (if that's the issue).
            onDisconnect(); // Trigger manually (why wait for poll to do it?).
            assert(isConnected() == false);
        }
    }

    int sendTextMessage(const char*, const size_t, bool) const override { return 0; }
    int sendBinaryMessage(const char*, const size_t, bool) const override { return 0; }

private:
    const std::string _host;
    const std::string _port;
    const Protocol _protocol;
    int _fd; //< The socket file-descriptor.
    std::chrono::microseconds _timeout;
    std::chrono::steady_clock::time_point _startTime;
    bool _connected;
    Request _request;
    FinishedCallback _onFinished;
    std::shared_ptr<Response> _response;
    std::weak_ptr<StreamSocket> _socket; //< Must be the last member.
};

/// HTTP Get a URL synchronously.
inline const std::shared_ptr<const http::Response>
get(const std::string& url, std::chrono::milliseconds timeout = Session::getDefaultTimeout())
{
    auto httpSession = http::Session::create(url);
    return httpSession->syncRequest(http::Request(net::parseUrl(url)), timeout);
}

/// HTTP Get synchronously given a url and a path.
inline const std::shared_ptr<const http::Response>
get(const std::string& url, const std::string& path,
    std::chrono::milliseconds timeout = Session::getDefaultTimeout())
{
    auto httpSession = http::Session::create(url);
    return httpSession->syncRequest(http::Request(path), timeout);
}

namespace server
{

/// A server http Session to make asynchronous HTTP responses.
class Session final : public ProtocolHandlerInterface
{
public:
    /// Construct a Session instance.
    Session()
        : _timeout(getDefaultTimeout())
        , _pos(-1)
        , _size(0)
        , _fd(-1)
        , _connected(false)
        , _start(0)
        , _end(-1)
        , _startIsSuffix(false)
        , _statusCode(http::StatusCode::OK)
    {
    }

    /// Returns the default timeout.
    static constexpr std::chrono::milliseconds getDefaultTimeout()
    {
        return std::chrono::seconds(30);
    }

    bool isConnected() const { return _connected; };

    /// Set the timeout, in microseconds.
    void setTimeout(const std::chrono::microseconds timeout) { _timeout = timeout; }
    /// Get the timeout, in microseconds.
    std::chrono::microseconds getTimeout() const { return _timeout; }

    /// The onFinished callback handler signature.
    using FinishedCallback = std::function<void(const std::shared_ptr<Session>& session)>;

    /// Set a callback to handle onFinished events from this session.
    /// onFinished is triggered whenever a request has finished,
    /// regardless of the reason (error, timeout, completion).
    void setFinishedHandler(FinishedCallback onFinished) { _onFinished = std::move(onFinished); }

    /// Start an asynchronous upload from a file.
    /// Return true when it dispatches the socket to the SocketPoll.
    /// Note: when reusing this Session, it is assumed that the socket
    /// is already added to the SocketPoll on a previous call (do not
    /// use multiple SocketPoll instances on the same Session).
    bool asyncUpload(std::string fromFile, std::string mimeType, int start, int end, bool startIsSuffix, http::StatusCode statusCode = http::StatusCode::OK)
    {
        _start = start;
        _end = end;
        _startIsSuffix = startIsSuffix;
        _statusCode = statusCode;

        LOG_TRC("asyncUpload from file [" << fromFile << ']');

        _fd = open(fromFile.c_str(), O_RDONLY);
        if (_fd == -1)
        {
            LOG_ERR("Failed to open file [" << fromFile << "] for uploading");
            return false;
        }

        struct stat sb;
        const int res = fstat(_fd, &sb);
        if (res == -1)
        {
            LOG_SYS("Failed to stat file [" << fromFile);
            close(_fd);
            _fd = -1;
            return false;
        }

        _size = sb.st_size;
        _data = std::move(fromFile);
        _mimeType = std::move(mimeType);

        int firstBytePos = getStart();

        if (lseek(_fd, firstBytePos, SEEK_SET) < 0)
            LOG_SYS("Failed to seek " << _data << " to " << firstBytePos << " because: " << strerror(errno));
        else
            _pos = firstBytePos;

        return true;
    }

    /// Start an asynchronous upload of a whole file
    bool asyncUpload(std::string fromFile, std::string mimeType)
    {
        return asyncUpload(fromFile, mimeType, 0, -1, false);
    }

    /// Start a partial asynchronous upload from a file based on the contents of a "Range" header
    bool asyncUpload(std::string fromFile, std::string mimeType, std::string rangeHeader)
    {
        size_t equalsPos = rangeHeader.find("=");
        if (equalsPos == std::string::npos) return asyncUpload(fromFile, mimeType);

        std::string unit = rangeHeader.substr(0, equalsPos);
        if (unit != "bytes") return asyncUpload(fromFile, mimeType);

        std::string range = rangeHeader.substr(equalsPos + 1);

        size_t dashPos = range.find("-");
        std::string startString = range.substr(0, dashPos);
        std::string endString = "-1";

        if (dashPos != std::string::npos) {
            endString = range.substr(dashPos + 1);
        }

        int start = 0;
        int end = -1;
        bool startIsSuffix = false;

        if (startString == "") {
            // Could be a suffix
            try {
                start = std::stoi(endString);
                startIsSuffix = true;
            }
            catch (std::invalid_argument&) {}
            catch (std::out_of_range&) {}

            return asyncUpload(fromFile, mimeType, start, end, startIsSuffix, http::StatusCode::PartialContent);
        }

        try {
            start = std::stoi(startString);
            end = std::stoi(endString) + 1;
        }
        catch (std::invalid_argument&) {}
        catch (std::out_of_range&) {}

        // FIXME: does not support ranges that specify multiple comma-separated values

        return asyncUpload(fromFile, mimeType, start, end, startIsSuffix, http::StatusCode::PartialContent);
    }

    int getStart() {
        if (_startIsSuffix) return _size - _start;
        return _start;
    }

    int getEnd() {
        if (_startIsSuffix) return _size;
        if (_end == -1) return _size;
        if (_end > _size) return _size;

        return _end;
    }

    /// Calculate how much we're going to send based on the file size and the range
    int getSendSize() {
        int end = getEnd();
        int start = getStart();

        if (start > _size) return 0;

        return end - start;
    }

    void asyncShutdown()
    {
        LOG_TRC("asyncShutdown");
        if (_socket)
        {
            _socket->shutdown();
        }
    }

    void disconnect()
    {
        LOG_TRC("disconnect");
        if (_socket)
        {
            _socket->closeConnection();
        }
    }

private:
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _connected = false; // Assume disconnected by default.
        _socket = socket;
        if (socket)
        {
            setLogContext(socket->getFD());
            if (_fd >= 0 || _pos >= 0)
            {
                LOG_TRC("Connected");
                _connected = true;

                LOG_DBG("Sending header with size " << getSendSize());
                http::Response httpResponse(_statusCode);
                httpResponse.set("Content-Length", std::to_string(getSendSize()));
                httpResponse.set("Content-Type", _mimeType);
                httpResponse.set("Accept-Ranges", "bytes");
                httpResponse.set("Content-Range", "bytes " + std::to_string(getStart()) + "-" + std::to_string(getEnd() - 1) + '/' +
                                    std::to_string(_size));

                socket->send(httpResponse);
                return;
            }

            LOG_DBG("Has no data to send back");
            http::Response httpResponse(http::StatusCode::BadRequest);
            httpResponse.set("Content-Length", "0");
            socket->sendAndShutdown(httpResponse);
        }
        else
        {
            LOG_DBG("Error: onConnect without a valid socket");
        }
    }

    void shutdown(bool /*goingAway*/, const std::string& /*statusMessage*/) override
    {
        LOG_TRC("shutdown");
    }

    void getIOStats(uint64_t& sent, uint64_t& recv) override
    {
        LOG_TRC("getIOStats");
        if (_socket)
            _socket->getIOStats(sent, recv);
        else
        {
            sent = 0;
            recv = 0;
        }
    }

    int getPollEvents(std::chrono::steady_clock::time_point /*now*/,
                      int64_t& /*timeoutMaxMicroS*/) override
    {
        int events = POLLIN;
        if (_fd >= 0 || _pos >= 0)
            events |= POLLOUT;
        return events;
    }

    virtual void handleIncomingMessage(SocketDisposition& /*disposition*/) override
    {
        if (!isConnected())
        {
            LOG_ERR("handleIncomingMessage called when not connected.");
            assert(!_socket && "Expected no socket when not connected.");
            return;
        }

        assert(_socket && "No valid socket to handleIncomingMessage.");
        LOG_TRC("handleIncomingMessage");
    }

    void performWrites(std::size_t capacity) override
    {
        // We may get called after disconnecting and freeing the Socket instance.
        if (_socket)
        {
            const Buffer& out = _socket->getOutBuffer();
            LOG_TRC("performWrites: " << out.size() << " bytes, capacity: " << capacity);

            while (_fd >= 0 && capacity > 0)
            {
                //FIXME: replace with in-place read into the output buffer.
                char buffer[64 * 1024];
                const auto size = std::min({sizeof(buffer), capacity, (size_t)(getEnd() - _pos)});
                int n;
                while ((n = ::read(_fd, buffer, size)) < 0 && errno == EINTR)
                    LOG_TRC("EINTR reading from " << _data);

                if (n <= 0 || _pos >= getEnd())
                {
                    if (n >= 0)
                    {
                        LOG_TRC("performWrites finished uploading");
                    }
                    else
                    {
                        LOG_SYS("Failed to upload file");
                    }

                    close(_fd);
                    _fd = -1;
                    onDisconnect();
                    break;
                }

                _socket->send(buffer, n);
                _pos += n;
                LOG_ASSERT(static_cast<std::size_t>(n) <= capacity);
                capacity -= n;
                LOG_TRC("performWrites wrote " << n << " bytes, capacity: " << capacity);
            }
        }
    }

    void onDisconnect() override
    {
        // Make sure the socket is disconnected and released.
        if (_socket)
        {
            LOG_TRC("onDisconnect");

            _socket->shutdown(); // Flag for shutdown for housekeeping in SocketPoll.
            _socket->closeConnection(); // Immediately disconnect.
            _socket.reset();
        }

        _connected = false;
    }

    int sendTextMessage(const char*, const size_t, bool) const override { return 0; }
    int sendBinaryMessage(const char*, const size_t, bool) const override { return 0; }

private:
    std::chrono::microseconds _timeout;
    std::chrono::steady_clock::time_point _startTime;
    std::string _data; //< Data to upload, if not from a file, OR, the filename (if _pos == -1).
    std::string _mimeType; //< The data Content-Type.
    int _pos; //< The current position in the data string.
    int _size; //< The size of the data in bytes.
    int _fd; //< The descriptor of the file to upload.
    bool _connected;
    int _start; //< The position we start reading from, the data includes this first byte
                //  If this is greater than _size we will return no bytes
                //  If this is less than 0 or greater than _end behavior is unspecified
    int _end; //< The position we stop reading at, the data does not include this last byte
              //  If this is greater than or equal to _start we will only return bytes in the range
              //  If this is greater than _size we will return all bytes between _start and _size
              //  If this is -1 we will treat it as if it were equal to _size
    bool _startIsSuffix; //< If this is true, we'll treat _start as an offset from the end, not from the start
                         //  In that case, we'll ignore end entirely
                         //  e.g. if this is true and start is 5, we will send the last 5 bytes
    http::StatusCode _statusCode;
    FinishedCallback _onFinished;
    std::shared_ptr<StreamSocket> _socket; //< Must be the last member.
};
}

inline std::ostream& operator<<(std::ostream& os, const http::Header& header)
{
    Util::joinPair(os, header, " / ");

    return os;
}

inline std::ostream& operator<<(std::ostream& os, const http::StatusCode& statusCode)
{
    os << static_cast<int>(statusCode) << " (" << getReasonPhraseForCode(statusCode) << ')';
    return os;
}

inline std::ostringstream& operator<<(std::ostringstream& os, const http::StatusCode& statusCode)
{
    os << static_cast<int>(statusCode) << " (" << getReasonPhraseForCode(statusCode) << ')';
    return os;
}

inline std::ostream& operator<<(std::ostream& os, const http::FieldParseState& fieldParseState)
{
    os << http::name(fieldParseState);
    return os;
}

inline std::ostream& operator<<(std::ostream& os, const http::Request::Stage& stage)
{
    os << http::Request::name(stage);
    return os;
}

inline std::ostream& operator<<(std::ostream& os, const http::Response::State& state)
{
    os << http::Response::name(state);
    return os;
}

/// Format seconds with the units suffix until we migrate to C++20.
inline std::ostream& operator<<(std::ostream& os, const std::chrono::seconds& s)
{
    os << s.count() << 's';
    return os;
}

/// Format milliseconds with the units suffix until we migrate to C++20.
inline std::ostream& operator<<(std::ostream& os, const std::chrono::milliseconds& ms)
{
    os << ms.count() << "ms";
    return os;
}

/// Format microseconds with the units suffix until we migrate to C++20.
inline std::ostream& operator<<(std::ostream& os, const std::chrono::microseconds& ms)
{
    os << ms.count() << "us";
    return os;
}

} // namespace http

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
