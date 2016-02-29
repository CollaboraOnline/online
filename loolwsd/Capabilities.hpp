/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_CAPABILITIES
#define INCLUDED_CAPABILITIES

#include <sys/capability.h>

#include "Util.hpp"

static
void dropCapability(cap_value_t capability)
{
    cap_t caps;
    cap_value_t cap_list[] = { capability };

    caps = cap_get_proc();
    if (caps == nullptr)
    {
        Log::error("Error: cap_get_proc() failed.");
        exit(1);
    }

    char *capText = cap_to_text(caps, nullptr);
    Log::info("Capabilities first: " + std::string(capText));
    cap_free(capText);

    if (cap_set_flag(caps, CAP_EFFECTIVE, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1 ||
        cap_set_flag(caps, CAP_PERMITTED, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1)
    {
        Log::error("Error: cap_set_flag() failed.");
        exit(1);
    }

    if (cap_set_proc(caps) == -1)
    {
        Log::error("Error: cap_set_proc() failed.");
        exit(1);
    }

    capText = cap_to_text(caps, nullptr);
    Log::info("Capabilities now: " + std::string(capText));
    cap_free(capText);

    cap_free(caps);
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
