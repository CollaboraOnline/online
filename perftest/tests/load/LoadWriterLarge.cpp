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

class LoadWriterLarge : public CombinedPerfTest
{
public:
    LoadWriterLarge(const std::string resultsDir, const std::string &server) :
        CombinedPerfTest(__func__, resultsDir, server)
    {
    }

    void runTest() {
        startMeasurement();
        connectAndLoad("perftest/data/large-hello-world.fodt");
        sendMessage("uno .uno:ToolbarMode?Mode:string=notebookbar_online.ui");
        sendMessage("commandvalues command=.uno:StyleApply");
        sendMessage("commandvalues command=.uno:CharFontName");
        sendMessage("commandvalues command=.uno:AcceptTrackedChanges");
        sendMessage("commandvalues command=.uno:LanguageStatus");
        sendMessage("commandvalues command=.uno:ViewAnnotations");
        sendMessage("commandvalues command=.uno:StyleApply");
        sendMessage("commandvalues command=.uno:CharFontName");
        sendMessage("uno .uno:SidebarShow");
        sendMessage("commandvalues command=.uno:ViewAnnotations");
        waitForMessage("statechanged: .uno:LeaveGroup=disabled");
        waitForIdle();
        sleep(1000);
        stopMeasurement();
        disconnect();
    }
};

CREATE_PERFTEST(LoadWriterLarge)
