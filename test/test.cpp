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

static std::mutex errorMutex;
static bool IsVerbose = false;
static std::stringstream errors;

void tstLog(const std::ostringstream &stream)
{
    if (IsVerbose)
        std::cerr << stream.str() << std::endl;
    else
    {
        std::lock_guard<std::mutex> lock(errorMutex);
        errors << stream.str();
    }
}

// returns true on success
bool runClientTests(bool standalone, bool verbose)
{
    IsVerbose = verbose;
    IsStandalone = standalone;

    CPPUNIT_NS::TestResult controller;
    CPPUNIT_NS::TestResultCollector result;
    controller.addListener(&result);
    CPPUNIT_NS::BriefTestProgressListener progress;
    controller.addListener(&progress);
    CPPUNIT_NS::TextTestProgressListener listener;
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

        // output the errors we got during the testing
        if (!result.wasSuccessful())
            std::cerr << errors.str() << std::endl;
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
#ifndef UNIT_CLIENT_TESTS
        const char *cmd = "./run_unit.sh --verbose";
        if (getenv("UNITTEST"))
            cmd = "./unittest";
        std::cerr << "  (cd test; CPPUNIT_TEST_NAME=\"" << (*failures.begin())->failedTestName() << "\" " << cmd << ")\n\n";
        if (getenv("UNITTEST"))
        {
            std::cerr << "To debug:\n\n";
            std::cerr << "  (cd test; CPPUNIT_TEST_NAME=\"" << (*failures.begin())->failedTestName() << "\" gdb --args " << cmd << ")\n\n";
        }
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

// Versions assuming a single user, on a single machine
#ifndef UNIT_CLIENT_TESTS

std::vector<int> getProcPids(const char* exec_filename)
{
    std::vector<int> pids;

    // Ensure we're in the same group.
    const int grp = getpgrp();

    // Get all lokit processes.
    for (auto it = Poco::DirectoryIterator(std::string("/proc")); it != Poco::DirectoryIterator(); ++it)
    {
        try
        {
            const Poco::Path& procEntry = it.path();
            const std::string& fileName = procEntry.getFileName();
            int pid;
            std::size_t endPos = 0;
            try
            {
                pid = std::stoi(fileName, &endPos);
            }
            catch (const std::invalid_argument&)
            {
                pid = 0;
            }

            if (pid > 1 && endPos == fileName.length())
            {
                Poco::FileInputStream stat(procEntry.toString() + "/stat");
                std::string statString;
                Poco::StreamCopier::copyToString(stat, statString);
                std::vector<std::string> tokens(LOOLProtocol::tokenize(statString, ' '));
                if (tokens.size() > 6 && tokens[1].find(exec_filename) == 0)
                {
                    // We could have several make checks running at once.
                    int kidGrp = std::atoi(tokens[4].c_str());
                    // Don't require matching grp for --debugrun invocations.
                    if (kidGrp != grp && !IsDebugrun)
                        continue;

                    switch (tokens[2].c_str()[0])
                    {
                    // Dead & zombie markers for old and new kernels.
                    case 'x':
                    case 'X':
                    case 'Z':
                        break;
                    default:
                        pids.push_back(pid);
                        break;
                    }
                }
            }
        }
        catch (const Poco::Exception&)
        {
        }
    }
    return pids;
}

std::vector<int> getSpareKitPids()
{
    return getProcPids("(kit_spare_");
}

std::vector<int> getDocKitPids()
{
    return getProcPids("(kitbroker_");
}

std::vector<int> getKitPids()
{
    std::vector<int> pids = getSpareKitPids();
    for (int pid : getDocKitPids())
        pids.push_back(pid);

    return pids;
}

int getLoolKitProcessCount()
{
    return getKitPids().size();
}

std::vector<int> getForKitPids()
{
    std::vector<int> pids, pids2;

    pids = getProcPids("(loolforkit)");
    pids2 = getProcPids("(forkit)");
    pids.insert(pids.end(), pids2.begin(), pids2.end());

    return pids;
}

#else // UNIT_CLIENT_TESTS

// Here we are compiled inside UnitClient.cpp and we have
// full access to the WSD process internals.

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

int getClientPort()
{
    return LOOLWSD::getClientPortNumber();
}

#endif // UNIT_CLIENT_TESTS

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
