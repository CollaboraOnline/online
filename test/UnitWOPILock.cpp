/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "lokassert.hpp"
#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <helpers.hpp>
#include <wsd/ClientSession.hpp>

#include <Poco/Net/HTTPRequest.h>

class UnitWopiLock : public WopiTestServer
{
    STATE_ENUM(Phase, Load, LockDocument, UnlockDocument, Done) _phase;

    std::string _lockState;
    std::string _lockString;
    std::size_t _sessionCount;

public:
    UnitWopiLock()
        : WopiTestServer("UnitWopiLock")
        , _phase(Phase::Load)
        , _lockState("UNLOCK")
        , _sessionCount(0)
    {
    }

    virtual bool handleHttpRequest(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& /*message*/, std::shared_ptr<StreamSocket>& socket) override
    {
        Poco::URI uriReq(request.getURI());
        Poco::RegularExpression regInfo("/wopi/files/[0-9]");
        Poco::RegularExpression regContent("/wopi/files/[0-9]/contents");
        LOG_TST("Fake wopi host request: " << request.getMethod() << ' ' << uriReq.toString());

        // CheckFileInfo
        if (request.getMethod() == "GET" && regInfo.match(uriReq.getPath()))
        {
            LOG_TST("Fake wopi host request, handling CheckFileInfo: " << uriReq.getPath());
            static int requestCount = 0;

            const std::string fileName(uriReq.getPath() == "/wopi/files/3" ? "he%llo.txt" : "hello.txt");
            Poco::JSON::Object::Ptr fileInfo = new Poco::JSON::Object();
            fileInfo->set("BaseFileName", fileName);
            fileInfo->set("Size", getFileContent().size());
            fileInfo->set("Version", "1.0");
            fileInfo->set("OwnerId", "test");
            fileInfo->set("UserId", "test");

            fileInfo->set("UserFriendlyName", "test");
            /// First session will be only session with the edit permission
            fileInfo->set("UserCanWrite", requestCount < 1 ? "true" : "false");
            fileInfo->set("PostMessageOrigin", "localhost");
            fileInfo->set("LastModifiedTime", Util::getIso8601FracformatTime(getFileLastModifiedTime()));
            fileInfo->set("EnableOwnerTermination", "true");
            fileInfo->set("SupportsLocks", "true");

            std::ostringstream jsonStream;
            fileInfo->stringify(jsonStream);

            http::Response httpResponse(http::StatusLine(200));
            httpResponse.set("Last-Modified", Util::getHttpTime(getFileLastModifiedTime()));
            httpResponse.setBody(jsonStream.str(), "application/json; charset=utf-8");
            socket->sendAndShutdown(httpResponse);

            requestCount++;

            return true;
        }
        // GetFile
        else if (request.getMethod() == "GET" && regContent.match(uriReq.getPath()))
        {
            LOG_TST("Fake wopi host request, handling GetFile: " << uriReq.getPath());

            http::Response httpResponse(http::StatusLine(200));
            httpResponse.set("Last-Modified", Util::getHttpTime(getFileLastModifiedTime()));
            httpResponse.setBody(getFileContent(), "text/plain; charset=utf-8");
            socket->sendAndShutdown(httpResponse);

            return true;
        }
        // X-WOPI-Lock
        else if (request.getMethod() == "POST" && regInfo.match(uriReq.getPath()))
        {
            LOG_TST("Fake wopi host request, handling Update Lock State: " << uriReq.getPath());

            assertLockRequest(request);

            http::Response httpResponse(http::StatusLine(200));
            httpResponse.set("Last-Modified", Util::getHttpTime(getFileLastModifiedTime()));
            socket->sendAndShutdown(httpResponse);

            return true;
        }

        return false;
    }

    void assertLockRequest(const Poco::Net::HTTPRequest& request)
    {
        const std::string lock = request.get("X-WOPI-Lock", std::string());
        const std::string newLockState = request.get("X-WOPI-Override", std::string());
        LOG_TST("In " << toString(_phase) << ", X-WOPI-Lock: " << lock << ", X-WOPI-Override: "
                      << newLockState << ", for URI: " << request.getURI());

        if (_phase == Phase::LockDocument)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:LOCK", std::string("LOCK"),
                                     newLockState);
            LOK_ASSERT_MESSAGE("Lock String cannot be empty", !lock.empty());
            _lockState = newLockState;
            _lockString = lock;
        }
        else if (_phase == Phase::UnlockDocument)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:UNLOCK", std::string("UNLOCK"),
                                     newLockState);
            LOK_ASSERT_MESSAGE("Document is not unlocked", _lockState != "UNLOCK");
            LOK_ASSERT_EQUAL(_lockString, lock);
            TRANSITION_STATE(_phase, Phase::Done);
            exitTest(TestResult::Ok);
        }
        else
        {
            LOK_ASSERT_FAIL("Unexpected lock-state change while in " + toString(_phase));
        }
    }

    /// Called when a new client session is added to a DocumentBroker.
    void onDocBrokerAddSession(const std::string&,
                               const std::shared_ptr<ClientSession>& session) override
    {
        ++_sessionCount;
        LOG_TST("New Session [" << session->getName() << "] added. Have " << _sessionCount
                                << " sessions.");
    }

    void onDocBrokerViewLoaded(const std::string&,
                               const std::shared_ptr<ClientSession>& session) override
    {
        LOG_TST("View for session [" << session->getName() << "] loaded.");

        if (_sessionCount == 2)
        {
            // Transition before disconnecting.
            TRANSITION_STATE(_phase, Phase::UnlockDocument);

            // force kill the session with edit permission
            LOG_TST("Disconnecting first connection with edit permission");
            deleteSocketAt(0);
        }
    }

    /// Called when a client session is removed to a DocumentBroker.
    void onDocBrokerRemoveSession(const std::string&,
                                  const std::shared_ptr<ClientSession>& session) override
    {
        --_sessionCount;
        LOG_TST("Session [" << session->getName() << "] removed. Have " << _sessionCount
                            << " sessions.");
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                // Always transition before issuing commands.
                TRANSITION_STATE(_phase, Phase::LockDocument);

                LOG_TST("Creating first connection");
                initWebsocket("/wopi/files/0?access_token=anything");

                LOG_TST("Creating second connection");
                addWebSocket();

                LOG_TST("Loading first view (editor)");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc());
                LOG_TST("Loading second view (viewer)");
                WSD_CMD_BY_CONNECTION_INDEX(1, "load url=" + getWopiSrc());
                break;
            }
            case Phase::LockDocument:
            case Phase::UnlockDocument:
                break;
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitWopiLock();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
