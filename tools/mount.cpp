/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * This is a very tiny helper to allow overlay mounting.
 */

#include <config.h>

#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <sys/mount.h>
#include <sys/stat.h>
#include <unistd.h>

void usage(const char* program)
{
    fprintf(stderr, "Usage: %s <-s|-r> <source path> <target path>\n", program);
    fprintf(stderr, "       %s -u <target>.\n", program);
    fprintf(stderr, "       -b bind and mount the source to target.\n");
    fprintf(stderr, "       -r bind and mount the source to target as readonly.\n");
    fprintf(stderr, "       -u to unmount the target.\n");
}

int main(int argc, char** argv)
{
    const char* program = argv[0];

    if (argc < 3)
    {
        usage(program);
        return 1;
    }

    const char* option = argv[1];
    if (argc == 3 && strcmp(option, "-u") == 0) // Unmount
    {
        const char* target = argv[2];

        struct stat sb;
        const bool target_exists = (stat(target, &sb) == 0 && S_ISDIR(sb.st_mode));

        // Do nothing if target doesn't exist.
        if (target_exists)
        {
            // Unmount the target, first by detaching. This should succeed.
            int retval = umount2(target, MNT_DETACH);
            if (retval != 0)
            {
                if (errno != EINVAL)
                    fprintf(stderr, "%s: unmount failed to detach [%s]: %s.\n", program, target,
                            strerror(errno));
            }

            // Now try to force the unmounting, which isn't supported on all filesystems.
            retval = umount2(target, MNT_FORCE);
            if (retval && errno != EINVAL)
            {
                fprintf(stderr, "%s: forced unmount of [%s] failed: %s.\n", program, target,
                        strerror(errno));
                return 1;
            }
        }
    }
    else if (argc == 4) // Mount
    {
        const char* source = argv[2];
        struct stat sb;
        if (stat(source, &sb) != 0 || !S_ISDIR(sb.st_mode))
        {
            fprintf(stderr, "%s: cannot mount from invalid source directory [%s].\n", program,
                    source);
            return 1;
        }

        const char* target = argv[3];
        const bool target_exists = (stat(target, &sb) == 0 && S_ISDIR(sb.st_mode));
        if (!target_exists)
        {
            fprintf(stderr, "%s: cannot mount on invalid target directory [%s].\n", program,
                    target);
            return 1;
        }

        // Mount the source path as the target path.
        // First bind to mount an existing directory node into the chroot.
        // MS_BIND ignores other flags.
        if (strcmp(option, "-b") == 0) // Shared or Bind Mount.
        {
            const int retval
                = mount(source, target, nullptr, (MS_MGC_VAL | MS_BIND | MS_REC), nullptr);
            if (retval)
            {
                fprintf(stderr, "%s: mount failed to bind [%s] to [%s]: %s.\n", program, source,
                        target, strerror(errno));
                return 1;
            }
        }
        else if (strcmp(option, "-r") == 0) // Readonly Mount.
        {
            // Now we need to set read-only and other flags with a remount.
            int retval = mount(source, target, nullptr,
                               (MS_BIND | MS_REC | MS_REMOUNT | MS_NOATIME | MS_NODEV | MS_NOSUID
                                | MS_RDONLY | MS_SILENT),
                               nullptr);
            if (retval)
            {
                fprintf(stderr, "%s: mount failed remount [%s] readonly: %s.\n", program, target,
                        strerror(errno));
                return 1;
            }

            retval = mount(source, target, nullptr, (MS_UNBINDABLE | MS_REC), nullptr);
            if (retval)
            {
                fprintf(stderr, "%s: mount failed make [%s] private: %s.\n", program, target,
                        strerror(errno));
                return 1;
            }
        }
    }
    else
    {
        usage(program);
        return 1;
    }

    fflush(stderr);
    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
