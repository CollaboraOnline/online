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
#include <errno.h>
#include <sys/mount.h>
#include <sys/stat.h>
#include <sysexits.h>
#include <unistd.h>

#include <security.h>

#ifdef __FreeBSD__
#include <stdlib.h>
#include <sys/uio.h>

#define MOUNT mount_wrapper
#define MS_MGC_VAL 0
#define MS_SILENT 0
#define MS_NODEV 0
#define MS_UNBINDABLE 0
#define MS_BIND 1
#define MS_REC 2
#define MS_REMOUNT 4
#define MS_NOATIME 8
#define MS_NOSUID 16
#define MS_RDONLY 32

void
build_iovec(struct iovec **iov, int *iovlen, const char *name, const void *val,
        size_t len)
{
    int i;

    if (*iovlen < 0)
        return;
    i = *iovlen;
    *iov = reinterpret_cast<struct iovec*>(realloc(*iov, sizeof **iov * (i + 2)));
    if (*iov == NULL) {
        *iovlen = -1;
        return;
    }
    (*iov)[i].iov_base = strdup(name);
    (*iov)[i].iov_len = strlen(name) + 1;
    i++;
    (*iov)[i].iov_base = const_cast<void*>(val);
    if (len == (size_t)-1) {
        if (val != NULL)
            len = strlen(reinterpret_cast<const char*>(val)) + 1;
        else
            len = 0;
    }
    (*iov)[i].iov_len = (int)len;
    *iovlen = ++i;
}

int mount_wrapper(const char *source, const char *target,
          const char *filesystemtype, unsigned long mountflags,
          const void *data)
{
    struct iovec *iov = NULL;
    int iovlen = 0;
    int freebsd_flags = 0;
    (void)data;

    if(mountflags & MS_BIND)
        filesystemtype = "nullfs";

    if(mountflags & MS_REMOUNT)
        freebsd_flags |= MNT_UPDATE;

    if(mountflags & MS_NOATIME)
        freebsd_flags |= MNT_NOATIME;

    if(mountflags & MS_NOSUID)
        freebsd_flags |= MNT_NOSUID;

    if(mountflags & MS_RDONLY)
        freebsd_flags |= MNT_RDONLY;

    // TODO: handle MS_REC?

    build_iovec(&iov, &iovlen, "fstype", reinterpret_cast<const void*>(filesystemtype), (size_t)-1);
    build_iovec(&iov, &iovlen, "fspath", reinterpret_cast<const void*>(target), (size_t)-1);
    build_iovec(&iov, &iovlen, "from", reinterpret_cast<const void*>(source), (size_t)-1);

    return nmount(iov, iovlen, freebsd_flags);
}

#define MNT_DETACH 1

int umount2(const char *target, int flags)
{
    struct statfs* mntbufs;
    int numInfos = getmntinfo(&mntbufs, MNT_WAIT);
    bool targetMounted = false;

    for (int i = 0; i < numInfos; i++)
    {
        if (!strcmp(target, mntbufs[i].f_mntonname))
        {
            targetMounted = true;
            break;
        }
    }

    if (!targetMounted)
    {
        errno = EINVAL;
        return -1;
    }

    if(flags == MNT_DETACH)
        flags = 0;

    return unmount(target, flags);
}
#else
#define MOUNT mount
#endif

void usage(const char* program)
{
    fprintf(stderr, "Usage: %s <-b|-r> <source path> <target path>\n", program);
    fprintf(stderr, "       %s -u <target>.\n", program);
#ifdef __FreeBSD__
    fprintf(stderr, "       %s -d <target>.\n", program);
#endif
    fprintf(stderr, "       -b bind and mount the source to target.\n");
    fprintf(stderr, "       -r bind and mount the source to target as readonly.\n");
#ifdef __FreeBSD__
    fprintf(stderr, "       -d mount minimal devfs layout (random and urandom) to target.\n");
#endif
    fprintf(stderr, "       -u to unmount the target.\n");
}

int main(int argc, char** argv)
{
    if (!hasCorrectUID(/* appName = */"coolmount"))
    {
        fprintf(stderr, "Aborting.\n");
        return EX_SOFTWARE;
    }

    const char* program = argv[0];
    if (argc < 3)
    {
        usage(program);
        return EX_USAGE;
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
                return EX_SOFTWARE;
            }
        }
    }
