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

#include <config.h>
#include <config_version.h>

#include <ConfigUtil.hpp>
#include <JailUtil.hpp>
#include <ProofKey.hpp>
#include <Poco/Net/NetException.h>

#include <ClientRequestDispatcher.hpp>

#include <Admin.hpp>
#include <ClientSession.hpp>
#include <COOLWSD.hpp>
#include <DocumentBroker.hpp>
#include <Exceptions.hpp>
#include <FileServer.hpp>
#if !MOBILEAPP
#include <HostUtil.hpp>
#endif // !MOBILEAPP
#include <RequestDetails.hpp>
#include <ProxyRequestHandler.hpp>
#include <WopiProxy.hpp>
#include <net/HttpHelper.hpp>

#include <Poco/File.h>
#include <Poco/StreamCopier.h>
#include <Poco/DOM/AutoPtr.h>
#include <Poco/DOM/DOMWriter.h>
#include <Poco/DOM/Document.h>
#include <Poco/DOM/DOMParser.h>
#include <Poco/DOM/Element.h>
#include <Poco/DOM/NodeList.h>
#include <Poco/Net/DNS.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/PartHandler.h>
#include <Poco/SAX/InputSource.h>

#include <map>
#include <string>

std::map<std::string, std::string> ClientRequestDispatcher::StaticFileContentCache;
extern std::map<std::string, std::shared_ptr<DocumentBroker>> DocBrokers;
extern std::mutex DocBrokersMutex;

extern void cleanupDocBrokers();

namespace
{

void sendLoadResult(const std::shared_ptr<ClientSession>& clientSession, bool success,
                    const std::string& errorMsg)
{
    const std::string result = success ? "" : "Error while loading document";
    const std::string resultstr = success ? "true" : "false";
    // Some sane limit, otherwise we get problems transferring this
    // to the client with large strings (can be a whole webpage)
    // Replace reserved characters
    std::string errorMsgFormatted = COOLProtocol::getAbbreviatedMessage(errorMsg);
    errorMsgFormatted = Poco::translate(errorMsg, "\"", "'");
    clientSession->sendMessage("commandresult: { \"command\": \"load\", \"success\": " + resultstr +
                               ", \"result\": \"" + result + "\", \"errorMsg\": \"" +
                               errorMsgFormatted + "\"}");
}

} // anonymous namespace

/// Find the DocumentBroker for the given docKey, if one exists.
/// Otherwise, creates and adds a new one to DocBrokers.
/// May return null if terminating or MaxDocuments limit is reached.
/// Returns the error message, if any, when no DocBroker is created/found.
std::pair<std::shared_ptr<DocumentBroker>, std::string>
findOrCreateDocBroker(DocumentBroker::ChildType type, const std::string& uri,
                      const std::string& docKey, const std::string& id, const Poco::URI& uriPublic,
                      unsigned mobileAppDocId = 0)
{
    LOG_INF("Find or create DocBroker for docKey ["
            << docKey << "] for session [" << id << "] on url ["
            << COOLWSD::anonymizeUrl(uriPublic.toString()) << ']');

    std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);

    cleanupDocBrokers();

    if (SigUtil::getShutdownRequestFlag())
    {
        // TerminationFlag implies ShutdownRequested.
        LOG_WRN((SigUtil::getTerminationFlag() ? "TerminationFlag" : "ShudownRequestedFlag")
                << " set. Not loading new session [" << id << "] for docKey [" << docKey << ']');

        return std::make_pair(nullptr, "error: cmd=load kind=recycling");
    }

    std::shared_ptr<DocumentBroker> docBroker;

    // Lookup this document.
    const auto it = DocBrokers.find(docKey);
    if (it != DocBrokers.end() && it->second)
    {
        // Get the DocumentBroker from the Cache.
        LOG_DBG("Found DocumentBroker with docKey [" << docKey << ']');
        docBroker = it->second;

        // Destroying the document? Let the client reconnect.
        if (docBroker->isUnloading())
        {
            LOG_WRN("DocBroker [" << docKey
                                  << "] is unloading. Rejecting client request to load session ["
                                  << id << ']');

            return std::make_pair(nullptr, "error: cmd=load kind=docunloading");
        }
    }
    else
    {
        LOG_DBG("No DocumentBroker with docKey [" << docKey
                                                  << "] found. Creating new Child and Document");
    }

    if (SigUtil::getShutdownRequestFlag())
    {
        // TerminationFlag implies ShutdownRequested.
        LOG_ERR((SigUtil::getTerminationFlag() ? "TerminationFlag" : "ShudownRequestedFlag")
                << " set. Not loading new session [" << id << "] for docKey [" << docKey << ']');

        return std::make_pair(nullptr, "error: cmd=load kind=recycling");
    }

    if (!docBroker)
    {
        Util::assertIsLocked(DocBrokersMutex);
        if (DocBrokers.size() + 1 > COOLWSD::MaxDocuments)
        {
            LOG_WRN("Maximum number of open documents of "
                    << COOLWSD::MaxDocuments << " reached while loading new session [" << id
                    << "] for docKey [" << docKey << ']');
#if ENABLE_SUPPORT_KEY
            shutdownLimitReached(proto);
            return nullptr;
#endif
        }

        // Set the one we just created.
        LOG_DBG("New DocumentBroker for docKey [" << docKey << ']');
        docBroker = std::make_shared<DocumentBroker>(type, uri, uriPublic, docKey, mobileAppDocId);
        DocBrokers.emplace(docKey, docBroker);
        LOG_TRC("Have " << DocBrokers.size() << " DocBrokers after inserting [" << docKey << ']');
    }

    return std::make_pair(docBroker, std::string());
}

/// Find the DocumentBroker for the given docKey, if one exists.
/// Otherwise, creates and adds a new one to DocBrokers.
/// May return null if terminating or MaxDocuments limit is reached.
/// After returning a valid instance DocBrokers must be cleaned up after exceptions.
std::shared_ptr<DocumentBroker>
findOrCreateDocBroker(const std::shared_ptr<ProtocolHandlerInterface>& proto,
                      DocumentBroker::ChildType type, const std::string& uri,
                      const std::string& docKey, const std::string& id, const Poco::URI& uriPublic,
                      unsigned mobileAppDocId = 0)
{
    const auto pair = findOrCreateDocBroker(type, uri, docKey, id, uriPublic, mobileAppDocId);
    const std::shared_ptr<DocumentBroker>& docBroker = pair.first;

    if (docBroker)
    {
        // Indicate to the client that we're connecting to the docbroker.
        if (proto)
        {
            const std::string statusConnect = "statusindicator: connect";
            LOG_TRC("Sending to Client [" << statusConnect << ']');
            proto->sendTextMessage(statusConnect.data(), statusConnect.size());
        }

        return docBroker;
    }

    // Failed.
    if (proto)
    {
        const std::string& error = pair.second;
        proto->sendTextMessage(error.data(), error.size(), /*flush=*/true);
        proto->shutdown(true, error);
    }

    return nullptr;
}

#if !MOBILEAPP

/// For clipboard setting
class ClipboardPartHandler : public Poco::Net::PartHandler
{
    std::shared_ptr<std::string> _data; // large.

public:
    std::shared_ptr<std::string> getData() const { return _data; }

    ClipboardPartHandler() {}

    virtual void handlePart(const Poco::Net::MessageHeader& /* header */,
                            std::istream& stream) override
    {
        std::istreambuf_iterator<char> eos;
        _data = std::make_shared<std::string>(std::istreambuf_iterator<char>(stream), eos);
        LOG_TRC("Clipboard stream from part header stored of size " << _data->length());
    }
};

/// Handles the filename part of the convert-to POST request payload,
/// Also owns the file - cleaning it up when destroyed.
class ConvertToPartHandler : public Poco::Net::PartHandler
{
    std::string _filename;

public:
    std::string getFilename() const { return _filename; }

    /// Afterwards someone else is responsible for cleaning that up.
    void takeFile() { _filename.clear(); }

    ConvertToPartHandler() {}

    virtual ~ConvertToPartHandler()
    {
        if (!_filename.empty())
        {
            LOG_TRC("Remove un-handled temporary file '" << _filename << '\'');
            StatelessBatchBroker::removeFile(_filename);
        }
    }

