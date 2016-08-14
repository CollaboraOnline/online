/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

/* Default host used in the start test URI */
#define LOOLWSD_TEST_HOST "localhost"

/* Default loleaflet UI used in the start test URI */
#define LOOLWSD_TEST_LOLEAFLET_UI "/loleaflet/" LOOLWSD_VERSION_HASH "/loleaflet.html"

/* Default document used in the start test URI */
#define LOOLWSD_TEST_DOCUMENT_RELATIVE_PATH "test/data/hello-world.odt"


// This is the main source for the loolwsd program. LOOL uses several loolwsd processes: one main
// parent process that listens on the TCP port and accepts connections from LOOL clients, and a
// number of child processes, each which handles a viewing (editing) session for one document.

#include <errno.h>
#include <locale.h>
#include <unistd.h>

#include <sys/types.h>
#include <sys/stat.h>
#include <sys/wait.h>

#include <time.h>
#include <stdlib.h>

#include <cassert>
#include <condition_variable>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <map>
#include <mutex>
#include <sstream>
#include <thread>

#include <Poco/DOM/AutoPtr.h>
#include <Poco/DOM/DOMParser.h>
#include <Poco/DOM/DOMWriter.h>
#include <Poco/DOM/Document.h>
#include <Poco/DOM/Element.h>
#include <Poco/DOM/NodeList.h>
#include <Poco/Exception.h>
#include <Poco/File.h>
#include <Poco/FileStream.h>
#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/ConsoleCertificateHandler.h>
#include <Poco/Net/Context.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPRequestHandler.h>
#include <Poco/Net/HTTPRequestHandlerFactory.h>
#include <Poco/Net/HTTPServer.h>
#include <Poco/Net/HTTPServerParams.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTTPServerResponse.h>
#include <Poco/Net/InvalidCertificateHandler.h>
#include <Poco/Net/KeyConsoleHandler.h>
#include <Poco/Net/MessageHeader.h>
#include <Poco/Net/Net.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/PartHandler.h>
#include <Poco/Net/PrivateKeyPassphraseHandler.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/Net/SecureServerSocket.h>
#include <Poco/Net/ServerSocket.h>
#include <Poco/Net/SocketAddress.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/SAX/InputSource.h>
#include <Poco/StreamCopier.h>
#include <Poco/StringTokenizer.h>
#include <Poco/TemporaryFile.h>
#include <Poco/ThreadPool.h>
#include <Poco/URI.h>
#include <Poco/Util/HelpFormatter.h>
#include <Poco/Util/MapConfiguration.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionException.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Util/ServerApplication.h>

#include "Admin.hpp"
#include "Auth.hpp"
#include "Common.hpp"
#include "Exceptions.hpp"
#include "FileServer.hpp"
#include "IoUtil.hpp"
#include "LOOLProtocol.hpp"
#include "LOOLSession.hpp"
#include "LOOLWSD.hpp"
#include "MasterProcessSession.hpp"
#include "QueueHandler.hpp"
#include "Storage.hpp"
#include "UserMessages.hpp"
#include "Util.hpp"
#include "Unit.hpp"
#include "UnitHTTP.hpp"

using namespace LOOLProtocol;

using Poco::Exception;
using Poco::File;
using Poco::Net::HTMLForm;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPRequestHandler;
using Poco::Net::HTTPRequestHandlerFactory;
using Poco::Net::HTTPResponse;
using Poco::Net::HTTPServer;
using Poco::Net::HTTPServerParams;
using Poco::Net::HTTPServerRequest;
using Poco::Net::HTTPServerResponse;
using Poco::Net::MessageHeader;
using Poco::Net::NameValueCollection;
using Poco::Net::PartHandler;
using Poco::Net::SecureServerSocket;
using Poco::Net::ServerSocket;
using Poco::Net::SocketAddress;
using Poco::Net::WebSocket;
using Poco::Path;
using Poco::Process;
using Poco::ProcessHandle;
using Poco::StreamCopier;
using Poco::StringTokenizer;
using Poco::TemporaryFile;
using Poco::Thread;
using Poco::ThreadPool;
using Poco::URI;
using Poco::Util::Application;
using Poco::Util::HelpFormatter;
using Poco::Util::IncompatibleOptionsException;
using Poco::Util::MissingOptionException;
using Poco::Util::Option;
using Poco::Util::OptionSet;
using Poco::Util::ServerApplication;
using Poco::XML::AutoPtr;
using Poco::XML::DOMParser;
using Poco::XML::DOMWriter;
using Poco::XML::Element;
using Poco::XML::InputSource;
using Poco::XML::NodeList;

int ClientPortNumber = DEFAULT_CLIENT_PORT_NUMBER;
int MasterPortNumber = DEFAULT_MASTER_PORT_NUMBER;

/// New LOK child processes ready to host documents.
//TODO: Move to a more sensible namespace.
static bool DisplayVersion = false;
static bool NoCapsForKit = false;
static std::vector<std::shared_ptr<ChildProcess>> newChildren;
static std::mutex newChildrenMutex;
static std::condition_variable newChildrenCV;
static std::chrono::steady_clock::time_point lastForkRequestTime = std::chrono::steady_clock::now();
static std::map<std::string, std::shared_ptr<DocumentBroker>> docBrokers;
static std::mutex docBrokersMutex;
// Sessions to pre-spawned child processes that have connected but are not yet assigned a
// document to work on.
static std::mutex AvailableChildSessionMutex;
static std::condition_variable AvailableChildSessionCV;
static std::map<std::string, std::shared_ptr<MasterProcessSession>> AvailableChildSessions;

#if ENABLE_DEBUG
static int careerSpanSeconds = 0;
#endif

namespace {

static inline
void lcl_shutdownLimitReached(WebSocket& ws)
{
    const std::string error = Poco::format(PAYLOAD_UNAVALABLE_LIMIT_REACHED, MAX_DOCUMENTS, MAX_CONNECTIONS);
    const std::string close = Poco::format(SERVICE_UNAVALABLE_LIMIT_REACHED, static_cast<int>(WebSocket::WS_POLICY_VIOLATION));

    /* loleaflet sends loolclient, load and partrectangles message immediately
       after web socket handshake, so closing web socket fails loading page in
       some sensible browsers. Ignore handshake messages and gracefully
       close in order to send error messages.
    */
    try
    {
        int flags = 0;
        int retries = 7;
        std::vector<char> buffer(READ_BUFFER_SIZE * 100);

        // 5 seconds timeout
        ws.setReceiveTimeout(5000000);
        do
        {
            // ignore loolclient, load and partpagerectangles
            ws.receiveFrame(buffer.data(), buffer.capacity(), flags);
            if (--retries == 4)
            {
                ws.sendFrame(error.data(), error.size());
                ws.shutdown(WebSocket::WS_POLICY_VIOLATION, close);
            }
        }
        while (retries > 0 && (flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE);
    }
    catch (Exception&)
    {
        ws.sendFrame(error.data(), error.size());
        ws.shutdown(WebSocket::WS_POLICY_VIOLATION, close);
    }
}

}

static void forkChildren(const int number)
{
    Util::assertIsLocked(newChildrenMutex);

    if (number > 0)
    {
        const std::string aMessage = "spawn " + std::to_string(number) + "\n";
        Log::debug("MasterToForKit: " + aMessage.substr(0, aMessage.length() - 1));
        IoUtil::writeFIFO(LOOLWSD::ForKitWritePipe, aMessage);
        lastForkRequestTime = std::chrono::steady_clock::now();
    }
}

/// Called on startup only.
static void preForkChildren()
{
    std::unique_lock<std::mutex> lock(newChildrenMutex);
    int numPreSpawn = LOOLWSD::NumPreSpawnedChildren;
    UnitWSD::get().preSpawnCount(numPreSpawn);
    --numPreSpawn; // ForKit always spawns one child at startup.
    forkChildren(numPreSpawn);
}

static void prespawnChildren()
{
    std::unique_lock<std::mutex> lock(newChildrenMutex, std::defer_lock);
    if (!lock.try_lock())
    {
        // We are forking already? Try later.
        return;
    }

    // Do the cleanup first.
    for (int i = newChildren.size() - 1; i >= 0; --i)
    {
        if (!newChildren[i]->isAlive())
        {
            newChildren.erase(newChildren.begin() + i);
        }
    }

    const auto duration = (std::chrono::steady_clock::now() - lastForkRequestTime);
    if (std::chrono::duration_cast<std::chrono::milliseconds>(duration).count() <= CHILD_TIMEOUT_SECS * 1000)
    {
        // Not enough time passed to balance children.
        return;
    }

    const int available = newChildren.size();
    int balance = LOOLWSD::NumPreSpawnedChildren;
    balance -= available;
    forkChildren(balance);
}

static size_t addNewChild(const std::shared_ptr<ChildProcess>& child)
{
    std::unique_lock<std::mutex> lock(newChildrenMutex);
    newChildren.emplace_back(child);
    const auto count = newChildren.size();
    Log::info() << "Have " << count << " "
                << (count == 1 ? "child" : "children")
                << "." << Log::end;

    newChildrenCV.notify_one();
    return count;
}

static std::shared_ptr<ChildProcess> getNewChild()
{
    std::unique_lock<std::mutex> lock(newChildrenMutex);

    namespace chrono = std::chrono;
    const auto startTime = chrono::steady_clock::now();
    do
    {
        const int available = newChildren.size();
        int balance = LOOLWSD::NumPreSpawnedChildren;
        if (available == 0)
        {
            Log::error("getNewChild: No available child. Sending spawn request to forkit and failing.");
        }
        else
        {
            balance -= available - 1; // Minus the one we'll dispatch just now.
            balance = std::max(balance, 0);
        }

        Log::debug("getNewChild: Have " + std::to_string(available) + " children, forking " + std::to_string(balance));
        forkChildren(balance);

        const auto timeout = chrono::milliseconds(CHILD_TIMEOUT_SECS * 1000);
        if (newChildrenCV.wait_for(lock, timeout, [](){ return !newChildren.empty(); }))
        {
            auto child = newChildren.back();
            newChildren.pop_back();

            // Validate before returning.
            if (child && child->isAlive())
            {
                Log::debug("getNewChild: Returning new child [" + std::to_string(child->getPid()) + "].");
                return child;
            }
        }

        Log::debug("getNewChild: No live child, forking more.");
    }
    while (chrono::duration_cast<chrono::milliseconds>(chrono::steady_clock::now() - startTime).count() < CHILD_TIMEOUT_SECS * 4000);

    Log::debug("getNewChild: Timed out while waiting for new child.");
    return nullptr;
}

/// Handles the filename part of the convert-to POST request payload.
class ConvertToPartHandler : public PartHandler
{
    std::string& _filename;
public:
    ConvertToPartHandler(std::string& filename)
        : _filename(filename)
    {
    }

