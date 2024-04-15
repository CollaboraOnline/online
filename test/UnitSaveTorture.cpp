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
#include <helpers.hpp>
#include <WebSocketSession.hpp>
#include <test/lokassert.hpp>
#include <Poco/Util/LayeredConfiguration.h>

#include <string>
#include <thread>

/// Save torture testcase.
class UnitSaveTorture : public UnitWSD
{
    void saveTortureOne(const std::string& name, const std::string& docName,
                        const size_t thread_count);
    TestResult testSaveTorture();

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);

        // Force much faster auto-saving
        config.setInt("per_document.idlesave_duration_secs", 1);
        config.setInt("per_document.autosave_duration_secs", 2);
    }

    // Force background autosave when saving the modified document
    bool isAutosave() override
    {
        return true;
    }

public:
    UnitSaveTorture();
    void invokeWSDTest() override;
};

void UnitSaveTorture::saveTortureOne(
    const std::string& name, const std::string& docName, const size_t thread_count)
{
    // Save same document from many threads together.
    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL(docName, documentPath, documentURL, name);

    TST_LOG("Starting test on " << documentURL << ' ' << documentPath);

    std::vector<int> view_ids;

    std::atomic<int> sum_view_ids;
    sum_view_ids = 0;
    std::atomic<int> num_of_views(0);
    std::atomic<int> num_to_load(thread_count);

    std::shared_ptr<SocketPoll> poll = std::make_shared<SocketPoll>("WebSocketPoll");
    poll->startThread();

    std::vector<std::thread> threads;
    for (size_t i = 0; i < thread_count; ++i)
    {
        threads.emplace_back([&] {
            std::ostringstream oss;
            oss << std::hex << std::this_thread::get_id();
            const std::string id = oss.str();

            TST_LOG(": #" << id << ", views: " << num_of_views << ", to load: " << num_to_load);
            try
            {
                // Save a document and wait for the status.
                auto wsSession = http::WebSocketSession::create(helpers::getTestServerURI());
                http::Request req(documentURL);
                wsSession->asyncRequest(req, poll);

                wsSession->sendMessage("load url=" + documentURL);

                // 20s is double of the default.
                std::vector<char> message
                    = wsSession->waitForMessage("status:", std::chrono::seconds(20), name + id + ' ');
                const std::string status = COOLProtocol::getFirstLine(message);

                ++num_of_views;
                --num_to_load;

                // Get all the views loaded - lean on test timeout to interrupt.
                while (num_to_load > 0)
                    std::this_thread::sleep_for(std::chrono::milliseconds(20));

                // Modify to have something to save the modified phase.
//                helpers::sendTextFrame(wsSession, "foo", getTestname());
                wsSession->sendMessage(std::string("key type=input char=97 key=0"));
                wsSession->sendMessage(std::string("key type=up char=0 key=512"));

                // Couple of saves:
                if (num_of_views % 3)
                    wsSession->sendMessage(std::string("save"));

                // wait for autosave to kick in
                std::this_thread::sleep_for(std::chrono::seconds(2 * 3));

                --num_of_views;

                TST_LOG(": #" << id << ", view: " << num_of_views << " unloading");
            }
            catch (const std::exception& exc)
            {
                TST_LOG(": #" << id << ", Exception: " << exc.what());
                --num_to_load;
            }
        });
    }

    for (auto& thread : threads)
    {
        try
        {
            thread.join();
        }
        catch (const std::exception& exc)
        {
            TST_LOG(": Exception: " << exc.what());
        }
    }
}

UnitBase::TestResult UnitSaveTorture::testSaveTorture()
{
    const int thread_count = 3;

    std::vector<std::string> docNames = { "empty.ods", "empty.odt", "empty.odp", "empty.odg" };

    std::vector<std::thread> threads;
    threads.reserve(docNames.size());
    for (const auto& docName : docNames)
    {
        threads.emplace_back([&] {
            const auto name = "saveTorture_" + docName + ' ';
            saveTortureOne(name, docName, thread_count);
        });
    }

    for (auto& thread : threads)
    {
        thread.join();
    }
    return TestResult::Ok;
}

UnitSaveTorture::UnitSaveTorture()
    : UnitWSD("UnitSaveTorture")
{
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
