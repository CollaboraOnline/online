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

#include <Poco/Util/Application.h>

#include <net/Ssl.hpp>
#if ENABLE_SSL
#  include <SslSocket.hpp>
#endif

#include <ReplaySocketHandler.hpp>

class CycleCountSocketHandler : public ReplaySocketHandler
{
public:
    CycleCountSocketHandler(SocketPoll &poll, /* bad style */
                        const std::string &uri,
                        const std::string &trace) :
        ReplaySocketHandler(poll, uri, trace)
    {
    }

    void startMeasurement() override
    {
        sendMessage("PERFTEST start");
    }

    void stopMeasurement() override
    {
        sendMessage("PERFTEST stop " + _trace);
    }
};

class CycleCountPerfTest : public Poco::Util::Application
{
public:
    CycleCountPerfTest() {}
protected:
    int  main(const std::vector<std::string>& args) override;
};

// coverity[root_function] : don't warn about uncaught exceptions
int CycleCountPerfTest::main(const std::vector<std::string>& args)
{
    if (args.size() != 2) {
        std::cerr << "Usage: ./cyclecountperftest <server> <trace-path>" << std::endl;
        std::cerr << "       server : Started separately. URI must start with ws:// or wss://. eg: wss://localhost:9980" << std::endl;
        std::cerr << "       trace  : Created from make run-trace and manually edited." << std::endl;
        std::cerr << "       See README for more info." << std::endl;
        return EX_USAGE;
    }

    std::string server = args[0];
    if (!server.starts_with("ws")) {
        std::cerr << "Server must start with ws:// or wss://. Server was: " << server << std::endl;
        return EX_USAGE;
    }

    std::string trace = args[1];
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
        return -1;
    }
#endif

    std::string filePath = "../test/data/hello-world.odt";
    std::string fileUri = ReplaySocketHandler::getFileUri(filePath);
    std::string serverUri = ReplaySocketHandler::getServerUri(server, fileUri);

    TerminatingPoll poll("CycleCountPerfTest poll");
    auto handler = std::make_shared<CycleCountSocketHandler>(poll, fileUri, trace);

    ReplaySocketHandler::start(handler, poll, serverUri);

    do {
        poll.poll(TerminatingPoll::DefaultPollTimeoutMicroS);
    } while (poll.continuePolling() && poll.getSocketCount() > 0);

    std::cerr << "Finished" << std::endl;


    // This is supposed to be json
    std::cout << "{\n"
              << "    name: " << trace << ",\n"
              << "}" << std::endl;

    return EX_OK;
}

// coverity[root_function] : don't warn about uncaught exceptions
POCO_APP_MAIN(CycleCountPerfTest)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