    virtual void handlePart(const MessageHeader& header, std::istream& stream) override
    {
        // Extract filename and put it to a temporary directory.
        std::string disp;
        NameValueCollection params;
        if (header.has("Content-Disposition"))
        {
            std::string cd = header.get("Content-Disposition");
            MessageHeader::splitParameters(cd, disp, params);
        }

        if (!params.has("filename"))
            return;

        Path tempPath = Path::forDirectory(TemporaryFile().tempName() + "/");
        File(tempPath).createDirectories();
        // Prevent user inputting anything funny here.
        // A "filename" should always be a filename, not a path
        const Path filenameParam(params.get("filename"));
        tempPath.setFileName(filenameParam.getFileName());
        _filename = tempPath.toString();

        // Copy the stream to _filename.
        std::ofstream fileStream;
        fileStream.open(_filename);
        StreamCopier::copyStream(stream, fileStream);
        fileStream.close();
    }
};

/// Handle a public connection from a client.
class ClientRequestHandler: public HTTPRequestHandler
{
private:
    static void waitBridgeCompleted(const std::shared_ptr<MasterProcessSession>& session)
    {
        bool isFound = false;
        std::unique_lock<std::mutex> lock(AvailableChildSessionMutex);
        Log::debug() << "Waiting for client session [" << session->getId() << "] to connect." << Log::end;
        AvailableChildSessionCV.wait_for(
            lock,
            std::chrono::milliseconds(COMMAND_TIMEOUT_MS),
            [&isFound, &session]
            {
                return (isFound = AvailableChildSessions.find(session->getId()) != AvailableChildSessions.end());
            });

        if (!isFound)
        {
            // Let the client know we can't serve now.
            Log::error(session->getName() + ": Failed to connect to lokit process. Client cannot serve now.");
            throw WebSocketErrorMessageException(SERVICE_UNAVALABLE_INTERNAL_ERROR);
        }

        Log::debug("Waiting child session permission, done!");
        AvailableChildSessions.erase(session->getId());
    }

    /// Handle POST requests.
    /// Always throw on error, do not set response status here.
    /// Returns true if a response has been sent.
    static bool handlePostRequest(HTTPServerRequest& request, HTTPServerResponse& response, const std::string& id)
    {
        Log::info("Post request: [" + request.getURI() + "]");
        StringTokenizer tokens(request.getURI(), "/?");
        if (tokens.count() >= 3 && tokens[2] == "convert-to")
        {
            std::string fromPath;
            ConvertToPartHandler handler(fromPath);
            HTMLForm form(request, request.stream(), handler);
            const std::string format = (form.has("format") ? form.get("format") : "");

            bool sent = false;
            if (!fromPath.empty())
            {
                if (!format.empty())
                {
                    Log::info("Conversion request for URI [" + fromPath + "].");

                    // Request a kit process for this doc.
                    auto child = getNewChild();
                    if (!child)
                    {
                        // Let the client know we can't serve now.
                        throw std::runtime_error("Failed to spawn lokit child.");
                    }

                    auto uriPublic = DocumentBroker::sanitizeURI(fromPath);
                    const auto docKey = DocumentBroker::getDocKey(uriPublic);
                    auto docBroker = std::make_shared<DocumentBroker>(uriPublic, docKey, LOOLWSD::ChildRoot, child);

                    // This lock could become a bottleneck.
                    // In that case, we can use a pool and index by publicPath.
                    std::unique_lock<std::mutex> lock(docBrokersMutex);

                    //FIXME: What if the same document is already open? Need a fake dockey here?
                    Log::debug("New DocumentBroker for docKey [" + docKey + "].");
                    docBrokers.emplace(docKey, docBroker);

                    // Load the document.
                    std::shared_ptr<WebSocket> ws;
                    auto session = std::make_shared<MasterProcessSession>(id, LOOLSession::Kind::ToClient, ws, docBroker, nullptr);

                    // Request the child to connect to us and add this session.
                    auto sessionsCount = docBroker->addSession(session);
                    Log::trace(docKey + ", ws_sessions++: " + std::to_string(sessionsCount));

                    lock.unlock();

                    // Wait until the client has connected with a prison socket.
                    waitBridgeCompleted(session);
                    // Now the bridge between the client and kit processes is connected
                    // Let messages flow

                    std::string encodedFrom;
                    URI::encode(docBroker->getPublicUri().getPath(), "", encodedFrom);
                    const std::string load = "load url=" + encodedFrom;
                    session->handleInput(load.data(), load.size());

                    // Convert it to the requested format.
                    Path toPath(docBroker->getPublicUri().getPath());
                    toPath.setExtension(format);
                    const std::string toJailURL = "file://" + std::string(JAILED_DOCUMENT_ROOT) + toPath.getFileName();
                    std::string encodedTo;
                    URI::encode(toJailURL, "", encodedTo);
                    std::string saveas = "saveas url=" + encodedTo + " format=" + format + " options=";
                    session->handleInput(saveas.data(), saveas.size());

                    // Send it back to the client.
                    //TODO: Should have timeout to avoid waiting forever.
                    Poco::URI resultURL(session->getSaveAs());
                    if (!resultURL.getPath().empty())
                    {
                        const std::string mimeType = "application/octet-stream";
                        std::string encodedFilePath;
                        URI::encode(resultURL.getPath(), "", encodedFilePath);
                        response.sendFile(encodedFilePath, mimeType);
                        sent = true;
                    }

                    lock.lock();
                    sessionsCount = docBroker->removeSession(id);
                    if (sessionsCount == 0)
                    {
                        Log::debug("Removing DocumentBroker for docKey [" + docKey + "].");
                        docBrokers.erase(docKey);
                    }
                }

                // Clean up the temporary directory the HTMLForm ctor created.
                Path tempDirectory(fromPath);
                tempDirectory.setFileName("");
                Util::removeFile(tempDirectory, /*recursive=*/true);
            }

            if (!sent)
            {
                //TODO: We should differentiate between bad request and failed conversion.
                throw BadRequestException("Failed to convert and send file.");
            }

            return true;
        }
        else if (tokens.count() >= 4 && tokens[3] == "insertfile")
        {
            Log::info("Insert file request.");
            response.set("Access-Control-Allow-Origin", "*");
            response.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            response.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

            std::string tmpPath;
            ConvertToPartHandler handler(tmpPath);
            HTMLForm form(request, request.stream(), handler);

            if (form.has("childid") && form.has("name"))
            {
                const std::string formChildid(form.get("childid"));
                const std::string formName(form.get("name"));

                // Validate the docKey
                std::unique_lock<std::mutex> docBrokersLock(docBrokersMutex);
                std::string decodedUri;
                URI::decode(tokens[2], decodedUri);
                const auto docKey = DocumentBroker::getDocKey(DocumentBroker::sanitizeURI(decodedUri));
                auto docBrokerIt = docBrokers.find(docKey);

                // Maybe just free the client from sending childid in form ?
                if (docBrokerIt == docBrokers.end() || docBrokerIt->second->getJailId() != formChildid)
                {
                    throw BadRequestException("DocKey [" + docKey + "] or childid [" + formChildid + "] is invalid.");
                }
                docBrokersLock.unlock();

                // protect against attempts to inject something funny here
                if (formChildid.find('/') == std::string::npos && formName.find('/') == std::string::npos)
                {
                    Log::info() << "Perform insertfile: " << formChildid << ", " << formName << Log::end;
                    const std::string dirPath = LOOLWSD::ChildRoot + formChildid
                                              + JAILED_DOCUMENT_ROOT + "insertfile";
                    File(dirPath).createDirectories();
                    std::string fileName = dirPath + "/" + form.get("name");
                    File(tmpPath).moveTo(fileName);
                    return false;
                }
            }
        }
        else if (tokens.count() >= 6)
        {
            Log::info("File download request.");
            //TODO: Check that the user in question has access to this file!
            const std::string dirPath = LOOLWSD::ChildRoot + tokens[3]
                                      + JAILED_DOCUMENT_ROOT + tokens[4];
            std::string fileName;
            URI::decode(tokens[5], fileName);
            const std::string filePath = dirPath + "/" + fileName;
            Log::info("HTTP request for: " + filePath);
            File file(filePath);

            // Validate the dockey
            std::string decodedUri;
            URI::decode(tokens[2], decodedUri);
            const auto docKey = DocumentBroker::getDocKey(DocumentBroker::sanitizeURI(decodedUri));
            std::unique_lock<std::mutex> docBrokersLock(docBrokersMutex);
            auto docBrokerIt = docBrokers.find(docKey);
            if (docBrokerIt == docBrokers.end())
            {
                throw BadRequestException("DocKey [" + docKey + "] is invalid.");
            }
            docBrokersLock.unlock();

            if (file.exists())
            {
                response.set("Access-Control-Allow-Origin", "*");
                HTMLForm form(request);
                const std::string mimeType = form.has("mime_type")
                                           ? form.get("mime_type")
                                           : "application/octet-stream";
                response.sendFile(filePath, mimeType);
                //TODO: Cleanup on error.
                Util::removeFile(dirPath, true);
                return true;
            }
            else
            {
                Log::error("Download file [" + filePath + "] not found.");
            }
        }

        throw BadRequestException("Invalid or unknown request.");
    }