    virtual void handlePart(const Poco::Net::MessageHeader& header, std::istream& stream) override
    {
        // Extract filename and put it to a temporary directory.
        std::string disp;
        Poco::Net::NameValueCollection params;
        if (header.has("Content-Disposition"))
        {
            std::string cd = header.get("Content-Disposition");
            Poco::Net::MessageHeader::splitParameters(cd, disp, params);
        }

        if (!params.has("filename"))
            return;

        // The temporary directory is child-root/<CHILDROOT_TMP_INCOMING_PATH>.
        // Always create a random sub-directory to avoid file-name collision.
        Poco::Path tempPath = Poco::Path::forDirectory(
            FileUtil::createRandomTmpDir(COOLWSD::ChildRoot +
                                         JailUtil::CHILDROOT_TMP_INCOMING_PATH) +
            '/');
        LOG_TRC("Created temporary convert-to/insert path: " << tempPath.toString());

        // Prevent user inputing anything funny here.
        std::string fileParam = params.get("filename");
        std::string cleanFilename = Util::cleanupFilename(fileParam);
        if (fileParam != cleanFilename)
            LOG_DBG("Unexpected characters in conversion filename '"
                    << fileParam << "' cleaned to '" << cleanFilename << "'");

        // A "filename" should always be a filename, not a path
        const Poco::Path filenameParam(cleanFilename);
        if (filenameParam.getFileName() == "callback:")
            tempPath.setFileName("incoming_file"); // A sensible name.
        else
            tempPath.setFileName(filenameParam.getFileName()); //TODO: Sanitize.
        _filename = tempPath.toString();
        LOG_DBG("Storing incoming file to: " << _filename);

        // Copy the stream to _filename.
        std::ofstream fileStream;
        fileStream.open(_filename);
        Poco::StreamCopier::copyStream(stream, fileStream);
        fileStream.close();
    }
};

class RenderSearchResultPartHandler : public Poco::Net::PartHandler
{
private:
    std::string _filename;
    std::shared_ptr<std::vector<char>> _pSearchResultContent;

public:
    std::string getFilename() const { return _filename; }

    /// Afterwards someone else is responsible for cleaning that up.
    void takeFile() { _filename.clear(); }

    const std::shared_ptr<std::vector<char>>& getSearchResultContent() const
    {
        return _pSearchResultContent;
    }

    RenderSearchResultPartHandler() = default;

    virtual ~RenderSearchResultPartHandler()
    {
        if (!_filename.empty())
        {
            LOG_TRC("Remove un-handled temporary file '" << _filename << '\'');
            StatelessBatchBroker::removeFile(_filename);
        }
    }

    virtual void handlePart(const Poco::Net::MessageHeader& header, std::istream& stream) override
    {
        // Extract filename and put it to a temporary directory.
        std::string label;
        Poco::Net::NameValueCollection content;
        if (header.has("Content-Disposition"))
        {
            Poco::Net::MessageHeader::splitParameters(header.get("Content-Disposition"), label,
                                                      content);
        }

        std::string name = content.get("name", "");
        if (name == "document")
        {
            std::string filename = content.get("filename", "");

            const Poco::Path filenameParam(filename);

            // The temporary directory is child-root/<JAIL_TMP_INCOMING_PATH>.
            // Always create a random sub-directory to avoid file-name collision.
            Poco::Path tempPath = Poco::Path::forDirectory(
                FileUtil::createRandomTmpDir(COOLWSD::ChildRoot +
                                             JailUtil::CHILDROOT_TMP_INCOMING_PATH) +
                '/');

            LOG_TRC("Created temporary render-search-result file path: " << tempPath.toString());

            // Prevent user inputting anything funny here.
            // A "filename" should always be a filename, not a path

            if (filenameParam.getFileName() == "callback:")
                tempPath.setFileName("incoming_file"); // A sensible name.
            else
                tempPath.setFileName(filenameParam.getFileName()); //TODO: Sanitize.
            _filename = tempPath.toString();

            // Copy the stream to _filename.
            std::ofstream fileStream;
            fileStream.open(_filename);
            Poco::StreamCopier::copyStream(stream, fileStream);
            fileStream.close();
        }
        else if (name == "result")
        {
            // Copy content from the stream into a std::vector<char>
            _pSearchResultContent = std::make_shared<std::vector<char>>(
                std::istreambuf_iterator<char>(stream), std::istreambuf_iterator<char>());
        }
    }
};

/// Constructs ConvertToBroker implamentation based on request type
std::shared_ptr<ConvertToBroker>
getConvertToBrokerImplementation(const std::string& requestType, const std::string& fromPath,
                                 const Poco::URI& uriPublic, const std::string& docKey,
                                 const std::string& format, const std::string& options,
                                 const std::string& lang, const std::string& target)
{
    if (requestType == "convert-to")
        return std::make_shared<ConvertToBroker>(fromPath, uriPublic, docKey, format, options,
                                                 lang);
    else if (requestType == "extract-link-targets")
        return std::make_shared<ExtractLinkTargetsBroker>(fromPath, uriPublic, docKey, lang);
    else if (requestType == "get-thumbnail")
        return std::make_shared<GetThumbnailBroker>(fromPath, uriPublic, docKey, lang, target);

    return nullptr;
}

bool ClientRequestDispatcher::allowPostFrom(const std::string& address)
{
    static bool init = false;
    static Util::RegexListMatcher hosts;
    if (!init)
    {
        const auto& app = Poco::Util::Application::instance();
        // Parse the host allow settings.
        for (size_t i = 0;; ++i)
        {
            const std::string path = "net.post_allow.host[" + std::to_string(i) + ']';
            const auto host = app.config().getString(path, "");
            if (!host.empty())
            {
                LOG_INF_S("Adding trusted POST_ALLOW host: [" << host << ']');
                hosts.allow(host);
            }
            else if (!app.config().has(path))
            {
                break;
            }
        }

        init = true;
    }

    return hosts.match(address);
}

bool ClientRequestDispatcher::allowConvertTo(const std::string& address,
                                             const Poco::Net::HTTPRequest& request)
{
    std::string addressToCheck = address;
    bool allow = allowPostFrom(addressToCheck) || HostUtil::allowedWopiHost(request.getHost());

    if (!allow)
    {
        LOG_WRN_S("convert-to: Requesting address is denied: " << addressToCheck);
        return false;
    }

    LOG_TRC_S("convert-to: Requesting address is allowed: " << addressToCheck);

    // Handle forwarded header and make sure all participating IPs are allowed
    if (request.has("X-Forwarded-For"))
    {
        const std::string fowardedData = request.get("X-Forwarded-For");
        StringVector tokens = StringVector::tokenize(fowardedData, ',');
        for (const auto& token : tokens)
        {
            std::string param = tokens.getParam(token);
            addressToCheck = Util::trim(param);
            try
            {
                if (!allowPostFrom(addressToCheck))
                {
                    const std::string hostToCheck = Poco::Net::DNS::resolve(addressToCheck).name();
                    allow &= HostUtil::allowedWopiHost(hostToCheck);
                }
            }
            catch (const Poco::Exception& exc)
            {
                LOG_ERR_S("Poco::Net::DNS::resolve(\"" << addressToCheck
                                                       << "\") failed: " << exc.displayText());
                // We can't find out the hostname, and it already failed the IP check
                allow = false;
            }

            if (!allow)
            {
                LOG_WRN_S("convert-to: Requesting address is denied: " << addressToCheck);
                return false;
            }

            LOG_INF_S("convert-to: Requesting address is allowed: " << addressToCheck);
        }
    }

    return allow;
}

#endif // !MOBILEAPP

void ClientRequestDispatcher::onConnect(const std::shared_ptr<StreamSocket>& socket)
{
    _id = COOLWSD::GetConnectionId();
    _socket = socket;
    setLogContext(socket->getFD());
    LOG_TRC("Connected to ClientRequestDispatcher");
}

