/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <chrono>
#include <string>
#define TST_LOG_REDIRECT
#include <test.hpp>

#include <config.h>

#include <cstdlib>
#include <iostream>
#include <memory>

#include <cppunit/BriefTestProgressListener.h>
#include <cppunit/CompilerOutputter.h>
#include <cppunit/TestResult.h>
#include <cppunit/TestFailure.h>
#include <cppunit/TestResultCollector.h>
#include <cppunit/TestRunner.h>
#include <cppunit/TextTestProgressListener.h>
#include <cppunit/extensions/TestFactoryRegistry.h>

#include <Poco/RegularExpression.h>
#include <Poco/DirectoryIterator.h>
#include <Poco/FileStream.h>
#include <Poco/StreamCopier.h>

#include <helpers.hpp>
#include <Unit.hpp>
#include <wsd/LOOLWSD.hpp>
#if ENABLE_SSL
#include <Ssl.hpp>
#include <SslSocket.hpp>
#endif
#include <Log.hpp>

#include "common/Protocol.hpp"

class HTTPGetTest;

bool filterTests(CPPUNIT_NS::TestRunner& runner, CPPUNIT_NS::Test* testRegistry, const std::string& testName)
{
    Poco::RegularExpression re(testName, Poco::RegularExpression::RE_CASELESS);
    Poco::RegularExpression::Match reMatch;

    bool haveTests = false;
    for (int i = 0; i < testRegistry->getChildTestCount(); ++i)
    {
        CPPUNIT_NS::Test* testSuite = testRegistry->getChildTestAt(i);
        for (int j = 0; j < testSuite->getChildTestCount(); ++j)
        {
            CPPUNIT_NS::Test* testCase = testSuite->getChildTestAt(j);
            try
            {
                if (re.match(testCase->getName(), reMatch))
                {
                    runner.addTest(testCase);
                    haveTests = true;
                }
            }
            catch (const std::exception& exc)
            {
                // Nothing to do; skip.
            }
        }
    }

    return haveTests;
}

static bool IsDebugrun = false;

int main(int argc, char** argv)
{
    bool verbose = false;
    std::string cert_path = "/etc/loolwsd/";
    for (int i = 1; i < argc; ++i)
    {
        const std::string arg(argv[i]);
        if (arg == "--verbose")
        {
            verbose = true;
        }
        else if (arg == "--debugrun")
        {
            IsDebugrun = true;
        }
        else if (arg == "--cert-path" && ++i < argc)
        {
            cert_path = argv[i];
        }
    }

    const char* loglevel = verbose ? "trace" : "warning";
    const bool withColor = isatty(fileno(stderr));
    Log::initialize("tst", loglevel, withColor, false, {});

#if ENABLE_SSL
    try
    {
        // The most likely place. If not found, SSL will be disabled in the tests.
        const std::string ssl_cert_file_path = cert_path + "/cert.pem";
        const std::string ssl_key_file_path = cert_path + "/key.pem";
        const std::string ssl_ca_file_path = cert_path + "/ca-chain.cert.pem";
        const std::string ssl_cipher_list = "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH";

        // Initialize the non-blocking socket SSL.
        ssl::Manager::initializeServerContext(ssl_cert_file_path, ssl_key_file_path,
                                              ssl_ca_file_path, ssl_cipher_list,
                                              ssl::CertificateVerification::Disabled);
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Exception while initializing SslContext: " << ex.what());
    }

    if (!ssl::Manager::isServerContextInitialized())
        LOG_ERR("Failed to initialize SSL. Set the path to the certificates via --cert-path. "
                "HTTPS tests will be disabled in unit-tests.");
    else
        LOG_INF("Initialized SSL.");
#else
    LOG_INF("SSL is unsupported in this build.");
#endif

    return runClientTests(true, verbose)? 0: 1;
}

static bool IsStandalone = false;

bool isStandalone()
{
    return IsStandalone;
}

static std::mutex ErrorMutex;
static bool IsVerbose = false;
static std::ostringstream ErrorsStream;

void tstLog(const std::ostringstream &stream)
{
    if (IsVerbose)
        writeTestLog(stream.str() + '\n');
    else
    {
        std::lock_guard<std::mutex> lock(ErrorMutex);
        ErrorsStream << stream.str();
    }
}

class TestProgressListener : public CppUnit::TestListener
{
    TestProgressListener(const TestProgressListener& copy) = delete;
    void operator=(const TestProgressListener& copy) = delete;

public:
    TestProgressListener() {}
    virtual ~TestProgressListener() {}

