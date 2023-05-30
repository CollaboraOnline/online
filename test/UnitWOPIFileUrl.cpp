/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "lokassert.hpp"

#include <Poco/Net/HTTPRequest.h>

#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <net/HttpHelper.hpp>

/// Test the FileUrl WOPI CheckFileInfo property.
/// When FileUrl is set, it must be used for
/// WOPI::GetFile requests, and only when that
/// fails do we request the default file.
///
/// This test loads the document three times.
/// 1. CheckFileInfo returns a valid FileUrl,
///    and is downloaded successfully.
/// 2. CheckFileInfo gives an invalid FileUrl,
///    download fails, default must be used.
/// 3. CheckFileInfo gives no FileUrl,
///    the default must be used.
class UnitWOPIFileUrl : public WopiTestServer
{
    /// The main phases of the test, repeated
    /// once for each test case (3 times).
    /// First, we load a document, modify it,
    /// then save. Validations are done during
    /// GetFile and PutFile to check that FileUrl
    /// is used, or not, as expected.
    enum class Phase
    {
        Load,
        WaitLoadStatus,
        WaitModifiedStatus,
        WaitPutFile,
        Polling
    } _phase;

    /// We have three tests, one for each
    /// of the following cases of FileUrl:
    /// 1. When it's provided and valid.
    /// 2. When it's provided and invalid.
    /// 3. When it's missing/blank.
    enum class FileUrlState
    {
        Valid,
        Invalid,
        Absent
    } _fileUrlState;

    /// We use different documents because
    /// we can't reload the same document so rapidly.
    int _docId;

    static constexpr auto FileUrlFilename = "/hello.odt";
    static constexpr auto InvalidFilename = "/invalid_file";

public:
    UnitWOPIFileUrl()
        : WopiTestServer("UnitWOPIFileUrl")
        , _phase(Phase::Load)
        , _fileUrlState(FileUrlState::Valid)
        , _docId(1)
    {
    }