#ifdef __FreeBSD__
    else if (argc == 3 && strcmp(option, "-d") == 0) // Mount devfs
    {
        const char* target = argv[2];

        struct stat sb;
        const bool target_exists = (stat(target, &sb) == 0 && S_ISDIR(sb.st_mode));

        if (!target_exists)
        {
            fprintf(stderr, "%s: cannot mount on invalid target directory [%s].\n", program,
                    target);
            return EX_USAGE;
        }

        struct iovec *iov = NULL;
        int iovlen = 0;

        build_iovec(&iov, &iovlen, "fstype", "devfs", (size_t)-1);
        build_iovec(&iov, &iovlen, "fspath", reinterpret_cast<const void*>(target), (size_t)-1);
        build_iovec(&iov, &iovlen, "from", "devfs", (size_t)-1);
        // See /etc/defaults/devfs.rules
        // [devfsrules_jail=4]
        build_iovec(&iov, &iovlen, "ruleset", "4", (size_t)-1);

        int retval = nmount(iov, iovlen, 0);
        if (retval)
        {
            fprintf(stderr, "%s: mount failed create to devfs layout in [%s]: %s.\n", program, target,
                    strerror(errno));
            return EX_SOFTWARE;
        }
    }
#endif
    else if (argc == 4) // Mount
    {
        const char* source = argv[2];
        struct stat sb;
        if (stat(source, &sb))
        {
            fprintf(stderr, "%s: cannot mount from invalid source [%s]. stat failed with %s\n",
                    program, source, strerror(errno));
            return EX_USAGE;
        }

        const bool isDir = S_ISDIR(sb.st_mode);
        const bool isFile = S_ISCHR(sb.st_mode); // We don't support regular files.
        if (!isDir && !isFile)
        {
            fprintf(stderr,
                    "%s: cannot mount from invalid source [%s], it is neither a file nor a "
                    "directory.\n",
                    program, source);
            return EX_USAGE;
        }

        const char* target = argv[3];
        if (stat(target, &sb))
        {
            fprintf(stderr, "%s: cannot mount on invalid target [%s]. stat failed with %s\n",
                    program, target, strerror(errno));
            return EX_USAGE;
        }

        const bool target_exists =
            ((isDir && S_ISDIR(sb.st_mode)) || (isFile && S_ISREG(sb.st_mode)));
        if (!target_exists)
        {
            fprintf(stderr,
                    "%s: cannot mount on invalid target [%s], it is not a %s as the source\n",
                    program, target, isDir ? "directory" : "file");
            return EX_USAGE;
        }

        // Mount the source path as the target path.
        // First bind to mount an existing directory node into the chroot.
        // MS_BIND ignores other flags.
        if (strcmp(option, "-b") == 0) // Shared or Bind Mount.
        {
            const int retval
                = MOUNT(source, target, nullptr, (MS_MGC_VAL | MS_BIND | MS_REC), nullptr);
            if (retval)
            {
                fprintf(stderr, "%s: mount failed to bind [%s] to [%s]: %s.\n", program, source,
                        target, strerror(errno));
                return EX_SOFTWARE;
            }
        }
        else if (strcmp(option, "-r") == 0) // Readonly Mount.
        {
            // Now we need to set read-only and other flags with a remount.
            int retval = MOUNT(source, target, nullptr,
                               (MS_BIND | MS_REC | MS_REMOUNT | MS_NOATIME | MS_NODEV | MS_NOSUID
                                | MS_RDONLY | MS_SILENT),
                               nullptr);
            if (retval)
            {
                fprintf(stderr, "%s: mount failed remount [%s] readonly: %s.\n", program, target,
                        strerror(errno));
                return EX_SOFTWARE;
            }

            retval = MOUNT(source, target, nullptr, (MS_UNBINDABLE | MS_REC), nullptr);
            if (retval)
            {
                fprintf(stderr, "%s: mount failed make [%s] private: %s.\n", program, target,
                        strerror(errno));
                return EX_SOFTWARE;
            }
        }
    }
    else
    {
        usage(program);
        return EX_USAGE;
    }

    fflush(stderr);
    return EX_OK;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
