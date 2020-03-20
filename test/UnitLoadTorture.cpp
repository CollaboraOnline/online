/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <memory>
#include <string>

#include <Poco/URI.h>
#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <Util.hpp>
#include <helpers.hpp>

class LOOLWebSocket;

/// Load torture testcase.
class UnitLoadTorture : public UnitWSD
{
    int loadTorture(const std::string& testname, const std::string& docName,
                    const size_t thread_count, const size_t max_jitter_ms);
    TestResult testLoadTortureODT();
    TestResult testLoadTortureODS();
    TestResult testLoadTortureODP();
    TestResult testLoadTorture();

public:
    UnitLoadTorture();
    void invokeTest() override;
};

int UnitLoadTorture::loadTorture(const std::string& testname, const std::string& docName,
                                 const size_t thread_count, const size_t max_jitter_ms)
{
    // Load same document from many threads together.
    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL(docName, documentPath, documentURL, testname);

    std::atomic<int> sum_view_ids;
    sum_view_ids = 0;
    std::atomic<int> num_of_views(0);
    std::atomic<int> num_to_load(thread_count);

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
                // Load a document and wait for the status.
                Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
                Poco::Net::HTTPResponse response;
                std::shared_ptr<LOOLWebSocket> socket = helpers::connectLOKit(
                    Poco::URI(helpers::getTestServerURI()), request, response, testname);
                helpers::sendTextFrame(socket, "load url=" + documentURL, testname);

                // 20s is double of the default.
                const auto status = helpers::assertResponseString(socket, "status:", testname, 20000);
                int viewid = -1;
                LOOLProtocol::getTokenIntegerFromMessage(status, "viewid", viewid);
                sum_view_ids += viewid;
                ++num_of_views;
                --num_to_load;

                TST_LOG(": #" << id << ", loaded views: " << num_of_views
                              << ", to load: " << num_to_load);

                while (true)
                {
                    if (num_to_load == 0)
                    {
                        // Unload at once, nothing more left to do.
                        TST_LOG(": #" << id << ", no more to load, unloading.");
                        break;
                    }

                    const auto ms
                        = (max_jitter_ms > 0
                               ? std::chrono::milliseconds(Util::rng::getNext() % max_jitter_ms)
                               : std::chrono::milliseconds(0));
                    std::this_thread::sleep_for(ms);

                    // Unload only when we aren't the last/only.
                    if (--num_of_views > 0)
                    {
                        TST_LOG(": #" << id << ", views: " << num_of_views
                                      << " not the last/only, unloading.");
                        break;
                    }
                    else
                    {
                        // Correct back, since we aren't unloading just yet.
                        ++num_of_views;
                    }
                }
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

    return sum_view_ids;
}

UnitBase::TestResult UnitLoadTorture::testLoadTortureODT()
{
    const int thread_count = 6;
    const int max_jitter_ms = 100;

    const char* testname = "loadTortureODT ";
    const int sum_view_ids = loadTorture(testname, "empty.odt", thread_count, max_jitter_ms);

    // This only works when the first view-ID is 0 and increments monotonously.
    const int number_of_loads = thread_count;
    const int exp_sum_view_ids = number_of_loads * (number_of_loads - 1) / 2; // 0-based view-ids.
    LOK_ASSERT_EQUAL(exp_sum_view_ids, sum_view_ids);
    return TestResult::Ok;
}

UnitBase::TestResult UnitLoadTorture::testLoadTortureODS()
{
    const int thread_count = 6;
    const int max_jitter_ms = 100;

    const char* testname = "loadTortureODS ";
    const int sum_view_ids = loadTorture(testname, "empty.ods", thread_count, max_jitter_ms);

    // This only works when the first view-ID is 0 and increments monotonously.
    const int number_of_loads = thread_count;
    const int exp_sum_view_ids = number_of_loads * (number_of_loads - 1) / 2; // 0-based view-ids.
    LOK_ASSERT_EQUAL(exp_sum_view_ids, sum_view_ids);
    return TestResult::Ok;
}

UnitBase::TestResult UnitLoadTorture::testLoadTortureODP()
{
    const int thread_count = 6;
    const int max_jitter_ms = 100;

    const char* testname = "loadTortureODP ";
    const int sum_view_ids = loadTorture(testname, "empty.odp", thread_count, max_jitter_ms);

    // For ODP the view-id is always odd, and we expect not to skip any ids.
    const int number_of_loads = thread_count;
    const int exp_sum_view_ids = number_of_loads * (number_of_loads - 1) / 2; // 0-based view-ids.
    LOK_ASSERT_EQUAL(exp_sum_view_ids, sum_view_ids);
    return TestResult::Ok;
}

UnitBase::TestResult UnitLoadTorture::testLoadTorture()
{
    const int thread_count = 3;
    const int max_jitter_ms = 75;

    std::vector<std::string> docNames = { "setclientpart.ods", "hello.odt", "viewcursor.odp" };

    std::vector<std::thread> threads;
    threads.reserve(docNames.size());
    for (const auto& docName : docNames)
    {
        threads.emplace_back([&] {
            const auto testname = "loadTorture_" + docName + ' ';
            loadTorture(testname, docName, thread_count, max_jitter_ms);
        });
    }

    for (auto& thread : threads)
    {
        thread.join();
    }
    return TestResult::Ok;
}

UnitLoadTorture::UnitLoadTorture()
{
    // Double of the default.
    int timeout_minutes = 1;
    setTimeout(timeout_minutes * 60 * 1000);
}

void UnitLoadTorture::invokeTest()
{
    UnitBase::TestResult result = testLoadTortureODT();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testLoadTortureODS();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testLoadTortureODP();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testLoadTorture();
    exitTest(result);
}

UnitBase* unit_create_wsd(void) { return new UnitLoadTorture(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
