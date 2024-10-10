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

#include <ClientRequestDispatcher.hpp>

#if ENABLE_FEATURE_LOCK
#include "CommandControl.hpp"
#endif

#include <Admin.hpp>
#include <COOLWSD.hpp>
#include <ClientSession.hpp>
#include <ConfigUtil.hpp>
#include <wsd/DocumentBroker.hpp>
#include <Exceptions.hpp>
#include <FileServer.hpp>
#include <HttpRequest.hpp>
#include <JailUtil.hpp>
#include <ProofKey.hpp>
#include <ProxyRequestHandler.hpp>
#include <RequestDetails.hpp>
#include <Socket.hpp>
#include <UserMessages.hpp>
#include <Util.hpp>
#include <net/AsyncDNS.hpp>
#include <net/HttpHelper.hpp>
#if !MOBILEAPP
#include <wsd/SpecialBrokers.hpp>
#include <HostUtil.hpp>
#endif // !MOBILEAPP

#include <Poco/DOM/AutoPtr.h>
#include <Poco/DOM/DOMParser.h>
#include <Poco/DOM/DOMWriter.h>
#include <Poco/DOM/Document.h>
#include <Poco/DOM/Element.h>
#include <Poco/DOM/NodeList.h>
#include <Poco/File.h>
#include <Poco/MemoryStream.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/PartHandler.h>
#include <Poco/SAX/InputSource.h>
#include <Poco/StreamCopier.h>

#include <map>
#include <memory>
#include <string>
#include <vector>

std::map<std::string, std::string> ClientRequestDispatcher::StaticFileContentCache;
std::unordered_map<std::string, std::shared_ptr<RequestVettingStation>>
    ClientRequestDispatcher::RequestVettingStations;

extern std::map<std::string, std::shared_ptr<DocumentBroker>> DocBrokers;
extern std::mutex DocBrokersMutex;

extern void cleanupDocBrokers();

namespace
{

/// Used in support key enabled builds
inline void shutdownLimitReached(const std::shared_ptr<ProtocolHandlerInterface>& proto)
{
    if (!proto)
        return;

    const std::string error = Poco::format(PAYLOAD_UNAVAILABLE_LIMIT_REACHED, COOLWSD::MaxDocuments,
                                           COOLWSD::MaxConnections);
    LOG_INF("Sending client 'hardlimitreached' message: " << error);

    try
    {
        // Let the client know we are shutting down.
        proto->sendTextMessage(error);

        // Shutdown.
        proto->shutdown(true, error);
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Error while shutting down socket on reaching limit: " << ex.what());
    }
}

} // end anonymous namespace

/// Find the DocumentBroker for the given docKey, if one exists.
/// Otherwise, creates and adds a new one to DocBrokers.
/// May return null if terminating or MaxDocuments limit is reached.
/// Returns the error message, if any, when no DocBroker is created/found.
std::pair<std::shared_ptr<DocumentBroker>, std::string>
findOrCreateDocBroker(DocumentBroker::ChildType type, const std::string& uri,
                      const std::string& docKey, const std::string& id, const Poco::URI& uriPublic,
                      unsigned mobileAppDocId,
                      std::unique_ptr<WopiStorage::WOPIFileInfo> wopiFileInfo)
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
        if (docBroker->isUnloadingUnrecoverably())
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
            if (config::isSupportKeyEnabled())
            {
                const std::string error = Poco::format(PAYLOAD_UNAVAILABLE_LIMIT_REACHED,
                                                       COOLWSD::MaxDocuments, COOLWSD::MaxConnections);
                return std::make_pair(nullptr, error);
            }
        }

        // Set the one we just created.
        LOG_DBG("New DocumentBroker for docKey [" << docKey << ']');
        docBroker = std::make_shared<DocumentBroker>(type, uri, uriPublic, docKey, mobileAppDocId,
                                                     std::move(wopiFileInfo));
        DocBrokers.emplace(docKey, docBroker);
        LOG_TRC("Have " << DocBrokers.size() << " DocBrokers after inserting [" << docKey << ']');
    }

    return std::make_pair(docBroker, std::string());
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
                                 const std::string& lang, const std::string& target,
                                 const std::string& filter, const std::string& transformJSON)
{
    if (requestType == "convert-to")
        return std::make_shared<ConvertToBroker>(fromPath, uriPublic, docKey, format, options,
                                                 lang);
    else if (requestType == "extract-link-targets")
        return std::make_shared<ExtractLinkTargetsBroker>(fromPath, uriPublic, docKey, lang);
    else if (requestType == "extract-document-structure")
        return std::make_shared<ExtractDocumentStructureBroker>(fromPath, uriPublic, docKey, lang,
                                                                filter);
    else if (requestType == "transform-document-structure")
    {
        if (format.empty())
            return std::make_shared<TransformDocumentStructureBroker>(fromPath, uriPublic, docKey,
                Poco::Path(fromPath).getExtension(), lang, transformJSON);
        else
            return std::make_shared<TransformDocumentStructureBroker>(fromPath, uriPublic, docKey,
                format, lang, transformJSON);
    }
    else if (requestType == "get-thumbnail")
        return std::make_shared<GetThumbnailBroker>(fromPath, uriPublic, docKey, lang, target);

    return nullptr;
}

