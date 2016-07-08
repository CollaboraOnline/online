/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <iostream>
#include <cppunit/TestRunner.h>
#include <cppunit/TestResult.h>
#include <cppunit/TestResultCollector.h>
#include <cppunit/TextTestProgressListener.h>
#include <cppunit/BriefTestProgressListener.h>
#include <cppunit/extensions/TestFactoryRegistry.h>
#include <cppunit/CompilerOutputter.h>

class HTTPGetTest;

int main(int /*argc*/, char** /*argv*/)
{
    CPPUNIT_NS::TestResult controller;
    CPPUNIT_NS::TestResultCollector result;
    controller.addListener(&result);
    CPPUNIT_NS::BriefTestProgressListener progress;
    controller.addListener(&progress);
    controller.addListener(new CPPUNIT_NS::TextTestProgressListener());

    CPPUNIT_NS::TestRunner runner;
    const char* testName = getenv("CPPUNIT_TEST_NAME");
    if (testName)
    {
        // Single test.
        CPPUNIT_NS::Test* testRegistry = CPPUNIT_NS::TestFactoryRegistry::getRegistry().makeTest();
        for (int i = 0; i < testRegistry->getChildTestCount(); ++i)
        {
            CPPUNIT_NS::Test* testSuite = testRegistry->getChildTestAt(i);
            for (int j = 0; j < testSuite->getChildTestCount(); ++j)
            {
                CPPUNIT_NS::Test* testCase = testSuite->getChildTestAt(j);
                if (testCase->getName() == testName)
                    runner.addTest(testCase);
            }
        }
    }
    else
        // All tests.
        runner.addTest(CPPUNIT_NS::TestFactoryRegistry::getRegistry().makeTest());

    runner.run(controller);

    CPPUNIT_NS::CompilerOutputter outputter(&result, std::cerr);
    outputter.write();

    return result.wasSuccessful() ? 0 : 1;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