void ClientRequestDispatcher::handleIncomingMessage(SocketDisposition& disposition)
{
    std::shared_ptr<StreamSocket> socket = _socket.lock();
    if (!socket)
    {
        LOG_ERR("Invalid socket while handling incoming client request");
        return;
    }

#if !MOBILEAPP
    if (!COOLWSD::isSSLEnabled() && socket->sniffSSL())
    {
        LOG_ERR("Looks like SSL/TLS traffic on plain http port");
        HttpHelper::sendErrorAndShutdown(http::StatusCode::BadRequest, socket);
        return;
    }

    Poco::MemoryInputStream startmessage(&socket->getInBuffer()[0], socket->getInBuffer().size());

#if 0 // debug a specific command's payload
        if (Util::findInVector(socket->getInBuffer(), "insertfile") != std::string::npos)
        {
            std::ostringstream oss;
            oss << "Debug - specific command:\n";
            socket->dumpState(oss);
            LOG_INF(oss.str());
        }
#endif

    Poco::Net::HTTPRequest request;

    StreamSocket::MessageMap map;
    if (!socket->parseHeader("Client", startmessage, request, map))
        return;

    LOG_DBG("Handling request: " << request.getURI());
    try
    {
        // We may need to re-write the chunks moving the inBuffer.
        socket->compactChunks(map);
        Poco::MemoryInputStream message(&socket->getInBuffer()[0], socket->getInBuffer().size());
        // update the read cursor - headers are not altered by chunks.
        message.seekg(startmessage.tellg(), std::ios::beg);

        // re-write ServiceRoot and cache.
        RequestDetails requestDetails(request, COOLWSD::ServiceRoot);
        // LOG_TRC("Request details " << requestDetails.toString());

        // Config & security ...
        if (requestDetails.isProxy())
        {
            if (!COOLWSD::IsProxyPrefixEnabled)
                throw BadRequestException(
                    "ProxyPrefix present but net.proxy_prefix is not enabled");
            else if (!socket->isLocal())
                throw BadRequestException("ProxyPrefix request from non-local socket");
        }

        // Routing
        if (UnitWSD::isUnitTesting() && UnitWSD::get().handleHttpRequest(request, message, socket))
        {
            // Unit testing, nothing to do here
        }
        else if (requestDetails.equals(RequestDetails::Field::Type, "browser") ||
                 requestDetails.equals(RequestDetails::Field::Type, "wopi"))
        {
            // File server
            assert(socket && "Must have a valid socket");
            constexpr auto ProxyRemote = "/remote/";
            constexpr auto ProxyRemoteLen = sizeof(ProxyRemote) - 1;
            constexpr auto ProxyRemoteStatic = "/remote/static/";
            const auto uri = requestDetails.getURI();
            const auto pos = uri.find(ProxyRemoteStatic);
            if (pos != std::string::npos)
            {
                if (Util::endsWith(uri, "lokit-extra-img.svg"))
                {
                    ProxyRequestHandler::handleRequest(uri.substr(pos + ProxyRemoteLen), socket,
                                                       ProxyRequestHandler::getProxyRatingServer());
                }
#if ENABLE_FEATURE_LOCK
                else
                {
                    const Poco::URI unlockImageUri =
                        CommandControl::LockManager::getUnlockImageUri();
                    if (!unlockImageUri.empty())
                    {
                        const std::string& serverUri =
                            unlockImageUri.getScheme() + "://" + unlockImageUri.getAuthority();
                        ProxyRequestHandler::handleRequest(
                            uri.substr(pos + sizeof("/remote/static") - 1), socket, serverUri);
                    }
                }
#endif
            }
            else
            {
                COOLWSD::FileRequestHandler->handleRequest(request, requestDetails, message,
                                                           socket);
                socket->shutdown();
            }
        }
        else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                 requestDetails.equals(1, "adminws"))
        {
            // Admin connections
            LOG_INF("Admin request: " << request.getURI());
            if (AdminSocketHandler::handleInitialRequest(_socket, request))
            {
                disposition.setMove(
                    [](const std::shared_ptr<Socket>& moveSocket)
                    {
                        // Hand the socket over to the Admin poll.
                        Admin::instance().insertNewSocket(moveSocket);
                    });
            }
        }
        else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                 requestDetails.equals(1, "getMetrics"))
        {
            // See metrics.txt
            std::shared_ptr<Poco::Net::HTTPResponse> response =
                std::make_shared<Poco::Net::HTTPResponse>();

            if (!COOLWSD::AdminEnabled)
                throw Poco::FileAccessDeniedException("Admin console disabled");

            try
            {
                /* WARNING: security point, we may skip authentication */
                bool skipAuthentication =
                    COOLWSD::getConfigValue<bool>("security.enable_metrics_unauthenticated", false);
                if (!skipAuthentication)
                    if (!COOLWSD::FileRequestHandler->isAdminLoggedIn(request, *response))
                        throw Poco::Net::NotAuthenticatedException("Invalid admin login");
            }
            catch (const Poco::Net::NotAuthenticatedException& exc)
            {
                //LOG_ERR("FileServerRequestHandler::NotAuthenticated: " << exc.displayText());
                http::Response httpResponse(http::StatusCode::Unauthorized);
                httpResponse.set("Content-Type", "text/html charset=UTF-8");
                httpResponse.set("WWW-authenticate", "Basic realm=\"online\"");
                socket->sendAndShutdown(httpResponse);
                socket->ignoreInput();
                return;
            }

            response->add("Last-Modified", Util::getHttpTimeNow());
            // Ask UAs to block if they detect any XSS attempt
            response->add("X-XSS-Protection", "1; mode=block");
            // No referrer-policy
            response->add("Referrer-Policy", "no-referrer");
            response->set("Server", http::getServerString());
            response->add("Content-Type", "text/plain");
            response->add("X-Content-Type-Options", "nosniff");

            disposition.setTransfer(Admin::instance(),
                                    [response](const std::shared_ptr<Socket>& moveSocket)
                                    {
                                        const std::shared_ptr<StreamSocket> streamSocket =
                                            std::static_pointer_cast<StreamSocket>(moveSocket);
                                        Admin::instance().sendMetrics(streamSocket, response);
                                    });
        }
        else if (requestDetails.isGetOrHead("/"))
            handleRootRequest(requestDetails, socket);

        else if (requestDetails.isGet("/favicon.ico"))
            handleFaviconRequest(requestDetails, socket);

        else if (requestDetails.equals(0, "hosting"))
        {
            if (requestDetails.equals(1, "discovery"))
                handleWopiDiscoveryRequest(requestDetails, socket);
            else if (requestDetails.equals(1, "capabilities"))
                handleCapabilitiesRequest(request, socket);
        }
        else if (requestDetails.isGet("/robots.txt"))
            handleRobotsTxtRequest(request, socket);

        else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                 requestDetails.equals(1, "media"))
        {
            handleMediaRequest(request, disposition, socket);
        }
        else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                 requestDetails.equals(1, "clipboard"))
        {
            //              Util::dumpHex(std::cerr, socket->getInBuffer(), "clipboard:\n"); // lots of data ...
            handleClipboardRequest(request, message, disposition, socket);
        }

        else if (requestDetails.isProxy() && requestDetails.equals(2, "ws"))
            handleClientProxyRequest(request, requestDetails, message, disposition);

        else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                 requestDetails.equals(2, "ws") && requestDetails.isWebSocket())
            handleClientWsUpgrade(request, requestDetails, disposition, socket);

        else if (!requestDetails.isWebSocket() &&
                 (requestDetails.equals(RequestDetails::Field::Type, "cool") ||
                  requestDetails.equals(RequestDetails::Field::Type, "lool")))
        {
            // All post requests have url prefix 'cool', except when the prefix
            // is 'lool' e.g. when integrations use the old /lool/convert-to endpoint
            handlePostRequest(requestDetails, request, message, disposition, socket);
        }
        else if (requestDetails.equals(RequestDetails::Field::Type, "wasm"))
        {
            if (COOLWSD::WASMState == COOLWSD::WASMActivationState::Disabled)
            {
                LOG_ERR(
                    "WASM document request while WASM is disabled: " << requestDetails.toString());

                // Bad request.
                HttpHelper::sendErrorAndShutdown(http::StatusCode::BadRequest, socket);
                return;
            }

            // Tunnel to WASM.
            _wopiProxy = std::make_unique<WopiProxy>(_id, requestDetails, socket);
            _wopiProxy->handleRequest(*COOLWSD::getWebServerPoll(), disposition);
        }
        else
        {
            LOG_ERR("Unknown resource: " << requestDetails.toString());

            // Bad request.
            HttpHelper::sendErrorAndShutdown(http::StatusCode::BadRequest, socket);
            return;
        }
    }
    catch (const BadRequestException& ex)
    {
        LOG_ERR('#' << socket->getFD() << " bad request: ["
                    << COOLProtocol::getAbbreviatedMessage(socket->getInBuffer())
                    << "]: " << ex.what());

        // Bad request.
        HttpHelper::sendErrorAndShutdown(http::StatusCode::BadRequest, socket);
        return;
    }
    catch (const std::exception& exc)
    {
        LOG_ERR('#' << socket->getFD() << " Exception while processing incoming request: ["
                    << COOLProtocol::getAbbreviatedMessage(socket->getInBuffer())
                    << "]: " << exc.what());

        // Bad request.
        // NOTE: Check _wsState to choose between HTTP response or WebSocket (app-level) error.
        http::Response httpResponse(http::StatusCode::BadRequest);
        httpResponse.set("Content-Length", "0");
        socket->sendAndShutdown(httpResponse);
        socket->ignoreInput();
        return;
    }

    // if we succeeded - remove the request from our input buffer
    // we expect one request per socket
    socket->eraseFirstInputBytes(map);
#else // !MOBILEAPP
    Poco::Net::HTTPRequest request;

#ifdef IOS
    // The URL of the document is sent over the FakeSocket by the code in
    // -[DocumentViewController userContentController:didReceiveScriptMessage:] when it gets the
    // HULLO message from the JavaScript in global.js.

    // The "app document id", the numeric id of the document, from the appDocIdCounter in CODocument.mm.
    char* space = strchr(socket->getInBuffer().data(), ' ');
    assert(space != nullptr);

    // The socket buffer is not nul-terminated so we can't just call strtoull() on the number at
    // its end, it might be followed in memory by more digits. Is there really no better way to
    // parse the number at the end of the buffer than to copy the bytes into a nul-terminated
    // buffer?
    const size_t appDocIdLen =
        (socket->getInBuffer().data() + socket->getInBuffer().size()) - (space + 1);
    char* appDocIdBuffer = (char*)malloc(appDocIdLen + 1);
    memcpy(appDocIdBuffer, space + 1, appDocIdLen);
    appDocIdBuffer[appDocIdLen] = '\0';
    unsigned appDocId = std::strtoul(appDocIdBuffer, nullptr, 10);
    free(appDocIdBuffer);

    handleClientWsUpgrade(
        request, std::string(socket->getInBuffer().data(), space - socket->getInBuffer().data()),
        disposition, socket, appDocId);
