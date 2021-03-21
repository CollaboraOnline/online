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

#include "Common.hpp"
#include "NetUtil.hpp"
#include <net/Socket.hpp>
#include <utility>
#if ENABLE_SSL
#include <net/SslSocket.hpp>
#endif
#include "Log.hpp"
#include "Util.hpp"

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
enum class FieldParseState
{
    Unknown, //< Not yet parsed.
    Incomplete, //< Not enough data to parse this field. Need more data.
    Invalid, //< The field is invalid/unexpected/long.
    Valid //< The field is both complete and valid.
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

/// An HTTP Header.
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
    enum class State
    {
        New,
        Incomplete, //< Haven't reached the end yet.
        InvalidField, //< Too long, no colon, etc.
        TooManyFields, //< Too many fields to accept.
        Complete //< Header is complete and valid.
    };

    using Container = std::vector<std::pair<std::string, std::string>>;
    using ConstIterator = std::vector<std::pair<std::string, std::string>>::const_iterator;

    ConstIterator begin() const { return _headers.begin(); }
    ConstIterator end() const { return _headers.end(); }

    /// Parse the given data as an HTTP header.
    /// Returns the number of bytes consumed (and must be removed from the input).
    int64_t parse(const char* p, int64_t len);

    /// Add an HTTP header field.
    void add(const std::string& key, const std::string& value)
    {
        _headers.emplace_back(key, value);
    }

    /// Set an HTTP header field, replacing an earlier value, if exists.
    void set(const std::string& key, const std::string& value)
    {
        for (auto& pair : _headers)
        {
            if (pair.first == key)
            {
                pair.second = value;
                return;
            }
        }

        _headers.emplace_back(key, value);
    }

    bool has(const std::string& key) const
    {
        for (const auto& pair : _headers)
        {
            if (pair.first == key)
                return true;
        }

        return false;
    }

    std::string get(const std::string& key) const
    {
        for (const auto& pair : _headers)
        {
            if (pair.first == key)
                return pair.second;
        }

        return std::string();
    }

    /// Set the Content-Type header.
    void setContentType(const std::string& type) { set(CONTENT_TYPE, type); }
    /// Get the Content-Type header.
    std::string getContentType() const { return get(CONTENT_TYPE); }
    /// Returns true iff a Content-Type header exists.
    bool hasContentType() const { return has(CONTENT_TYPE); }

    /// Set the Content-Length header.
    void setContentLength(int64_t length) { set(CONTENT_LENGTH, std::to_string(length)); }
    /// Get the Content-Length header.
    int64_t getContentLength() const { return std::stoll(get(CONTENT_LENGTH)); }
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
    enum class Stage
    {
        Header, //< Communicate the header.
        Body, //< Communicate the body (if any).
        Finished //< Done.
    };

    Request(const std::string& url = "/", const std::string& verb = VERB_GET,
            const std::string& version = VERS_1_1)
        : _url(url)
        , _verb(verb)
        , _version(version)
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
    void add(const std::string& key, const std::string& value) { _header.add(key, value); }

    /// Set an HTTP header field, replacing an earlier value, if exists.
    void set(const std::string& key, const std::string& value) { _header.set(key, value); }

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
        //FIXME: use generalized lambda campture to move the ifstream, available in C++14.
        auto ifs = std::make_shared<std::ifstream>(path, std::ios::binary);

        ifs->seekg(0, std::ios_base::end);
        const int64_t size = ifs->tellg();
        ifs->seekg(0, std::ios_base::beg);

