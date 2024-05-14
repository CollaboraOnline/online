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

    void testModified();
    void testTileCombineRace();
    void testSaveTorture();

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

    bool getSaveResult(const std::vector<char> &message, bool &success)
    {
        success = false;
        if (message.size() == 0)
            return false;

        Poco::JSON::Object::Ptr object;
        if (!JsonUtil::parseJSON(std::string(message.data(), message.size()), object))
            return false;

        // We can get .uno:Modified and other unocommandresults.
        if (JsonUtil::getJSONValue<std::string>(object, "commandName") == ".uno:Save")
        {
            success = JsonUtil::getJSONValue<bool>(object, "success");
            return true;
        }

        return false;
    }

public:
    UnitSaveTorture();
    void invokeWSDTest() override;
};

namespace {
    void modifyDocument(const std::shared_ptr<http::WebSocketSession> &wsSession)
    {
        // move to another cell?
        wsSession->sendMessage(std::string("key type=input char=13 key=1280"));
        wsSession->sendMessage(std::string("key type=up char=0 key=1280"));
        // enter - some text.
        wsSession->sendMessage(std::string("textinput id=0 text=foo"));
        // enter - commit to a cell in calc eg.
        wsSession->sendMessage(std::string("key type=input char=13 key=1280"));
        wsSession->sendMessage(std::string("key type=up char=0 key=1280"));
    }

    bool waitForModifiedStatus(const std::string& name, const std::shared_ptr<http::WebSocketSession> &wsSession,
                               std::chrono::seconds timeout = std::chrono::seconds(10))
    {
        const auto testname = __func__;

        std::chrono::steady_clock::time_point start = std::chrono::steady_clock::now();
        while (true)
        {
            if (std::chrono::steady_clock::now() - start > timeout)
            {
                LOK_ASSERT_FAIL("Timed out waiting for modified status change");
                break;
            }
            std::vector<char> message
                = wsSession->waitForMessage("statechanged:", timeout, name);
            if (message.empty())
                continue; // fail above more helpfully

            auto tokens = StringVector::tokenize(message.data(), message.size());
            if (tokens[1] == ".uno:ModifiedStatus=false")
                return false;
            else if (tokens[1] == ".uno:ModifiedStatus=true")
                return true;
        }
    }
}

void UnitSaveTorture::testModified()
{
    std::string name = "testModified";
    std::string docName = "empty.ods";

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL(docName, documentPath, documentURL, name);

    TST_LOG("Starting test on " << documentURL << ' ' << documentPath);

    std::shared_ptr<SocketPoll> poll = std::make_shared<SocketPoll>("WebSocketPoll");
    poll->startThread();

    Poco::URI uri(helpers::getTestServerURI());
    auto wsSession = helpers::loadDocAndGetSession(poll, docName, uri, testname);

    // It is vital that we can change the modified status successfully
    // and also get correct notifications from the core for bgsave to work.
    for (size_t i = 0; i < 4; ++i)
    {
        TST_LOG("modify document");
        modifyDocument(wsSession);
        LOK_ASSERT_EQUAL(waitForModifiedStatus(name, wsSession, std::chrono::seconds(3)), true);

        std::string args = "{ \"Modified\": { \"type\": \"boolean\", \"value\": \"false\" } }";
        TST_LOG("post force modified command: .uno:Modified " << args);
        wsSession->sendMessage(std::string("uno .uno:Modified ") + args);

        TST_LOG("wait for confirmation of (non-)modification:");
        LOK_ASSERT_EQUAL(waitForModifiedStatus(name, wsSession, std::chrono::seconds(3)), false);
    }

    poll->joinThread();
}

void UnitSaveTorture::testTileCombineRace()
{
    std::string name = "testModified";
    std::string docName = "empty.ods";

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL(docName, documentPath, documentURL, name);

    TST_LOG("Starting test on " << documentURL << ' ' << documentPath);

    std::shared_ptr<SocketPoll> poll = std::make_shared<SocketPoll>("WebSocketPoll");
    poll->startThread();

    Poco::URI uri(helpers::getTestServerURI());
    auto wsSession = helpers::loadDocAndGetSession(poll, docName, uri, testname);

    TST_LOG("modify document");
    modifyDocument(wsSession);

    // We need the tilecombine and save in the same drainQueue in this order:
    createStamp("holddrainqueue");

    wsSession->sendMessage(std::string("tilecombine nviewid=0 part=0 width=256 height=256 tileposx=0,3840,7680 tileposy=0,0,0 tilewidth=3840 tileheight=3840"));

    // Force a background save-as-auto-save now
    forceAutosave = true;
    wsSession->sendMessage(std::string("save dontTerminateEdit=0 dontSaveIfUnmodified=0"));

    removeStamp("holddrainqueue");

    // Check the save succeeded & kit didn't crash
    while (true)
    {
        std::chrono::seconds timeout = std::chrono::seconds(10);
        auto message = wsSession->waitForMessage("unocommandresult:", timeout, name);
        bool success;
        if (getSaveResult(message, success))
        {
            LOK_ASSERT_EQUAL(success, true);
            break;
        }
    }

    poll->joinThread();
}

