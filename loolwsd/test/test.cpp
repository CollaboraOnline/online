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

/// Dump all the tests registered.
void dumpTests(CPPUNIT_NS::Test* test)
{
    if (test != nullptr)
    {
        std::cout << test->getName() << std::endl;
        if (test->getChildTestCount())
        {
            for (auto i = 0; i < test->getChildTestCount(); ++i)
            {
                dumpTests(test->getChildTestAt(i));
            }
        }
    }
}

int main(int /*argc*/, char** /*argv*/)
{
    CPPUNIT_NS::TestResult controller;
    CPPUNIT_NS::TestResultCollector result;
    controller.addListener(&result);
    CPPUNIT_NS::BriefTestProgressListener progress;
    controller.addListener(&progress);
    controller.addListener(new CPPUNIT_NS::TextTestProgressListener());

    auto all = CPPUNIT_NS::TestFactoryRegistry::getRegistry().makeTest();
    //dumpTests(all);
    //CppUnit::TestFactoryRegistry &registry = CppUnit::TestFactoryRegistry::getRegistry("httpgettest");
    //CppUnit::TestFactoryRegistry &registry = CppUnit::TestFactoryRegistry::getRegistry("httpposttest");
    //CppUnit::TestFactoryRegistry &registry = CppUnit::TestFactoryRegistry::getRegistry("httpwstest");
    //CppUnit::TestFactoryRegistry &registry = CppUnit::TestFactoryRegistry::getRegistry("httpcrashtest");

    CPPUNIT_NS::TestRunner runner;
    runner.addTest(all);
    //runner.addTest(registry.makeTest());
    runner.run(controller);

    CPPUNIT_NS::CompilerOutputter outputter(&result, std::cerr);
    outputter.write();

    return result.wasSuccessful() ? 0 : 1;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