        setBodySource(
            [=](char* buf, int64_t len) -> int64_t {
                ifs->read(buf, len);
                return ifs->gcount();
            },
            size);
    }

    Stage stage() const { return _stage; }

    bool writeData(Buffer& out)
    {
        if (_stage == Stage::Header)
        {
            std::ostringstream oss;
            oss << getVerb() << ' ' << getUrl() << ' ' << getVersion() << "\r\n";
            _header.serialize(oss);
            oss << "\r\n";
            const std::string headerStr = oss.str();

            out.append(headerStr.data(), headerStr.size());
            LOG_TRC("performWrites (header): " << headerStr.size());
            _stage = Stage::Body;
        }

        if (_stage == Stage::Body)
        {
            // Get the data to write into the socket
            // from the client's callback. This is
            // used to upload files, or other data.
            char buffer[16 * 1024];
            const int64_t read = _bodyReaderCb(buffer, sizeof(buffer));
            if (read < 0)
                return false;

            if (read == 0)
            {
                _stage = Stage::Finished;
            }
            else if (read > 0)
            {
                out.append(buffer, read);
                LOG_TRC("performWrites (body): " << read);
            }
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
    static constexpr int64_t MinStatusLineLen
        = sizeof("HTTP/0.0 000\r\n") - 1; // Reason phrase is optional.
    static constexpr int64_t MaxStatusLineLen = VersionLen + StatusCodeLen + MaxReasonPhraseLen;
    static constexpr int64_t MinValidStatusCode = 100;
    static constexpr int64_t MaxValidStatusCode = 599;

    static constexpr const char* HTTP_1_1 = "HTTP/1.1";
    static constexpr const char* OK = "OK";

    StatusLine()
        : _statusCode(0)
    {
    }

    /// The Status Code class of the response.
    /// None of these implies complete receipt of the response.
    enum class StatusCodeClass
    {
        Invalid,
        Informational, //< Request being processed, not final response.
        Successful, //< Successfully processed request, response on the way.
        Redirection, //< Redirected to a different resource.
        Client_Error, //< Bad request, cannot respond.
        Server_Error //< Bad server, cannot respond.
    };

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

    const std::string& httpVersion() const { return _httpVersion; }
    int versionMajor() const { return _versionMajor; }
    int versionMinor() const { return _versionMinor; }
    int statusCode() const { return _statusCode; }
    const std::string& reasonPhrase() const { return _reasonPhrase; }

private:
    std::string _httpVersion; //< Typically "HTTP/1.1"
    int _versionMajor; //< The first version digit (typically 1).
    int _versionMinor; //< The second version digit (typically 1).
    int _statusCode;
    std::string _reasonPhrase; //< A client SHOULD ignore the reason-phrase content.
};

/// The response for an HTTP request.
class Response final
{
public:
    using FinishedCallback = std::function<void()>;

    Response(FinishedCallback finishedCallback)
        : _state(State::New)
        , _parserStage(ParserStage::StatusLine)
        , _recvBodySize(0)
        , _finishedCallback(std::move(finishedCallback))
    {
        // By default we store the body in memory.
        saveBodyToMemory();
    }

    /// The state of the response.
    enum class State
    {
        New, //< Valid but meaningless.
        Incomplete, //< In progress, no errors.
        Error, //< This is for protocol errors, not 400 and 500 reponses.
        Timeout, //< The request has exceeded the time allocated.
        Complete //< Successfully completed (does *not* imply 200 OK).
    };

    /// The state of the Response (for the server's response use statusLine).
    State state() const { return _state; }

    /// Returns true iff there is no more data to expect and the state is final.
    bool done() const
    {
        return (_state == State::Error || _state == State::Timeout || _state == State::Complete);
    }

    const StatusLine& statusLine() const { return _statusLine; }

    const Header& header() const { return _header; }

    /// Redirect the response body, if any, to a file.
    /// If the server responds with a non-success status code (i.e. not 2xx)
    /// the body is redirected to memory to be read via getBody().
    /// Check the statusLine().statusCategory() for the status code.
    void saveBodyToFile(const std::string& path)
    {
        _bodyFile.open(path, std::ios_base::out | std::ios_base::binary);
        _onBodyWriteCb = [this](const char* p, int64_t len) {
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
        _onBodyWriteCb = [this](const char* p, int64_t len) {
            _body.insert(_body.end(), p, p + len);
            // LOG_TRC("Body: " << len << "\n" << _body);
            return len;
        };
    }

    /// Returns the body, assuming it wasn't redirected to file or callback.
    const std::string& getBody() const { return _body; }

    /// Handles incoming data.
    /// Returns the number of bytes consumed, or -1 for error
    /// and/or to interrupt transmission.
    int64_t readData(const char* p, int64_t len);

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

private:
    void finish(State newState)
    {
        if (!done())
        {
            LOG_TRC("Finishing");
            _bodyFile.close();
            _state = newState;
            _finishedCallback();
        }
    }

private:
    /// The stage we're at in consuming the received data.
    enum class ParserStage
    {
        StatusLine,
        Header,
        Body,
        Finished
    };

    StatusLine _statusLine;
    Header _header;
    State _state; //< The state of the Response.
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
    enum class Protocol
    {
        HttpUnencrypted,
        HttpSsl,
    };

private:
    Session(const std::string& hostname, Protocol protocolType, int portNumber)
        : _host(hostname)
        , _port(std::to_string(portNumber))
        , _protocol(protocolType)
        , _timeout(std::chrono::seconds(30))
        , _connected(false)
    {
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
    static std::shared_ptr<Session> create(const std::string& host, Protocol protocol, int port = 0)
    {
        port = (port > 0 ? port : getDefaultPort(protocol));
        return std::shared_ptr<Session>(new Session(host, protocol, port));
    }

    /// Create a new unencrypted HTTP Session to the given host.
    /// @port <= 0 will default to the http default port.
    static std::shared_ptr<Session> createHttp(const std::string& host, int port = 0)
    {
        return create(host, Protocol::HttpUnencrypted, port);
    }

    /// Create a new SSL HTTP Session to the given host.
    /// @port <= 0 will default to the https default port.
    static std::shared_ptr<Session> createHttpSsl(const std::string& host, int port = 0)
    {
        return create(host, Protocol::HttpSsl, port);
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

    /// Returns the current protocol scheme.
    const char* getProtocolScheme() const { return getProtocolScheme(_protocol); }

    const std::string& host() const { return _host; }
    const std::string& port() const { return _port; }
    Protocol protocol() const { return _protocol; }
    bool isSecure() const { return _protocol == Protocol::HttpSsl; }

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
    bool syncDownload(const Request& req, const std::string& saveToFilePath)
    {
        LOG_TRC("syncDownload: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
                                 << req.getUrl());

        newRequest(req);

        if (!saveToFilePath.empty())
            _response->saveBodyToFile(saveToFilePath);

        return syncRequestImpl();
    }

    /// Make a synchronous request.
    /// The payload body of the response, if any, can be read via getBody().
    bool syncRequest(const Request& req)
    {
        LOG_TRC("syncRequest: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
                                << req.getUrl());

        newRequest(req);

        return syncRequestImpl();
    }

    bool asyncRequest(const Request& req, SocketPoll& poll)
    {
        LOG_TRC("asyncRequest: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
                                 << req.getUrl());

        newRequest(req);

        if (!_connected && connect())
        {
            LOG_TRC("Connected");
            poll.insertNewSocket(_socket);
        }
        else if (!_socket)
        {
            LOG_ERR("Failed to connect to " << _host << ':' << _port);
            return false;
        }
        else
            poll.wakeupWorld();

        return true;
    }

private:
    /// Make a synchronous request.
    bool syncRequestImpl()
    {
        const std::chrono::microseconds timeout = getTimeout();
        const auto deadline = std::chrono::steady_clock::now() + timeout;

        assert(!!_response && "Response must be set!");

        if (!_connected && !connect())
            return false;

        SocketPoll poller("HttpSynReqPoll");

        poller.insertNewSocket(_socket);
        poller.poll(timeout.count());
        while (!_response->done())
        {
            const auto now = std::chrono::steady_clock::now();
            const auto remaining
                = std::chrono::duration_cast<std::chrono::microseconds>(deadline - now);
            poller.poll(remaining.count());
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
        Response::FinishedCallback onFinished = [&]() {
            LOG_TRC("onFinished");
            assert(_response->done());
            if (_onFinished)
            {
                LOG_TRC("onFinished calling client");
                _onFinished(std::static_pointer_cast<Session>(shared_from_this()));
            }
        };

        _response.reset(new Response(onFinished));

        _request = std::move(req);
        _request.set("Host", host()); // Make sure the host is set.
    }

    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        LOG_TRC("onConnect");
        LOG_TRC('#' << socket->getFD() << " Connected.");
        _connected = true;
    }

    void shutdown(bool /*goingAway*/, const std::string& /*statusMessage*/) override
    {
        LOG_TRC("shutdown");
    }

    void getIOStats(uint64_t& sent, uint64_t& recv) override
    {
        LOG_TRC("getIOStats");
        _socket->getIOStats(sent, recv);
    }

    int getPollEvents(std::chrono::steady_clock::time_point /*now*/,
                      int64_t& /*timeoutMaxMicroS*/) override
    {
        LOG_TRC("getPollEvents");
        int events = POLLIN;
        if (_request.stage() != Request::Stage::Finished)
            events |= POLLOUT;
        return events;
    }

    virtual void handleIncomingMessage(SocketDisposition& disposition) override
    {
        LOG_TRC("handleIncomingMessage");

        std::vector<char>& data = _socket->getInBuffer();

        // Consume the incoming data by parsing and processing the body.
        const int64_t read = _response->readData(data.data(), data.size());
        if (read > 0)
        {
            // Remove consumed data.
            data.erase(data.begin(), data.begin() + read);
        }
        else if (read < 0)
        {
            // Interrupt the transfer.
            disposition.setClosed();
            _socket->shutdown();
        }
    }

    void performWrites() override
    {
        LOG_TRC("performWrites");

        Buffer& out = _socket->getOutBuffer();
        if (!_request.writeData(out))
        {
            _socket->shutdown();
        }
        else if (!out.empty())
        {
            _socket->writeOutgoingData();
        }
    }

    void onDisconnect() override
    {
        LOG_TRC("onDisconnect");
        _connected = false;
        _response->complete();
    }

    bool connect()
    {
        _socket = net::connect(_host, _port, isSecure(), shared_from_this());
        return _socket != nullptr;
    }

    void checkTimeout(std::chrono::steady_clock::time_point now) override
    {
        const auto duration
            = std::chrono::duration_cast<std::chrono::milliseconds>(now - _startTime);
        if (duration > getTimeout())
        {
            LOG_WRN("Socket #" << _socket->getFD() << " has timed out while requesting ["
                               << _request.getVerb() << ' ' << _host << _request.getUrl()
                               << "] after " << duration);

            // Flag that we timed out.
            _response->timeout();

            // Disconnect and trigger the right events and handlers.
            // Note that this is the right way to end a request in HTTP, it's also
            // no good maintaining a poor connection (if that's the issue).
            _socket->shutdown(); // Flag for shutdown for housekeeping in SocketPoll.
            _socket->closeConnection(); // Immediately disconnect.
            onDisconnect(); // Trigger manually (why wait for poll to do it?).
            assert(_connected == false);
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
    std::shared_ptr<StreamSocket> _socket;
    Request _request;
    std::shared_ptr<Response> _response;
    FinishedCallback _onFinished;
    bool _connected;
};

} // namespace http

#define CASE(X)                                                                                    \
    case X:                                                                                        \
        os << #X;                                                                                  \
        break;

inline std::ostream& operator<<(std::ostream& os, const http::FieldParseState& fieldParseState)
{
    switch (fieldParseState)
    {
        CASE(http::FieldParseState::Unknown);
        CASE(http::FieldParseState::Incomplete);
        CASE(http::FieldParseState::Invalid);
        CASE(http::FieldParseState::Valid);
    }
    return os;
}

inline std::ostream& operator<<(std::ostream& os, const http::Request::Stage& stage)
{
    switch (stage)
    {
        CASE(http::Request::Stage::Body);
        CASE(http::Request::Stage::Finished);
        CASE(http::Request::Stage::Header);
    }
    return os;
}

inline std::ostream& operator<<(std::ostream& os, const http::Response::State& state)
{
    switch (state)
    {
        CASE(http::Response::State::New);
        CASE(http::Response::State::Incomplete);
        CASE(http::Response::State::Error);
        CASE(http::Response::State::Timeout);
        CASE(http::Response::State::Complete);
    }
    return os;
}

#undef CASE

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