    /// Handle GET requests.
    static void handleGetRequest(const std::string& uri, std::shared_ptr<WebSocket>& ws, const std::string& id)
    {
        Log::info("Starting GET request handler for session [" + id + "].");

        // indicator to the client that document broker is searching
        std::string status("statusindicator: find");
        Log::trace("Sending to Client [" + status + "].");
        ws->sendFrame(status.data(), (int) status.size());

        const auto uriPublic = DocumentBroker::sanitizeURI(uri);
        const auto docKey = DocumentBroker::getDocKey(uriPublic);
        std::shared_ptr<DocumentBroker> docBroker;

        // scope the docBrokersLock
        {
            std::unique_lock<std::mutex> docBrokersLock(docBrokersMutex);

            // Lookup this document.
            auto it = docBrokers.find(docKey);
            if (it != docBrokers.end())
            {
                // Get the DocumentBroker from the Cache.
                Log::debug("Found DocumentBroker for docKey [" + docKey + "].");
                docBroker = it->second;
                assert(docBroker);
            }
        }

        if (docBroker)
        {
            // If this document is going out, wait.
            if (docBroker->isMarkedToDestroy())
            {
                Log::debug("Document [" + docKey + "] is marked to destroy, waiting to reload.");
                const auto timeout = POLL_TIMEOUT_MS / 2;
                for (size_t i = 0; i < COMMAND_TIMEOUT_MS / timeout; ++i)
                {
                    std::this_thread::sleep_for(std::chrono::milliseconds(timeout));
                    std::unique_lock<std::mutex> lock(docBrokersMutex);
                    if (docBrokers.find(docKey) == docBrokers.end())
                    {
                        docBroker.reset();
                        break;
                    }
                }

                if (docBroker)
                {
                    // Still here, but marked to destroy. Proceed and hope to recover.
                    Log::error("Timed out while waiting for document to unload before loading.");
                }
            }
        }

        bool newDoc = false;
        if (!docBroker)
        {
            newDoc = true;
            // Request a kit process for this doc.
            auto child = getNewChild();
            if (!child)
            {
                // Let the client know we can't serve now.
                Log::error("Failed to get new child. Service Unavailable.");
                throw WebSocketErrorMessageException(SERVICE_UNAVALABLE_INTERNAL_ERROR);
            }

#if MAX_DOCUMENTS > 0
            if (++LOOLWSD::NumDocBrokers > MAX_DOCUMENTS)
            {
                --LOOLWSD::NumDocBrokers;
                Log::error("Maximum number of open documents reached.");
                lcl_shutdownLimitReached(*ws);
                return;
            }
#endif

            // Set one we just created.
            Log::debug("New DocumentBroker for docKey [" + docKey + "].");
            docBroker = std::make_shared<DocumentBroker>(uriPublic, docKey, LOOLWSD::ChildRoot, child);
            child->setDocumentBroker(docBroker);
        }

        // Validate the broker.
        if (!docBroker || !docBroker->isAlive())
        {
            Log::error("DocBroker is invalid or child had SDS. Service Unavailable.");
            if (!newDoc)
            {
                // Remove.
                std::unique_lock<std::mutex> lock(docBrokersMutex);
                docBrokers.erase(docKey);
#if MAX_DOCUMENTS > 0
                --LOOLWSD::NumDocBrokers;
#endif
            }

            throw WebSocketErrorMessageException(SERVICE_UNAVALABLE_INTERNAL_ERROR);
        }

        // Validate the URI and Storage before moving on.
        const auto fileinfo = docBroker->validate(uriPublic);
        Log::debug("Validated [" + uriPublic.toString() + "]");

        if (newDoc)
        {
            std::unique_lock<std::mutex> lock(docBrokersMutex);
            docBrokers.emplace(docKey, docBroker);
        }

        // Above this point exceptions are safe and will auto-cleanup.
        // Below this, we need to cleanup internal references.
        std::shared_ptr<MasterProcessSession> session;
        try
        {
            // For ToClient sessions, we store incoming messages in a queue and have a separate
            // thread to pump them. This is to empty the queue when we get a "canceltiles" message.
            auto queue = std::make_shared<BasicTileQueue>();
            session = std::make_shared<MasterProcessSession>(id, LOOLSession::Kind::ToClient, ws, docBroker, queue);
            if (!fileinfo._userName.empty())
            {
                Log::debug(uriPublic.toString() + " requested with username [" + fileinfo._userName + "]");
                session->setUserName(fileinfo._userName);
            }

            // Request the child to connect to us and add this session.
            auto sessionsCount = docBroker->addSession(session);
            Log::trace(docKey + ", ws_sessions++: " + std::to_string(sessionsCount));

            // indicator to a client that is waiting to connect to lokit process
            status = "statusindicator: connect";
            Log::trace("Sending to Client [" + status + "].");
            ws->sendFrame(status.data(), (int) status.size());

            // Wait until the client has connected with a prison socket.
            waitBridgeCompleted(session);
            // Now the bridge beetween the client and kit process is connected
            // Let messages flow

            status = "statusindicator: ready";
            Log::trace("Sending to Client [" + status + "].");
            ws->sendFrame(status.data(), (int) status.size());

            QueueHandler handler(queue, session, "wsd_queue_" + session->getId());
            Thread queueHandlerThread;
            queueHandlerThread.start(handler);

            IoUtil::SocketProcessor(ws,
                [&queue](const std::vector<char>& payload)
                {
                    queue->put(payload);
                    return true;
                },
                [&session]() { session->closeFrame(); },
                [&queueHandlerThread]() { return TerminationFlag || !queueHandlerThread.isRunning(); });

            {
                std::unique_lock<std::mutex> docBrokersLock(docBrokersMutex);

                // We can destory if this is the last session.
                // If not, we have to remove the session and check again.
                // Otherwise, we may end up removing the one and only session.
                bool removedSession = false;
                auto canDestroy = docBroker->canDestroy();
                sessionsCount = docBroker->getSessionsCount();
                if (sessionsCount > 1)
                {
                    sessionsCount = docBroker->removeSession(id);
                    removedSession = true;
                    Log::trace(docKey + ", ws_sessions--: " + std::to_string(sessionsCount));
                    canDestroy = docBroker->canDestroy();
                }

                // If we are the last, we must wait for the save to complete.
                if (canDestroy)
                {
                    Log::info("Shutdown of the last session, saving the document before tearing down.");
                }

                // We need to wait until the save notification reaches us
                // and Storage persists the document.
                if (!docBroker->autoSave(canDestroy, COMMAND_TIMEOUT_MS))
                {
                    Log::error("Auto-save before closing failed.");
                }

                if (!removedSession)
                {
                    sessionsCount = docBroker->removeSession(id);
                    Log::trace(docKey + ", ws_sessions--: " + std::to_string(sessionsCount));
                }
            }

            if (session->_bLoadError)
            {
                Log::info("Clearing the queue.");
                queue->clear();
            }

            if (sessionsCount == 0)
            {
                std::unique_lock<std::mutex> docBrokersLock(docBrokersMutex);
                Log::debug("Removing DocumentBroker for docKey [" + docKey + "].");
                docBrokers.erase(docKey);
#if MAX_DOCUMENTS > 0
                --LOOLWSD::NumDocBrokers;
#endif
                Log::info("Removing complete doc [" + docKey + "] from Admin.");
                Admin::instance().rmDoc(docKey);
            }

            Log::info("Finishing GET request handler for session [" + id + "]. Joining the queue.");
            queue->put("eof");
            queueHandlerThread.join();
        }
        catch (const std::exception& exc)
        {
            Log::error("Error in client request handler: " + std::string(exc.what()));
        }

        if (session->isCloseFrame())
        {
            Log::trace("Normal close handshake.");
            if (session->shutdownPeer(WebSocket::WS_NORMAL_CLOSE, ""))
            {
                // Client initiated close handshake
                // respond close frame
                ws->shutdown();
            }
        }
        else
        {
            // something wrong, with internal exceptions
            Log::trace("Abnormal close handshake.");
            session->closeFrame();
            ws->shutdown(WebSocket::WS_ENDPOINT_GOING_AWAY, SERVICE_UNAVALABLE_INTERNAL_ERROR);
            session->shutdownPeer(WebSocket::WS_ENDPOINT_GOING_AWAY, SERVICE_UNAVALABLE_INTERNAL_ERROR);
        }
    }

