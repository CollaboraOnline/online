/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * Place for simple security-related code.
 */

#pragma once

#include <sys/mount.h>
#include <sys/types.h>

#include <pwd.h>
#include <unistd.h>
#include <string.h>
#include <stdio.h>

#define LOOL_USER_ID "lool"

#ifndef KIT_IN_PROCESS
static int hasCorrectUID(const char *appName)
{
#if ENABLE_DEBUG
    (void)appName;
    return 1; // insecure but easy to use.
#else
    struct passwd *pw = getpwuid(getuid());
    if (pw && pw->pw_name && !strcmp(pw->pw_name, LOOL_USER_ID))
        return 1;
    else {
        fprintf(stderr, "Error: %s incorrect user-name: %s - aborting\n",
		appName, pw && pw->pw_name ? pw->pw_name : "<null>");
	return 0;
    }
#endif
}
#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
