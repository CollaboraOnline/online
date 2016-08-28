/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <iostream>

#include <cppunit/BriefTestProgressListener.h>
#include <cppunit/CompilerOutputter.h>
#include <cppunit/TestResult.h>
#include <cppunit/TestResultCollector.h>
#include <cppunit/TestRunner.h>
#include <cppunit/TextTestProgressListener.h>
#include <cppunit/extensions/TestFactoryRegistry.h>

#include <Poco/RegularExpression.h>

class HTTPGetTest;

bool filterTests(CPPUNIT_NS::TestRunner& runner, CPPUNIT_NS::Test* testRegistry)
{
    const char* envar = getenv("CPPUNIT_TEST_NAME");
    if (envar)
    {
        std::string testName(envar);
        if (testName.empty())
        {
            return false;
        }

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

        std::cerr << "Failed to match [" << testName << "] to any names in the test-suite. Running all tests." << std::endl;
        return haveTests;
    }

    return false;
}

int main(int /*argc*/, char** /*argv*/)
{
    CPPUNIT_NS::TestResult controller;
    CPPUNIT_NS::TestResultCollector result;
    controller.addListener(&result);
    CPPUNIT_NS::BriefTestProgressListener progress;
    controller.addListener(&progress);
    controller.addListener(new CPPUNIT_NS::TextTestProgressListener());

    CPPUNIT_NS::Test* testRegistry = CPPUNIT_NS::TestFactoryRegistry::getRegistry().makeTest();

    CPPUNIT_NS::TestRunner runner;
    if (!filterTests(runner, testRegistry))
    {
        // All tests.
        runner.addTest(testRegistry);
    }

    runner.run(controller);

    CPPUNIT_NS::CompilerOutputter outputter(&result, std::cerr);
    outputter.write();

    return result.wasSuccessful() ? 0 : 1;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