    /// Sends back the WOPI Discovery XML.
    /// The XML needs to be preprocessed to stamp the correct URL etc.
    /// Returns true if a response has been sent.
    static bool handleGetWOPIDiscovery(HTTPServerRequest& request, HTTPServerResponse& response)
    {
        std::string discoveryPath = Path(Application::instance().commandPath()).parent().toString() + "discovery.xml";
        if (!File(discoveryPath).exists())
        {
            discoveryPath = LOOLWSD_DATADIR "/discovery.xml";
        }

        const std::string mediaType = "text/xml";
        const std::string action = "action";
        const std::string urlsrc = "urlsrc";
        const auto& config = Application::instance().config();
        const std::string loleafletHtml = config.getString("loleaflet_html", "loleaflet.html");
        const std::string uriValue = ((LOOLWSD::isSSLEnabled() || LOOLWSD::isSSLTermination()) ? "https://" : "http://") +
            (LOOLWSD::ServerName.empty() ? request.getHost() : LOOLWSD::ServerName) +
            "/loleaflet/" LOOLWSD_VERSION_HASH "/" + loleafletHtml + "?";

        InputSource inputSrc(discoveryPath);
        DOMParser parser;
        AutoPtr<Poco::XML::Document> docXML = parser.parse(&inputSrc);
        AutoPtr<NodeList> listNodes = docXML->getElementsByTagName(action);

        for (unsigned long it = 0; it < listNodes->length(); ++it)
        {
            static_cast<Element*>(listNodes->item(it))->setAttribute(urlsrc, uriValue);
        }

        std::ostringstream ostrXML;
        DOMWriter writer;
        writer.writeNode(ostrXML, docXML);

        response.set("User-Agent", "LOOLWSD WOPI Agent");
        response.setContentLength(ostrXML.str().length());
        response.setContentType(mediaType);
        response.setChunkedTransferEncoding(false);

        std::ostream& ostr = response.send();
        ostr << ostrXML.str();
        Log::debug("Sent discovery.xml successfully.");
        return true;
    }

public:

    void handleRequest(HTTPServerRequest& request, HTTPServerResponse& response) override
    {
        if (UnitWSD::get().filterHandleRequest(
                UnitWSD::TestRequest::TEST_REQ_CLIENT,
                request, response))
            return;

#if MAX_CONNECTIONS > 0
        if (++LOOLWSD::NumConnections > MAX_CONNECTIONS)
        {
            --LOOLWSD::NumConnections;
            Log::error("Maximum number of connections reached.");
            // accept hand shake
            WebSocket ws(request, response);
            lcl_shutdownLimitReached(ws);
            return;
        }
#endif

        handleClientRequest(request,response);

#if MAX_CONNECTIONS > 0
        --LOOLWSD::NumConnections;
#endif
    }

