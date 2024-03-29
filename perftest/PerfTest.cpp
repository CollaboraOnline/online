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

#include <sysexits.h>
#include <filesystem>
#include <memory>

#include <Poco/Util/Application.h>

#include <net/Ssl.hpp>
#if ENABLE_SSL
#  include <SslSocket.hpp>
#endif

#include <ReplaySocketHandler.hpp>
#include <PerfTestSocketHandler.hpp>

class PerfTest : public Poco::Util::Application
{
public:
    PerfTest() {}
protected:
    int  main(const std::vector<std::string>& args) override;
};

// coverity[root_function] : don't warn about uncaught exceptions
int PerfTest::main(const std::vector<std::string>& args)
{
    if (args.size() != 3) {
        std::cerr << "Usage: ./coolperftest <type> <server> <trace-path>" << std::endl;
        std::cerr << "       type : 'cycle' 'message' or 'time'" << std::endl;
        std::cerr << "       server : Started separately. URI must start with ws:// or wss://. eg: wss://localhost:9980" << std::endl;
        std::cerr << "       trace  : Created from make run-trace and manually edited." << std::endl;
        std::cerr << "       See README for more info." << std::endl;
        return EX_USAGE;
    }

    std::string type = args[0];
    if (!(type == "cycle" || type == "message" || type == "time")) {
        std::cerr << " Type must be one of 'cycle' 'message' or 'time'. Type was: " << type << std::endl;
        return EX_USAGE;
    }

    std::string server = args[1];
    if (!server.starts_with("ws")) {
        std::cerr << "Server must start with ws:// or wss://. Server was: " << server << std::endl;
        return EX_USAGE;
    }

    std::string trace = args[2];
    if (!std::filesystem::exists(trace)) {
        std::cerr << "Trace file does not exist. Trace was: " << trace << std::endl;
        return EX_USAGE;
    }

    std::cerr << "Starting" << std::endl;

#if ENABLE_SSL
    ssl::Manager::initializeClientContext("", "", "",
            "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH",
            ssl::CertificateVerification::Disabled);
    if (!ssl::Manager::isClientContextInitialized()) {
        std::cerr << "Failed to initialize Client SSL.\n";
        return EX_SOFTWARE;
    }
#endif

    std::string filePath = "test/data/hello-world.odt";
    std::string fileUri = ReplaySocketHandler::getFileUri(filePath);
    std::string serverUri = ReplaySocketHandler::getServerUri(server, fileUri);

    TerminatingPoll poll("PerfTest poll");
    std::shared_ptr<PerfTestSocketHandler> handler;
    if (type == "cycle") {
        handler = std::make_shared<CyclePerfTestSocketHandler>(poll, fileUri, trace);
    } else if (type == "message") {
        handler = std::make_shared<MessagePerfTestSocketHandler>(poll, fileUri, trace);
    } else if (type == "time") {
        handler = std::make_shared<TimePerfTestSocketHandler>(poll, fileUri, trace);
    }

    ReplaySocketHandler::start(handler, poll, serverUri);

    do {
        poll.poll(TerminatingPoll::DefaultPollTimeoutMicroS);
    } while (poll.continuePolling() && poll.getSocketCount() > 0);

    if (handler->isFinished()) {
        std::cerr << "Finished" << std::endl;
    } else {
        std::cerr << "Did not finish measurement" << std::endl;
        return EX_SOFTWARE;
    }

    handler->printResults();

    return EX_OK;
}

// coverity[root_function] : don't warn about uncaught exceptions
POCO_APP_MAIN(PerfTest)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
