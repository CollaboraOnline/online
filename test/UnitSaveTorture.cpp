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

#include <Unit.hpp>
#include <Util.hpp>
#include <JsonUtil.hpp>
#include <FileUtil.hpp>
#include <helpers.hpp>
#include <StringVector.hpp>
#include <WebSocketSession.hpp>
#include <wsd/COOLWSD.hpp>
#include <wsd/DocumentBroker.hpp>
#include <test/lokassert.hpp>
#include <Poco/Util/LayeredConfiguration.h>

#include <string>
#include <thread>

/// Save torture testcase.
class UnitSaveTorture : public UnitWSD
{
    bool forceAutosave;

    void saveTortureOne(const std::string& name, const std::string& docName);

    TestResult testSaveTorture();

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);

        // Force much faster auto-saving
        config.setBool("per_document.background_autosave", true);
    }

    // Force background autosave when saving the modified document
    bool isAutosave() override
    {
        LOG_TST("isAutosave returns " << forceAutosave);
        return forceAutosave;
    }

    std::string getJailRootPath(const std::string &name)
    {
        return getJailRoot() + "/tmp/" + name;
    }

    void createStamp(const std::string &name)
    {
        TST_LOG("create stamp " << name);
        std::ofstream stamp(getJailRootPath(name));
        stamp.close();
    }

    void removeStamp(const std::string &name)
    {
        FileUtil::removeFile(getJailRootPath(name));
        TST_LOG("removed stamp " << name);
    }

public:
    UnitSaveTorture();
    void invokeWSDTest() override;
};

namespace {
    void modifyDocument(const std::shared_ptr<http::WebSocketSession> &wsSession)
    {
        wsSession->sendMessage(std::string("key type=input char=97 key=0"));
        wsSession->sendMessage(std::string("key type=up char=0 key=512"));
    }

    bool waitForModifiedStatus(const std::string& name, const std::shared_ptr<http::WebSocketSession> &wsSession)
    {
        const auto testname = __func__;

        auto timeout = std::chrono::seconds(10);
        std::chrono::steady_clock::time_point start = std::chrono::steady_clock::now();
        while (true)
        {
            if (std::chrono::steady_clock::now() - start > std::chrono::seconds(10))
            {
                LOK_ASSERT_FAIL("Timed out waiting for modified status change");
                break;
            }
            std::vector<char> message
                = wsSession->waitForMessage("statechanged:", timeout, name);
            LOK_ASSERT(message.size() > 0);

            auto tokens = StringVector::tokenize(message.data(), message.size());
            if (tokens[1] == ".uno:ModifiedStatus=false")
                return false;
            else if (tokens[1] == ".uno:ModifiedStatus=true")
                return true;
        }
    }
}

void UnitSaveTorture::saveTortureOne(
    const std::string& name, const std::string& docName)
{
    auto timeout = std::chrono::seconds(10);

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL(docName, documentPath, documentURL, name);

    TST_LOG("Starting test on " << documentURL << ' ' << documentPath);

    std::shared_ptr<SocketPoll> poll = std::make_shared<SocketPoll>("WebSocketPoll");
    poll->startThread();

    Poco::URI uri(helpers::getTestServerURI());
    auto wsSession = helpers::loadDocAndGetSession(poll, docName, uri, testname);

    std::vector<char> message
        = wsSession->waitForMessage("status:", timeout, name);
    const std::string status = COOLProtocol::getFirstLine(message);

    modifyDocument(wsSession);

    LOK_ASSERT_EQUAL(waitForModifiedStatus(name, wsSession), true);

    createStamp("holdsave");

    // Force a synchronous save-as-auto-save now
    forceAutosave = true;
    wsSession->sendMessage(std::string("save dontTerminateEdit=0 dontSaveIfUnmodified=0"));

    removeStamp("holdsave");

    // Check the save succeeded
    message = wsSession->waitForMessage("unocommandresult:", timeout, name);
    LOK_ASSERT(message.size() > 0);
    Poco::JSON::Object::Ptr object;
    LOK_ASSERT(JsonUtil::parseJSON(std::string(message.data(), message.size()), object));
    LOK_ASSERT_EQUAL(JsonUtil::getJSONValue<bool>(object, "success"), true);

    // Autosaves and notifies us of clean modification state
    LOK_ASSERT_EQUAL(waitForModifiedStatus(name, wsSession), false);

    // Next: Modify, force an autosave, and while saving, modify again ...
}

UnitBase::TestResult UnitSaveTorture::testSaveTorture()
{
    std::vector<std::string> docNames = { "empty.ods", "empty.odt" };
    //, "empty.odp", "empty.odg" }; - modify command needs twekaing ...
    for (const auto& docName : docNames)
    {
        const auto name = "saveTorture_" + docName + ' ';
        saveTortureOne(name, docName);
    }

    return TestResult::Ok;
}

UnitSaveTorture::UnitSaveTorture()
    : UnitWSD("UnitSaveTorture"),
      forceAutosave(false)
{
    setHasKitHooks();
    // Double of the default.
    constexpr std::chrono::minutes timeout_minutes(1);
    setTimeout(timeout_minutes);
}

void UnitSaveTorture::invokeWSDTest()
{
    auto result = testSaveTorture();
    exitTest(result);
}

// Inside the forkit & kit processes
class UnitKitSaveTorture : public UnitKit
{
    void waitWhileStamp(const std::string &name)
    {
        std::chrono::steady_clock::time_point start = std::chrono::steady_clock::now();
        while (FileUtil::Stat(std::string("/tmp/") + name).exists())
        {
            TST_LOG("wait for stamp " << name);
            if (std::chrono::steady_clock::now() - start > std::chrono::seconds(10))
            {
                LOK_ASSERT_FAIL("Timed out while waiting for stamp file " + name + " to go");
                return;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
        TST_LOG("found stamp " << name);
    }

public:
    UnitKitSaveTorture() : UnitKit("savetorture")
    {
        std::cerr << "\n\nYour Kit process has Save torturing hooks\n\n\n";
        setTimeout(std::chrono::hours(1));
    }
    virtual bool filterKitMessage(WebSocketHandler *, std::string & /* message */) override
    {
        return false;
    }

    virtual void postBackgroundSaveFork() override
    {
        std::cerr << "\n\npost background save process fork\n\n\n";

        waitWhileStamp("holdsave");

        // FIXME: create stamp files in file-system to avoid collision
        // and to flag failure.
    }

    virtual void preBackgroundSaveExit() override
    {
        std::cerr << "\n\npre exit of background save process\n\n\n";
    }
};

UnitBase* unit_create_wsd(void) { return new UnitSaveTorture(); }

UnitBase *unit_create_kit(void) { return new UnitKitSaveTorture(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