    static void handleClientRequest(HTTPServerRequest& request, HTTPServerResponse& response)
    {
        const auto id = LOOLWSD::GenSessionId();

        Poco::URI requestUri(request.getURI());
        Log::debug("Handling GET: " + request.getURI());

        StringTokenizer reqPathTokens(request.getURI(), "/?", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

        Util::setThreadName("client_ws_" + id);

        Log::debug("Thread started.");

        bool responded = false;
        try
        {
            if ((request.getMethod() == HTTPRequest::HTTP_GET || request.getMethod() == HTTPRequest::HTTP_HEAD) && request.getURI() == "/")
            {
                std::string mimeType = "text/plain";
                std::string responseString = "OK";
                response.setContentLength(responseString.length());
                response.setContentType(mimeType);
                response.setChunkedTransferEncoding(false);
                std::ostream& ostr = response.send();
                if (request.getMethod() == HTTPRequest::HTTP_GET)
                {
                    ostr << responseString;
                }
                responded = true;
            }
            else if (request.getMethod() == HTTPRequest::HTTP_GET && request.getURI() == "/favicon.ico")
            {
                std::string mimeType = "image/vnd.microsoft.icon";
                std::string faviconPath = Path(Application::instance().commandPath()).parent().toString() + "favicon.ico";
                if (!File(faviconPath).exists())
                {
                    faviconPath = LOOLWSD_DATADIR "/favicon.ico";
                }
                response.setContentType(mimeType);
                response.sendFile(faviconPath, mimeType);
                responded = true;
            }
            else if (request.getMethod() == HTTPRequest::HTTP_GET && request.getURI() == "/hosting/discovery")
            {
                // http://server/hosting/discovery
                responded = handleGetWOPIDiscovery(request, response);
            }
            // All post requests have url prefix, lool
            else if (!(request.find("Upgrade") != request.end() && Poco::icompare(request["Upgrade"], "websocket") == 0) &&
                     reqPathTokens.count() > 0 && reqPathTokens[0] == "lool")
            {
                responded = handlePostRequest(request, response, id);
            }
            else if (reqPathTokens.count() > 2 && reqPathTokens[0] == "lool" && reqPathTokens[2] == "ws")
            {
                auto ws = std::make_shared<WebSocket>(request, response);
                try
                {
                    responded = true; // After upgrading to WS we should not set HTTP response.
                    std::string decodedUri;
                    URI::decode(reqPathTokens[1], decodedUri);
                    handleGetRequest(decodedUri, ws, id);
                }
                catch (const WebSocketErrorMessageException& exc)
                {
                    // Internal error that should be passed on to the client.
                    Log::error(std::string("ClientRequestHandler::handleRequest: WebSocketErrorMessageException: ") + exc.what());
                    try
                    {
                        const std::string msg = std::string("error: ") + exc.what();
                        ws->sendFrame(msg.data(), msg.size());
                        // abnormal close frame handshake
                        ws->shutdown(WebSocket::WS_ENDPOINT_GOING_AWAY, msg);
                    }
                    catch (const std::exception& exc2)
                    {
                        Log::error(std::string("ClientRequestHandler::handleRequest: exception while sending WS error message: ") + exc2.what());
                    }
                }
            }
            else
            {
                Log::error("Unknown resource: " + request.getURI());
                response.setStatusAndReason(HTTPResponse::HTTP_BAD_REQUEST);
            }
        }
        catch (const Exception& exc)
        {
            Log::error() << "ClientRequestHandler::handleRequest: PocoException: " << exc.displayText()
                         << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                         << Log::end;
            response.setStatusAndReason(HTTPResponse::HTTP_SERVICE_UNAVAILABLE);
        }
        catch (const UnauthorizedRequestException& exc)
        {
            Log::error(std::string("ClientRequestHandler::handleRequest: UnauthorizedException: ") + exc.what());
            response.setStatusAndReason(HTTPResponse::HTTP_UNAUTHORIZED);
        }
        catch (const BadRequestException& exc)
        {
            Log::error(std::string("ClientRequestHandler::handleRequest: BadRequestException: ") + exc.what());
            response.setStatusAndReason(HTTPResponse::HTTP_BAD_REQUEST);
        }
        catch (const std::exception& exc)
        {
            Log::error(std::string("ClientRequestHandler::handleRequest: Exception: ") + exc.what());
            response.setStatusAndReason(HTTPResponse::HTTP_SERVICE_UNAVAILABLE);
        }
        catch (...)
        {
            Log::error("ClientRequestHandler::handleRequest:: Unexpected exception");
        }

        if (!responded)
        {
            response.setContentLength(0);
            response.send();
        }

        Log::debug("Thread finished.");
    }
};

/// Handle requests from prisoners (internal).
class PrisonerRequestHandler: public HTTPRequestHandler
{
public:

    void handleRequest(HTTPServerRequest& request, HTTPServerResponse& response) override
    {
        if (UnitWSD::get().filterHandleRequest(
                UnitWSD::TestRequest::TEST_REQ_PRISONER,
                request, response))
            return;

        handlePrisonerRequest(request, response);
    }

    static void handlePrisonerRequest(HTTPServerRequest& request, HTTPServerResponse& response)
    {
        Util::setThreadName("prison_ws");

        Log::debug("Child connection with URI [" + request.getURI() + "].");

        assert(request.serverAddress().port() == MasterPortNumber);
        if (request.getURI().find(NEW_CHILD_URI) == 0)
        {
            // New Child is spawned.
            const auto params = Poco::URI(request.getURI()).getQueryParameters();
            Poco::Process::PID pid = -1;
            for (const auto& param : params)
            {
                if (param.first == "pid")
                {
                    pid = std::stoi(param.second);
                }
                else if (param.first == "version")
                {
                    LOOLWSD::LOKitVersion = param.second;
                }
            }

            if (pid <= 0)
            {
                Log::error("Invalid PID in child URI [" + request.getURI() + "].");
                return;
            }

            Log::info("New child [" + std::to_string(pid) + "].");
            auto ws = std::make_shared<WebSocket>(request, response);
            UnitWSD::get().newChild(ws);

            addNewChild(std::make_shared<ChildProcess>(pid, ws));
            return;
        }

        if (request.getURI().find(CHILD_URI) != 0)
        {
            Log::error("Invalid request URI: [" + request.getURI() + "].");
            return;
        }

        std::string sessionId;
        std::string jailId;
        std::string docKey;
        try
        {
            const auto params = Poco::URI(request.getURI()).getQueryParameters();
            for (const auto& param : params)
            {
                if (param.first == "sessionId")
                {
                    sessionId = param.second;
                }
                else if (param.first == "jailId")
                {
                    jailId = param.second;
                }
                else if (param.first == "docKey")
                {
                    // We store encoded docKey in DocumentBroker only
                    URI::encode(param.second, "", docKey);
                }
            }

            Util::setThreadName("prison_ws_" + sessionId);

            // Misleading debug message, we obviously started already a while ago and have done lots
            // of stuff already.
            Log::debug("Thread started.");

            Log::debug("Child socket for SessionId: " + sessionId + ", jailId: " + jailId +
                       ", docKey: " + docKey + " connected.");

            // Jail id should be the PID, beacuse Admin need it to calculate the memory
            const Poco::Process::PID pid = std::stoi(jailId);

            std::shared_ptr<DocumentBroker> docBroker;
            {
                // This lock could become a bottleneck.
                // In that case, we can use a pool and index by publicPath.
                std::unique_lock<std::mutex> lock(docBrokersMutex);

                // Lookup this document.
                auto it = docBrokers.find(docKey);
                if (it != docBrokers.end())
                {
                    // Get the DocumentBroker from the Cache.
                    docBroker = it->second;
                    assert(docBroker);
                }
                else
                {
                    // The client closed before we started,
                    // or some early failure happened.
                    Log::error("Failed to find DocumentBroker for docKey [" + docKey +
                               "] while handling child connection for session [" + sessionId + "].");
                    throw std::runtime_error("Invalid docKey.");
                }
            }

            docBroker->load(jailId);

            auto ws = std::make_shared<WebSocket>(request, response);
            auto session = std::make_shared<MasterProcessSession>(sessionId, LOOLSession::Kind::ToPrisoner, ws, docBroker, nullptr);

            // Connect the prison session to the client.
            docBroker->connectPeers(session);

            std::unique_lock<std::mutex> lock(AvailableChildSessionMutex);
            AvailableChildSessions.emplace(sessionId, session);

            Log::info() << " mapped " << session << " jailId=" << jailId << ", id=" << sessionId
                        << " into _availableChildSessions, size=" << AvailableChildSessions.size() << Log::end;

            lock.unlock();
            AvailableChildSessionCV.notify_one();

            Log::info("Adding doc " + docKey + " to Admin");
            Admin::instance().addDoc(docKey, pid, docBroker->getFilename(), sessionId);

            UnitWSD::get().onChildConnected(pid, sessionId);

            IoUtil::SocketProcessor(ws,
                [&session](const std::vector<char>& payload)
                {
                    return session->handleInput(payload.data(), payload.size());
                },
                [&session]() { session->closeFrame(); },
                []() { return TerminationFlag; });

            if (session->isCloseFrame())
            {
                Log::trace("Normal close handshake.");
                if (session->shutdownPeer(WebSocket::WS_NORMAL_CLOSE, ""))
                {
                    // LOKit initiated close handshake
                    // respond close frame
                    ws->shutdown();
                }
            }
            else
            {
                // something wrong, with internal exceptions
                Log::trace("Abnormal close handshake.");
                session->closeFrame();
                ws->shutdown(WebSocket::WS_ENDPOINT_GOING_AWAY, SERVICE_UNAVALABLE_INTERNAL_ERROR);
                session->shutdownPeer(WebSocket::WS_ENDPOINT_GOING_AWAY, SERVICE_UNAVALABLE_INTERNAL_ERROR);
            }
        }
        catch (const Exception& exc)
        {
            Log::error() << "PrisonerRequestHandler::handleRequest: Exception: " << exc.displayText()
                         << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                         << Log::end;
        }
        catch (const std::exception& exc)
        {
            Log::error(std::string("PrisonerRequestHandler::handleRequest: Exception: ") + exc.what());
        }
        catch (...)
        {
            Log::error("PrisonerRequestHandler::handleRequest:: Unexpected exception");
        }

        if (!jailId.empty())
        {
            Log::info("Removing doc " + docKey + " from Admin");
            Admin::instance().rmDoc(docKey, sessionId);
        }

        // Replenish.
        prespawnChildren();
        Log::debug("Thread finished.");
    }
};

class ClientRequestHandlerFactory: public HTTPRequestHandlerFactory
{
public:
    ClientRequestHandlerFactory(FileServer& fileServer)
        : _fileServer(fileServer)
        { }

