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
#include <dlfcn.h>

#include <Poco/Util/Application.h>
#include <Poco/URI.h>

#include <net/Ssl.hpp>
#if ENABLE_SSL
#  include <SslSocket.hpp>
#endif
#include <Log.hpp>

#include <perftest/PerfTest.hpp>
#include <perftest/PerfTestSocketHandler.hpp>

typedef std::shared_ptr<PerfTest> (CreatePerfTestFunction)(std::string &server);

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

    // Temporarily silence unused parameter warning
    for (std::string arg : args) {
        std::cout << "Args: " << arg << std::endl;
    }

    if (args.size() != 2) {
        std::cerr << "Usage: ./coolperftest <name> <server>" << std::endl;
        std::cerr << "       name: name of the perf test library" << std::endl;
        std::cerr << "       server : Started separately. URI must start with ws:// or wss://. eg: wss://localhost:9980" << std::endl;
        std::cerr << "       See README for more info." << std::endl;
        return EX_USAGE;
    }

    //std::string name = "perftest/sample/SamplePerfTest";
    std::string name = args[0];

    //std::string server = "wss://localhost:9980";
    std::string server = args[1];
    if (!server.starts_with("ws")) {
        std::cerr << "Server must start with ws:// or wss://. Server was: " << server << std::endl;
        return EX_USAGE;
    }

#if ENABLE_SSL
    ssl::Manager::initializeClientContext("", "", "",
            "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH",
            ssl::CertificateVerification::Disabled);
    if (!ssl::Manager::isClientContextInitialized()) {
        std::cerr << "Failed to initialize Client SSL.\n";
        return EX_SOFTWARE;
    }
#endif

    LOG_DBG("Starting PerfTest " << name << " " << server);
    Log::setLevel("debug");

    LOG_DBG("Dynamicaly linking library " << name);
    void *dlhandle = dlopen(name.c_str(), RTLD_GLOBAL|RTLD_NOW);
    if (!dlhandle)
    {
        LOG_ERR("Failed to load perftest lib " << dlerror());
        return EX_SOFTWARE;
    }
    LOG_DBG("Successfully linked library " << name);

    LOG_DBG("Finding create_perftest symbol in " << name);
    CreatePerfTestFunction *createFunction =
        reinterpret_cast<CreatePerfTestFunction*>(dlsym(dlhandle, "create_perftest"));
    if (!createFunction) {
        LOG_ERR("No 'create_perftest' symbol in " << name);
        return EX_SOFTWARE;
    }
    LOG_DBG("Found create_perftest symbol in " << name);

    std::shared_ptr<PerfTest> perfTest = createFunction(server);
    perfTest->runTest();

    std::cerr << "runTest DONE" << std::endl;

    if (perfTest->isFinished()) {
        std::cerr << "Finished" << std::endl;
    } else {
        std::cerr << "Did not finish measurement";
        if (!perfTest->isStarted()) {
            std::cerr << " (Never started)";
        }
        std::cerr << std::endl;
        return EX_SOFTWARE;
    }

    perfTest->printResults();

    return EX_OK;
}

// coverity[root_function] : don't warn about uncaught exceptions
POCO_APP_MAIN(COOLPerfTest)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