class ConvertToAddressResolver : public std::enable_shared_from_this<ConvertToAddressResolver>
{
    std::shared_ptr<ConvertToAddressResolver> _selfLifecycle;
    std::vector<std::string> _addressesToResolve;
    ClientRequestDispatcher::AsyncFn _asyncCb;
    bool _allow;

public:

    ConvertToAddressResolver(std::vector<std::string> addressesToResolve, ClientRequestDispatcher::AsyncFn asyncCb)
        : _addressesToResolve(std::move(addressesToResolve))
        , _asyncCb(std::move(asyncCb))
        , _allow(true)
    {
    }

    void testHostName(const std::string& hostToCheck)
    {
        _allow &= HostUtil::allowedWopiHost(hostToCheck);
    }

    // synchronous case
    bool syncProcess()
    {
        assert(!_asyncCb);
        while (!_addressesToResolve.empty())
        {
            const std::string& addressToCheck = _addressesToResolve.front();

            try
            {
                std::string resolvedHostName = net::canonicalHostName(addressToCheck);
                testHostName(resolvedHostName);
            }
            catch (const Poco::Exception& exc)
            {
                LOG_ERR_S("net::canonicalHostName(\"" << addressToCheck
                                                      << "\") failed: " << exc.displayText());
                // We can't find out the hostname, and it already failed the IP check
                _allow = false;
            }

            if (_allow)
            {
                LOG_INF_S("convert-to: Requesting address is allowed: " << addressToCheck);
            }
            else
            {
                LOG_WRN_S("convert-to: Requesting address is denied: " << addressToCheck);
                break;
            }

            _addressesToResolve.pop_back();
        }
        return _allow;
    }

    // asynchronous case
    void startAsyncProcessing()
    {
        assert(_asyncCb);
        _selfLifecycle = shared_from_this();
        dispatchNextLookup();
    }

    std::string toState() const
    {
        std::string state = "ConvertToAddressResolver: ";
        for (const auto& address : _addressesToResolve)
            state += address + ", ";
        state += "\n";
        return state;
    }

    void dispatchNextLookup()
    {
        net::AsyncDNS::DNSThreadFn pushHostnameResolvedToPoll = [this](const net::HostEntry& hostEntry) {
            COOLWSD::getWebServerPoll()->addCallback([this, hostEntry]() {
                hostnameResolved(hostEntry);
            });
        };

        net::AsyncDNS::DNSThreadDumpStateFn dumpState = [this]() -> std::string {
            return toState();
        };

        const std::string& addressToCheck = _addressesToResolve.front();
        net::AsyncDNS::lookup(addressToCheck, {}, pushHostnameResolvedToPoll, dumpState);
    }