#else // IOS
    handleClientWsUpgrade(
        request,
        RequestDetails(std::string(socket->getInBuffer().data(), socket->getInBuffer().size())),
        disposition, socket);
#endif // !IOS
    socket->getInBuffer().clear();
#endif // MOBILEAPP
}

#if !MOBILEAPP
void ClientRequestDispatcher::handleRootRequest(const RequestDetails& requestDetails,
                                                const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_DBG("HTTP request: " << requestDetails.getURI());
    const std::string mimeType = "text/plain";
    const std::string responseString = "OK";

    http::Response httpResponse(http::StatusCode::OK);
    httpResponse.set("Content-Length", std::to_string(responseString.size()));
    httpResponse.set("Content-Type", mimeType);
    httpResponse.set("Last-Modified", Util::getHttpTimeNow());
    httpResponse.set("Connection", "close");
    httpResponse.writeData(socket->getOutBuffer());
    if (requestDetails.isGet())
        socket->send(responseString);
    socket->flush();
    socket->shutdown();
    LOG_INF("Sent / response successfully.");
}

void ClientRequestDispatcher::handleFaviconRequest(const RequestDetails& requestDetails,
                                                   const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_TRC_S("Favicon request: " << requestDetails.getURI());
    http::Response response(http::StatusCode::OK);
    response.setContentType("image/vnd.microsoft.icon");
    std::string faviconPath =
        Poco::Path(Poco::Util::Application::instance().commandPath()).parent().toString() +
        "favicon.ico";
    if (!Poco::File(faviconPath).exists())
        faviconPath = COOLWSD::FileServerRoot + "/favicon.ico";

    HttpHelper::sendFileAndShutdown(socket, faviconPath, response);
}

void ClientRequestDispatcher::handleWopiDiscoveryRequest(
    const RequestDetails& requestDetails, const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_DBG("Wopi discovery request: " << requestDetails.getURI());

    std::string xml = getFileContent("discovery.xml");
    std::string srvUrl =
#if ENABLE_SSL
        ((COOLWSD::isSSLEnabled() || COOLWSD::isSSLTermination()) ? "https://" : "http://")
#else
        "http://"
#endif
        + (COOLWSD::ServerName.empty() ? requestDetails.getHostUntrusted() : COOLWSD::ServerName) +
        COOLWSD::ServiceRoot;
    if (requestDetails.isProxy())
        srvUrl = requestDetails.getProxyPrefix();
    Poco::replaceInPlace(xml, std::string("%SRV_URI%"), srvUrl);

    http::Response httpResponse(http::StatusCode::OK);
    httpResponse.setBody(xml, "text/xml");
    httpResponse.set("Last-Modified", Util::getHttpTimeNow());
    httpResponse.set("X-Content-Type-Options", "nosniff");
    LOG_TRC("Sending back discovery.xml: " << xml);
    socket->sendAndShutdown(httpResponse);
    LOG_INF("Sent discovery.xml successfully.");
}

void ClientRequestDispatcher::handleCapabilitiesRequest(const Poco::Net::HTTPRequest& request,
                                                        const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_DBG("Wopi capabilities request: " << request.getURI());

    const std::string capabilities = getCapabilitiesJson(request, socket);

    http::Response httpResponse(http::StatusCode::OK);
    httpResponse.set("Last-Modified", Util::getHttpTimeNow());
    httpResponse.setBody(capabilities, "application/json");
    httpResponse.set("X-Content-Type-Options", "nosniff");
    socket->sendAndShutdown(httpResponse);
    LOG_INF("Sent capabilities.json successfully.");
}

void ClientRequestDispatcher::handleClipboardRequest(const Poco::Net::HTTPRequest& request,
                                                     Poco::MemoryInputStream& message,
                                                     SocketDisposition& disposition,
                                                     const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_DBG_S(
        "Clipboard " << ((request.getMethod() == Poco::Net::HTTPRequest::HTTP_GET) ? "GET" : "POST")
                     << " request: " << request.getURI());

    Poco::URI requestUri(request.getURI());
    Poco::URI::QueryParameters params = requestUri.getQueryParameters();
    std::string WOPISrc, serverId, viewId, tag, mime;
    for (const auto& it : params)
    {
        if (it.first == "WOPISrc")
            WOPISrc = it.second;
        else if (it.first == "ServerId")
            serverId = it.second;
        else if (it.first == "ViewId")
            viewId = it.second;
        else if (it.first == "Tag")
            tag = it.second;
        else if (it.first == "MimeType")
            mime = it.second;
    }

    if (serverId != Util::getProcessIdentifier())
    {
        LOG_ERR_S("Cluster configuration error: mis-matching serverid ["
                  << serverId << "] vs. [" << Util::getProcessIdentifier() << "] with tag [" << tag
                  << "] on request to URL: " << request.getURI());

        // we got the wrong request.
        http::Response httpResponse(http::StatusCode::BadRequest);
        httpResponse.set("Content-Length", "0");
        socket->sendAndShutdown(httpResponse);
        socket->ignoreInput();
        return;
    }

    // Verify that the WOPISrc is properly encoded.
    if (!HttpHelper::verifyWOPISrc(request.getURI(), WOPISrc, socket))
    {
        return;
    }

    const auto docKey = RequestDetails::getDocKey(WOPISrc);
    LOG_TRC_S("Clipboard request for us: [" << serverId << "] with tag [" << tag << "] on docKey ["
                                            << docKey << ']');

    std::shared_ptr<DocumentBroker> docBroker;
    {
        std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
        auto it = DocBrokers.find(docKey);
        if (it != DocBrokers.end())
            docBroker = it->second;
    }

    // If we have a valid docBroker, use it.
    // Note: there is a race here as DocBroker may
    // have already exited its SocketPoll, but we
    // haven't cleaned up the DocBrokers container.
    // Since we don't care about creating a new one,
    // we simply go to the fallback below.
    if (docBroker && docBroker->isAlive())
    {
        std::shared_ptr<std::string> data;
        DocumentBroker::ClipboardRequest type;
        if (request.getMethod() == Poco::Net::HTTPRequest::HTTP_GET)
        {
            if (mime == "text/html")
                type = DocumentBroker::CLIP_REQUEST_GET_RICH_HTML_ONLY;
            else
                type = DocumentBroker::CLIP_REQUEST_GET;
        }
        else
        {
            type = DocumentBroker::CLIP_REQUEST_SET;
            ClipboardPartHandler handler;
            Poco::Net::HTMLForm form(request, message, handler);
            data = handler.getData();
            if (!data || data->length() == 0)
                LOG_ERR_S("Invalid zero size set clipboard content with tag ["
                          << tag << "] on docKey [" << docKey << ']');
        }

        // Do things in the right thread.
        LOG_TRC_S("Move clipboard request tag [" << tag << "] to docbroker thread with "
                                                 << (data ? data->length() : 0)
                                                 << " bytes of data");
        docBroker->setupTransfer(
            disposition,
            [docBroker, type, viewId, tag, data](const std::shared_ptr<Socket>& moveSocket)
            {
                auto streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);
                docBroker->handleClipboardRequest(type, streamSocket, viewId, tag, data);
            });
        LOG_TRC_S("queued clipboard command " << type << " on docBroker fetch");
    }
    // fallback to persistent clipboards if we can
    else if (!DocumentBroker::lookupSendClipboardTag(socket, tag, false))
    {
        LOG_ERR_S("Invalid clipboard request to server ["
                  << serverId << "] with tag [" << tag << "] and broker [" << docKey
                  << "]: " << (docBroker ? "" : "not ") << "found");

        std::string errMsg = "Empty clipboard item / session tag " + tag;

        // Bad request.
        HttpHelper::sendErrorAndShutdown(http::StatusCode::BadRequest, socket, errMsg);
    }
}

void ClientRequestDispatcher::handleRobotsTxtRequest(const Poco::Net::HTTPRequest& request,
                                                     const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_DBG_S("HTTP request: " << request.getURI());
    const std::string responseString = "User-agent: *\nDisallow: /\n";

    http::Response httpResponse(http::StatusCode::OK);
    httpResponse.set("Last-Modified", Util::getHttpTimeNow());
    httpResponse.set("Content-Length", std::to_string(responseString.size()));
    httpResponse.set("Content-Type", "text/plain");
    httpResponse.set("Connection", "close");
    httpResponse.writeData(socket->getOutBuffer());

    if (request.getMethod() == Poco::Net::HTTPRequest::HTTP_GET)
    {
        socket->send(responseString);
    }

    socket->shutdown();
    LOG_INF_S("Sent robots.txt response successfully");
}

