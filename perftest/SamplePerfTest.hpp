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

#include <PerfTest.hpp>

class SamplePerfTest : public CyclePerfTest
{
public:
    SamplePerfTest(const std::string &server) :
        CyclePerfTest("sample5", server)
    {
    }

    void runTest() {
        testDarkMode();
    }

    void testLoad() {
        startMeasurement();
        connectAndLoad("test/data/hello-world.odt");
        waitForMessage("statechanged: .uno:LeaveGroup=disabled");
        waitForIdle();
        stopMeasurement();
        //disconnect();
    }

    void testDarkMode() {
        connectAndLoad("test/data/hello-world.odt");
        waitForMessage("statechanged: .uno:LeaveGroup=disabled");
        waitForIdle();

        // Send both because we're not sure what we theme we have now
        sendMessage("uno .uno:ChangeTheme {\"NewTheme\":{\"type\":\"string\",\"value\":\"Dark\"}}");
        sendMessage("uno .uno:ChangeTheme {\"NewTheme\":{\"type\":\"string\",\"value\":\"Light\"}}");
        waitForMessage("canonicalidchange");
        waitForIdle();

        sleep(3000);
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
        //disconnect();
    }
};
