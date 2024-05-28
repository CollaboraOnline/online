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
#include <tools/Replay.hpp>

#include <string>
#include <thread>


/// Save torture testcase.
class UnitPerf : public UnitWSD
{
    void testPerf();

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
    std::unique_ptr<Util::SysStopwatch> _timer;
};

void UnitPerf::testPerf()
{
    auto stats = std::make_shared<Stats>();

    TerminatingPoll poll("performance test");

    std::string docName = "empty.odt";

    std::string filePath, dummy;
    helpers::getDocumentPathAndURL(docName, filePath, dummy, "testPerf");

    const std::string tracePath;
    StressSocketHandler::addPollFor(
        poll, helpers::getTestServerURI("ws"),
        filePath, TDOC "/../traces/perf-writer.txt",
        stats);

    do {
        poll.poll(TerminatingPoll::DefaultPollTimeoutMicroS);
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

    testPerf();

    std::cerr << "test: " << _timer->elapsedTime().count() << "us\n";

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitPerf(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
