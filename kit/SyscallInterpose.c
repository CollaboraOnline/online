/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#define _GNU_SOURCE
#include "config.h"

#include <dlfcn.h>
#include <dirent.h>
#include <fcntl.h>
#include <stdarg.h>
#include <stdio.h>
#include <sys/stat.h>
#include <sys/vfs.h>
#include <sys/mount.h>
#include <time.h>
#include <unistd.h>

/* Real function pointers */
static int (*real_chdir)(const char *);
static int (*real_chown)(const char *, uid_t, gid_t);
static int (*real_chroot)(const char *);
static int (*real_utimensat)(int, const char *, const struct timespec[2], int);
static int (*real_rename)(const char *, const char *);
static int (*real_chmod)(const char *, mode_t);
static char *(*real_getcwd)(char *, size_t);
static int (*real_stat)(const char *, struct stat *);
static int (*real_mount)(const char *, const char *, const char *, unsigned long, const void *);
static int (*real_mkdir)(const char *, mode_t);
static int (*real_unlink)(const char *);
static int (*real_statfs)(const char *, struct statfs *);
static int (*real_fstatat)(int, const char *, struct stat *, int);
static int (*real_faccessat)(int, const char *, int, int);
static int (*real_openat)(int, const char *, int, mode_t);
static int (*real_access)(const char *, int);
static ssize_t (*real_readlink)(const char *, char *, size_t);
static DIR *(*real_opendir)(const char *);
static struct dirent *(*real_readdir)(DIR *);
static int (*real_closedir)(DIR *);

#define INTERPOSE(name) real_##name = dlsym(RTLD_NEXT, #name)

__attribute__((constructor)) static void init(void) {
    INTERPOSE(chdir); INTERPOSE(chown); INTERPOSE(chroot); INTERPOSE(utimensat);
    INTERPOSE(rename); INTERPOSE(chmod); INTERPOSE(getcwd); INTERPOSE(stat);
    INTERPOSE(mount); INTERPOSE(mkdir); INTERPOSE(unlink); INTERPOSE(statfs);
    INTERPOSE(fstatat); INTERPOSE(faccessat); INTERPOSE(openat); INTERPOSE(access);
    INTERPOSE(readlink); INTERPOSE(opendir); INTERPOSE(readdir); INTERPOSE(closedir);
}

int chdir(const char *p) {
    fprintf(stderr, "chdir(%s)\n", p);
    return real_chdir(p);
}

int chown(const char *p, uid_t u, gid_t g) {
    fprintf(stderr, "chown(%s, %d, %d)\n", p, u, g);
    return real_chown(p, u, g);
}

int chroot(const char *p) {
    fprintf(stderr, "chroot(%s)\n", p);
    return real_chroot(p);
}

int utimensat(int fd, const char *p, const struct timespec t[2], int f) {
    fprintf(stderr, "utimensat(%d, %s, ..., %d)\n", fd, p, f);
    return real_utimensat(fd, p, t, f);
}

int rename(const char *o, const char *n) {
    fprintf(stderr, "rename(%s, %s)\n", o, n);
    return real_rename(o, n);
}

int chmod(const char *p, mode_t m) {
    fprintf(stderr, "chmod(%s, %o)\n", p, m);
    return real_chmod(p, m);
}

char *getcwd(char *b, size_t s) {
    fprintf(stderr, "getcwd(%p, %zu)\n", b, s);
    return real_getcwd(b, s);
}

int stat(const char *p, struct stat *b) {
    fprintf(stderr, "stat(%s)\n", p);
    return real_stat(p, b);
}

int mount(const char *src, const char *tgt, const char *fs, unsigned long fl, const void *d) {
    fprintf(stderr, "mount(%s, %s, %s, %lu)\n", src, tgt, fs, fl);
    return real_mount(src, tgt, fs, fl, d);
}

int mkdir(const char *p, mode_t m) {
    fprintf(stderr, "mkdir(%s, %o)\n", p, m);
    return real_mkdir(p, m);
}

int unlink(const char *p) {
    fprintf(stderr, "unlink(%s)\n", p);
    return real_unlink(p);
}

int statfs(const char *p, struct statfs *b) {
    fprintf(stderr, "statfs(%s)\n", p);
    return real_statfs(p, b);
}

int fstatat(int fd, const char *p, struct stat *b, int f) {
    fprintf(stderr, "fstatat(%d, %s, ..., %d)\n", fd, p, f);
    return real_fstatat(fd, p, b, f);
}

int faccessat(int fd, const char *p, int m, int f) {
    fprintf(stderr, "faccessat(%d, %s, %d, %d)\n", fd, p, m, f);
    return real_faccessat(fd, p, m, f);
}

int openat(int fd, const char *p, int f, ...) {
    mode_t m = 0;
    if (f & O_CREAT) { va_list ap; va_start(ap, f); m = va_arg(ap, mode_t); va_end(ap); }
    fprintf(stderr, "openat(%d, %s, %d, %o)\n", fd, p, f, m);
    return real_openat(fd, p, f, m);
}

int access(const char *p, int m) {
    fprintf(stderr, "access(%s, %d)\n", p, m);
    return real_access(p, m);
}

ssize_t readlink(const char *p, char *b, size_t s) {
    fprintf(stderr, "readlink(%s)\n", p);
    return real_readlink(p, b, s);
}

DIR *opendir(const char *p) {
    fprintf(stderr, "opendir(%s)\n", p);
    return real_opendir(p);
}

struct dirent *readdir(DIR *d) {
    fprintf(stderr, "readdir(%p)\n", d);
    return real_readdir(d);
}

int closedir(DIR *d) {
    fprintf(stderr, "closedir(%p)\n", d);
    return real_closedir(d);
}
