/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * Place for simple security-related code.
 */

#pragma once

#ifdef __linux__
#include <sys/capability.h>
#endif
#include <sys/types.h>

#include <pwd.h>
#include <unistd.h>
#include <string.h>
#include <stdio.h>

#ifndef COOL_USER_ID
#  error "include config.h for user id";
#endif

#ifndef KIT_IN_PROCESS
inline int hasUID(const char *userId)
{
    struct passwd *pw = getpwuid(getuid());
    if (pw && pw->pw_name && !strcmp(pw->pw_name, userId))
        return 1;

    return 0;
}

inline int isInContainer()
{
#ifdef __linux__
    FILE *cgroup;
    char line[80];
    const char *docker = ":/docker/";
    cgroup = fopen("/proc/self/cgroup", "r");
    if(!cgroup)
    {
        fprintf(stderr, "Error: cannot open /proc/self/cgroup\n");
        return 0;
    }
    while (fgets(line, sizeof(line), cgroup) != NULL)
    {
        if (strstr(line, docker) != NULL)
        {
            fclose(cgroup);
            return 1;
        }
    }
    fclose(cgroup);
#endif
    return 0;
}

inline int hasCorrectUID(const char *appName)
{
#if ENABLE_DEBUG
    (void)appName;
    return 1; // insecure but easy to use.
#else
    if (hasUID(COOL_USER_ID))
        return 1;
    else {
        fprintf(stderr, "Security: %s incorrect user-name, other than '" COOL_USER_ID "'\n", appName);
        return 0;
    }
#endif
}

/** Return 0 if no capability is set on the current binary. Positive number gives the bitfield of caps that are set, negative an error. */
inline int hasAnyCapability()
{
#ifdef __linux__
    cap_t caps = cap_get_proc();
    if (caps == nullptr)
    {
        fprintf(stderr, "Error: cap_get_proc() failed.\n");
        return -1;
    }

    cap_t caps_none = cap_init();
    if (caps_none == nullptr)
    {
        fprintf(stderr, "Error: cap_init() failed.\n");
        cap_free(caps);
        return -1;
    }

    // 0 = caps of this process equal to no caps
    int result = cap_compare(caps, caps_none);

    cap_free(caps_none);
    cap_free(caps);

    return result;
#else
    return 0;
#endif
}
#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