    void hostnameResolved(const net::HostEntry& hostEntry)
    {
        if (hostEntry.good())
            testHostName(hostEntry.getCanonicalName());
        else
        {
            LOG_ERR_S("canonicalHostName failed: " << hostEntry.errorMessage());
            // We can't find out the hostname, and it already failed the IP check
            _allow = false;
        }

        const std::string& addressToCheck = _addressesToResolve.front();
        if (_allow)
            LOG_INF_S("convert-to: Requesting address is allowed: " << addressToCheck);
        else
            LOG_WRN_S("convert-to: Requesting address is denied: " << addressToCheck);
        _addressesToResolve.pop_back();

        // If hostToCheck is not allowed, or there are no addresses
        // left to check, then do callback and end
        if (!_allow || _addressesToResolve.empty())
        {
            _asyncCb(_allow);
            _selfLifecycle.reset();
            return;
        }
        dispatchNextLookup();
    }
};

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
                                             const Poco::Net::HTTPRequest& request,
                                             AsyncFn asyncCb)
{
    const bool allow = allowPostFrom(address) || HostUtil::allowedWopiHost(request.getHost());
    if (!allow)
    {
        LOG_WRN_S("convert-to: Requesting address is denied: " << address);
        if (asyncCb)
            asyncCb(false);
        return false;
    }

    LOG_TRC_S("convert-to: Requesting address is allowed: " << address);

    std::vector<std::string> addressesToResolve;

    // Handle forwarded header and make sure all participating IPs are allowed
    if (request.has("X-Forwarded-For"))
    {
        const std::string forwardedData = request.get("X-Forwarded-For");
        LOG_INF_S("convert-to: X-Forwarded-For is: " << forwardedData);
        StringVector tokens = StringVector::tokenize(forwardedData, ',');
        for (const auto& token : tokens)
        {
            std::string param = tokens.getParam(token);
            std::string addressToCheck = Util::trim(param);
            if (!allowPostFrom(addressToCheck))
            {
                // postpone resolving addresses until later
                addressesToResolve.push_back(addressToCheck);
                continue;
            }

            LOG_INF_S("convert-to: Requesting address is allowed: " << addressToCheck);
        }
    }

    if (addressesToResolve.empty())
    {
        if (asyncCb)
            asyncCb(true);
        return true;
    }

    auto resolver = std::make_shared<ConvertToAddressResolver>(std::move(addressesToResolve), asyncCb);
    if (asyncCb)
    {
        resolver->startAsyncProcessing();
        return false;
    }
    return resolver->syncProcess();
}

#endif // !MOBILEAPP

void ClientRequestDispatcher::onConnect(const std::shared_ptr<StreamSocket>& socket)
{
    _id = COOLWSD::GetConnectionId();
    _socket = socket;
    setLogContext(socket->getFD());
    LOG_TRC("Connected to ClientRequestDispatcher");
}

void launchAsyncCheckFileInfo(const std::string& id, const FileServerRequestHandler::ResourceAccessDetails& accessDetails,
                              std::unordered_map<std::string, std::shared_ptr<RequestVettingStation>>& requestVettingStations)
{
    const std::string requestKey = RequestDetails::getRequestKey(
        accessDetails.wopiSrc(), accessDetails.accessToken());

    std::vector<std::string> options = {
        "access_token=" + accessDetails.accessToken(), "access_token_ttl=0"
    };

    if (!accessDetails.permission().empty())
        options.push_back("permission=" + accessDetails.permission());

    const RequestDetails fullRequestDetails =
        RequestDetails(accessDetails.wopiSrc(), options, /*compat=*/std::string());

    if (requestVettingStations.find(requestKey) != requestVettingStations.end())
    {
        LOG_TRC("Found RVS under key: " << requestKey << ", nothing to do");
    }
    else
    {
        LOG_TRC("Creating RVS with key: " << requestKey << ", for DocumentLoadURI: "
                                          << fullRequestDetails.getDocumentURI());
        auto it = requestVettingStations.emplace(
            requestKey, std::make_shared<RequestVettingStation>(
                            COOLWSD::getWebServerPoll(), fullRequestDetails));

        it.first->second->handleRequest(id);
    }
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

    const bool closeConnection = !request.getKeepAlive(); // HTTP/1.1: closeConnection true w/ "Connection: close" only!
    LOG_DBG("Handling request: " << request.getURI() << ", closeConnection " << closeConnection);
    const size_t preInBufferSz = socket->getInBuffer().size();

    // denotes whether the request has been served synchronously
    bool servedSync = false;

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
        const bool isUnitTesting = UnitWSD::isUnitTesting();
        bool handledByUnitTesting = false;
        if (isUnitTesting)
        {
            handledByUnitTesting = UnitWSD::get().handleHttpRequest(request, message, socket);
            if (!handledByUnitTesting)
            {
                auto mapAccessDetails = UnitWSD::get().parallelizeCheckInfo(request, message, socket);
                if (!mapAccessDetails.empty())
                {
                    auto accessDetails = FileServerRequestHandler::ResourceAccessDetails(
                        mapAccessDetails.at("wopiSrc"),
                        mapAccessDetails.at("accessToken"),
                        mapAccessDetails.at("permission"));
                    launchAsyncCheckFileInfo(_id, accessDetails, RequestVettingStations);
                }
            }
        }
        if (handledByUnitTesting)
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
                if (uri.ends_with("lokit-extra-img.svg"))
                {
                    ProxyRequestHandler::handleRequest(uri.substr(pos + ProxyRemoteLen), socket,
                                                       ProxyRequestHandler::getProxyRatingServer());
                    servedSync = true;
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
                        servedSync = true;
                    }
                }
