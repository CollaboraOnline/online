/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Util/LayeredConfiguration.h>

class UnitWopiLock : public WopiTestServer
{
    STATES_ENUM(Phase, _phase, Load, LockDocument, UnlockDocument, Polling);

    std::string _lockState;
    std::string _lockString;

public:
    UnitWopiLock()
        : WopiTestServer("UnitWopiLock")
        , _phase(Phase::Load)
        , _lockState("UNLOCK")
    {
    }

    virtual bool handleHttpRequest(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& /*message*/, std::shared_ptr<StreamSocket>& socket) override
    {
        Poco::URI uriReq(request.getURI());
        Poco::RegularExpression regInfo("/wopi/files/[0-9]");
        Poco::RegularExpression regContent("/wopi/files/[0-9]/contents");
        LOG_INF("Fake wopi host request: " << request.getMethod() << ' ' << uriReq.toString());

        // CheckFileInfo
        if (request.getMethod() == "GET" && regInfo.match(uriReq.getPath()))
        {
            LOG_INF("Fake wopi host request, handling CheckFileInfo: " << uriReq.getPath());
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
            std::string responseString = jsonStream.str();

            const std::string mimeType = "application/json; charset=utf-8";

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                "Last-Modified: " << Util::getHttpTime(getFileLastModifiedTime()) << "\r\n"
                "User-Agent: " WOPI_AGENT_STRING "\r\n"
                "Content-Length: " << responseString.size() << "\r\n"
                "Content-Type: " << mimeType << "\r\n"
                "\r\n"
                << responseString;

            socket->send(oss.str());
            socket->shutdown();
            requestCount++;

            return true;
        }
        // GetFile
        else if (request.getMethod() == "GET" && regContent.match(uriReq.getPath()))
        {
            LOG_INF("Fake wopi host request, handling GetFile: " << uriReq.getPath());

            const std::string mimeType = "text/plain; charset=utf-8";

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                "Last-Modified: " << Util::getHttpTime(getFileLastModifiedTime()) << "\r\n"
                "User-Agent: " WOPI_AGENT_STRING "\r\n"
                "Content-Length: " << getFileContent().size() << "\r\n"
                "Content-Type: " << mimeType << "\r\n"
                "\r\n"
                << getFileContent();

            socket->send(oss.str());
            socket->shutdown();

            return true;
        }
        // X-WOPI-Lock
        else if (request.getMethod() == "POST" && regInfo.match(uriReq.getPath()))
        {
            LOG_INF("Fake wopi host request, handling Update Lock State: " << uriReq.getPath());

            assertLockRequest(request);

            const std::string mimeType = "text/html";
            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                "Last-Modified: " << Util::getHttpTime(getFileLastModifiedTime()) << "\r\n"
                "User-Agent: " WOPI_AGENT_STRING "\r\n"
                "Content-Length: 0 \r\n"
                "Content-Type: " << mimeType << "\r\n"
                "\r\n";

            socket->send(oss.str());
            socket->shutdown();
            return true;
        }

        return false;
    }

    void assertLockRequest(const Poco::Net::HTTPRequest& request)
    {
        LOG_TST("assertLockRequest: " << request.getURI());

        std::string newLockState = request.get("X-WOPI-Override", std::string());
        std::string lock = request.get("X-WOPI-Lock", std::string());
        if (_phase == Phase::LockDocument && newLockState == "LOCK")
        {
            LOK_ASSERT_MESSAGE("Lock String cannot be empty", lock != std::string());
            TRANSITION_STATE(_phase, Phase::UnlockDocument);
            _lockState = newLockState;
            _lockString = lock;

        }
        else if (_phase == Phase::UnlockDocument && newLockState == "UNLOCK")
        {
            LOK_ASSERT_MESSAGE("Document it not locked", _lockState != "UNLOCK");
            LOK_ASSERT_EQUAL(_lockString, lock);
            TRANSITION_STATE(_phase, Phase::Polling);
            exitTest(TestResult::Ok);
        }
    }

    void invokeWSDTest() override
    {
        constexpr char testName[] = "UnitWopiLock";

        switch (_phase)
        {
            case Phase::Load:
            {
                initWebsocket("/wopi/files/0?access_token=anything");
                addWebSocket();
                helpers::sendTextFrame(*getWs()->getCOOLWebSocket(), "load url=" + getWopiSrc(), testName);
                helpers::sendTextFrame(*getWsAt(1)->getCOOLWebSocket(), "load url=" + getWopiSrc(), testName);
                TRANSITION_STATE(_phase, Phase::LockDocument);
                break;
            }
            case Phase::LockDocument:
                break;
            case Phase::UnlockDocument:
            {
                // force kill the session with edit permission
                deleteSocketAt(0);
                break;
            }
            case Phase::Polling:
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