void ClientRequestDispatcher::handleMediaRequest(const Poco::Net::HTTPRequest& request,
                                                 SocketDisposition& /*disposition*/,
                                                 const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_DBG_S("Media request: " << request.getURI());

    std::string decoded;
    Poco::URI::decode(request.getURI(), decoded);
    Poco::URI requestUri(decoded);
    Poco::URI::QueryParameters params = requestUri.getQueryParameters();
    std::string WOPISrc, serverId, viewId, tag, mime;
    for (const auto& it : params)
    {
        if (it.first == "WOPISrc")
            WOPISrc = it.second;
        else if (it.first == "ServerId")
            serverId = it.second;
        else if (it.first == "ViewId")
            viewId = it.second;
        else if (it.first == "Tag")
            tag = it.second;
        else if (it.first == "MimeType")
            mime = it.second;
    }

    LOG_TRC_S("Media request for us: [" << serverId << "] with tag [" << tag << "] and viewId ["
                                        << viewId << ']');

    if (serverId != Util::getProcessIdentifier())
    {
        LOG_ERR_S("Cluster configuration error: mis-matching serverid ["
                  << serverId << "] vs. [" << Util::getProcessIdentifier()
                  << "] on request to URL: " << request.getURI());

        // we got the wrong request.
        http::Response httpResponse(http::StatusCode::BadRequest);
        httpResponse.set("Content-Length", "0");
        socket->sendAndShutdown(httpResponse);
        socket->ignoreInput();
        return;
    }

    // Verify that the WOPISrc is properly encoded.
    if (!HttpHelper::verifyWOPISrc(request.getURI(), WOPISrc, socket))
    {
        return;
    }

    const auto docKey = RequestDetails::getDocKey(WOPISrc);
    LOG_TRC_S("Looking up DocBroker with docKey [" << docKey << "] referenced in WOPISrc ["
                                                   << WOPISrc
                                                   << "] in media URL: " + request.getURI());

    std::shared_ptr<DocumentBroker> docBroker;
    {
        std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
        auto it = DocBrokers.find(docKey);
        if (it == DocBrokers.end())
        {
            LOG_ERR_S("Unknown DocBroker with docKey [" << docKey << "] referenced in WOPISrc ["
                                                        << WOPISrc
                                                        << "] in media URL: " + request.getURI());

            http::Response httpResponse(http::StatusCode::BadRequest);
            httpResponse.set("Content-Length", "0");
            socket->sendAndShutdown(httpResponse);
            socket->ignoreInput();
            return;
        }

        docBroker = it->second;
    }

    // If we have a valid docBroker, use it.
    // Note: there is a race here as DocBroker may
    // have already exited its SocketPoll, but we
    // haven't cleaned up the DocBrokers container.
    // Since we don't care about creating a new one,
    // we simply go to the fallback below.
    if (docBroker && docBroker->isAlive())
    {
        // Do things in the right thread.
        LOG_TRC_S("Move media request " << tag << " to docbroker thread");

        std::string range = request.get("Range", "none");
        docBroker->handleMediaRequest(std::move(range), socket, tag);
    }
}

