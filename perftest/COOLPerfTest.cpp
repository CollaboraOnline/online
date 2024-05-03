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
#include <Poco/URI.h>

#include <net/Ssl.hpp>
#if ENABLE_SSL
#  include <SslSocket.hpp>
#endif
#include <Log.hpp>

//#include <ReplaySocketHandler.hpp>
#include <PerfTest.hpp>
#include <SamplePerfTest.hpp>
#include <PerfTestSocketHandler.hpp>

class COOLPerfTest : public Poco::Util::Application
{
public:
    COOLPerfTest() {}
protected:
    int  main(const std::vector<std::string>& args) override;
};

// coverity[root_function] : don't warn about uncaught exceptions
int COOLPerfTest::main(const std::vector<std::string>& args)
{
    //if (args.size() != 3) {
    if (args.size() != 1) {
        std::cerr << "Usage: ./coolperftest <type> <server> <trace-path>" << std::endl;
        std::cerr << "       type : 'cycle' 'message' or 'time'" << std::endl;
        std::cerr << "       server : Started separately. URI must start with ws:// or wss://. eg: wss://localhost:9980" << std::endl;
        //std::cerr << "       trace  : Created from make run-trace and manually edited." << std::endl;
        std::cerr << "       See README for more info." << std::endl;
        return EX_USAGE;
    }

    /*
    std::string type = args[0];
    if (!(type == "cycle" || type == "message" || type == "time")) {
        std::cerr << " Type must be one of 'cycle' 'message' or 'time'. Type was: " << type << std::endl;
        return EX_USAGE;
    }
    */

    std::string server = "wss://localhost:9980";
    /*
    std::string server = args[0];
    if (!server.starts_with("ws")) {
        std::cerr << "Server must start with ws:// or wss://. Server was: " << server << std::endl;
        return EX_USAGE;
    }
    */

    //std::string trace = args[2];
    //if (!std::filesystem::exists(trace)) {
        //std::cerr << "Trace file does not exist. Trace was: " << trace << std::endl;
        //return EX_USAGE;
    //}

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

    Log::setLevel("debug");
    /*
    //std::string filePath = "test/data/hello-world.odt";
    //std::string fileUri = ReplaySocketHandler::getFileUri(filePath);
    //std::string serverUri = ReplaySocketHandler::getServerUri(server, fileUri);

    TerminatingPoll poll("PerfTest poll");
    //std::shared_ptr<PerfTestSocketHandler> handler;
    std::shared_ptr<PerfTest> perfTest;
    if (type == "cycle") {
        //handler = std::make_shared<CyclePerfTestSocketHandler>(poll);
        perfTest = std::make_shared<CyclePerfTest>(name, server);
    } else if (type == "message") {
        //handler = std::make_shared<MessagePerfTestSocketHandler>(poll);
        perfTest = std::make_shared<MessagePerfTest>(name, server);
    } else if (type == "time") {
        //handler = std::make_shared<TimePerfTestSocketHandler>(poll);
        perfTest = std::make_shared<PerfTest>(name, server);
    }

    */
    //TerminatingPoll poll("PerfTest2 poll");
    SamplePerfTest perfTest(server);
    //std::shared_ptr<SamplePerfTest> perfTest = std::make_shared<SamplePerfTest>(server);
    //std::string serverUri = "wss://localhost:9980/cool/file\%253A\%252F\%252F\%252Fhome\%252Fneilguertin\%252Fbuild\%252Fonline-performance\%252Ftest\%252Fdata\%252Fhello-world.odt/ws";
    //std::string serverUri = "wss://localhost:9980/cool/file\%253A\%252F\%252F\%252Fhome\%252Fneilguertin\%252Fbuild\%252Fonline-performance\%252Ftest\%252Fdata\%252Fhello-world.odt/ws";
    //poll.insertNewWebSocketSync(Poco::URI(serverUri), perfTest->_handler);
        std::cerr << "runTest..." << std::endl;
    perfTest.runTest();
        std::cerr << "runTest DONE" << std::endl;
    //ReplaySocketHandler::start(handler, poll, serverUri);

        /*
    do {
        std::cerr << "polling..." << std::endl;
        poll.poll(TerminatingPoll::DefaultPollTimeoutMicroS);
    } while (poll.continuePolling() && poll.getSocketCount() > 0);

    */
    if (perfTest.isFinished()) {
        std::cerr << "Finished" << std::endl;
    } else {
        std::cerr << "Did not finish measurement";
        if (!perfTest.isStarted()) {
            std::cerr << " (Never started)";
        }
        std::cerr << std::endl;
        return EX_SOFTWARE;
    }

    perfTest.printResults();

    return EX_OK;
}

// coverity[root_function] : don't warn about uncaught exceptions
POCO_APP_MAIN(COOLPerfTest)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