#endif
            }
            else
            {
                FileServerRequestHandler::ResourceAccessDetails accessDetails;
                COOLWSD::FileRequestHandler->handleRequest(request, requestDetails, message, socket,
                                                           accessDetails);
                if (accessDetails.isValid())
                {
                    LOG_ASSERT_MSG(
                        Uri::decode(requestDetails.getField(RequestDetails::Field::WOPISrc)) ==
                            Uri::decode(accessDetails.wopiSrc()),
                        "Expected identical WOPISrc in the request as in cool.html");

                    launchAsyncCheckFileInfo(_id, accessDetails, RequestVettingStations);
                }
                servedSync = true;
            }

            if (!servedSync)
                HttpHelper::sendErrorAndShutdown(http::StatusCode::BadRequest, socket);
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
            else
                HttpHelper::sendErrorAndShutdown(http::StatusCode::BadRequest, socket);
        }
        else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                 requestDetails.equals(1, "getMetrics"))
        {
            if (!COOLWSD::AdminEnabled)
                throw Poco::FileAccessDeniedException("Admin console disabled");

            // See metrics.txt
            std::shared_ptr<http::Response> response =
                std::make_shared<http::Response>(http::StatusCode::OK);

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

            FileServerRequestHandler::hstsHeaders(*response);
            response->add("Last-Modified", Util::getHttpTimeNow());
            // Ask UAs to block if they detect any XSS attempt
            response->add("X-XSS-Protection", "1; mode=block");
            // No referrer-policy
            response->add("Referrer-Policy", "no-referrer");
            response->add("X-Content-Type-Options", "nosniff");

            disposition.setTransfer(Admin::instance(),
                                    [response=std::move(response)](const std::shared_ptr<Socket>& moveSocket)
                                    {
                                        const std::shared_ptr<StreamSocket> streamSocket =
                                            std::static_pointer_cast<StreamSocket>(moveSocket);
                                        Admin::instance().sendMetrics(streamSocket, response);
                                    });
        }
        else if (requestDetails.isGetOrHead("/"))
            servedSync = handleRootRequest(requestDetails, socket);

        else if (requestDetails.isGet("/favicon.ico"))
            servedSync = handleFaviconRequest(requestDetails, socket);

        else if (requestDetails.equals(0, "hosting"))
        {
            if (requestDetails.equals(1, "discovery"))
                servedSync = handleWopiDiscoveryRequest(requestDetails, socket);
            else if (requestDetails.equals(1, "capabilities"))
                servedSync = handleCapabilitiesRequest(request, socket);
            else
                HttpHelper::sendErrorAndShutdown(http::StatusCode::BadRequest, socket);
        }
        else if (requestDetails.isGet("/robots.txt"))
            servedSync = handleRobotsTxtRequest(request, socket);

        else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                 requestDetails.equals(1, "media"))
            servedSync = handleMediaRequest(request, disposition, socket);

        else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                 requestDetails.equals(1, "clipboard"))
        {
            //              Util::dumpHex(std::cerr, socket->getInBuffer(), "clipboard:\n"); // lots of data ...
            servedSync = handleClipboardRequest(request, message, disposition, socket);
        }

        else if (requestDetails.isProxy() && requestDetails.equals(2, "ws"))
            servedSync = handleClientProxyRequest(request, requestDetails, message, disposition);
        else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                 requestDetails.equals(2, "ws") && requestDetails.isWebSocket())
            servedSync = handleClientWsUpgrade(request, requestDetails, disposition, socket);

        else if (!requestDetails.isWebSocket() &&
                 (requestDetails.equals(RequestDetails::Field::Type, "cool") ||
                  requestDetails.equals(RequestDetails::Field::Type, "lool")))
        {
            // All post requests have url prefix 'cool', except when the prefix
            // is 'lool' e.g. when integrations use the old /lool/convert-to endpoint
            servedSync = handlePostRequest(requestDetails, request, message, disposition, socket);
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
            _wopiProxy->handleRequest(COOLWSD::getWebServerPoll(), disposition);
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

    if( socket->getInBuffer().size() > 0 ) // erase request from inBuffer if not cleared by ignoreInput
    {
        // Remove the request header from our input buffer
        socket->eraseFirstInputBytes(map._headerSize);
        if (servedSync)
        {
            // Remove the request body from our input buffer, as it has been served (synchronously)
            // See cool#9621, commit 895c224efae9c21f0481e2fbf024a015656a5a97 and cool#10042
            socket->eraseFirstInputBytes(map._messageSize - map._headerSize);
        }
    }
    if( servedSync && closeConnection && !socket->isClosed() )
    {
        LOG_DBG("Handled request: " << request.getURI()
                << ", inBuf[sz " << preInBufferSz << " -> " << socket->getInBuffer().size()
                << ", rm " <<  (preInBufferSz-socket->getInBuffer().size())
                << "], served and closing connection.");
        socket->shutdown();
        socket->ignoreInput();
    }
    else
        LOG_DBG("Handled request: " << request.getURI()
                << ", inBuf[sz " << preInBufferSz << " -> " << socket->getInBuffer().size()
                << ", rm " <<  (preInBufferSz-socket->getInBuffer().size())
                << "], connection open " << !socket->isClosed());

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
bool ClientRequestDispatcher::handleRootRequest(const RequestDetails& requestDetails,
                                                const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_DBG("HTTP request: " << requestDetails.getURI());
    const std::string mimeType = "text/plain";
    const std::string responseString = "OK";

    http::Response httpResponse(http::StatusCode::OK);
    FileServerRequestHandler::hstsHeaders(httpResponse);
    httpResponse.set("Content-Length", std::to_string(responseString.size()));
    httpResponse.set("Content-Type", mimeType);
    httpResponse.set("Last-Modified", Util::getHttpTimeNow());
    if( requestDetails.closeConnection() )
        httpResponse.header().setConnectionToken(http::Header::ConnectionToken::Close);
    httpResponse.writeData(socket->getOutBuffer());
    if (requestDetails.isGet())
        socket->send(responseString);
    socket->flush();
    LOG_INF("Sent / response successfully.");
    return true;
}

bool ClientRequestDispatcher::handleFaviconRequest(const RequestDetails& requestDetails,
                                                   const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_TRC_S("Favicon request: " << requestDetails.getURI());
    http::Response response(http::StatusCode::OK);
    FileServerRequestHandler::hstsHeaders(response);
    response.setContentType("image/vnd.microsoft.icon");
    if( requestDetails.closeConnection() )
        response.header().setConnectionToken(http::Header::ConnectionToken::Close);
    std::string faviconPath =
        Poco::Path(Poco::Util::Application::instance().commandPath()).parent().toString() +
        "favicon.ico";
    if (!Poco::File(faviconPath).exists())
        faviconPath = COOLWSD::FileServerRoot + "/favicon.ico";

    HttpHelper::sendFile(socket, faviconPath, response);
    return true;
}

bool ClientRequestDispatcher::handleWopiDiscoveryRequest(
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
    FileServerRequestHandler::hstsHeaders(httpResponse);
    httpResponse.setBody(xml, "text/xml");
    httpResponse.set("Last-Modified", Util::getHttpTimeNow());
    httpResponse.set("X-Content-Type-Options", "nosniff");
    if( requestDetails.closeConnection() )
        httpResponse.header().setConnectionToken(http::Header::ConnectionToken::Close);
    LOG_TRC("Sending back discovery.xml: " << xml);
    socket->send(httpResponse);
    LOG_INF("Sent discovery.xml successfully.");
    return true;
}

bool ClientRequestDispatcher::handleClipboardRequest(const Poco::Net::HTTPRequest& request,
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
        return true;
    }

    // Verify that the WOPISrc is properly encoded.
    if (!HttpHelper::verifyWOPISrc(request.getURI(), WOPISrc, socket))
    {
        return false;
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
            else if (mime == "text/html,text/plain;charset=utf-8")
                type = DocumentBroker::CLIP_REQUEST_GET_HTML_PLAIN_ONLY;
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
            [docBroker, type, viewId=std::move(viewId),
             tag=std::move(tag), data=std::move(data)](const std::shared_ptr<Socket>& moveSocket)
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
        return true;
    }
    return false;
}

