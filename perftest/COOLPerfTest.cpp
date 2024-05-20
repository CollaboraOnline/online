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
    if (args.size() != 2) {
        std::cerr << "Usage: ./coolperftest <object> <server>" << std::endl;
        std::cerr << "       object: name of the perf test shared object" << std::endl;
        std::cerr << "       server: Started separately. URI must start with ws:// or wss://. eg: wss://localhost:9980" << std::endl;
        std::cerr << "       See README for more info." << std::endl;
        return EX_USAGE;
    }

    std::string object = args[0];
    if (!object.ends_with("so")) {
        std::cerr << "Object must end with .so. Object was: " << object << std::endl;
        return EX_USAGE;
    }

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

    // Set up logging
    std::cerr << "Starting PerfTest " << object << std::endl << "Logging to perftest/workdir/coolperftest.log" << std::endl;
    std::map<std::string, std::string> logConfig;
    logConfig.emplace("path","perftest/workdir/coolperftest.log");
    Log::initialize("perftest","trace",false,true,logConfig);
    LOG_DBG("Starting PerfTest. Object: " << object << " Server: " << server);

    LOG_DBG("Dynamicaly linking library " << object);
    void *dlhandle = dlopen(object.c_str(), RTLD_GLOBAL|RTLD_NOW);
    if (!dlhandle)
    {
        LOG_ERR("Failed to load perftest lib " << dlerror());
        return EX_SOFTWARE;
    }
    LOG_DBG("Successfully linked library " << object);

    LOG_DBG("Finding create_perftest symbol in " << object);
    CreatePerfTestFunction *createFunction =
        reinterpret_cast<CreatePerfTestFunction*>(dlsym(dlhandle, "create_perftest"));
    if (!createFunction) {
        LOG_ERR("No 'create_perftest' symbol in " << object);
        return EX_SOFTWARE;
    }
    LOG_DBG("Found create_perftest symbol in " << object);

    LOG_DBG("Creating perftest");
    std::shared_ptr<PerfTest> perfTest = createFunction(server);
    LOG_DBG("Running perftest");
    perfTest->runTest();
    LOG_DBG("PerfTest complete.");

    if (perfTest->isFinished()) {
        LOG_DBG("PerfTest finished measurement");
        std::cerr << "Finished" << std::endl;
    } else {
        LOG_DBG("PerfTest did not finish measurment");
        std::cerr << "Did not finish measurement";
        if (!perfTest->isStarted()) {
            LOG_DBG("PerfTest never started measurment");
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
