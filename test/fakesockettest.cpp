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
#include "Globals.hpp"

bool EnableExperimental = false;

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
    constexpr std::string_view testname = __func__;

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

    // Start threads that accept connections to s0
    const int nthreads = 20;
    int acceptedSockets[nthreads];
    std::thread threads[nthreads];

    for (int i = 0; i < nthreads; i++)
    {
        threads[i] = std::thread([i, s0, &acceptedSockets] {
            // Cannot use LOK_ASSERT here as that throws and this thread has no Cppunit
            // exception handler. We check below after joining this thread.
            acceptedSockets[i] = fakeSocketAccept4(s0);
        });
    }

    int clientSockets[nthreads];
    for (int i = 0; i < nthreads; i++)
    {
        clientSockets[i] = fakeSocketSocket();
        fakeSocketConnect(clientSockets[i], s0);
    }

    // Verify that we got all connected up
    for (int i = 0; i < nthreads; i++)
        threads[i].join();

    for (int i = 0; i < nthreads; i++)
    {
        bool haveMatch = false;
        LOK_ASSERT(clientSockets[i] != -1);
        LOK_ASSERT(acceptedSockets[i] != -1);
        LOK_ASSERT(fakeSocketPeer(acceptedSockets[i]) != -1);
        LOK_ASSERT(fakeSocketPeer(clientSockets[i]) != -1);
        LOK_ASSERT(fakeSocketPeer(acceptedSockets[i]) != acceptedSockets[i]);
        LOK_ASSERT(fakeSocketPeer(clientSockets[i]) != clientSockets[i]);
        for (int j = 0; j < nthreads; j++)
        {
            LOK_ASSERT(clientSockets[i] != acceptedSockets[j]);
            if (fakeSocketPeer(clientSockets[i]) == acceptedSockets[j])
            {
                LOK_ASSERT(fakeSocketPeer(acceptedSockets[j]) == clientSockets[i]);
                LOK_ASSERT(!haveMatch);
                haveMatch = true;
            }
        }
        LOK_ASSERT(haveMatch);
    }

    // Some writing and reading
    rc = fakeSocketWrite(clientSockets[0], "hello", 5);
    LOK_ASSERT(rc != -1);

    rc = fakeSocketWrite(clientSockets[0], "greetings", 9);
    LOK_ASSERT(rc != -1);

    rc = fakeSocketWrite(clientSockets[7], "moin", 4);
    LOK_ASSERT(rc != -1);

    // fakeSocketAvailableDataLength() returns the length of the *first* buffer only, if any
    rc = fakeSocketAvailableDataLength(fakeSocketPeer(clientSockets[0]));
    LOK_ASSERT(rc == 5);

    rc = fakeSocketRead(fakeSocketPeer(clientSockets[0]), buf, 10);
    LOK_ASSERT(rc == 5);
    LOK_ASSERT(memcmp(buf, "hello", 5) == 0);

    rc = fakeSocketAvailableDataLength(fakeSocketPeer(clientSockets[0]));
    LOK_ASSERT(rc == 9);

    rc = fakeSocketRead(fakeSocketPeer(clientSockets[0]), buf, 100);
    LOK_ASSERT(rc == 9);
    LOK_ASSERT(memcmp(buf, "greetings", 9) == 0);

    rc = fakeSocketRead(fakeSocketPeer(clientSockets[7]), buf, 100);
    LOK_ASSERT(rc == 4);
    LOK_ASSERT(memcmp(buf, "moin", 4) == 0);

    rc = fakeSocketWrite(fakeSocketPeer(clientSockets[9]), "goodbye", 7);
    LOK_ASSERT(rc > 0);

    rc = fakeSocketRead(clientSockets[9], buf, 4);
    LOK_ASSERT(rc == -1);
    // Note: not really the right errno, but what else? See FakeSocket.cpp.
    LOK_ASSERT(errno == EAGAIN);

    rc = fakeSocketRead(clientSockets[9], buf, 100);
    LOK_ASSERT(rc == 7);

    // Close a socket. Reading from its peer should then return an EOF indication (0).
    fakeSocketClose(fakeSocketPeer(clientSockets[5]));

    rc = fakeSocketAvailableDataLength(clientSockets[5]);
    LOK_ASSERT(rc == 0);

    rc = fakeSocketRead(clientSockets[5], buf, 100);
    LOK_ASSERT(rc == 0);

    rc = fakeSocketAvailableDataLength(clientSockets[5]);
    LOK_ASSERT(rc == 0);

    rc = fakeSocketRead(clientSockets[5], buf, 100);
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
    pollfds[1].fd = clientSockets[5];
    pollfds[1].events = POLLIN | POLLOUT;
    pollfds[2].fd = clientSockets[7];
    pollfds[2].events = POLLIN | POLLOUT;
    pollfds[3].fd = 1234;
    pollfds[3].events = POLLIN | POLLOUT;

    rc = fakeSocketPoll(pollfds, 4, -1);
    LOK_ASSERT(rc == 3);
    // s0 is a listening socket, nothing.
    // Hmm, does a real poll() set POLLIN for a listening socket? Probably only if there is a
    // connection in progress, and that is not the case here for s0.
    LOK_ASSERT(pollfds[0].revents == 0);
    // clientSockets[5] has a closed peer, apparently POLLIN is what should be set then?
    LOK_ASSERT(pollfds[1].revents == POLLIN);
    // clientSockets[7] has nothing to be read, but can be written to
    LOK_ASSERT(pollfds[2].revents == POLLOUT);
    // 1234 is invalid
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

    // Initialize logging that LOK_ASSERT() uses.
    std::string logLevel("fatal");
    bool withColor = false;
    bool logToFile = false;
    std::map<std::string, std::string> logProperties;
    Log::initialize("wsd", logLevel, withColor, logToFile, logProperties, false, {});

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
