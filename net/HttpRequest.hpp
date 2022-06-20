/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <chrono>
#include <cstdint>
#include <iostream>
#include <fstream>
#include <memory>
#include <sstream>
#include <string>
#include <sys/types.h>
#include <sys/socket.h>
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

#ifndef COOLWSD_VERSION
static_assert(false, "config.h must be included in the .cpp being compiled");
#endif

// This is a partial implementation of RFC 7230
// and its related RFCs, with focus on the core
// HTTP/1.1 messaging of GET and POST requests.
//
// There is no attempt to support all possible
// features of the RFC. However, we do attempt
// to be maximally compatible and accomodating
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
// Finally, if a syncronous request is needed,
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
        CASE(100, "Continue");
        CASE(101, "Switching Protocols");
        CASE(102, "Processing"); // RFC 2518 (WebDAV)
        CASE(103, "Early Hints"); // RFC 8297

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

        CASE(300, "Multiple Choices");
        CASE(301, "Moved Permanently");
        CASE(302, "Found");
        CASE(303, "See Other");
        CASE(304, "Not Modified");
        CASE(305, "Use Proxy");
        CASE(307, "Temporary Redirect");

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
        //FIXME: use generalized lambda capture to move the ifstream, available in C++14.
        auto ifs = std::make_shared<std::ifstream>(path, std::ios::binary);

        ifs->seekg(0, std::ios_base::end);
        const int64_t size = ifs->tellg();
        ifs->seekg(0, std::ios_base::beg);

        setBodySource(
            [=](char* buf, int64_t len) -> int64_t
            {
                ifs->read(buf, len);
                return ifs->gcount();
            },
            size);
    }

    Stage stage() const { return _stage; }

    bool writeData(Buffer& out, std::size_t capacity)
    {
        if (_stage == Stage::Header)
        {
            LOG_TRC("performWrites (request header).");

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
            LOG_TRC("performWrites (request body).");

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
                    LOG_TRC("performWrites (request body): finished, total: " << wrote);
                    _stage = Stage::Finished;
                    return true;
                }

                out.append(buffer, read);
                wrote += read;
                LOG_TRC("performWrites (request body): " << read << " bytes, total: " << wrote);
            } while (wrote < capacity);
        }

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
    unsigned statusCode() const { return _statusCode; }
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
    Response(FinishedCallback finishedCallback)
        : _state(State::New)
        , _parserStage(ParserStage::StatusLine)
        , _recvBodySize(0)
        , _finishedCallback(std::move(finishedCallback))
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
    Response(StatusLine statusLineObj)
        : _statusLine(std::move(statusLineObj))
    {
        _header.add("Date", Util::getHttpTimeNow());
        _header.add("Server", HTTP_SERVER_STRING);
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
            LOG_TRC("Writing " << len << " bytes.");
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
        finish(State::Error);
    }

