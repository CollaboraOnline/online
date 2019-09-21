/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <test.hpp>

#include <config.h>

#include <cstdlib>
#include <iostream>

#include <cppunit/BriefTestProgressListener.h>
#include <cppunit/CompilerOutputter.h>
#include <cppunit/TestResult.h>
#include <cppunit/TestResultCollector.h>
#include <cppunit/TestRunner.h>
#include <cppunit/TextTestProgressListener.h>
#include <cppunit/extensions/TestFactoryRegistry.h>

#include <Poco/RegularExpression.h>
#include <Poco/DirectoryIterator.h>
#include <Poco/FileStream.h>
#include <Poco/StreamCopier.h>
#include <Poco/StringTokenizer.h>

#include <Log.hpp>

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

int main(int argc, char** argv)
{
    const bool verbose = (argc > 1 && std::string("--verbose") == argv[1]);
    const char* loglevel = verbose ? "trace" : "error";

    Log::initialize("tst", loglevel, true, false, {});

    return runClientTests(true, verbose)? 0: 1;
}

static bool IsStandalone = false;

bool isStandalone()
{
    return IsStandalone;
}

// returns true on success
bool runClientTests(bool standalone, bool verbose)
{
    IsStandalone = standalone;

    CPPUNIT_NS::TestResult controller;
    CPPUNIT_NS::TestResultCollector result;
    controller.addListener(&result);
    CPPUNIT_NS::BriefTestProgressListener progress;
    controller.addListener(&progress);
    std::unique_ptr<CPPUNIT_NS::TextTestProgressListener> pListener(new CPPUNIT_NS::TextTestProgressListener());
    controller.addListener(pListener.get());

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
        // redirect std::cerr temporarily
        std::stringstream errorBuffer;
        std::streambuf* oldCerr = std::cerr.rdbuf(errorBuffer.rdbuf());

        runner.run(controller);

        std::cerr.rdbuf(oldCerr);

        // output the errors we got during the testing
        if (!result.wasSuccessful())
            std::cerr << errorBuffer.str() << std::endl;
    }
    else
    {
        runner.run(controller);
    }

    CPPUNIT_NS::CompilerOutputter outputter(&result, std::cerr);
    outputter.setNoWrap();
    outputter.write();

    return result.wasSuccessful();
}

// Versions assuming a single user, on a single machine
#ifndef UNIT_CLIENT_TESTS

std::vector<int> getProcPids(const char* exec_filename, bool ignoreZombies = false)
{
    std::vector<int> pids;

    // Crash all lokit processes.
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
                Poco::StringTokenizer tokens(statString, " ");
                if (tokens.count() > 3 && Util::startsWith(tokens[1], exec_filename))
                {
                    if (ignoreZombies)
                    {
                        switch (tokens[2].c_str()[0])
                        {
                            // Dead marker for old and new kernels.
                        case 'x':
                        case 'X':
                            // Don't ignore zombies.
                            break;
                        default:
                            pids.push_back(pid);
                            break;
                        }
                    }
                    else
                        pids.push_back(pid);
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

/// How many live lookit processes do we have ?
int getLoolKitProcessCount()
{
    return getKitPids().size();
}

#endif // UNIT_CLIENT_TESTS

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
