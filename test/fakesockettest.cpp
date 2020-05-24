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

#include <test/lokassert.hpp>

#include <cppunit/BriefTestProgressListener.h>
#include <cppunit/CompilerOutputter.h>
#include <cppunit/TestResult.h>
#include <cppunit/TestResultCollector.h>
#include <cppunit/TestRunner.h>
#include <cppunit/TextTestProgressListener.h>
#include <cppunit/extensions/HelperMacros.h>
#include <cppunit/extensions/TestFactoryRegistry.h>

#undef MOBILEAPP
#define MOBILEAPP 1 // A bit ugly, but currently FakeSocket.hpp is surrounded by a MOBILEAPP ifdef,
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
                                         std::cerr << line << '\n';
                                     });
    }

    void tearDown()
    {
    }
};

void FakeSocketTest::testBasic()
{
    int rc;
    char buf[100];

    // First check invalid fds.

    rc = fakeSocketListen(10);
    LOK_ASSERT(rc == -1);
    LOK_ASSERT(errno == EBADF);

    rc = fakeSocketWrite(20, "hah", 3);
    LOK_ASSERT(rc == -1);
    LOK_ASSERT(errno == EBADF);

    rc = fakeSocketRead(30, buf, 3);
    LOK_ASSERT(rc == -1);
    LOK_ASSERT(errno == EBADF);

    // Create three sockets: s0, s1 and s2.
    int s0 = fakeSocketSocket();
    LOK_ASSERT(s0 >= 0);
    int s1 = fakeSocketSocket();
    LOK_ASSERT(s1 >= 0);
    int s2 = fakeSocketSocket();
    LOK_ASSERT(s2 >= 0);

    LOK_ASSERT(s0 != s1);
    LOK_ASSERT(s1 != s2);

    // Close s1 and create it anew
    fakeSocketClose(s1);

    s1 = fakeSocketSocket();
    LOK_ASSERT(s1 >= 0);

    // Listen on s0
    rc = fakeSocketListen(s0);
    LOK_ASSERT(rc != -1);

    // Start a thread that accepts two connections to s0, producing sockets s3 and s4.
    int s3 = -1, s4 = -1;
    std::thread t0([&] {
            // Cannot use LOK_ASSERT here as that throws and this thread has no Cppunit
            // exception handler. We check below after joining this thread.
            s3 = fakeSocketAccept4(s0);
            s4 = fakeSocketAccept4(s0);
        });

    // Connect s1 and s2 to s0 (that is, to the sockets produced by accepting connections to
    // s0).
    rc = fakeSocketConnect(s1, s0);
    LOK_ASSERT(rc != -1);

    rc = fakeSocketConnect(s2, s0);
    LOK_ASSERT(rc != -1);

    // Verify that we got the accepts.
    t0.join();
    LOK_ASSERT(s3 != -1);
    LOK_ASSERT(s4 != -1);

    // s1 should now be connected to s3, and s2 to s4.
    LOK_ASSERT(fakeSocketPeer(s1) == s3);
    LOK_ASSERT(fakeSocketPeer(s3) == s1);
    LOK_ASSERT(fakeSocketPeer(s2) == s4);
    LOK_ASSERT(fakeSocketPeer(s4) == s2);

    // Some writing and reading
    rc = fakeSocketWrite(s1, "hello", 5);
    LOK_ASSERT(rc != -1);

    rc = fakeSocketWrite(s1, "greetings", 9);
    LOK_ASSERT(rc != -1);

    rc = fakeSocketWrite(s2, "moin", 4);
    LOK_ASSERT(rc != -1);

    rc = fakeSocketAvailableDataLength(s3);
    LOK_ASSERT(rc == 5);

    rc = fakeSocketRead(s3, buf, 100);
    LOK_ASSERT(rc == 5);

    rc = fakeSocketAvailableDataLength(s3);
    LOK_ASSERT(rc == 9);

    rc = fakeSocketRead(s4, buf, 100);
    LOK_ASSERT(rc == 4);

    rc = fakeSocketWrite(s3, "goodbye", 7);
    LOK_ASSERT(rc > 0);

    rc = fakeSocketRead(s1, buf, 4);
    LOK_ASSERT(rc == -1);
    LOK_ASSERT(errno == EAGAIN); // Note: not really the right errno, but what else? See
                                     // FakeSocket.cpp.

    rc = fakeSocketRead(s1, buf, 100);
    LOK_ASSERT(rc > 0);

    // Close s3. Reading from s1 should then return an EOF indication (0).
    fakeSocketClose(s3);

    rc = fakeSocketAvailableDataLength(s1);
    LOK_ASSERT(rc == 0);

    rc = fakeSocketRead(s1, buf, 100);
    LOK_ASSERT(rc == 0);

    rc = fakeSocketAvailableDataLength(s1);
    LOK_ASSERT(rc == 0);

    rc = fakeSocketRead(s1, buf, 100);
    LOK_ASSERT(rc == 0);

    // Test the "pipe" functionality, that creates an already connected socket pair.
    int pipe[2];
    rc = fakeSocketPipe2(pipe);
    LOK_ASSERT(rc == 0);

    rc = fakeSocketWrite(pipe[0], "x", 1);
    LOK_ASSERT(rc == 1);

    rc = fakeSocketAvailableDataLength(pipe[1]);
    LOK_ASSERT(rc == 1);

    rc = fakeSocketRead(pipe[1], buf, 1);
    LOK_ASSERT(rc == 1);

    LOK_ASSERT(buf[0] == 'x');

    rc = fakeSocketWrite(pipe[1], "y", 1);
    LOK_ASSERT(rc == 1);

    rc = fakeSocketRead(pipe[0], buf, 1);
    LOK_ASSERT(rc == 1);
    LOK_ASSERT(buf[0] == 'y');

    rc = fakeSocketWrite(pipe[0], "z", 1);
    LOK_ASSERT(rc == 1);

    rc = fakeSocketShutdown(pipe[0]);
    LOK_ASSERT(rc == 0);

    rc = fakeSocketRead(pipe[1], buf, 1);
    LOK_ASSERT(rc == 1);
    LOK_ASSERT(buf[0] == 'z');

    rc = fakeSocketWrite(pipe[0], "a", 1);
    LOK_ASSERT(rc == -1);
    LOK_ASSERT(errno == EPIPE);

    rc = fakeSocketRead(pipe[0], buf, 1);
    LOK_ASSERT(rc == 0);

    rc = fakeSocketRead(pipe[0], buf, 1);
    LOK_ASSERT(rc == 0);

    rc = fakeSocketClose(pipe[0]);
    LOK_ASSERT(rc == 0);

    rc = fakeSocketClose(pipe[0]);
    LOK_ASSERT(rc == -1);
    LOK_ASSERT(errno == EBADF);

    rc = fakeSocketClose(pipe[1]);
    LOK_ASSERT(rc == 0);

    rc = fakeSocketClose(pipe[1]);
    LOK_ASSERT(rc == -1);
    LOK_ASSERT(errno == EBADF);

    // Create a pipe again.

    rc = fakeSocketPipe2(pipe);
    LOK_ASSERT(rc == 0);

    rc = fakeSocketAvailableDataLength(pipe[0]);
    LOK_ASSERT(rc == -1);
    LOK_ASSERT(errno == EAGAIN);

    rc = fakeSocketAvailableDataLength(pipe[1]);
    LOK_ASSERT(rc == -1);
    LOK_ASSERT(errno == EAGAIN);

    // Test poll functionality.

    struct pollfd pollfds[4];

    pollfds[0].fd = s0;
    pollfds[0].events = POLLIN | POLLOUT;
    pollfds[1].fd = s1;
    pollfds[1].events = POLLIN | POLLOUT;
    pollfds[2].fd = s2;
    pollfds[2].events = POLLIN | POLLOUT;
    pollfds[3].fd = 40;
    pollfds[3].events = POLLIN | POLLOUT;

    rc = fakeSocketPoll(pollfds, 4, -1);
    // Hmm, does a real poll() set POLLIN for a listening socket? Probably only if there is a
    // connection in progress, and that is not the case here for s0.
    LOK_ASSERT(rc == 3);
    LOK_ASSERT(pollfds[0].revents == 0);
    LOK_ASSERT(pollfds[1].revents == POLLIN);
    LOK_ASSERT(pollfds[2].revents == POLLOUT);
    LOK_ASSERT(pollfds[3].revents == POLLNVAL);
}

CPPUNIT_TEST_SUITE_REGISTRATION(FakeSocketTest);

int main(int, char**)
{
    const char* envar = std::getenv("CPPUNIT_TEST_NAME");
    std::string testName;
    if (envar)
    {
        testName = std::string(envar);
    }
    if (!testName.empty() && testName != "FakeSocketTest")
    {
        return 0;
    }

    CPPUNIT_NS::TestResult controller;
    CPPUNIT_NS::TestResultCollector result;
    controller.addListener(&result);
    CPPUNIT_NS::BriefTestProgressListener progress;
    controller.addListener(&progress);
    CPPUNIT_NS::TextTestProgressListener listener;
    controller.addListener(&listener);

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