std::string ClientRequestDispatcher::getContentType(const std::string& fileName)
{
    static std::unordered_map<std::string, std::string> aContentTypes{
        { "svg", "image/svg+xml" },
        { "pot", "application/vnd.ms-powerpoint" },
        { "xla", "application/vnd.ms-excel" },

        // Writer documents
        { "sxw", "application/vnd.sun.xml.writer" },
        { "odt", "application/vnd.oasis.opendocument.text" },
        { "fodt", "application/vnd.oasis.opendocument.text-flat-xml" },

        // Calc documents
        { "sxc", "application/vnd.sun.xml.calc" },
        { "ods", "application/vnd.oasis.opendocument.spreadsheet" },
        { "fods", "application/vnd.oasis.opendocument.spreadsheet-flat-xml" },

        // Impress documents
        { "sxi", "application/vnd.sun.xml.impress" },
        { "odp", "application/vnd.oasis.opendocument.presentation" },
        { "fodp", "application/vnd.oasis.opendocument.presentation-flat-xml" },

        // Draw documents
        { "sxd", "application/vnd.sun.xml.draw" },
        { "odg", "application/vnd.oasis.opendocument.graphics" },
        { "fodg", "application/vnd.oasis.opendocument.graphics-flat-xml" },

        // Chart documents
        { "odc", "application/vnd.oasis.opendocument.chart" },

        // Text master documents
        { "sxg", "application/vnd.sun.xml.writer.global" },
        { "odm", "application/vnd.oasis.opendocument.text-master" },

        // Math documents
        // In fact Math documents are not supported at all.
        // See: https://bugs.documentfoundation.org/show_bug.cgi?id=97006
        { "sxm", "application/vnd.sun.xml.math" },
        { "odf", "application/vnd.oasis.opendocument.formula" },

        // Text template documents
        { "stw", "application/vnd.sun.xml.writer.template" },
        { "ott", "application/vnd.oasis.opendocument.text-template" },

        // Writer master document templates
        { "otm", "application/vnd.oasis.opendocument.text-master-template" },

        // Spreadsheet template documents
        { "stc", "application/vnd.sun.xml.calc.template" },
        { "ots", "application/vnd.oasis.opendocument.spreadsheet-template" },

        // Presentation template documents
        { "sti", "application/vnd.sun.xml.impress.template" },
        { "otp", "application/vnd.oasis.opendocument.presentation-template" },

        // Drawing template documents
        { "std", "application/vnd.sun.xml.draw.template" },
        { "otg", "application/vnd.oasis.opendocument.graphics-template" },

        // MS Word
        { "doc", "application/msword" },
        { "dot", "application/msword" },

        // MS Excel
        { "xls", "application/vnd.ms-excel" },

        // MS PowerPoint
        { "ppt", "application/vnd.ms-powerpoint" },

        // OOXML wordprocessing
        { "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
        { "docm", "application/vnd.ms-word.document.macroEnabled.12" },
        { "dotx", "application/vnd.openxmlformats-officedocument.wordprocessingml.template" },
        { "dotm", "application/vnd.ms-word.template.macroEnabled.12" },

        // OOXML spreadsheet
        { "xltx", "application/vnd.openxmlformats-officedocument.spreadsheetml.template" },
        { "xltm", "application/vnd.ms-excel.template.macroEnabled.12" },
        { "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        { "xlsb", "application/vnd.ms-excel.sheet.binary.macroEnabled.12" },
        { "xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12" },

        // OOXML presentation
        { "pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
        { "pptm", "application/vnd.ms-powerpoint.presentation.macroEnabled.12" },
        { "potx", "application/vnd.openxmlformats-officedocument.presentationml.template" },
        { "potm", "application/vnd.ms-powerpoint.template.macroEnabled.12" },

        // Others
        { "wpd", "application/vnd.wordperfect" },
        { "pdb", "application/x-aportisdoc" },
        { "hwp", "application/x-hwp" },
        { "wps", "application/vnd.ms-works" },
        { "wri", "application/x-mswrite" },
        { "dif", "application/x-dif-document" },
        { "slk", "text/spreadsheet" },
        { "csv", "text/csv" },
        { "dbf", "application/x-dbase" },
        { "wk1", "application/vnd.lotus-1-2-3" },
        { "cgm", "image/cgm" },
        { "dxf", "image/vnd.dxf" },
        { "emf", "image/x-emf" },
        { "wmf", "image/x-wmf" },
        { "cdr", "application/coreldraw" },
        { "vsd", "application/vnd.visio2013" },
        { "vss", "application/vnd.visio" },
        { "pub", "application/x-mspublisher" },
        { "lrf", "application/x-sony-bbeb" },
        { "gnumeric", "application/x-gnumeric" },
        { "mw", "application/macwriteii" },
        { "numbers", "application/x-iwork-numbers-sffnumbers" },
        { "oth", "application/vnd.oasis.opendocument.text-web" },
        { "p65", "application/x-pagemaker" },
        { "rtf", "text/rtf" },
        { "txt", "text/plain" },
        { "fb2", "application/x-fictionbook+xml" },
        { "cwk", "application/clarisworks" },
        { "wpg", "image/x-wpg" },
        { "pages", "application/x-iwork-pages-sffpages" },
        { "ppsx", "application/vnd.openxmlformats-officedocument.presentationml.slideshow" },
        { "key", "application/x-iwork-keynote-sffkey" },
        { "abw", "application/x-abiword" },
        { "fh", "image/x-freehand" },
        { "sxs", "application/vnd.sun.xml.chart" },
        { "602", "application/x-t602" },
        { "bmp", "image/bmp" },
        { "png", "image/png" },
        { "gif", "image/gif" },
        { "tiff", "image/tiff" },
        { "jpg", "image/jpg" },
        { "jpeg", "image/jpeg" },
        { "pdf", "application/pdf" },
    };

    const std::string sExt = Poco::Path(fileName).getExtension();

    const auto it = aContentTypes.find(sExt);
    if (it != aContentTypes.end())
        return it->second;

    return "application/octet-stream";
}

bool ClientRequestDispatcher::isSpreadsheet(const std::string& fileName)
{
    const std::string sContentType = getContentType(fileName);

    return sContentType == "application/vnd.oasis.opendocument.spreadsheet" ||
           sContentType == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
           sContentType == "application/vnd.ms-excel";
}

void ClientRequestDispatcher::handlePostRequest(const RequestDetails& requestDetails,
                                                const Poco::Net::HTTPRequest& request,
                                                Poco::MemoryInputStream& message,
                                                SocketDisposition& disposition,
                                                const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_INF("Post request: [" << COOLWSD::anonymizeUrl(requestDetails.getURI()) << ']');

    if (requestDetails.equals(1, "convert-to") ||
        requestDetails.equals(1, "extract-link-targets") ||
        requestDetails.equals(1, "get-thumbnail"))
    {
        // Validate sender - FIXME: should do this even earlier.
        if (!allowConvertTo(socket->clientAddress(), request))
        {
            LOG_WRN(
                "Conversion requests not allowed from this address: " << socket->clientAddress());
            http::Response httpResponse(http::StatusCode::Forbidden);
            httpResponse.set("Content-Length", "0");
            socket->sendAndShutdown(httpResponse);
            socket->ignoreInput();
            return;
        }

        ConvertToPartHandler handler;
        Poco::Net::HTMLForm form(request, message, handler);

        std::string format = (form.has("format") ? form.get("format") : "");
        // prefer what is in the URI
        if (requestDetails.size() > 2)
            format = requestDetails[2];

        bool hasRequiredParameters = true;
        if (requestDetails.equals(1, "convert-to") && format.empty())
            hasRequiredParameters = false;

        const std::string fromPath = handler.getFilename();
        LOG_INF("Conversion request for URI [" << fromPath << "] format [" << format << "].");
        if (!fromPath.empty() && hasRequiredParameters)
        {
            Poco::URI uriPublic = RequestDetails::sanitizeURI(fromPath);
            const std::string docKey = RequestDetails::getDocKey(uriPublic);

            std::string options;
            if (form.has("options"))
            {
                // Allow specifying options as-is, in case only data + format are used.
                options = form.get("options");
            }

            const bool fullSheetPreview =
                (form.has("FullSheetPreview") && form.get("FullSheetPreview") == "true");
            if (fullSheetPreview && format == "pdf" && isSpreadsheet(fromPath))
            {
                //FIXME: We shouldn't have "true" as having the option already implies that
                // we want it enabled (i.e. we shouldn't set the option if we don't want it).
                options = ",FullSheetPreview=trueFULLSHEETPREVEND";
            }
            const std::string pdfVer = (form.has("PDFVer") ? form.get("PDFVer") : "");
            if (!pdfVer.empty())
            {
                if (strcasecmp(pdfVer.c_str(), "PDF/A-1b") &&
                    strcasecmp(pdfVer.c_str(), "PDF/A-2b") &&
                    strcasecmp(pdfVer.c_str(), "PDF/A-3b") &&
                    strcasecmp(pdfVer.c_str(), "PDF-1.5") && strcasecmp(pdfVer.c_str(), "PDF-1.6"))
                {
                    LOG_ERR("Wrong PDF type: " << pdfVer << ". Conversion aborted.");
                    http::Response httpResponse(http::StatusCode::BadRequest);
                    httpResponse.set("Content-Length", "0");
                    socket->sendAndShutdown(httpResponse);
                    socket->ignoreInput();
                    return;
                }
                options += ",PDFVer=" + pdfVer + "PDFVEREND";
            }

            std::string lang = (form.has("lang") ? form.get("lang") : std::string());
            std::string target = (form.has("target") ? form.get("target") : std::string());

            // This lock could become a bottleneck.
            // In that case, we can use a pool and index by publicPath.
            std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);

            LOG_DBG("New DocumentBroker for docKey [" << docKey << "].");
            auto docBroker = getConvertToBrokerImplementation(
                requestDetails[1], fromPath, uriPublic, docKey, format, options, lang, target);
            handler.takeFile();

            cleanupDocBrokers();

            DocBrokers.emplace(docKey, docBroker);
            LOG_TRC("Have " << DocBrokers.size() << " DocBrokers after inserting [" << docKey
                            << "].");

            if (!docBroker->startConversion(disposition, _id))
            {
                LOG_WRN("Failed to create Client Session with id [" << _id << "] on docKey ["
                                                                    << docKey << "].");
                cleanupDocBrokers();
            }
        }
        else
        {
            LOG_INF("Missing parameters for conversion request.");
            http::Response httpResponse(http::StatusCode::BadRequest);
            httpResponse.set("Content-Length", "0");
            socket->sendAndShutdown(httpResponse);
            socket->ignoreInput();
        }
        return;
    }
    else if (requestDetails.equals(2, "insertfile"))
    {
        LOG_INF("Insert file request.");

        ConvertToPartHandler handler;
        Poco::Net::HTMLForm form(request, message, handler);

        if (form.has("childid") && form.has("name"))
        {
            const std::string formChildid(form.get("childid"));
            const std::string formName(form.get("name"));

            // Validate the docKey
            const std::string decodedUri = requestDetails.getDocumentURI();
            const std::string docKey = RequestDetails::getDocKey(decodedUri);

            std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
            auto docBrokerIt = DocBrokers.find(docKey);

            // Maybe just free the client from sending childid in form ?
            if (docBrokerIt == DocBrokers.end() || docBrokerIt->second->getJailId() != formChildid)
            {
                throw BadRequestException("DocKey [" + docKey + "] or childid [" + formChildid +
                                          "] is invalid.");
            }
            docBrokersLock.unlock();

            // protect against attempts to inject something funny here
            if (formChildid.find('/') == std::string::npos &&
                formName.find('/') == std::string::npos)
            {
                const std::string dirPath =
                    COOLWSD::ChildRoot + formChildid + JAILED_DOCUMENT_ROOT + "insertfile";
                const std::string fileName = dirPath + '/' + form.get("name");
                LOG_INF("Perform insertfile: " << formChildid << ", " << formName
                                               << ", filename: " << fileName);
                Poco::File(dirPath).createDirectories();
                Poco::File(handler.getFilename()).moveTo(fileName);

                // Cleanup the directory after moving.
                const std::string dir = Poco::Path(handler.getFilename()).parent().toString();
                if (FileUtil::isEmptyDirectory(dir))
                    FileUtil::removeFile(dir);

                handler.takeFile();

                http::Response httpResponse(http::StatusCode::OK);
                httpResponse.set("Content-Length", "0");
                socket->sendAndShutdown(httpResponse);
                socket->ignoreInput();
                return;
            }
        }
    }
    else if (requestDetails.equals(2, "download"))
    {
        LOG_INF("File download request.");
        // TODO: Check that the user in question has access to this file!

        // 1. Validate the dockey
        const std::string decodedUri = requestDetails.getDocumentURI();
        const std::string docKey = RequestDetails::getDocKey(decodedUri);

        std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
        auto docBrokerIt = DocBrokers.find(docKey);
        if (docBrokerIt == DocBrokers.end())
        {
            throw BadRequestException("DocKey [" + docKey + "] is invalid.");
        }

        std::string downloadId = requestDetails[3];
        std::string url = docBrokerIt->second->getDownloadURL(downloadId);
        docBrokerIt->second->unregisterDownloadId(downloadId);
        std::string jailId = docBrokerIt->second->getJailId();

        docBrokersLock.unlock();

        bool foundDownloadId = !url.empty();

        std::string decoded;
        Poco::URI::decode(url, decoded);

        const Poco::Path filePath(COOLWSD::ChildRoot + jailId + JAILED_DOCUMENT_ROOT + decoded);
        const std::string filePathAnonym = COOLWSD::anonymizeUrl(filePath.toString());

        if (foundDownloadId && filePath.isAbsolute() && Poco::File(filePath).exists())
        {
            LOG_INF("HTTP request for: " << filePathAnonym);

            const std::string& fileName = filePath.getFileName();
            const Poco::URI postRequestUri(request.getURI());
            const Poco::URI::QueryParameters postRequestQueryParams =
                postRequestUri.getQueryParameters();

            bool serveAsAttachment = true;
            const auto attachmentIt =
                std::find_if(postRequestQueryParams.begin(), postRequestQueryParams.end(),
                             [](const std::pair<std::string, std::string>& element)
                             { return element.first == "attachment"; });
            if (attachmentIt != postRequestQueryParams.end())
                serveAsAttachment = attachmentIt->second != "0";

            http::Response response(http::StatusCode::OK);

            // Instruct browsers to download the file, not display it
            // with the exception of SVG where we need the browser to
            // actually show it.
            const std::string contentType = getContentType(fileName);
            response.setContentType(contentType);
            if (serveAsAttachment && contentType != "image/svg+xml")
                response.set("Content-Disposition", "attachment; filename=\"" + fileName + '"');

            try
            {
                HttpHelper::sendFileAndShutdown(socket, filePath.toString(), response);
            }
            catch (const Poco::Exception& exc)
            {
                LOG_ERR("Error sending file to client: "
                        << exc.displayText()
                        << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
            }

            FileUtil::removeFile(filePath.toString());
        }
        else
        {
            if (foundDownloadId)
                LOG_ERR("Download file [" << filePathAnonym << "] not found.");
            else
                LOG_ERR("Download with id [" << downloadId << "] not found.");

            http::Response httpResponse(http::StatusCode::NotFound);
            httpResponse.set("Content-Length", "0");
            socket->sendAndShutdown(httpResponse);
        }
        return;
    }
    else if (requestDetails.equals(1, "render-search-result"))
    {
        RenderSearchResultPartHandler handler;
        Poco::Net::HTMLForm form(request, message, handler);

        const std::string fromPath = handler.getFilename();

        LOG_INF("Create render-search-result POST command handler");

        if (fromPath.empty())
            return;

        Poco::URI uriPublic = RequestDetails::sanitizeURI(fromPath);
        const std::string docKey = RequestDetails::getDocKey(uriPublic);

        // This lock could become a bottleneck.
        // In that case, we can use a pool and index by publicPath.
        std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);

        LOG_DBG("New DocumentBroker for docKey [" << docKey << "].");
        auto docBroker = std::make_shared<RenderSearchResultBroker>(
            fromPath, uriPublic, docKey, handler.getSearchResultContent());
        handler.takeFile();

        cleanupDocBrokers();

        DocBrokers.emplace(docKey, docBroker);
        LOG_TRC("Have " << DocBrokers.size() << " DocBrokers after inserting [" << docKey << "].");

        if (!docBroker->executeCommand(disposition, _id))
        {
            LOG_WRN("Failed to create Client Session with id [" << _id << "] on docKey [" << docKey
                                                                << "].");
            cleanupDocBrokers();
        }

        return;
    }

    throw BadRequestException("Invalid or unknown request.");
}

void ClientRequestDispatcher::handleClientProxyRequest(const Poco::Net::HTTPRequest& request,
                                                       const RequestDetails& requestDetails,
                                                       Poco::MemoryInputStream& message,
                                                       SocketDisposition& disposition)
{
    //FIXME: The DocumentURI includes the WOPISrc, which makes it potentially invalid URI.
    const std::string url = requestDetails.getLegacyDocumentURI();

    LOG_INF("URL [" << url << "] for Proxy request.");
    const auto uriPublic = RequestDetails::sanitizeURI(url);
    const auto docKey = RequestDetails::getDocKey(uriPublic);
    const std::string fileId = Util::getFilenameFromURL(docKey);
    Util::mapAnonymized(fileId, fileId); // Identity mapping, since fileId is already obfuscated

    LOG_INF("Starting Proxy request handler for session [" << _id << "] on url ["
                                                           << COOLWSD::anonymizeUrl(url) << "].");

    // Check if readonly session is required
    bool isReadOnly = false;
    for (const auto& param : uriPublic.getQueryParameters())
    {
        LOG_DBG("Query param: " << param.first << ", value: " << param.second);
        if (param.first == "permission" && param.second == "readonly")
        {
            isReadOnly = true;
        }
    }

    LOG_INF("URL [" << COOLWSD::anonymizeUrl(url) << "] is "
                    << (isReadOnly ? "readonly" : "writable") << '.');
    (void)request;
    (void)message;
    (void)disposition;

    std::shared_ptr<ProtocolHandlerInterface> none;
    // Request a kit process for this doc.
    std::shared_ptr<DocumentBroker> docBroker = findOrCreateDocBroker(
        none, DocumentBroker::ChildType::Interactive, url, docKey, _id, uriPublic);
    if (docBroker)
    {
        // need to move into the DocumentBroker context before doing session lookup / creation etc.
        docBroker->setupTransfer(
            disposition,
            [docBroker, id = _id, uriPublic, isReadOnly,
             requestDetails](const std::shared_ptr<Socket>& moveSocket)
            {
                // Now inside the document broker thread ...
                LOG_TRC_S("In the docbroker thread for " << docBroker->getDocKey());

                const int fd = moveSocket->getFD();
                auto streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);
                try
                {
                    docBroker->handleProxyRequest(id, uriPublic, isReadOnly, requestDetails,
                                                  streamSocket);
                    return;
                }
                catch (const UnauthorizedRequestException& exc)
                {
                    LOG_ERR_S("Unauthorized Request while starting session on "
                              << docBroker->getDocKey() << " for socket #" << fd
                              << ". Terminating connection. Error: " << exc.what());
                }
                catch (const StorageConnectionException& exc)
                {
                    LOG_ERR_S("Storage error while starting session on "
                              << docBroker->getDocKey() << " for socket #" << fd
                              << ". Terminating connection. Error: " << exc.what());
                }
                catch (const std::exception& exc)
                {
                    LOG_ERR_S("Error while starting session on "
                              << docBroker->getDocKey() << " for socket #" << fd
                              << ". Terminating connection. Error: " << exc.what());
                }
                // badness occurred:
                HttpHelper::sendErrorAndShutdown(http::StatusCode::BadRequest, streamSocket);
            });
    }
    else
    {
        auto streamSocket = std::static_pointer_cast<StreamSocket>(disposition.getSocket());
        LOG_ERR("Failed to find document");
        // badness occurred:
        HttpHelper::sendErrorAndShutdown(http::StatusCode::BadRequest, streamSocket);
        // FIXME: send docunloading & re-try on client ?
    }
}
#endif

void ClientRequestDispatcher::handleClientWsUpgrade(const Poco::Net::HTTPRequest& request,
                                                    const RequestDetails& requestDetails,
                                                    SocketDisposition& disposition,
                                                    const std::shared_ptr<StreamSocket>& socket,
                                                    unsigned mobileAppDocId)
{
    const std::string url = requestDetails.getDocumentURI();
    assert(socket && "Must have a valid socket");

    // must be trace for anonymization
    LOG_TRC("Client WS request: " << requestDetails.getURI() << ", url: " << url << ", socket #"
                                  << socket->getFD());

    // First Upgrade.
    auto ws = std::make_shared<WebSocketHandler>(socket, request);

    // Response to clients beyond this point is done via WebSocket.
    try
    {
        if (COOLWSD::NumConnections >= COOLWSD::MaxConnections)
        {
            LOG_INF("Limit on maximum number of connections of " << COOLWSD::MaxConnections
                                                                 << " reached.");
#if ENABLE_SUPPORT_KEY
            shutdownLimitReached(ws);
            return;
#endif
        }

        LOG_INF("URL [" << url << "] for WS Request.");
        const auto uriPublic = RequestDetails::sanitizeURI(url);
        const auto docKey = RequestDetails::getDocKey(uriPublic);
        const std::string fileId = Util::getFilenameFromURL(docKey);
        Util::mapAnonymized(fileId,
                            fileId); // Identity mapping, since fileId is already obfuscated

        LOG_INF("Starting GET request handler for session [" << _id << "] on url ["
                                                             << COOLWSD::anonymizeUrl(url) << "].");

        // Indicate to the client that document broker is searching.
        static const std::string status("statusindicator: find");
        LOG_TRC("Sending to Client [" << status << "].");
        ws->sendMessage(status);

        LOG_INF("Sanitized URI [" << COOLWSD::anonymizeUrl(url) << "] to ["
                                  << COOLWSD::anonymizeUrl(uriPublic.toString())
                                  << "] and mapped to docKey [" << docKey << "] for session ["
                                  << _id << "].");

        // Check if readonly session is required
        bool isReadOnly = false;
        for (const auto& param : uriPublic.getQueryParameters())
        {
            LOG_TRC("Query param: " << param.first << ", value: " << param.second);
            if (param.first == "permission" && param.second == "readonly")
            {
                isReadOnly = true;
            }
        }

        LOG_INF("URL [" << COOLWSD::anonymizeUrl(url) << "] is "
                        << (isReadOnly ? "readonly" : "writable"));

        // Request a kit process for this doc.
        std::shared_ptr<DocumentBroker> docBroker = findOrCreateDocBroker(
            std::static_pointer_cast<ProtocolHandlerInterface>(ws),
            DocumentBroker::ChildType::Interactive, url, docKey, _id, uriPublic, mobileAppDocId);
        if (docBroker)
        {
            std::shared_ptr<ClientSession> clientSession =
                docBroker->createNewClientSession(ws, _id, uriPublic, isReadOnly, requestDetails);
            if (clientSession)
            {
                // Transfer the client socket to the DocumentBroker when we get back to the poll:
                docBroker->setupTransfer(
                    disposition,
                    [docBroker, clientSession, ws](const std::shared_ptr<Socket>& moveSocket)
                    {
                        try
                        {
                            auto streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);

                            // Set WebSocketHandler's socket after its construction for shared_ptr goodness.
                            streamSocket->setHandler(ws);

                            LOG_DBG_S('#' << moveSocket->getFD() << " handler is "
                                          << clientSession->getName());

                            // Add and load the session.
                            docBroker->addSession(clientSession);

                            COOLWSD::checkDiskSpaceAndWarnClients(true);
                            // Users of development versions get just an info
                            // when reaching max documents or connections
                            COOLWSD::checkSessionLimitsAndWarnClients();

                            sendLoadResult(clientSession, true, "");
                        }
                        catch (const UnauthorizedRequestException& exc)
                        {
                            LOG_ERR_S("Unauthorized Request while starting session on "
                                      << docBroker->getDocKey() << " for socket #"
                                      << moveSocket->getFD()
                                      << ". Terminating connection. Error: " << exc.what());
                            const std::string msg = "error: cmd=internal kind=unauthorized";
                            ws->shutdown(WebSocketHandler::StatusCodes::POLICY_VIOLATION, msg);
                            moveSocket->ignoreInput();
                        }
                        catch (const StorageConnectionException& exc)
                        {
                            LOG_ERR_S("Storage error while starting session on "
                                      << docBroker->getDocKey() << " for socket #"
                                      << moveSocket->getFD()
                                      << ". Terminating connection. Error: " << exc.what());
                            const std::string msg = "error: cmd=storage kind=loadfailed";
                            ws->shutdown(WebSocketHandler::StatusCodes::POLICY_VIOLATION, msg);
                            moveSocket->ignoreInput();
                        }
                        catch (const std::exception& exc)
                        {
                            LOG_ERR_S("Error while starting session on "
                                      << docBroker->getDocKey() << " for socket #"
                                      << moveSocket->getFD()
                                      << ". Terminating connection. Error: " << exc.what());
                            const std::string msg = "error: cmd=storage kind=loadfailed";
                            ws->shutdown(WebSocketHandler::StatusCodes::POLICY_VIOLATION, msg);
                            moveSocket->ignoreInput();
                        }
                    });
            }
            else
            {
                LOG_WRN("Failed to create Client Session with id [" << _id << "] on docKey ["
                                                                    << docKey << "].");
                throw std::runtime_error("Cannot create client session for doc " + docKey);
            }
        }
        else
        {
            throw ServiceUnavailableException("Failed to create DocBroker with docKey [" + docKey +
                                              "].");
        }
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Error while handling Client WS Request: " << exc.what());
        const std::string msg = "error: cmd=internal kind=load";
        ws->sendMessage(msg);
        ws->shutdown(WebSocketHandler::StatusCodes::ENDPOINT_GOING_AWAY, msg);
        socket->ignoreInput();
    }
}