    void startTest(CppUnit::Test* test)
    {
        writeTestLog("\n=============== START " + test->getName() + '\n');
        if (UnitBase::isUnitTesting()) // Only if we are in UnitClient.
            UnitBase::get().setTestname(test->getName());
        _startTime = std::chrono::steady_clock::now();
    }

    void addFailure(const CppUnit::TestFailure& failure)
    {
        if (failure.isError())
            writeTestLog("\n>>>>>>>> ERROR " + failure.failedTestName() + " <<<<<<<<<\n");
        else
            writeTestLog("\n>>>>>>>> FAILED " + failure.failedTestName() + " <<<<<<<<<\n");

        const auto ex = failure.thrownException();
        if (ex != nullptr)
        {
            writeTestLog("\nException: " + ex->message().shortDescription() + '\n'
                         + ex->message().details() + "\tat " + ex->sourceLine().fileName() + ':'
                         + std::to_string(ex->sourceLine().lineNumber()) + '\n');
        }
        else
        {
            writeTestLog("\tat " + failure.sourceLine().fileName() + ':'
                         + std::to_string(failure.sourceLine().lineNumber()) + '\n');
        }
    }

    void endTest(CppUnit::Test* test)
    {
        const auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - _startTime);
        writeTestLog("\n=============== END " + test->getName() + " (" + std::to_string(ms.count())
                     + "ms) ===============\n");
    }

private:
    std::chrono::steady_clock::time_point _startTime;
};

// returns true on success
bool runClientTests(bool standalone, bool verbose)
{
    IsVerbose = verbose;
    IsStandalone = standalone;

    CPPUNIT_NS::TestResult controller;
    CPPUNIT_NS::TestResultCollector result;
    controller.addListener(&result);
    TestProgressListener listener;
    controller.addListener(&listener);

    CPPUNIT_NS::Test* testRegistry = CPPUNIT_NS::TestFactoryRegistry::getRegistry().makeTest();

    CPPUNIT_NS::TestRunner runner;
    const char* envar = std::getenv("CPPUNIT_TEST_NAME");
    std::string testName;
    if (envar)
    {
        testName = std::string(envar);
    }

    if (testName.empty())
    {
        // Add all tests.
        runner.addTest(testRegistry);
    }
    else
    {
        const bool testsAdded = filterTests(runner, testRegistry, testName);
        if (!testsAdded)
        {
            std::cerr << "Failed to match [" << testName << "] to any names in the external test-suite. "
                      << "No external tests will be executed" << std::endl;
        }
    }

    if (!verbose)
    {
        runner.run(controller);

        // output the ErrorsStream we got during the testing
        if (!result.wasSuccessful())
            writeTestLog(ErrorsStream.str() + '\n');
    }
    else
    {
        runner.run(controller);
    }

    CPPUNIT_NS::CompilerOutputter outputter(&result, std::cerr);
    outputter.setNoWrap();
    outputter.write();

    const std::deque<CPPUNIT_NS::TestFailure *> &failures = result.failures();
    if (!envar && failures.size() > 0)
    {
        std::cerr << "\nTo reproduce the first test failure use:\n\n";
#ifdef STANDALONE_CPPUNIT // unittest
        const char *cmd = "./unittest";
        std::cerr << "To debug:\n\n";
        std::cerr << "  (cd test; CPPUNIT_TEST_NAME=\"" << (*failures.begin())->failedTestName() << "\" gdb --args " << cmd << ")\n\n";
#else
        std::string aLib = UnitBase::get().getUnitLibPath();
        std::size_t lastSlash = aLib.rfind('/');
        if (lastSlash != std::string::npos)
            aLib = aLib.substr(lastSlash + 1, aLib.length() - lastSlash - 4) + ".la";
        std::cerr << "(cd test; CPPUNIT_TEST_NAME=\"" << (*failures.begin())->failedTestName() <<
            "\" ./run_unit.sh --test-name " << aLib << ")\n\n";
#endif
    }

    return result.wasSuccessful();
}

// Standalone tests don't really use WSD
#ifndef STANDALONE_CPPUNIT

std::set<pid_t> getKitPids()
{
    return LOOLWSD::getKitPids();
}

/// Get the PID of the forkit
std::set<pid_t> getForKitPids()
{
    std::set<pid_t> pids;
    if (LOOLWSD::ForKitProcId >= 0)
        pids.emplace(LOOLWSD::ForKitProcId);
    return pids;
}

/// How many live loolkit processes do we have ?
int getLoolKitProcessCount()
{
    return getKitPids().size();
}
#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