    virtual bool handleHttpRequest(const Poco::Net::HTTPRequest& request,
                                   Poco::MemoryInputStream& message,
                                   std::shared_ptr<StreamSocket>& socket) override
    {
        Poco::URI uriReq(request.getURI());
        LOG_TST("FakeWOPIHost: Handling HTTP " << request.getMethod()
                                               << " request: " << uriReq.toString());

        constexpr auto DefaultUrlFilename = "empty.odt";
        static const Poco::RegularExpression regContent("/wopi/files/[0-9]/contents");

        if (request.getMethod() == "GET")
        {
            static const Poco::RegularExpression regInfo("/wopi/files/[0-9]");

            // CheckFileInfo
            if (regInfo.match(uriReq.getPath()))
            {
                LOG_TST("FakeWOPIHost: Handling WOPI::CheckFileInfo: " << uriReq.getPath());

                Poco::JSON::Object::Ptr fileInfo = getDefaultCheckFileInfoPayload(uriReq);
                fileInfo->set("BaseFileName", DefaultUrlFilename);
                fileInfo->set("FileUrl", getFileUrl());

                std::ostringstream jsonStream;
                fileInfo->stringify(jsonStream);

                http::Response httpResponse(http::StatusCode::OK);
                httpResponse.set("Last-Modified", Util::getHttpTime(getFileLastModifiedTime()));
                httpResponse.setBody(jsonStream.str(), "application/json; charset=utf-8");
                socket->sendAndShutdown(httpResponse);

                return true;
            }

            if (uriReq.getPath() == FileUrlFilename)
            {
                const std::string filename = std::string(TDOC) + FileUrlFilename;
                LOG_TST("FakeWOPIHost: Request, WOPI::GetFile sending FileUrl: " << filename);
                HttpHelper::sendFileAndShutdown(socket, filename, "");
                return true;
            }

            if (uriReq.getPath() == InvalidFilename)
            {
                const std::string filename = std::string(TDOC) + InvalidFilename;
                LOG_TST("FakeWOPIHost: Request, WOPI::GetFile returning 404 for: " << filename);

                http::Response httpResponse(http::StatusCode::NotFound);
                socket->sendAndShutdown(httpResponse);

                return true;
            }

            if (regContent.match(uriReq.getPath()))
            {
                if (_fileUrlState == FileUrlState::Valid)
                {
                    LOK_ASSERT_FAIL(
                        "The default URL should not be used when a valid FileUrl is provided.");
                    exitTest(TestResult::Failed);
                    return false;
                }

                const std::string filename = std::string(TDOC) + '/' + DefaultUrlFilename;
                LOG_TST("FakeWOPIHost: Request, WOPI::GetFile sending Default: " << filename);
                HttpHelper::sendFileAndShutdown(socket, filename, "");
                return true;
            }
        }
        else if (request.getMethod() == "POST")
        {
            LOG_TST("FakeWOPIHost: Handling PutFile: " << uriReq.getPath());

            LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitPutFile",
                               _phase == Phase::WaitPutFile);

            LOK_ASSERT_MESSAGE("Always the default URI must be used for PutFile",
                               regContent.match(uriReq.getPath()));

            std::streamsize size = request.getContentLength();
            LOK_ASSERT(size > 0);

            http::Response httpResponse(http::StatusCode::OK);
            httpResponse.setBody("{\"LastModifiedTime\": \"" +
                                     Util::getHttpTime(getFileLastModifiedTime()) + "\" }",
                                 "application/json; charset=utf-8");
            socket->sendAndShutdown(httpResponse);

            LOG_TST("Closing document after PutFile");
            WSD_CMD("closedocument");
            ++_docId; // Load the next file.

            if (_fileUrlState == FileUrlState::Valid)
            {
                LOG_TST("Valid FileUrl test successful. Now testing Invalid FileUrl.");
                _fileUrlState = FileUrlState::Invalid;
                _phase = Phase::Load;
            }
            else if (_fileUrlState == FileUrlState::Invalid)
            {
                LOG_TST("Invalid FileUrl test successful. Now testing without FileUrl.");
                _fileUrlState = FileUrlState::Absent;
                _phase = Phase::Load;
            }
            else if (_fileUrlState == FileUrlState::Absent)
            {
                LOG_TST("Testing of FileUrl completed successfully.");
                _phase = Phase::Polling;
                exitTest(TestResult::Ok);
            }

            return true;
        }

        return WopiTestServer::handleHttpRequest(request, message, socket);
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitLoadStatus",
                           _phase == Phase::WaitLoadStatus);

        LOG_TST(
            "onDocumentLoaded: Modifying the document and switching to Phase::WaitModifiedStatus");
        _phase = Phase::WaitModifiedStatus;

        WSD_CMD("key type=input char=97 key=0");
        WSD_CMD("key type=up char=0 key=512");

        return true;
    }

    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("onDocumentModified: [" << message << ']');
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitModified",
                           _phase == Phase::WaitModifiedStatus);

        LOG_TST("onDocumentModified: Saving document and switching to Phase::WaitPutFile");
        _phase = Phase::WaitPutFile;

        WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0 "
                "extendedData=CustomFlag%3DCustom%20Value%3BAnotherFlag%3DAnotherValue");

        return true;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                LOG_TST("Phase::Load");
                _phase = Phase::WaitLoadStatus;

                initWebsocket("/wopi/files/" + std::to_string(_docId) + "?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());
                break;
            }
            case Phase::WaitLoadStatus:
            case Phase::WaitModifiedStatus:
            case Phase::WaitPutFile:
            {
                break;
            }
            case Phase::Polling:
            {
                exitTest(TestResult::Ok);
                break;
            }
        }
    }

private:
    std::string getFileUrl() const
    {
        if (_fileUrlState == FileUrlState::Valid)
        {
            return helpers::getTestServerURI() + FileUrlFilename;
        }
        else if (_fileUrlState == FileUrlState::Invalid)
        {
            return helpers::getTestServerURI() + InvalidFilename;
        }

        return std::string();
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWOPIFileUrl(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
