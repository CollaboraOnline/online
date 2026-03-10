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

/*
 * Unit test for stress testing document saving under heavy load.
 */

#include <config.h>

#include <test/UnitWSDClient.hpp>
#include <Unit.hpp>
#include <common/Util.hpp>
#include <common/JsonUtil.hpp>
#include <common/FileUtil.hpp>
#include <common/Log.hpp>
#include <JailUtil.hpp>
#include <helpers.hpp>
#include <common/StringVector.hpp>
#include <WebSocketSession.hpp>
#include <unistd.h>
#include <wsd/COOLWSD.hpp>
#include <wsd/DocumentBroker.hpp>
#include <test/lokassert.hpp>
#include <Poco/Util/LayeredConfiguration.h>

#include <string>
#include <thread>

using namespace std::literals;

constexpr auto StampFileCheckPeriodMs = 100ms;

/// Base class for Save Torture test cases.
class UnitSaveTortureBase : public UnitWSDClient
{
    bool _forceAutosave;

protected:
    UnitSaveTortureBase(const std::string& name)
        : UnitWSDClient(name)
        , _forceAutosave(false)
    {
        setHasKitHooks();
        // Double of the default.
        constexpr std::chrono::minutes timeout_minutes(1);
        setTimeout(timeout_minutes);
    }

    void modifyDocument()
    {
        TST_LOG("Modifying");

        // move to another cell?
        WSD_CMD("key type=input char=13 key=1280");
        WSD_CMD("key type=up char=0 key=1280");
        // enter - some text.
        WSD_CMD("textinput id=0 text=foo");
        // enter - commit to a cell in calc eg.
        WSD_CMD("key type=input char=13 key=1280");
        WSD_CMD("key type=up char=0 key=1280");
    }

    std::string getJailRootPath(const std::string& name)
    {
        return FileUtil::buildLocalPathToJail(JailUtil::isMountNamespacesEnabled(), getJailRoot(),
                                              "/tmp/" + name);
    }

    void createStamp(const std::string& name)
    {
        const auto path = getJailRootPath(name);
        TST_LOG("create stamp " << name << ": " << path);
        std::ofstream stamp(path);
        stamp.close();
        std::this_thread::sleep_for(StampFileCheckPeriodMs);
        sync(); // Flush the filesystem as sometimes the kit doesn't see the stamp file.
        std::this_thread::sleep_for(StampFileCheckPeriodMs);
    }

    void removeStamp(const std::string& name)
    {
        FileUtil::removeFile(getJailRootPath(name));
        TST_LOG("removed stamp " << name);
    }

    // Force background autosave when saving the modified document
    bool isAutosave() override { return _forceAutosave; }
    void forceAutosave() { _forceAutosave = true; }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);

        // Force much faster auto-saving
        config.setBool("per_document.background_autosave", true);
    }
};

/// Save torture testcase.
class UnitSaveTorture : public UnitWSD
{
    bool forceAutosave;

    void saveTortureOne(const std::string& name, const std::string& docName);

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
        TST_LOG("isAutosave returns " << forceAutosave);
        return forceAutosave;
    }

    std::string getJailRootPath(const std::string &name)
    {
        return FileUtil::buildLocalPathToJail(JailUtil::isMountNamespacesEnabled(), getJailRoot(), "/tmp/" + name);
    }

    void createStamp(const std::string &name)
    {
        const auto path = getJailRootPath(name);
        TST_LOG("create stamp " << name << ": " << path);
        std::ofstream stamp(path);
        stamp.close();
        std::this_thread::sleep_for(StampFileCheckPeriodMs);
        sync(); // Flush the filesystem as sometimes the kit doesn't see the stamp file.
        std::this_thread::sleep_for(StampFileCheckPeriodMs);
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

    bool waitForModifiedStatus(const std::string& name,
                               const std::shared_ptr<http::WebSocketSession>& wsSession,
                               std::chrono::seconds timeout = 10s)
    {
        const auto testname = __func__;

        std::chrono::steady_clock::time_point start = std::chrono::steady_clock::now();
        while (!SigUtil::getShutdownRequestFlag())
        {
            if (std::chrono::duration_cast<std::chrono::seconds>(std::chrono::steady_clock::now() -
                                                                 start) > timeout)
            {
                LOK_ASSERT_FAIL("Timed out waiting for modified status change");
                return false; // arbitrary but why not.
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

        return false;
    }
}

class UnitModified : public UnitSaveTortureBase
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitModifiedStatus) _phase;
    int _modifyCycleCount; ///< Number of times to modify.

public:
    UnitModified()
        : UnitSaveTortureBase("UnitModified")
        , _phase(Phase::Load)
        , _modifyCycleCount(4)
    {
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        TST_LOG("Got: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);

        modifyDocument();

        return true;
    }

    bool onDocumentModified(const std::string& message) override
    {
        TST_LOG("Got: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);

        if (--_modifyCycleCount == 0)
        {
            passTest("Force-modified successfully multiple times");
        }
        else
        {
            // It is vital that we can change the modified status successfully
            // and also get correct notifications from the core for bgsave to work.
            const std::string args =
                "{ \"Modified\": { \"type\": \"boolean\", \"value\": \"false\" } }";
            TST_LOG("post force modified command: .uno:Modified " << args);
            WSD_CMD("uno .uno:Modified " + args);

            modifyDocument();
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

                const std::string docName = "empty.ods";
                TST_LOG("Loading document: " << docName);
                connectAndLoadLocalDocument(docName);
                break;
            }
            case Phase::WaitLoadStatus:
            case Phase::WaitModifiedStatus:
            {
                // just wait for the results
                break;
            }
        }
    }
};

class UnitTileCombineRace : public UnitSaveTortureBase
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitDocClose) _phase;