namespace {
    /*
     * A sleep in a unit test !? but ... SfxBinding notifies its
     * state changes around 250ms after they are made to reduce
     * spamming clients; so - if we eg. do a save that forces an
     * un-modified state, and then immediately do a modification
     * we will get no notification - from the binding's perspective
     * we continue to be unmodified - no sweat; no notification.
     *
     * But we want to see and check all those transitions - so
     * in theory we need to wait.
     */
    void sleepForIdleModificationNotification(const std::string &testname)
    {
        LOG_TST("Sleep to let idle non-synthetic ModifiedState notification catch up");
        std::this_thread::sleep_for(std::chrono::milliseconds(1000));
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

    // ----------------- simple load/modify/bgsave  -----------------
    // ----------------- load/modify/bgsave+modify  -----------------
    // Next: Modify, force an autosave, and while saving, modify again ...

    static struct {
        bool modifyFirst;
        bool modifyAfterSaveStarts;
        const char *description;
    } options[] = {
        { true, false,  "simple load/modify/bgsave" },
        { true, true,   "load/modify/bgsave-start + modify + bgsave-end" },
//        { false, false, "un-modified, just save and lets see" }
    };

    for (size_t i = 0; i < std::size(options); ++i)
    {
        LOG_TST("saveTorture test stage " << i << " " << options[i].description);

        if (options[i].modifyFirst)
        {
            modifyDocument(wsSession);

            LOG_TST("wait for first modified status");
            LOK_ASSERT_EQUAL(waitForModifiedStatus(name, wsSession), true);
        }

        createStamp("holdsave");

        // Force a background save-as-auto-save now
        forceAutosave = true;
        wsSession->sendMessage(std::string("save dontTerminateEdit=0 dontSaveIfUnmodified=0"));

        if (options[i].modifyAfterSaveStarts)
        {
            LOG_TST("Give the on-save modification clear - time to get emitted");
            sleepForIdleModificationNotification(testname);

            LOG_TST("Modify after saving starts");
            modifyDocument(wsSession);

            LOK_ASSERT_EQUAL(waitForModifiedStatus(name, wsSession, std::chrono::seconds(3)), true);
        }

        LOG_TST("Allow saving to continue");
        removeStamp("holdsave");

        std::vector<char> message;

        // Check the save succeeded
        while (true)
        {
            message = wsSession->waitForMessage("unocommandresult:", timeout, name);
            bool success;
            if (getSaveResult(message, success))
            {
                LOK_ASSERT_EQUAL(success, true);
                break;
            }
        }

        if (!options[i].modifyAfterSaveStarts)
        {
            LOG_TST("wait for modified status");

            // Autosaves and synthetically notifies us of clean modification state
            LOK_ASSERT_EQUAL(waitForModifiedStatus(name, wsSession), false);
        }
        else // we don't get this - it is still modified
        {
            // Restore the document un-modified state
            wsSession->sendMessage(std::string("save dontTerminateEdit=0 dontSaveIfUnmodified=0"));
            LOG_TST("wait for cleanup of modified state before end of test");
            LOK_ASSERT_EQUAL(waitForModifiedStatus(name, wsSession), false);
        }
    }

    poll->joinThread();
}

void UnitSaveTorture::testSaveTorture()
{
    std::vector<std::string> docNames = { "empty.odt", "empty.ods" };
    // TODO: "empty.odp", "empty.odg" - modification method needs tweaking.
    for (const auto& docName : docNames)
    {
        const auto name = "saveTorture_" + docName + ' ';
        saveTortureOne(name, docName);
    }
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
    testModified();

    testTileCombineRace();

    testSaveTorture();

    exitTest(TestResult::Ok);
}

// Inside the forkit & kit processes
class UnitKitSaveTorture : public UnitKit
{
    bool stampExists(const std::string &name)
    {
        return FileUtil::Stat(std::string("/tmp/") + name).exists();
    }

    void waitWhileStamp(const std::string &name)
    {
        std::chrono::steady_clock::time_point start = std::chrono::steady_clock::now();
        while (stampExists(name))
        {
            TST_LOG("stamp exists " << name);
            if (std::chrono::steady_clock::now() - start > std::chrono::seconds(10))
            {
                LOK_ASSERT_FAIL("Timed out while waiting for stamp file " + name + " to go");
                return;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
        TST_LOG("stamp removed " << name);
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

    virtual bool filterDrainQueue() override
    {
        return stampExists("holddrainqueue");
    }

    virtual void postBackgroundSaveFork() override
    {
        std::cerr << "\n\npost background save process fork\n\n\n";

        waitWhileStamp("holdsave");
    }

    virtual void preBackgroundSaveExit() override
    {
        std::cerr << "\n\npre exit of background save process\n\n\n";
    }
};

UnitBase* unit_create_wsd(void) { return new UnitSaveTorture(); }

UnitBase *unit_create_kit(void) { return new UnitKitSaveTorture(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