/// Lookup cached file content.
const std::string& ClientRequestDispatcher::getFileContent(const std::string& filename)
{
    const auto it = StaticFileContentCache.find(filename);
    if (it == StaticFileContentCache.end())
    {
        throw Poco::FileAccessDeniedException("Invalid or forbidden file path: [" + filename +
                                              "].");
    }

    return it->second;
}

/// Process the discovery.xml file and return as string.
std::string ClientRequestDispatcher::getDiscoveryXML()
{
#if MOBILEAPP
    // not needed for mobile
    return std::string();
#else
    std::string discoveryPath =
        Poco::Path(Poco::Util::Application::instance().commandPath()).parent().toString() +
        "discovery.xml";
    if (!Poco::File(discoveryPath).exists())
    {
        // http://server/hosting/discovery.xml
        discoveryPath = COOLWSD::FileServerRoot + "/discovery.xml";
    }

    const std::string action = "action";
    const std::string favIconUrl = "favIconUrl";
    const std::string urlsrc = "urlsrc";

    const std::string rootUriValue = "%SRV_URI%";
    const std::string uriBaseValue = rootUriValue + "/browser/" COOLWSD_VERSION_HASH "/";
    const std::string uriValue = uriBaseValue + "cool.html?";

    LOG_DBG_S("Processing discovery.xml from " << discoveryPath);
    Poco::XML::InputSource inputSrc(discoveryPath);
    Poco::XML::DOMParser parser;
    Poco::AutoPtr<Poco::XML::Document> docXML = parser.parse(&inputSrc);
    Poco::AutoPtr<Poco::XML::NodeList> listNodes = docXML->getElementsByTagName(action);

    for (unsigned long it = 0; it < listNodes->length(); ++it)
    {
        Poco::XML::Element* elem = static_cast<Poco::XML::Element*>(listNodes->item(it));
        Poco::XML::Element* parent =
            elem->parentNode() ? static_cast<Poco::XML::Element*>(elem->parentNode()) : nullptr;
        if (parent && parent->getAttribute("name") == "Capabilities")
        {
            elem->setAttribute(urlsrc, rootUriValue + CAPABILITIES_END_POINT);
        }
        else
        {
            elem->setAttribute(urlsrc, uriValue);
        }

        // Set the View extensions cache as well.
        if (elem->getAttribute("name") == "edit")
        {
            const std::string ext = elem->getAttribute("ext");
            if (COOLWSD::EditFileExtensions.insert(ext).second) // Skip duplicates.
                LOG_DBG_S("Enabling editing of [" << ext << "] extension files");
        }
        else if (elem->getAttribute("name") == "view_comment")
        {
            const std::string ext = elem->getAttribute("ext");
            if (COOLWSD::ViewWithCommentsFileExtensions.insert(ext).second) // Skip duplicates.
                LOG_DBG_S("Enabling commenting on [" << ext << "] extension files");
        }
    }

    // turn "images/img.svg" into "http://server.tld/browser/12345abcd/images/img.svg"
    listNodes = docXML->getElementsByTagName("app");
    for (unsigned long it = 0; it < listNodes->length(); ++it)
    {
        Poco::XML::Element* elem = static_cast<Poco::XML::Element*>(listNodes->item(it));

        if (elem->hasAttribute(favIconUrl))
        {
            elem->setAttribute(favIconUrl, uriBaseValue + elem->getAttribute(favIconUrl));
        }
    }

    const auto& proofAttribs = GetProofKeyAttributes();
    if (!proofAttribs.empty())
    {
        // Add proof-key element to wopi-discovery root
        Poco::AutoPtr<Poco::XML::Element> keyElem = docXML->createElement("proof-key");
        for (const auto& attrib : proofAttribs)
            keyElem->setAttribute(attrib.first, attrib.second);
        docXML->documentElement()->appendChild(keyElem);
    }

    std::ostringstream ostrXML;
    Poco::XML::DOMWriter writer;
    writer.writeNode(ostrXML, docXML);
    return ostrXML.str();
#endif
}

