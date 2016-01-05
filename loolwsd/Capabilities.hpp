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

#ifdef __linux
#include <sys/capability.h>
#endif

#include "Util.hpp"

#if ENABLE_DEBUG
#include <sys/types.h>
#include <pwd.h>

static int uid = 0;
#endif

static
void dropCapability(
#ifdef __linux
                    cap_value_t capability
#endif
                    )
{
#ifdef __linux
    cap_t caps;
    cap_value_t cap_list[] = { capability };

    caps = cap_get_proc();
    if (caps == nullptr)
    {
        Log::error("Error: cap_get_proc() failed.");
        exit(1);
    }

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

    char *capText = cap_to_text(caps, nullptr);
    Log::info("Capabilities now: " + std::string(capText));
    cap_free(capText);

    cap_free(caps);
#endif
    // We assume that on non-Linux we don't need to be root to be able to hardlink to files we
    // don't own, so drop root.
    if (geteuid() == 0 && getuid() != 0)
    {
        // The program is setuid root. Not normal on Linux where we use setcap, but if this
        // needs to run on non-Linux Unixes, setuid root is what it will bneed to be to be able
        // to do chroot().
        if (setuid(getuid()) != 0)
        {
            Log::error("Error: setuid() failed.");
        }
    }
#if ENABLE_DEBUG
    if (geteuid() == 0 && getuid() == 0)
    {
#ifdef __linux
        // Argh, awful hack
        if (capability == CAP_FOWNER)
            return;
#endif

        // Running under sudo, probably because being debugged? Let's drop super-user rights.
        if (uid == 0)
        {
            struct passwd *nobody = getpwnam("nobody");
            if (nobody)
                uid = nobody->pw_uid;
            else
                uid = 65534;
        }
        if (setuid(uid) != 0)
        {
            Log::error("setuid() failed.");
        }
    }
#endif
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