    HTTPRequestHandler* createRequestHandler(const HTTPServerRequest& request) override
    {
        Util::setThreadName("client_req_hdl");

        auto logger = Log::info();
        logger << "Request from " << request.clientAddress().toString() << ": "
               << request.getMethod() << " " << request.getURI() << " "
               << request.getVersion();

        for (const auto& it : request)
        {
            logger << " / " << it.first << ": " << it.second;
        }

        logger << Log::end;

        // Routing
        Poco::URI requestUri(request.getURI());
        std::vector<std::string> reqPathSegs;
        requestUri.getPathSegments(reqPathSegs);
        HTTPRequestHandler* requestHandler;

        // File server
        if (reqPathSegs.size() >= 1 && reqPathSegs[0] == "loleaflet")
        {
            requestHandler = _fileServer.createRequestHandler();
        }
        // Admin WebSocket Connections
        else if (reqPathSegs.size() >= 2 && reqPathSegs[0] == "lool" && reqPathSegs[1] == "adminws")
        {
            requestHandler = Admin::createRequestHandler();
        }
        // Client post and websocket connections
        else
        {
            requestHandler = new ClientRequestHandler();
        }

        return requestHandler;
    }

private:
    FileServer& _fileServer;
};

class PrisonerRequestHandlerFactory: public HTTPRequestHandlerFactory
{
public:
    HTTPRequestHandler* createRequestHandler(const HTTPServerRequest& request) override
    {
        Util::setThreadName("prsnr_req_hdl");

        auto logger = Log::info();
        logger << "Request from " << request.clientAddress().toString() << ": "
               << request.getMethod() << " " << request.getURI() << " "
               << request.getVersion();

        for (const auto& it : request)
        {
            logger << " / " << it.first << ": " << it.second;
        }

        logger << Log::end;
        return new PrisonerRequestHandler();
    }
};

namespace {

static inline
ServerSocket* lcl_getServerSocket(int nClientPortNumber)
{
    return (LOOLWSD::isSSLEnabled()) ? new SecureServerSocket(nClientPortNumber)
                       : new ServerSocket(nClientPortNumber);
}

static inline
std::string lcl_getLaunchURI()
{
    std::string aAbsTopSrcDir = Poco::Path(Application::instance().commandPath()).parent().toString();
    aAbsTopSrcDir = Poco::Path(aAbsTopSrcDir).absolute().toString();

    std::string aLaunchURI("    ");
    aLaunchURI += ((LOOLWSD::isSSLEnabled() || LOOLWSD::isSSLTermination()) ? "https://" : "http://");
    aLaunchURI += LOOLWSD_TEST_HOST ":";
    aLaunchURI += std::to_string(ClientPortNumber);
    aLaunchURI += LOOLWSD_TEST_LOLEAFLET_UI;
    aLaunchURI += "?file_path=file://";
    aLaunchURI += aAbsTopSrcDir;
    aLaunchURI += LOOLWSD_TEST_DOCUMENT_RELATIVE_PATH;

    return aLaunchURI;
}

} // anonymous namespace

std::atomic<unsigned> LOOLWSD::NextSessionId;
int LOOLWSD::ForKitWritePipe = -1;
std::string LOOLWSD::Cache = LOOLWSD_CACHEDIR;
std::string LOOLWSD::SysTemplate;
std::string LOOLWSD::LoTemplate;
std::string LOOLWSD::ChildRoot;
std::string LOOLWSD::ServerName;
std::string LOOLWSD::FileServerRoot;
std::string LOOLWSD::LOKitVersion;
Util::RuntimeConstant<bool> LOOLWSD::SSLEnabled;
Util::RuntimeConstant<bool> LOOLWSD::SSLTermination;

static std::string UnitTestLibrary;

unsigned int LOOLWSD::NumPreSpawnedChildren = 0;
std::atomic<unsigned> LOOLWSD::NumDocBrokers;
std::atomic<unsigned> LOOLWSD::NumConnections;

class AppConfigMap : public Poco::Util::MapConfiguration
{
public:
    AppConfigMap(const std::map<std::string, std::string>& map)
    {
        for (const auto& pair : map)
        {
            setRaw(pair.first, pair.second);
        }
    }
};

LOOLWSD::LOOLWSD()
{
}

LOOLWSD::~LOOLWSD()
{
}

void LOOLWSD::initialize(Application& self)
{
    Log::initialize("wsd");

    if (geteuid() == 0)
    {
        throw std::runtime_error("Do not run as root. Please run as lool user.");
    }

    if (!UnitWSD::init(UnitWSD::UnitType::TYPE_WSD,
                       UnitTestLibrary))
    {
        throw std::runtime_error("Failed to load wsd unit test library.");
    }

    auto& conf = config();

    // Add default values of new entries here.
    static const std::map<std::string, std::string> DefAppConfig = {
        { "tile_cache_path", LOOLWSD_CACHEDIR },
        { "sys_template_path", "systemplate" },
        { "lo_template_path", "/opt/collaboraoffice5.1" },
        { "child_root_path", "jails" },
        { "lo_jail_subpath", "lo" },
        { "server_name", "" },
        { "file_server_root_path", "../loleaflet/../" },
        { "num_prespawn_children", "1" },
        { "per_document.max_concurrency", "4" },
        { "loleaflet_html", "loleaflet.html" },
        { "logging.color", "true" },
        { "logging.level", "trace" },
        { "ssl.enable", "true" },
        { "ssl.termination", "true" },
        { "ssl.cert_file_path", LOOLWSD_CONFIGDIR "/cert.pem" },
        { "ssl.key_file_path", LOOLWSD_CONFIGDIR "/key.pem" },
        { "ssl.ca_file_path", LOOLWSD_CONFIGDIR "/ca-chain.cert.pem" },
        { "storage.filesystem[@allow]", "false" },
        { "storage.wopi[@allow]", "true" },
        { "storage.wopi.host[0][@allow]", "true" },
        { "storage.wopi.host[0]", "localhost" },
        { "storage.wopi.max_file_size", "0" },
        { "storage.webdav[@allow]", "false" },
    };

    // Set default values, in case they are missing from the config file.
    AutoPtr<AppConfigMap> pDefConfig(new AppConfigMap(DefAppConfig));
    conf.addWriteable(pDefConfig, PRIO_SYSTEM); // Lowest priority

    // Load default configuration files, if present.
    if (loadConfiguration(PRIO_DEFAULT) == 0)
    {
        // Fallback to the default path.
        const std::string configPath = LOOLWSD_CONFIGDIR "/loolwsd.xml";
        loadConfiguration(configPath, PRIO_DEFAULT);
    }

    // Override any settings passed on the command-line.
    AutoPtr<AppConfigMap> pOverrideConfig(new AppConfigMap(_overrideSettings));
    conf.addWriteable(pOverrideConfig, PRIO_APPLICATION); // Highest priority

    // Allow UT to manipulate before using configuration values.
    UnitWSD::get().configure(config());

#if ENABLE_SSL
    LOOLWSD::SSLEnabled.set(getConfigValue<bool>(conf, "ssl.enable", true));
#else
    LOOLWSD::SSLEnabled.set(false);
#endif

    if (LOOLWSD::isSSLEnabled())
    {
        Log::info("SSL support: SSL is enabled.");
    }
    else
    {
        Log::warn("SSL support: SSL is disabled.");
    }

#if ENABLE_SSL
    LOOLWSD::SSLTermination.set(getConfigValue<bool>(conf, "ssl.termination", true));
#else
    LOOLWSD::SSLTermination.set(false);
#endif

    Cache = getPathFromConfig("tile_cache_path");
    SysTemplate = getPathFromConfig("sys_template_path");
    LoTemplate = getPathFromConfig("lo_template_path");
    ChildRoot = getPathFromConfig("child_root_path");
    ServerName = config().getString("server_name");
    FileServerRoot = getPathFromConfig("file_server_root_path");
    NumPreSpawnedChildren = getConfigValue<unsigned int>(conf, "num_prespawn_children", 1);

    const auto maxConcurrency = getConfigValue<unsigned int>(conf, "per_document.max_concurrency", 4);
    if (maxConcurrency > 0)
    {
        setenv("MAX_CONCURRENCY", std::to_string(maxConcurrency).c_str(), 1);
    }

    Log::warn("Launch this in your browser:");
    Log::warn(lcl_getLaunchURI());

    // Otherwise we profile the soft-device at jail creation time.
    setenv ("SAL_DISABLE_OPENCL", "true", 1);

    // In Trial Versions we might want to set some limits.
    LOOLWSD::NumDocBrokers = 0;
    LOOLWSD::NumConnections = 0;
    Log::info() << "Open Documents Limit: " << (MAX_DOCUMENTS > 0 ?
                                                std::to_string(MAX_DOCUMENTS) :
                                                std::string("unlimited")) << Log::end;

    Log::info() << "Client Connections Limit: " << (MAX_CONNECTIONS > 0 ?
                                                    std::to_string(MAX_CONNECTIONS) :
                                                    std::string("unlimited")) << Log::end;

    StorageBase::initialize();

    ServerApplication::initialize(self);
}

void LOOLWSD::initializeSSL()
{
    if (!LOOLWSD::isSSLEnabled())
    {
        return;
    }

    const auto ssl_cert_file_path = getPathFromConfig("ssl.cert_file_path");
    Log::info("SSL Cert file: " + ssl_cert_file_path);

    const auto ssl_key_file_path = getPathFromConfig("ssl.key_file_path");
    Log::info("SSL Key file: " + ssl_key_file_path);

    const auto ssl_ca_file_path = getPathFromConfig("ssl.ca_file_path");
    Log::info("SSL CA file: " + ssl_ca_file_path);

    Poco::Crypto::initializeCrypto();

    Poco::Net::initializeSSL();
    Poco::Net::Context::Params sslParams;
    sslParams.certificateFile = ssl_cert_file_path;
    sslParams.privateKeyFile = ssl_key_file_path;
    sslParams.caLocation = ssl_ca_file_path;
    // Don't ask clients for certificate
    sslParams.verificationMode = Poco::Net::Context::VERIFY_NONE;

    Poco::SharedPtr<Poco::Net::PrivateKeyPassphraseHandler> consoleHandler = new Poco::Net::KeyConsoleHandler(true);
    Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidCertHandler = new Poco::Net::ConsoleCertificateHandler(true);

    Poco::Net::Context::Ptr sslContext = new Poco::Net::Context(Poco::Net::Context::SERVER_USE, sslParams);
    Poco::Net::SSLManager::instance().initializeServer(consoleHandler, invalidCertHandler, sslContext);

    // Init client
    Poco::Net::Context::Params sslClientParams;
    // TODO: Be more strict and setup SSL key/certs for owncloud server and us
    sslClientParams.verificationMode = Poco::Net::Context::VERIFY_NONE;

    Poco::SharedPtr<Poco::Net::PrivateKeyPassphraseHandler> consoleClientHandler = new Poco::Net::KeyConsoleHandler(false);
    Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidClientCertHandler = new Poco::Net::AcceptCertificateHandler(false);

    Poco::Net::Context::Ptr sslClientContext = new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslClientParams);
    Poco::Net::SSLManager::instance().initializeClient(consoleClientHandler, invalidClientCertHandler, sslClientContext);
}

void LOOLWSD::uninitialize()
{
    ServerApplication::uninitialize();
}

void LOOLWSD::defineOptions(OptionSet& optionSet)
{
    ServerApplication::defineOptions(optionSet);

    optionSet.addOption(Option("help", "", "Display help information on command line arguments.")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("version", "", "Display version information.")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("port", "", "Port number to listen to (default: " + std::to_string(DEFAULT_CLIENT_PORT_NUMBER) + "),"
                             " must not be " + std::to_string(MasterPortNumber) + ".")
                        .required(false)
                        .repeatable(false)
                        .argument("port number"));

    optionSet.addOption(Option("disable-ssl", "", "Disable SSL security layer.")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("override", "o", "Override any setting by providing fullxmlpath=value.")
                        .required(false)
                        .repeatable(true)
                        .argument("xmlpath"));

#if ENABLE_DEBUG
    optionSet.addOption(Option("unitlib", "", "Unit testing library path.")
                        .required(false)
                        .repeatable(false)
                        .argument("unitlib"));

    optionSet.addOption(Option("nocaps", "", "Use a non-privileged forkit for valgrinding.")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("careerspan", "", "How many seconds to run.")
                        .required(false)
                        .repeatable(false)
                        .argument("seconds"));
#endif
}

void LOOLWSD::handleOption(const std::string& optionName,
                           const std::string& value)
{
    ServerApplication::handleOption(optionName, value);

    if (optionName == "help")
    {
        displayHelp();
        std::exit(Application::EXIT_OK);
    }
    else if (optionName == "version")
        DisplayVersion = true;
    else if (optionName == "port")
        ClientPortNumber = std::stoi(value);
    else if (optionName == "disable-ssl")
        _overrideSettings["ssl.enable"] = "false";
    else if (optionName == "override")
    {
        std::string optName;
        std::string optValue;
        LOOLProtocol::parseNameValuePair(value, optName, optValue);
        _overrideSettings[optName] = optValue;
    }
#if ENABLE_DEBUG
    else if (optionName == "unitlib")
        UnitTestLibrary = value;
    else if (optionName == "nocaps")
        NoCapsForKit = true;
    else if (optionName == "careerspan")
        careerSpanSeconds = std::stoi(value);

    static const char* clientPort = getenv("LOOL_TEST_CLIENT_PORT");
    if (clientPort)
        ClientPortNumber = std::stoi(clientPort);

    static const char* masterPort = getenv("LOOL_TEST_MASTER_PORT");
    if (masterPort)
        MasterPortNumber = std::stoi(masterPort);
#endif
}

void LOOLWSD::displayHelp()
{
    HelpFormatter helpFormatter(options());
    helpFormatter.setCommand(commandName());
    helpFormatter.setUsage("OPTIONS");
    helpFormatter.setHeader("LibreOffice On-Line WebSocket server.");
    helpFormatter.format(std::cout);
}

Process::PID LOOLWSD::createForKit()
{
    Process::Args args;

    args.push_back("--losubpath=" + std::string(LO_JAIL_SUBPATH));
    args.push_back("--systemplate=" + SysTemplate);
    args.push_back("--lotemplate=" + LoTemplate);
    args.push_back("--childroot=" + ChildRoot);
    args.push_back("--clientport=" + std::to_string(ClientPortNumber));
    if (UnitWSD::get().hasKitHooks())
        args.push_back("--unitlib=" + UnitTestLibrary);
    if (DisplayVersion)
        args.push_back("--version");

    std::string forKitPath = Path(Application::instance().commandPath()).parent().toString() + "loolforkit";

    if (NoCapsForKit)
    {
        forKitPath = forKitPath + std::string("-nocaps");
        args.push_back("--nocaps");
    }

    Log::info("Launching forkit process: " + forKitPath + " " +
              Poco::cat(std::string(" "), args.begin(), args.end()));

    lastForkRequestTime = std::chrono::steady_clock::now();
    ProcessHandle child = Process::launch(forKitPath, args);

    return child.id();
}

int LOOLWSD::main(const std::vector<std::string>& /*args*/)
{
    if (DisplayVersion)
    {
        std::string version, hash;
        Util::getVersionInfo(version, hash);
        std::cout << "loolwsd " << version << " - " << hash << std::endl;
    }

    initializeSSL();

    char *locale = setlocale(LC_ALL, nullptr);
    if (locale == nullptr || std::strcmp(locale, "C") == 0)
        setlocale(LC_ALL, "en_US.utf8");

    Util::setTerminationSignals();
    Util::setFatalSignals();

    if (access(Cache.c_str(), R_OK | W_OK | X_OK) != 0)
    {
        Log::syserror("Unable to access cache [" + Cache +
                      "] please make sure it exists, and has write permission for this user.");
        return Application::EXIT_SOFTWARE;
    }

    // We use the same option set for both parent and child loolwsd,
    // so must check options required in the parent (but not in the
    // child) separately now. Also check for options that are
    // meaningless for the parent.
    if (SysTemplate.empty())
        throw MissingOptionException("systemplate");
    if (LoTemplate.empty())
        throw MissingOptionException("lotemplate");

    if (ChildRoot.empty())
        throw MissingOptionException("childroot");
    else if (ChildRoot[ChildRoot.size() - 1] != '/')
        ChildRoot += '/';

    if (FileServerRoot.empty())
        FileServerRoot = Poco::Path(Application::instance().commandPath()).parent().parent().toString();
    FileServerRoot = Poco::Path(FileServerRoot).absolute().toString();
    Log::debug("FileServerRoot: " + FileServerRoot);

    if (ClientPortNumber == MasterPortNumber)
        throw IncompatibleOptionsException("port");

    // Create the directory where the fifo pipe with ForKit will be.
    const Path pipePath = Path::forDirectory(ChildRoot + "/" + FIFO_PATH);
    if (!File(pipePath).exists() && !File(pipePath).createDirectory())
    {
        Log::error("Failed to create pipe directory [" + pipePath.toString() + "].");
        return Application::EXIT_SOFTWARE;
    }

    // Create the fifo with ForKit.
    const std::string pipeLoolwsd = Path(pipePath, FIFO_LOOLWSD).toString();
    Log::debug("mkfifo(" + pipeLoolwsd + ")");
    if (mkfifo(pipeLoolwsd.c_str(), 0666) < 0 && errno != EEXIST)
    {
        Log::syserror("Failed to create fifo [" + pipeLoolwsd + "].");
        return Application::EXIT_SOFTWARE;
    }

    // Init the file server
    FileServer fileServer;

    // Configure the Server.
    // Note: TCPServer internally uses a ThreadPool to
    // dispatch connections (the default if not given).
    // The capacity of the ThreadPool is increased here to
    // match MAX_SESSIONS. The pool must have sufficient available
    // threads to dispatch new connections, otherwise will deadlock.
    auto params1 = new HTTPServerParams();
    params1->setMaxThreads(MAX_SESSIONS);
    auto params2 = new HTTPServerParams();
    params2->setMaxThreads(MAX_SESSIONS);

    // Start a server listening on the port for clients

    std::unique_ptr<ServerSocket> psvs(lcl_getServerSocket(ClientPortNumber));

    ThreadPool threadPool(NumPreSpawnedChildren*6, MAX_SESSIONS * 2);
    HTTPServer srv(new ClientRequestHandlerFactory(fileServer), threadPool, *psvs, params1);
    Log::info("Starting master server listening on " + std::to_string(ClientPortNumber));
    srv.start();

    // And one on the port for child processes
    SocketAddress addr2("127.0.0.1", MasterPortNumber);
    ServerSocket svs2(addr2);
    HTTPServer srv2(new PrisonerRequestHandlerFactory(), threadPool, svs2, params2);
    Log::info("Starting prisoner server listening on " + std::to_string(MasterPortNumber));
    srv2.start();

    // Fire the ForKit process; we are ready.
    const Process::PID forKitPid = createForKit();
    if (forKitPid < 0)
    {
        Log::error("Failed to spawn loolforkit.");
        return Application::EXIT_SOFTWARE;
    }

    // Open write fifo pipe with ForKit.
    if ( (ForKitWritePipe = open(pipeLoolwsd.c_str(), O_WRONLY) ) < 0 )
    {
        Log::syserror("Failed to open pipe [" + pipeLoolwsd + "] for writing.");
        return Application::EXIT_SOFTWARE;
    }
    Log::debug("open(" + pipeLoolwsd + ", WRONLY) = " + std::to_string(ForKitWritePipe));

    // Init the Admin manager
    Admin::instance().setForKitPid(forKitPid);

    // Spawn some children, if necessary.
    preForkChildren();

    time_t last30SecCheck = time(NULL);

#if ENABLE_DEBUG
    time_t startTimeSpan = last30SecCheck;
#endif

    int status = 0;
    while (!TerminationFlag)
    {
        UnitWSD::get().invokeTest();

        const pid_t pid = waitpid(forKitPid, &status, WUNTRACED | WNOHANG);
        if (pid > 0)
        {
            if (forKitPid == pid)
            {
                if (WIFEXITED(status))
                {
                    Log::info() << "Child process [" << pid << "] exited with code: "
                                << WEXITSTATUS(status) << "." << Log::end;

                    break;
                }
                else
                if (WIFSIGNALED(status))
                {
                    std::string fate = "died";
                    if (WCOREDUMP(status))
                        fate = "core-dumped";
                    Log::error() << "Child process [" << pid << "] " << fate
                                 << " with " << Util::signalName(WTERMSIG(status))
                                 << Log::end;

                    break;
                }
                else if (WIFSTOPPED(status))
                {
                    Log::info() << "Child process [" << pid << "] stopped with "
                                << Util::signalName(WSTOPSIG(status))
                                << Log::end;
                }
                else if (WIFCONTINUED(status))
                {
                    Log::info() << "Child process [" << pid << "] resumed with SIGCONT."
                                << Log::end;
                }
                else
                {
                    Log::warn() << "Unknown status returned by waitpid: "
                                << std::hex << status << "." << Log::end;
                }
            }
            else
            {
                Log::error("An unknown child process died, pid: " + std::to_string(pid));
            }
        }
        else if (pid < 0)
        {
            Log::syserror("waitpid failed.");
            // No child processes
            if (errno == ECHILD)
            {
                TerminationFlag = true;
                continue;
            }
        }
        else // pid == 0, no children have died
        {
            if (!std::getenv("LOOL_NO_AUTOSAVE"))
            {
                if (time(nullptr) >= last30SecCheck + 30)
                {
                    try
                    {
                        std::unique_lock<std::mutex> docBrokersLock(docBrokersMutex);
                        for (auto& brokerIt : docBrokers)
                        {
                            brokerIt.second->autoSave(false, 0);
                        }
                    }
                    catch (const std::exception& exc)
                    {
                        Log::error("Exception: " + std::string(exc.what()));
                    }

                    last30SecCheck = time(nullptr);
                }
            }

            sleep(WSD_SLEEP_SECS);

            // Make sure we have sufficient reserves.
            prespawnChildren();
        }
#if ENABLE_DEBUG
        if (careerSpanSeconds > 0 && time(nullptr) > startTimeSpan + careerSpanSeconds)
        {
            Log::info(std::to_string(time(nullptr) - startTimeSpan) + " seconds gone, finishing as requested.");
            TerminationFlag = true;
        }
#endif
    }

    // stop the service, no more request
    srv.stop();
    srv2.stop();

    // close all websockets
    threadPool.joinAll();

    // Terminate child processes
    Log::info("Requesting child process " + std::to_string(forKitPid) + " to terminate");
    Util::requestTermination(forKitPid);
    for (auto& child : newChildren)
    {
        child->close(true);
    }

    // Wait for forkit process finish
    waitpid(forKitPid, &status, WUNTRACED);
    close(ForKitWritePipe);

    Log::info("Cleaning up childroot directory [" + ChildRoot + "].");
    std::vector<std::string> jails;
    File(ChildRoot).list(jails);
    for (auto& jail : jails)
    {
        const auto path = ChildRoot + jail;
        Log::info("Removing jail [" + path + "].");
        Util::removeFile(path, true);
    }

    if (LOOLWSD::isSSLEnabled())
    {
        Poco::Net::uninitializeSSL();
        Poco::Crypto::uninitializeCrypto();
    }


    Log::info("Process [loolwsd] finished.");

    int returnValue = Application::EXIT_OK;
    UnitWSD::get().returnValue(returnValue);

    return returnValue;
}

void UnitWSD::testHandleRequest(TestRequest type, UnitHTTPServerRequest& request, UnitHTTPServerResponse& response)
{
    switch (type)
    {
    case TestRequest::TEST_REQ_CLIENT:
        ClientRequestHandler::handleClientRequest(request, response);
        break;
    case TestRequest::TEST_REQ_PRISONER:
        PrisonerRequestHandler::handlePrisonerRequest(request, response);
        break;
    default:
        assert(false);
        break;
    }
}

POCO_SERVER_MAIN(LOOLWSD)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