public:
    UnitTileCombineRace()
        : UnitSaveTortureBase("UnitTileCombineRace")
        , _phase(Phase::Load)
    {
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        TST_LOG("Got: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        TRANSITION_STATE(_phase, Phase::WaitDocClose);

        modifyDocument();

        // We need the tilecombine and save in the same drainQueue in this order:
        createStamp("holddrainqueue");

        WSD_CMD("tilecombine nviewid=0 part=0 width=256 height=256 tileposx=0,3840,7680 "
                "tileposy=0,0,0 tilewidth=3840 tileheight=3840");

        // Force a background save-as-auto-save now.
        forceAutosave();
        WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0");

        removeStamp("holddrainqueue");

        return true;
    }

    bool onDocumentSaved(const std::string& message, bool success,
                         [[maybe_unused]] const std::string& result) override
    {
        TST_LOG("Save result: " << message);

        // Check the save succeeded & kit didn't crash.
        LOK_ASSERT_MESSAGE("Expected save to succeed", success);

        exitTest(success ? TestResult::Ok : TestResult::Failed);

        return true;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                const std::string docName = "empty.ods";
                TST_LOG("Loading document: " << docName);
                connectAndLoadLocalDocument(docName);
                break;
            }
            case Phase::WaitLoadStatus:
            case Phase::WaitDocClose:
            {
                // just wait for the results
                break;
            }
        }
    }
};

class UnitBgSaveCrash : public UnitSaveTortureBase
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitModifiedStatus, WaitDocClose) _phase;
    STATE_ENUM(Case, Background, Foreground) _case;

public:
    UnitBgSaveCrash()
        : UnitSaveTortureBase("UnitBgSaveCrash")
        , _phase(Phase::Load)
        , _case(Case::Background)
    {
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        TST_LOG("Got: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);

        modifyDocument();

        return true;
    }

    bool onDocumentModified(const std::string& message) override
    {
        TST_LOG("Got: [" << message << ']');

        // When the BG save fails, we get the unmodified state again.
        if (_case == Case::Background)
        {
            LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);
            TRANSITION_STATE(_phase, Phase::WaitDocClose);
        }
        else
        {
            LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);
        }

        createStamp("crashkitonsave");

        forceAutosave();

        // force a crashing save ...
        TST_LOG("Sending save request");
        WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0");

        return true;
    }

    bool onDocumentSaved(const std::string& message, bool success,
                         const std::string& result) override
    {
        TST_LOG("Save result: " << result);
        switch (_case)
        {
            case Case::Background:
                if (success)
                {
                    TST_LOG("Document failed to save");
                    failTest("Failed to save the document (Core is out-of-date or it has a "
                             "regression: " +
                             message);
                }
                else
                {
                    TST_LOG("Background save exited early as expected");
                    TRANSITION_STATE(_case, Case::Foreground);

                    TST_LOG("Sending save request to verify that foreground-saving is now used");
                    WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0");
                }
                break;
            case Case::Foreground:
                if (success)
                {
                    TST_LOG("(non)-background save succeeded on 2nd attempt");
                    passTest("Saved using foreground succeeded");
                }
                else
                {
                    TST_LOG("Document failed to save");
                    failTest("Failed to save the document (Core is out-of-date or it has a "
                             "regression: " +
                             message);
                }
                break;
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

                const std::string docName = "empty.ods";
                TST_LOG("Loading document: " << docName);
                connectAndLoadLocalDocument(docName);
                break;
            }
            case Phase::WaitLoadStatus:
            case Phase::WaitModifiedStatus:
            case Phase::WaitDocClose:
            {
                // just wait for the results
                break;
            }
        }
    }
};