private:
    void finish(State newState)
    {
        if (!done())
        {
            LOG_TRC("Finishing");
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
        , _timeout(getDefaultTimeout())
        , _connected(false)
    {
        assert(!_host.empty() && portNumber > 0 && !_port.empty() &&
               "Invalid hostname and portNumber for http::Sesssion");
#ifdef ENABLE_DEBUG
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
            LOG_ERR("Invalid URI [" << uri << "] to http::Session::create.");
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

        LOG_ERR("Invalid port [" << portString << "] in URI [" << uri
                                 << "] to http::Session::create.");
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

    std::shared_ptr<const Response> response() const { return _response; }

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
        LOG_TRC("syncDownload: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
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
        return syncDownload(req, saveToFilePath, poller);
    }

    /// Make a synchronous request.
    /// The payload body of the response, if any, can be read via getBody().
    const std::shared_ptr<const Response> syncRequest(const Request& req, SocketPoll& poller)
    {
        LOG_TRC("syncRequest: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
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
        LOG_TRC("asyncRequest: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
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
            LOG_TRC('#' << socket->getFD() << ": Connected");
            poll.insertNewSocket(socket);
        }
        else
        {
            // Technically, there is a race here. The socket can
            // get disconnected and removed right after isConnected.
            // In that case, we will timeout and no request will be sent.
            poll.wakeupWorld();
        }

        return true;
    }

private:
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

        poller.poll(timeout);
        while (!_response->done())
        {
            const auto now = std::chrono::steady_clock::now();
            const auto remaining =
                std::chrono::duration_cast<std::chrono::microseconds>(deadline - now);
            poller.poll(remaining);
        }

        return _response->state() == Response::State::Complete;
    }

    /// Set up a new request and response.
    void newRequest(Request req)
    {
        _startTime = std::chrono::steady_clock::now();

        // Called when the response is finished.
        // We really need only delegate it to our client.
        // We need to do this extra hop because Response
        // doesn't have our (Session) reference. Also,
        // it's good that we are notified that the request
        // has retired, so we can perform housekeeping.
        Response::FinishedCallback onFinished = [&]()
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
                _onFinished(std::static_pointer_cast<Session>(shared_from_this()));
            }

            if (_response->get("Connection", "") == "close")
            {
                LOG_TRC("Our peer has sent the 'Connection: close' token. Disconnecting.");
                onDisconnect();
                assert(isConnected() == false);
            }
        };

        _response.reset(new Response(onFinished));

        _request = std::move(req);

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
            LOG_TRC('#' << socket->getFD() << " Connected.");
            _connected = true;
        }
        else
        {
            LOG_DBG("Error: onConnect without a valid socket");
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

    virtual void handleIncomingMessage(SocketDisposition& disposition) override
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (!isConnected())
        {
            LOG_ERR("handleIncomingMessage called when not connected.");
            assert(!socket && "Expected no socket when not connected.");
            return;
        }

        assert(socket && "No valid socket to handleIncomingMessage.");
        LOG_TRC('#' << socket->getFD() << " handleIncomingMessage.");

        bool close = false;
        Buffer& data = socket->getInBuffer();

        // Consume the incoming data by parsing and processing the body.
        const int64_t read = _response->readData(data.data(), data.size());
        if (read > 0)
        {
            // Remove consumed data.
            data.eraseFirst(read);
            close = !isConnected();
        }
        else if (read < 0)
        {
            // Protocol error: Interrupt the transfer.
            close = true;
        }

        if (close)
        {
            disposition.setClosed();
            onDisconnect();
        }
    }

    void performWrites(std::size_t capacity) override
    {
        // We may get called after disconnecting and freeing the Socket instance.
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (socket)
        {
            Buffer& out = socket->getOutBuffer();
            LOG_TRC('#' << socket->getFD() << ": performWrites: " << out.size()
                        << " bytes, capacity: " << capacity);

            if (!socket->send(_request))
            {
                LOG_ERR('#' << socket->getFD() << ": Error while writing to socket.");
            }
        }
    }

    void onDisconnect() override
    {
        // Make sure the socket is disconnected and released.
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (socket)
        {
            LOG_TRC('#' << socket->getFD() << ": onDisconnect");

            socket->shutdown(); // Flag for shutdown for housekeeping in SocketPoll.
            socket->closeConnection(); // Immediately disconnect.
            _socket.reset();
        }

        _connected = false;
        if (_response)
            _response->finish();
    }

    std::shared_ptr<StreamSocket> connect()
    {
        _socket.reset(); // Reset to make sure we are disconnected.
        std::shared_ptr<StreamSocket> socket =
            net::connect(_host, _port, isSecure(), shared_from_this());
        assert(socket && "Unexpected nullptr returned from net::connect");
        _socket = socket; // Hold a weak pointer to it.
        return socket; // Return the shared pointer.
    }

    void checkTimeout(std::chrono::steady_clock::time_point now) override
    {
        if (!_response || _response->done())
            return;

        const auto duration =
            std::chrono::duration_cast<std::chrono::milliseconds>(now - _startTime);
        if (duration > getTimeout())
        {
            std::shared_ptr<StreamSocket> socket = _socket.lock();
            const int fd = socket ? socket->getFD() : 0;
            LOG_WRN('#' << fd << " has timed out while requesting [" << _request.getVerb() << ' '
                        << _host << _request.getUrl() << "] after " << duration);

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

} // namespace http

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

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
