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

class LoadImpressSmall : public CyclePerfTest
{
public:
    LoadImpressSmall(const std::string &server) :
        CyclePerfTest(__func__, server)
    {
    }

    void runTest() {
        startMeasurement();
        connectAndLoad("perftest/data/hello-world.odp");
        waitForMessage("statechanged: .uno:LeaveGroup=disabled");
        waitForIdle();
        sleep(1000);
        stopMeasurement();
        disconnect();
    }
};

std::shared_ptr<PerfTest> create_perftest(std::string &server)
{
    return std::make_shared<LoadImpressSmall>(server);
}