bool ClientRequestDispatcher::handleRobotsTxtRequest(const Poco::Net::HTTPRequest& request,
                                                     const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_DBG_S("HTTP request: " << request.getURI());
    const std::string responseString = "User-agent: *\nDisallow: /\n";

    http::Response httpResponse(http::StatusCode::OK);
    FileServerRequestHandler::hstsHeaders(httpResponse);
    httpResponse.set("Last-Modified", Util::getHttpTimeNow());
    httpResponse.set("Content-Length", std::to_string(responseString.size()));
    httpResponse.set("Content-Type", "text/plain");
    if( !request.getKeepAlive() )
        httpResponse.header().setConnectionToken(http::Header::ConnectionToken::Close);
    httpResponse.writeData(socket->getOutBuffer());

    if (request.getMethod() == Poco::Net::HTTPRequest::HTTP_GET)
    {
        socket->send(responseString);
    }
    socket->flush();
    LOG_INF_S("Sent robots.txt response successfully");
    return true;
}

bool ClientRequestDispatcher::handleMediaRequest(const Poco::Net::HTTPRequest& request,
                                                 SocketDisposition& /*disposition*/,
                                                 const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_DBG_S("Media request: " << request.getURI());

    const std::string decoded = Uri::decode(request.getURI());
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
        return true;
    }

    // Verify that the WOPISrc is properly encoded.
    if (!HttpHelper::verifyWOPISrc(request.getURI(), WOPISrc, socket))
    {
        return false;
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
            return true;
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
    return false; // async
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
        { "tsv", "text/tab-separated-values" },
        { "dbf", "application/x-dbase" },
        { "wk1", "application/vnd.lotus-1-2-3" },
        { "wks", "application/vnd.lotus-1-2-3" },
        { "wq2", "application/vnd.lotus-1-2-3" },
        { "123", "application/vnd.lotus-1-2-3" },
        { "wb1", "application/vnd.lotus-1-2-3" },
        { "wq1", "application/vnd.lotus-1-2-3" },
        { "xlr", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        { "qpw", "application/vnd.ms-office" },
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

bool ClientRequestDispatcher::handlePostRequest(const RequestDetails& requestDetails,
                                                const Poco::Net::HTTPRequest& request,
                                                Poco::MemoryInputStream& message,
                                                SocketDisposition& disposition,
                                                const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_INF("Post request: [" << COOLWSD::anonymizeUrl(requestDetails.getURI()) << ']');

    if (requestDetails.equals(1, "convert-to") ||
        requestDetails.equals(1, "extract-link-targets") ||
        requestDetails.equals(1, "extract-document-structure") ||
        requestDetails.equals(1, "transform-document-structure") ||
        requestDetails.equals(1, "get-thumbnail"))
    {
        // Validate sender - FIXME: should do this even earlier.
        if (!allowConvertTo(socket->clientAddress(), request, nullptr))
        {
            LOG_WRN(
                "Conversion requests not allowed from this address: " << socket->clientAddress());
            http::Response httpResponse(http::StatusCode::Forbidden);
            httpResponse.set("Content-Length", "0");
            socket->sendAndShutdown(httpResponse);
            socket->ignoreInput();
            return true;
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
                    return true;
                }
                options += ",PDFVer=" + pdfVer + "PDFVEREND";
            }

            std::string lang = (form.has("lang") ? form.get("lang") : std::string());
            std::string target = (form.has("target") ? form.get("target") : std::string());
            std::string filter = (form.has("filter") ? form.get("filter") : std::string());

            std::string encodedTransformJSON;
            if (form.has("transform"))
            {
                std::string transformJSON = form.get("transform");
                Poco::URI::encode(transformJSON, "", encodedTransformJSON);
            }

            // This lock could become a bottleneck.
            // In that case, we can use a pool and index by publicPath.
            std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);

            LOG_DBG("New DocumentBroker for docKey [" << docKey << "].");
            auto docBroker = getConvertToBrokerImplementation(
                requestDetails[1], fromPath, uriPublic, docKey, format, options, lang, target,
                filter, encodedTransformJSON);
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
            return true;
        }
        return false;
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
                    FileUtil::buildLocalPathToJail(COOLWSD::EnableMountNamespaces, COOLWSD::ChildRoot + formChildid,
                                                   JAILED_DOCUMENT_ROOT + std::string("insertfile"));
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
                FileServerRequestHandler::hstsHeaders(httpResponse);
                httpResponse.set("Content-Length", "0");
                socket->sendAndShutdown(httpResponse);
                socket->ignoreInput();
                return true;
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

        const std::string decoded = Uri::decode(url);

        const Poco::Path filePath(FileUtil::buildLocalPathToJail(COOLWSD::EnableMountNamespaces, COOLWSD::ChildRoot + jailId,
                                                                 JAILED_DOCUMENT_ROOT + decoded));
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
            FileServerRequestHandler::hstsHeaders(response);

            // Instruct browsers to download the file, not display it
            // with the exception of SVG where we need the browser to
            // actually show it.
            const std::string contentType = getContentType(fileName);
            response.setContentType(contentType);
            if (serveAsAttachment && contentType != "image/svg+xml")
                response.set("Content-Disposition", "attachment; filename=\"" + fileName + '"');

#if !MOBILEAPP
            if (COOLWSD::WASMState != COOLWSD::WASMActivationState::Disabled)
            {
                response.add("Cross-Origin-Opener-Policy", "same-origin");
                response.add("Cross-Origin-Embedder-Policy", "require-corp");
                response.add("Cross-Origin-Resource-Policy", "cross-origin");
            }
#endif // !MOBILEAPP

            try
            {
                HttpHelper::sendFile(socket, filePath.toString(), response);
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
            return true;
        }
        return false;
    }
    else if (requestDetails.equals(1, "render-search-result"))
    {
        RenderSearchResultPartHandler handler;
        Poco::Net::HTMLForm form(request, message, handler);

        const std::string fromPath = handler.getFilename();

        LOG_INF("Create render-search-result POST command handler");

        if (fromPath.empty())
            return false;

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

        return false;
    }

    throw BadRequestException("Invalid or unknown request.");
}

