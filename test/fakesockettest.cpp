/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <algorithm>
#include <condition_variable>
#include <mutex>
#include <thread>
#include <regex>
#include <vector>

#include <cppunit/BriefTestProgressListener.h>
#include <cppunit/CompilerOutputter.h>
#include <cppunit/TestResult.h>
#include <cppunit/TestResultCollector.h>
#include <cppunit/TestRunner.h>
#include <cppunit/TextTestProgressListener.h>
#include <cppunit/extensions/HelperMacros.h>
#include <cppunit/extensions/TestFactoryRegistry.h>

#define MOBILEAPP // A bit ugly, but currently FakeSocket.hpp is surrounded by a MOBILEAPP ifdef,
                  // and probably it is not a good idea to remove that?
#include "FakeSocket.hpp"

class FakeSocketTest : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(FakeSocketTest);

    CPPUNIT_TEST(testBasic);

    CPPUNIT_TEST_SUITE_END();

    void testBasic();

public:
    FakeSocketTest()
    {
    }

    void setUp()
    {
        fakeSocketSetLoggingCallback([](const std::string& line)
                                     {
                                         std::cerr << line << "\n";
                                     });
    }

    void tearDown()
    {
    }
};

void FakeSocketTest::testBasic()
{
    try
    {
        // Create three sockets: s0, s1 and s2.
        int s0 = fakeSocketSocket();
        CPPUNIT_ASSERT(s0 >= 0);
        int s1 = fakeSocketSocket();
        CPPUNIT_ASSERT(s1 >= 0);
        int s2 = fakeSocketSocket();
        CPPUNIT_ASSERT(s2 >= 0);

        CPPUNIT_ASSERT(s0 != s1);
        CPPUNIT_ASSERT(s1 != s2);

        // Close s1 and create it anew
        fakeSocketClose(s1);

        s1 = fakeSocketSocket();
        CPPUNIT_ASSERT(s1 >= 0);

        // Listen on s0
        int rc = fakeSocketListen(s0);
        CPPUNIT_ASSERT(rc != -1);

        // Start a thread that accepts two connections to s0, producing sockets s3 and s4.
        int s3 = -1, s4 = -1;
        std::thread t0([&] {
                s3 = fakeSocketAccept4(s0, 0);
                CPPUNIT_ASSERT(s3 >= 0);

                s4 = fakeSocketAccept4(s0, 0);
                CPPUNIT_ASSERT(s4 >= 0);
            });

        // Connect s1 and s2 to s0 (that is, to the sockets produced by accepting connections to
        // s0).
        rc = fakeSocketConnect(s1, s0);
        CPPUNIT_ASSERT(rc != -1);

        rc = fakeSocketConnect(s2, s0);
        CPPUNIT_ASSERT(rc != -1);

        // Verify that we got the accepts.
        t0.join();
        CPPUNIT_ASSERT(s3 != -1);
        CPPUNIT_ASSERT(s4 != -1);

        // s1 should now be connected to s3, and s2 to s4.
        CPPUNIT_ASSERT(fakeSocketPeer(s1) == s3);
        CPPUNIT_ASSERT(fakeSocketPeer(s3) == s1);
        CPPUNIT_ASSERT(fakeSocketPeer(s2) == s4);
        CPPUNIT_ASSERT(fakeSocketPeer(s4) == s2);

        // Some writing and reading
        rc = fakeSocketWrite(s1, "hello", 5);
        CPPUNIT_ASSERT(rc != -1);

        rc = fakeSocketWrite(s1, "there", 5);
        CPPUNIT_ASSERT(rc != -1);

        rc = fakeSocketWrite(s2, "moin", 4);
        CPPUNIT_ASSERT(rc != -1);

        char buf[100];

        rc = fakeSocketRead(s3, buf, 100);
        CPPUNIT_ASSERT(rc != -1);
        CPPUNIT_ASSERT(rc > 0);

        rc = fakeSocketRead(s4, buf, 100);
        CPPUNIT_ASSERT(rc != -1);
        CPPUNIT_ASSERT(rc > 0);

        rc = fakeSocketWrite(s3, "goodbye", 7);
        CPPUNIT_ASSERT(rc != -1);
        CPPUNIT_ASSERT(rc > 0);

        rc = fakeSocketRead(s1, buf, 4);
        CPPUNIT_ASSERT(rc == -1);

        rc = fakeSocketRead(s1, buf, 100);
        CPPUNIT_ASSERT(rc != -1);
        CPPUNIT_ASSERT(rc > 0);

        // Close s3. Reading from s1 should then return an EOF indication (0). 
        fakeSocketClose(s3);
        rc = fakeSocketRead(s1, buf, 100);
        CPPUNIT_ASSERT(rc == 0);

        rc = fakeSocketRead(s1, buf, 100);
        CPPUNIT_ASSERT(rc == 0);

        // Test the "pipe" functionality, that creates an already connected socket pair.
        int pipe[2];
        rc = fakeSocketPipe2(pipe);
        CPPUNIT_ASSERT(rc == 0);

        rc = fakeSocketWrite(pipe[0], "x", 1);
        CPPUNIT_ASSERT(rc == 1);

        rc = fakeSocketRead(pipe[1], buf, 1);
        CPPUNIT_ASSERT(rc == 1);

        CPPUNIT_ASSERT(buf[0] == 'x');

        rc = fakeSocketWrite(pipe[1], "y", 1);
        CPPUNIT_ASSERT(rc == 1);

        rc = fakeSocketRead(pipe[0], buf, 1);
        CPPUNIT_ASSERT(rc == 1);
        CPPUNIT_ASSERT(buf[0] == 'y');

        rc = fakeSocketWrite(pipe[0], "z", 1);
        CPPUNIT_ASSERT(rc == 1);

        rc = fakeSocketShutdown(pipe[0]);
        CPPUNIT_ASSERT(rc == 0);

        rc = fakeSocketRead(pipe[1], buf, 1);
        CPPUNIT_ASSERT(rc == 1);
        CPPUNIT_ASSERT(buf[0] == 'z');

        rc = fakeSocketWrite(pipe[0], "a", 1);
        CPPUNIT_ASSERT(rc == -1);
        CPPUNIT_ASSERT(errno == EPIPE);

        rc = fakeSocketRead(pipe[0], buf, 1);
        CPPUNIT_ASSERT(rc == 0);

        rc = fakeSocketRead(pipe[0], buf, 1);
        CPPUNIT_ASSERT(rc == 0);
    }
    catch (const std::exception& exception)
    {
        CPPUNIT_FAIL(exception.what());
    }
}


CPPUNIT_TEST_SUITE_REGISTRATION(FakeSocketTest);

int main(int, char**)
{
    CPPUNIT_NS::TestResult controller;
    CPPUNIT_NS::TestResultCollector result;
    controller.addListener(&result);
    CPPUNIT_NS::BriefTestProgressListener progress;
    controller.addListener(&progress);
    controller.addListener(new CPPUNIT_NS::TextTestProgressListener());

    CPPUNIT_NS::Test* testRegistry = CPPUNIT_NS::TestFactoryRegistry::getRegistry().makeTest();

    CPPUNIT_NS::TestRunner runner;
    runner.addTest(testRegistry);
    runner.run(controller);

    CPPUNIT_NS::CompilerOutputter outputter(&result, std::cerr);
    outputter.setNoWrap();
    outputter.write();

    fakeSocketDumpState();

    return result.wasSuccessful() ? 0 : 1;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
