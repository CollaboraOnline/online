/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <chrono>

#include "HttpRequest.hpp"
#include "Util.hpp"
#include "lokassert.hpp"

#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <cstddef>
#include <helpers.hpp>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Util/LayeredConfiguration.h>

/// Test slow saving/uploading.
/// We modify the document, save, and immediately
/// modify again followed by closing the connection.
/// In this scenario, it's not just that the document
/// is modified at the time of unloading, which is
/// covered by the UnitWOPIAsncUpload_ModifyClose
/// test. Instead, here we close the connection
/// while the document is being saved and uploaded.
/// Unlike the failed upload scenario, this one
/// will hit "upload in progress" and will test
/// that in such a case we don't drop the latest
/// changes, which were done while save/upload
/// were in progress.
/// Modify, Save, Modify, Close -> No data loss.
class UnitWOPISlow : public WopiTestServer
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitModifiedStatus, WaitPutFile) _phase;

    static constexpr auto LargeDocumentFilename = "large-six-hundred.odt";

    /// The delay to simulate a slow server.
    std::chrono::milliseconds _serverResponseDelay;

    /// The number of key input sent.
    std::size_t _inputCount;

public:
    UnitWOPISlow()
        : WopiTestServer("UnitWOPISlow")
        , _phase(Phase::Load)
        , _serverResponseDelay(std::chrono::seconds(5))
        , _inputCount(0)
    {
        // We need more time than the default.
        setTimeout(std::chrono::minutes(10));

        // Read the document data and store as string in memory.
        const auto data = helpers::readDataFromFile(LargeDocumentFilename);
        setFileContent(Util::toString(data));
    }

    bool handleHttpRequest(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& message,
                           std::shared_ptr<StreamSocket>& socket) override
    {
        static const std::string rootPath = "/wopi/files/";
        static const std::string contentsSuffix = "/contents";

        Poco::URI uriReq(request.getURI());

        LOG_INF("Fake wopi host " << request.getMethod() << " request URI [" << uriReq.toString()
                                  << "], path: [" << uriReq.getPath() << ']');

        if (request.getMethod() == "GET" &&
            Util::startsWith(uriReq.getPath(), rootPath + LargeDocumentFilename) &&
            !Util::endsWith(uriReq.getPath(), contentsSuffix))
        {
            LOG_INF("Fake wopi host request, handling large-document CheckFileInfo: "
                    << uriReq.getPath());

            assertCheckFileInfoRequest(request);

            Poco::LocalDateTime now;
            Poco::JSON::Object::Ptr fileInfo = new Poco::JSON::Object();
            fileInfo->set("BaseFileName", LargeDocumentFilename);
            fileInfo->set("Size", getFileContent().size());
            fileInfo->set("Version", "1.0");
            fileInfo->set("OwnerId", "test");
            fileInfo->set("UserId", "test");
            fileInfo->set("UserFriendlyName", "test");
            fileInfo->set("UserCanWrite", "true");
            fileInfo->set("PostMessageOrigin", "localhost");
            fileInfo->set("LastModifiedTime",
                          Util::getIso8601FracformatTime(getFileLastModifiedTime()));
            fileInfo->set("EnableOwnerTermination", "true");

            std::ostringstream jsonStream;
            fileInfo->stringify(jsonStream);

            http::Response httpResponse(http::StatusLine(200));
            httpResponse.setBody(jsonStream.str(), "application/json; charset=utf-8");
            socket->sendAndShutdown(httpResponse);

            return true;
        }
        else if (request.getMethod() == "GET" &&
                 Util::startsWith(uriReq.getPath(), rootPath + LargeDocumentFilename) &&
                 Util::endsWith(uriReq.getPath(), contentsSuffix))
        {
            LOG_TST("Fake wopi host request, handling GetFile: " << uriReq.getPath());

            assertGetFileRequest(request);

            http::Response httpResponse(http::StatusLine(200));
            httpResponse.setBody(getFileContent(), "application/octet-stream");
            socket->sendAndShutdown(httpResponse);

            return true;
        }
        else if (request.getMethod() == "POST" &&
                 Util::startsWith(uriReq.getPath(), rootPath + LargeDocumentFilename) &&
                 Util::endsWith(uriReq.getPath(), contentsSuffix))
        {
            LOG_TST("Fake wopi host request, handling PutFile: " << uriReq.getPath());

            // Update the in-memory document content.
            const std::streamsize size = request.getContentLength();
            std::vector<char> buffer(size);
            message.read(buffer.data(), size);
            setFileContent(Util::toString(buffer));

            std::unique_ptr<http::Response> response = assertPutFileRequest(request);
            if (response)
            {
                LOG_TST("Fake wopi host response to POST "
                        << uriReq.getPath() << ": " << response->statusLine().statusCode() << ' '
                        << response->statusLine().reasonPhrase());
                socket->sendAndShutdown(*response);
            }
            else
            {
                // By default we return success.
                const std::string body = "{\"LastModifiedTime\": \"" +
                                         Util::getIso8601FracformatTime(getFileLastModifiedTime()) +
                                         "\" }";
                LOG_TST("Fake wopi host (default) response to POST " << uriReq.getPath()
                                                                     << ": 200 OK " << body);
                http::Response httpResponse(http::StatusLine(200));
                httpResponse.setBody(body);
                socket->sendAndShutdown(httpResponse);
            }

            return true;
        }

        return WopiTestServer::handleHttpRequest(request, message, socket);
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        LOG_TST("PutFile");
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitPutFile", _phase == Phase::WaitPutFile);

        // Triggered while closing.
        LOK_ASSERT_EQUAL(std::string("false"), request.get("X-LOOL-WOPI-IsAutosave"));

        // Unfortunately, we clobber the modified flag when uploading.
        // So, if we had a user-modified upload that failed, the subsequent
        // try will have dropped the modified flag, and this assertion will fail.
        //FIXME: do not clobber the storage flags (modified, forced, etc.) when retrying.
        // LOK_ASSERT_EQUAL(std::string("true"), request.get("X-LOOL-WOPI-IsModifiedByUser"));

        passTest("Document uploaded on closing as expected.");
        return nullptr;
    }

    void onDocBrokerDestroy(const std::string& docKey) override
    {
        passTest("Document [" + docKey + "] uploaded and closed cleanly.");
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("Doc (" << toString(_phase) << "): [" << message << ']');
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitLoadStatus",
                           _phase == Phase::WaitLoadStatus);

        // Modify and wait for the notification.
        TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);

        LOG_TST("Sending key input #" << ++_inputCount);
        WSD_CMD("key type=input char=97 key=0");
        WSD_CMD("key type=up char=0 key=512");

        return true;
    }

    /// The document is modified. Save, modify, and close it.
    bool onDocumentModified(const std::string& message) override
    {
        // We modify the document multiple times.
        // Only the first time is handled here.
        if (_phase == Phase::WaitModifiedStatus)
        {
            LOG_TST("Doc (" << toString(_phase) << "): [" << message << ']');
            LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitModifiedStatus",
                               _phase == Phase::WaitModifiedStatus);

            // Save and immediately modify, then close the connection.
            WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0 "
                    "extendedData=CustomFlag%3DCustom%20Value%3BAnotherFlag%3DAnotherValue");

            LOG_TST("Sending key input #" << ++_inputCount);
            WSD_CMD("key type=input char=97 key=0");
            WSD_CMD("key type=up char=0 key=512");

            LOG_TST("Closing the connection.");
            deleteSocketAt(0);

            // Don't transition to WaitPutFile until after closing the socket.
            TRANSITION_STATE(_phase, Phase::WaitPutFile);
        }

        return true;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                LOG_TST("Load: initWebsocket.");
                initWebsocket("/wopi/files/large-six-hundred.odt?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());
                break;
            }
            case Phase::WaitLoadStatus:
                break;
            case Phase::WaitModifiedStatus:
                break;
            case Phase::WaitPutFile:
                break;
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWOPISlow(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
