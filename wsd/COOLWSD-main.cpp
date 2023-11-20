/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
#include "config.h"
#include "StringVector.hpp"
#include "Util.hpp"
#include "TraceEvent.hpp"
#include "COOLWSD.hpp"

#if !LIBFUZZER
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

#endif //!LIBFUZZER

extern "C" int createForkit(const std::string forKitPath, const StringVector args)
{
    return Util::spawnProcess(forKitPath, args);
};

extern "C" void createLibreOfficeKit(const std::string& childRoot,
                        const std::string& sysTemplate,
                        const std::string& loTemplate,
                        int limit)
{
    LOG_TRC("forkLibreOfficeKit " << limit << childRoot << sysTemplate<< loTemplate);
}