void UnitSaveTorture::saveTortureOne(
    const std::string& name, const std::string& docName)
{
    auto timeout = 10s;

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

    // Tests assume all are background save
    createStamp("abortonsyncsave");

    for (size_t i = 0; i < std::size(options); ++i)
    {
        TST_LOG("saveTorture test stage " << i << " " << options[i].description);

        if (options[i].modifyFirst)
        {
            modifyDocument(wsSession);

            TST_LOG("wait for first modified status");
            LOK_ASSERT(waitForModifiedStatus(name, wsSession));
        }

        createStamp("holdsave");

        // Force a background save-as-auto-save now
        forceAutosave = true;
        wsSession->sendMessage(std::string("save dontTerminateEdit=0 dontSaveIfUnmodified=0"));

        if (options[i].modifyAfterSaveStarts)
        {
            TST_LOG("Modify after saving starts");
            modifyDocument(wsSession);

            LOK_ASSERT(waitForModifiedStatus(name, wsSession, 10s));
        }

        TST_LOG("Allow saving to continue");
        removeStamp("holdsave");

        std::vector<char> message;

        // Check the save succeeded
        while (!SigUtil::getShutdownRequestFlag())
        {
            message = wsSession->waitForMessage("unocommandresult:", timeout, name);
            LOK_ASSERT(message.size() > 0);
            if (message.size() == 0)
                break;
            bool success;
            if (getSaveResult(message, success))
            {
                LOK_ASSERT(success);
                break;
            }
        }

        if (!options[i].modifyAfterSaveStarts)
        {
            TST_LOG("wait for modified status");

            // Autosaves and synthetically notifies us of clean modification state
            LOK_ASSERT(!waitForModifiedStatus(name, wsSession));
        }
        else // we don't get this - it is still modified
        {
            // Restore the document un-modified state
            wsSession->sendMessage(std::string("save dontTerminateEdit=0 dontSaveIfUnmodified=0"));
            TST_LOG("wait for cleanup of modified state before end of test");
            LOK_ASSERT(!waitForModifiedStatus(name, wsSession));
        }
    }

    // Last save is non-sync as we cleanup.
    removeStamp("abortonsyncsave");

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
    testSaveTorture();

    exitTest(TestResult::Ok);
}

// Inside the forkit & kit processes
class UnitKitSaveTorture : public UnitKit
{
    bool stampExists(const std::string& name)
    {
        const std::string path = "/tmp/" + name;
        const bool exists = FileUtil::Stat(path).exists();
        TST_LOG("Stamp [" << name << "] " << (exists ? "exists" : "missing"));
        return exists;
    }

    void waitWhileStamp(const std::string &name)
    {
        TST_LOG("waiting while stamp " << name << " exists");
        std::chrono::steady_clock::time_point start = std::chrono::steady_clock::now();
        while (stampExists(name))
        {
            TST_LOG("stamp exists " << name);
            if (std::chrono::steady_clock::now() - start > 10s)
            {
                LOK_ASSERT_FAIL("Timed out while waiting for stamp file " << name << " to go");
                return;
            }
            std::this_thread::sleep_for(StampFileCheckPeriodMs);
        }
        TST_LOG("stamp removed " << name);
    }

public:
    UnitKitSaveTorture() : UnitKit("savetorture")
    {
        std::cerr << "\n\nYour Kit process has Save torturing hooks\n\n\n";
    }
    virtual bool filterKitMessage(WebSocketHandler *, std::string & /* message */) override
    {
        return false;
    }

    virtual bool filterDrainQueue() override
    {
        return stampExists("holddrainqueue");
    }

    virtual void preSaveHook() override
    {
        TST_LOG("Synchronous non-background save!");
        if (stampExists("abortonsyncsave"))
        {
            std::cerr << "Abort - unexpected non background save !\n\n";
            _exit(0); // otherwise we create segv's to count.
        }
    }

    virtual void postBackgroundSaveFork() override
    {
        if (stampExists("crashkitonsave"))
        {
            std::cerr << "Exit bgsave process to simulate crash\n\n";
            _exit(0); // otherwise we create segv's to count.
        }

        std::cerr << "\npost background save process fork\n\n";

        waitWhileStamp("holdsave");
    }

    virtual void preBackgroundSaveExit() override
    {
        std::cerr << "\n\npre exit of background save process\n\n\n";
    }
};

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase*[5]{ new UnitBgSaveCrash(), new UnitTileCombineRace(), new UnitModified(),
                             /*new UnitSaveTorture(),*/ nullptr };
}

UnitBase *unit_create_kit(void) { return new UnitKitSaveTorture(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
