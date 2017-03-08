/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * This is a very tiny helper to allow overlay mounting.
 */

#include "config.h"

#include <sys/mount.h>

#include "security.h"

int main(int argc, char **argv)
{
    if (!hasCorrectUID("loolmount"))
        return 1;

    if (argc < 3)
        return 1;

    int retval = mount (argv[1], argv[2], nullptr, MS_BIND, nullptr);
    if (retval)
        return retval;

    // apparently this has to be done in a 2nd pass.
    return mount(argv[1], argv[2], nullptr,
                 (MS_BIND | MS_REMOUNT | MS_NOATIME | MS_NODEV |
                  MS_NOSUID | MS_RDONLY  | MS_SILENT), nullptr);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