/// Create the /hosting/capabilities JSON and return as string.
std::string
ClientRequestDispatcher::getCapabilitiesJson(const Poco::Net::HTTPRequest& request,
                                             const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    // Can the convert-to be used?
    Poco::JSON::Object::Ptr convert_to = new Poco::JSON::Object;
#if !MOBILEAPP
    Poco::Dynamic::Var available = allowConvertTo(socket->clientAddress(), request);
    convert_to->set("available", available);
    if (available)
        convert_to->set("endpoint", "/cool/convert-to");
#else
    // convert-to is not supported on mobile apps as it requires wopi.
    (void)request;
    Poco::Dynamic::Var available = false;
    convert_to->set("available", available);
#endif // MOBILEAPP

    Poco::JSON::Object::Ptr capabilities = new Poco::JSON::Object;
    capabilities->set("convert-to", convert_to);

    // Supports the TemplateSaveAs in CheckFileInfo?
    // TemplateSaveAs is broken by design, disable it everywhere (and
    // remove at some stage too)
    capabilities->set("hasTemplateSaveAs", false);

    // Supports the TemplateSource in CheckFileInfo?
    capabilities->set("hasTemplateSource", true);

    // Hint to encourage use on mobile devices
    capabilities->set("hasMobileSupport", true);

    // Set the product name
    capabilities->set("productName", config::getString("product_name", APP_NAME));

    // Set the Server ID
    capabilities->set("serverId", Util::getProcessIdentifier());

    std::string version, hash;
    Util::getVersionInfo(version, hash);

    // Set the product version
    capabilities->set("productVersion", version);

    // Set the product version hash
    capabilities->set("productVersionHash", hash);

    // Set that this is a proxy.php-enabled instance
    capabilities->set("hasProxyPrefix", COOLWSD::IsProxyPrefixEnabled);

    // Set if this instance supports Zotero
    capabilities->set("hasZoteroSupport", config::getBool("zotero.enable", true));

#if !MOBILEAPP
    // Set if this instance supports WASM.
    capabilities->set("hasWASMSupport",
                      COOLWSD::WASMState != COOLWSD::WASMActivationState::Disabled);
#endif // !MOBILEAPP

    std::ostringstream ostrJSON;
    capabilities->stringify(ostrJSON);
    return ostrJSON.str();
}
