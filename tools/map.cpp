/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <string.h>
#include <ctype.h>
#include <errno.h>
#include <error.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <dirent.h>
#include <locale.h>

#define MAP_SIZE 20
#define PATH_SIZE 64
#define BUFFER_SIZE 9600

static int read_buffer(char *buffer, unsigned size,
                       const char *file, char sep)
{
    int file_desc;
    unsigned total_bytes = 0;

    file_desc = open(file, O_RDONLY);
    if (file_desc == -1)
        return 0;

    for (;;)
    {
        ssize_t number_bytes = read(file_desc,
                                    buffer + total_bytes,
                                    size - total_bytes);
        if (number_bytes == -1)
        {
            if (errno==EINTR)
                continue;
            break;
        }

        total_bytes += number_bytes;
        if (total_bytes == size)
        {
            --total_bytes;
            break;
        }

        if (number_bytes==0)
            break;  // EOF
    }

    close(file_desc);

    if (total_bytes)
    {
        int i=total_bytes;

        while (i--)
            if (buffer[i]=='\n' || buffer[i]=='\0')
                buffer[i]=sep;

        if (buffer[total_bytes-1]==' ')
            buffer[total_bytes-1]='\0';
    }

    buffer[total_bytes] = '\0';
    return total_bytes;
}

static void total_smaps(unsigned proc_id, const char *file, const char *cmdline)
{
    FILE *file_pointer;
    char buffer[BUFFER_SIZE];

    unsigned long long total_private_dirty = 0ull;
    unsigned long long total_private_clean = 0ull;
    unsigned long long total_shared_dirty = 0ull;
    unsigned long long total_shared_clean = 0ull;
    unsigned long long smap_value;
    char smap_key[MAP_SIZE];

    if ((file_pointer = fopen(file, "r")) == nullptr)
        error(EXIT_FAILURE, errno, "%s", file);

    while (fgets(buffer, sizeof(buffer), file_pointer))
    {
        if (buffer[0] >= 'A' && buffer[0] <= 'Z')
        {
            if (sscanf(buffer, "%20[^:]: %llu", smap_key, &smap_value) == 2)
            {
                if (strncmp("Shared_Dirty", smap_key, 12) == 0)
                {
                    total_shared_dirty += smap_value;
                    continue;
                }
                if (strncmp("Shared_Clean", smap_key, 12) == 0)
                {
                    total_shared_clean += smap_value;
                    continue;
                }
                if (strncmp("Private_Dirty", smap_key, 13) == 0)
                {
                    total_private_dirty += smap_value;
                    continue;
                }
                if (strncmp("Private_Clean", smap_key, 13) == 0)
                {
                    total_private_clean += smap_value;
                    continue;
                }
            }
        }
    }

    if (errno)
        error(EXIT_FAILURE, errno, "%s\n", cmdline);

    printf("%s\n", cmdline);
    printf("Process ID    :%20d\n", proc_id);
    printf("--------------------------------------\n");
    printf("Shared Clean  :%20lld kB\n", total_shared_clean);
    printf("Shared Dirty  :%20lld kB\n", total_shared_dirty);
    printf("Private Clean :%20lld kB\n", total_private_clean);
    printf("Private Dirty :%20lld kB\n", total_private_dirty);
    printf("--------------------------------------\n");
    printf("Shared        :%20lld kB\n", total_shared_clean + total_shared_dirty);
    printf("Private       :%20lld kB\n\n", total_private_clean + total_private_dirty);
}

int main(int argc, char **argv)
{
    DIR *root_proc;
    struct dirent *dir_proc;

    unsigned pid_proc;
    char path_proc[PATH_SIZE];
    char cmdline[BUFFER_SIZE];

    setlocale (LC_ALL, "");
    getopt(argc, argv, "");

    if (argc != 2)
        error(EXIT_FAILURE, EINVAL, "incorrect arguments");

    root_proc = opendir("/proc");
    if (!root_proc)
        error(EXIT_FAILURE, errno, "%s", "/proc");

    while ((dir_proc = readdir(root_proc)))
    {
        if (!dir_proc && !dir_proc->d_name[0])
            error(EXIT_FAILURE, ENOTDIR, "bad dir");

        if (*dir_proc->d_name > '0' && *dir_proc->d_name <= '9')
        {
            pid_proc = strtoul(dir_proc->d_name, nullptr, 10);
            snprintf(path_proc, sizeof(path_proc), "/proc/%s/%s", dir_proc->d_name, "cmdline");
            if (read_buffer(cmdline, sizeof(cmdline), path_proc, ' ') &&
                strstr(cmdline, argv[1]) &&
                !strstr(cmdline, argv[0]))
            {
                snprintf(path_proc, sizeof(path_proc), "/proc/%s/%s", dir_proc->d_name, "smaps");
                total_smaps(pid_proc, path_proc, cmdline);
            }
        }
    }

    if (errno)
        error(EXIT_FAILURE, errno, "fail");

  return EXIT_SUCCESS;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