bool ClientRequestDispatcher::handleClientProxyRequest(const Poco::Net::HTTPRequest& request,
                                                       const RequestDetails& requestDetails,
                                                       Poco::MemoryInputStream& message,
                                                       SocketDisposition& disposition)
{
    //FIXME: The DocumentURI includes the WOPISrc, which makes it potentially invalid URI.
    const std::string url = requestDetails.getLegacyDocumentURI();

    LOG_INF("URL [" << url << "] for Proxy request.");
    const auto uriPublic = RequestDetails::sanitizeURI(url);
    const auto docKey = RequestDetails::getDocKey(uriPublic);
    const std::string fileId = Uri::getFilenameFromURL(docKey);
    Util::mapAnonymized(fileId, fileId); // Identity mapping, since fileId is already obfuscated

    LOG_INF("Starting Proxy request handler for session [" << _id << "] on url ["
                                                           << COOLWSD::anonymizeUrl(url) << "].");

    // Check if readonly session is required.
    const bool isReadOnly = Uri::hasReadonlyPermission(uriPublic.toString());

    LOG_INF("URL [" << COOLWSD::anonymizeUrl(url) << "] is "
                    << (isReadOnly ? "readonly" : "writable") << '.');
    (void)request;
    (void)message;
    (void)disposition;

    // Request a kit process for this doc.
    std::pair<std::shared_ptr<DocumentBroker>, std::string> pair
        = findOrCreateDocBroker(DocumentBroker::ChildType::Interactive, url, docKey, _id, uriPublic,
                              /*mobileAppDocId=*/0, /*wopiFileInfo=*/nullptr);
    auto docBroker = pair.first;

    if (!docBroker)
    {
        const auto& errorMsg = pair.second;
        LOG_ERR("Failed to find document [" << docKey << "]: " << errorMsg);
        // badness occurred:
        auto streamSocket = std::static_pointer_cast<StreamSocket>(disposition.getSocket());
        HttpHelper::sendErrorAndShutdown(http::StatusCode::BadRequest, streamSocket);
        // FIXME: send docunloading & re-try on client ?
        return true;
    }

    // need to move into the DocumentBroker context before doing session lookup / creation etc.
    docBroker->setupTransfer(
        disposition,
        [docBroker, id = _id, uriPublic = std::move(uriPublic), isReadOnly,
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
    return false; // async
}
#endif

bool ClientRequestDispatcher::handleClientWsUpgrade(const Poco::Net::HTTPRequest& request,
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
            if (config::isSupportKeyEnabled())
            {
                shutdownLimitReached(ws);
                return true;
            }
        }

        const std::string requestKey = requestDetails.getRequestKey();
        if (!requestKey.empty())
        {
            auto it = RequestVettingStations.find(requestKey);
            if (it != RequestVettingStations.end())
            {
                LOG_TRC("Found RVS under key: " << requestKey);
                _rvs = it->second;
                RequestVettingStations.erase(it);
            }
        }

        if (!_rvs)
        {
            LOG_TRC("Creating RVS for key: " << requestKey);
            _rvs = std::make_shared<RequestVettingStation>(COOLWSD::getWebServerPoll(),
                                                           requestDetails);
        }

        // Indicate to the client that document broker is searching.
        static constexpr const char* const status = "progress: { \"id\":\"find\" }";
        LOG_TRC("Sending to Client [" << status << ']');
        ws->sendMessage(status);

        _rvs->handleRequest(_id, requestDetails, ws, socket, mobileAppDocId, disposition);
        return false; // async keep alive
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Error while handling Client WS Request: " << exc.what());
        const std::string msg = "error: cmd=internal kind=load";
        ws->sendMessage(msg);
        ws->shutdown(WebSocketHandler::StatusCodes::ENDPOINT_GOING_AWAY, msg);
        socket->ignoreInput();
        return true;
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
    const std::string uriBaseValue = rootUriValue + "/browser/" + Util::getCoolVersionHash() + '/';
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
            // We don't seem to treat this list differently.
            // The assumption seems to be that if a file is not editable,
            // then it's view-only. And if it's view-only, it supports comments.
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

#if !MOBILEAPP

/// Create the /hosting/capabilities JSON and return as string.
static std::string getCapabilitiesJson(bool convertToAvailable)
{
    // Can the convert-to be used?
    Poco::JSON::Object::Ptr convert_to = new Poco::JSON::Object;
    Poco::Dynamic::Var available = convertToAvailable;
    convert_to->set("available", available);
    if (available)
        convert_to->set("endpoint", "/cool/convert-to");

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

    // Set the product version
    capabilities->set("productVersion", Util::getCoolVersion());

    // Set the product version hash
    capabilities->set("productVersionHash", Util::getCoolVersionHash());

    // Set that this is a proxy.php-enabled instance
    capabilities->set("hasProxyPrefix", COOLWSD::IsProxyPrefixEnabled);

    // Set if this instance supports Zotero
    capabilities->set("hasZoteroSupport", config::getBool("zotero.enable", true));

    // Set if this instance supports WASM.
    capabilities->set("hasWASMSupport",
                      COOLWSD::WASMState != COOLWSD::WASMActivationState::Disabled);

    const std::string serverName = config::getString("indirection_endpoint.server_name", "");
    if (const char* podName = std::getenv("POD_NAME"))
        capabilities->set("podName", podName);
    else if (!serverName.empty())
        capabilities->set("podName", serverName);

    if (COOLWSD::IndirectionServerEnabled && COOLWSD::GeolocationSetup)
    {
        std::string timezoneName =
            config::getString("indirection_endpoint.geolocation_setup.timezone", "");
        if (!timezoneName.empty())
            capabilities->set("timezone", std::string(timezoneName));
    }

    std::ostringstream ostrJSON;
    capabilities->stringify(ostrJSON);
    return ostrJSON.str();
}

/// Send the /hosting/capabilities JSON to socket
static void sendCapabilities(bool convertToAvailable, bool closeConnection,
                             const std::shared_ptr<StreamSocket>& socket)
{
    http::Response httpResponse(http::StatusCode::OK);
    FileServerRequestHandler::hstsHeaders(httpResponse);
    httpResponse.set("Last-Modified", Util::getHttpTimeNow());
    httpResponse.setBody(getCapabilitiesJson(convertToAvailable), "application/json");
    httpResponse.set("X-Content-Type-Options", "nosniff");
    if( closeConnection )
        socket->sendAndShutdown(httpResponse);
    else
        socket->send(httpResponse);
    LOG_INF("Sent capabilities.json successfully.");
}

bool ClientRequestDispatcher::handleCapabilitiesRequest(const Poco::Net::HTTPRequest& request,
                                                        const std::shared_ptr<StreamSocket>& socket)
{
    assert(socket && "Must have a valid socket");

    LOG_DBG("Wopi capabilities request: " << request.getURI());
    const bool closeConnection = !request.getKeepAlive();

    AsyncFn convertToAllowedCb = [socket, closeConnection](bool allowedConvert){
        COOLWSD::getWebServerPoll()->addCallback([socket, allowedConvert, closeConnection]()
                                                 { sendCapabilities(allowedConvert, closeConnection, socket); });
    };

    allowConvertTo(socket->clientAddress(), request, std::move(convertToAllowedCb));
    return false;
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
