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
#include <config_version.h>

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
#include <tools/Replay.hpp>
#include <common/Log.hpp>

#include <string>
#include <thread>

/// Save torture testcase.
class UnitPerf : public UnitWSD
{
    void testPerf(std::string testType, std::string fileType, std::string tracesStr);

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        config.setString("logging.level", "critical");
        config.setString("logging.level_startup", "critical");

//        pfm_initialize();
        UnitWSD::configure(config);
    }

public:
    UnitPerf();
    void invokeWSDTest() override;
    void onPerfDocumentLoading() override;
    void onPerfDocumentLoaded() override;
    std::unique_ptr<Util::SysStopwatch> _timer;
    std::shared_ptr<Stats> stats;
};

void UnitPerf::testPerf(std::string testType, std::string fileType, std::string traceStr)
{
    stats = std::make_shared<Stats>();
    stats->setTypeOfTest(std::move(testType));

    const std::chrono::microseconds PollTimeoutMicroS = net::Defaults::get().SocketPollTimeout;

    TerminatingPoll poll("performance test");

    std::string docName = "empty." + fileType;

    std::string filePath, dummy;

    helpers::getDocumentPathAndURL(docName, filePath, dummy, "testPerf");

    const std::string tracePath = TDOC + traceStr;
    StressSocketHandler::addPollFor(
        poll, helpers::getTestServerURI("ws"),
        filePath, tracePath,
        stats);

    do {
        poll.poll(PollTimeoutMicroS);
    } while (poll.continuePolling() && poll.getSocketCount() > 0);

    stats->dump();
}



UnitPerf::UnitPerf() : UnitWSD("UnitPerf")
{
    // Double of the default.
    constexpr std::chrono::minutes timeout_minutes(1);
    setTimeout(timeout_minutes);

    _timer.reset(new Util::SysStopwatch());
}

void UnitPerf::invokeWSDTest()
{
    std::cerr << "startup: " << _timer->elapsedTime().count() << "us\n";
    _timer->restart();

    testPerf("writer", "odt", "/../traces/perf-writer.txt");

    testPerf("calc", "ods", "/../traces/perf-calc.txt");

    testPerf("impress", "odp", "/../traces/perf-impress.txt");

    testPerf("draw", "odg", "/../traces/perf-draw.txt");

    long cpuTime = _timer->elapsedTime().count();

    std::cerr << "test: " << cpuTime << "us\n";

    exitTest(TestResult::Ok);
}

//Called when document loading process starts e.g. setup finishes
void UnitPerf::onPerfDocumentLoading()
{
    stats->endPhase(Log::Phase::Setup);
}

//called when document has been loaded into core
void UnitPerf::onPerfDocumentLoaded()
{
    stats->endPhase(Log::Phase::Load);
}

UnitBase* unit_create_wsd(void) { return new UnitPerf(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
