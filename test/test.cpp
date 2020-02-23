/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

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
    }

    const char* loglevel = verbose ? "trace" : "warning";
    Log::initialize("tst", loglevel, true, false, {});

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
        _name = test->getName();
        writeTestLog("\n=============== START " + _name + '\n');
    }

    void addFailure(const CppUnit::TestFailure& failure)
    {
        if (failure.isError())
            writeTestLog("\n>>>>>>>> FAILED " + _name + " <<<<<<<<<\n");
        else
            writeTestLog("\n>>>>>>>> PASS " + _name + " <<<<<<<<<\n");
    }

    void done() { writeTestLog("\n=============== END " + _name + " ===============\n"); }

private:
    std::string _name;
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
        size_t lastSlash = aLib.rfind('/');
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

std::vector<int> getKitPids()
{
    return LOOLWSD::getKitPids();
}

/// Get the PID of the forkit
std::vector<int> getForKitPids()
{
    std::vector<int> pids;
    if (LOOLWSD::ForKitProcId >= 0)
        pids.push_back(LOOLWSD::ForKitProcId);
    return pids;
}

/// How many live loolkit processes do we have ?
int getLoolKitProcessCount()
{
    return getKitPids().size();
}
#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
