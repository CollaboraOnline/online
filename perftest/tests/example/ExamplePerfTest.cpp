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

#include <perftest/PerfTest.hpp>

class ExamplePerfTest : public CyclePerfTest
{
public:
    ExamplePerfTest(const std::string &server) :
        CyclePerfTest("ExamplePerfTest", server)
    {
    }

    void runTest() {
        /*
        startMeasurement();
        stopMeasurement();
        */
        sleep(1000);
        testViewChange();
    }

    void testLoad() {
        startMeasurement();
        connectAndLoad("test/data/hello-world.odt");
        waitForMessage("statechanged: .uno:LeaveGroup=disabled");
        waitForIdle();
        stopMeasurement();
        disconnect();
    }

    void testViewChange() {
        // Note: reuses same view, does not rerender every time
        connectAndLoad("test/data/hello-world.odt");
        waitForMessage("statechanged: .uno:LeaveGroup=disabled");
        waitForIdle();

        // Send both because we're not sure what we theme we have now
        sendMessage("uno .uno:ChangeTheme {\"NewTheme\":{\"type\":\"string\",\"value\":\"Dark\"}}");
        sendMessage("uno .uno:ChangeTheme {\"NewTheme\":{\"type\":\"string\",\"value\":\"Light\"}}");
        waitForMessage("canonicalidchange");
        waitForIdle();
        // Loop twice to make sure views are loaded
        for (int i=0; i<3; i++) {
            sendMessage("uno .uno:ChangeTheme {\"NewTheme\":{\"type\":\"string\",\"value\":\"Dark\"}}");
            waitForMessage("canonicalidchange");
            waitForIdle();
            sendMessage("uno .uno:ChangeTheme {\"NewTheme\":{\"type\":\"string\",\"value\":\"Light\"}}");
            waitForMessage("canonicalidchange");
            waitForIdle();
        }
        sleep(5000);

        startMeasurement();
        for (int i=0; i<100; i++) {
            sendMessage("uno .uno:ChangeTheme {\"NewTheme\":{\"type\":\"string\",\"value\":\"Dark\"}}");
            waitForMessage("canonicalidchange");
            waitForIdle();
            sendMessage("uno .uno:ChangeTheme {\"NewTheme\":{\"type\":\"string\",\"value\":\"Light\"}}");
            waitForMessage("canonicalidchange");
            waitForIdle();
        }
        stopMeasurement();

        disconnect();
    }

    void testZoom() {
        connectAndLoad("test/data/hello-world.odt");
        waitForMessage("statechanged: .uno:LeaveGroup=disabled");
        waitForIdle();
    }
};

std::shared_ptr<PerfTest> create_perftest(std::string &server)
{
    return std::make_shared<ExamplePerfTest>(server);
}
