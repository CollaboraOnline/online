/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
#include "StringVector.hpp"
#include "Util.hpp"
#include "TraceEvent.hpp"
#include "COOLWSD.hpp"

#if !MOBILEAPP
int createForkit(const std::string& forKitPath, const StringVector& args)
{
    // create forkit in a process
    return Util::spawnProcess(forKitPath, args);
};
#endif

// FIXME: Somewhat idiotically, the parameter to emitOneRecordingIfEnabled() should end with a
// newline, while the paramter to emitOneRecording() should not.

void TraceEvent::emitOneRecordingIfEnabled(const std::string& recording)
{
    if (COOLWSD::TraceEventFile == NULL)
        return;

    COOLWSD::writeTraceEventRecording(recording);
}

void TraceEvent::emitOneRecording(const std::string& recording)
{
    if (COOLWSD::TraceEventFile == NULL)
        return;

    if (!TraceEvent::isRecordingOn())
        return;

    COOLWSD::writeTraceEventRecording(recording + "\n");
}
