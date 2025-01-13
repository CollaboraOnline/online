/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "Syscall.hpp"

#include <cerrno>
#include <sys/socket.h>

#if !HAVE_PIPE2
#include <fcntl.h>
#else
#include <unistd.h>
#endif

/**
 * Internal helper functions.
 */
namespace {

#if !HAVE_PIPE2

/**
 * Set FD_CLOEXEC and O_NONBLOCK on one file descriptor.
 */
int set_fd_cloexec_nonblock(int fd, bool cloexec, bool nonblock) {
    // Set FD_CLOEXEC if the user wants it
    if (cloexec)
    {
        int fd_flags = fcntl(fd, F_GETFD);
        if (fd_flags == -1)
            return -1;

        fd_flags |= FD_CLOEXEC;
        if (fcntl(fd, F_SETFD, fd_flags) == -1)
            return -1;
    }

    // Set O_NONBLOCK if the user wants it
    if (nonblock)
    {
        int fl_flags = fcntl(fd, F_GETFL);
        if (fl_flags == -1)
            return -1;

        fl_flags |= O_NONBLOCK;
        if (fcntl(fd, F_SETFL, fl_flags) == -1)
            return -1;
    }

    return 0;
}

/**
 * Set CLOEXEC or NONBLOCK on both sides of the pipe/socket/...
 */
int set_fds_cloexec_nonblock(int fds[2], bool cloexec, bool nonblock) {
    for (int i = 0; i < 2; i++) {
        int ret = set_fd_cloexec_nonblock(fds[i], cloexec, nonblock);
        if (ret < 0) {
            int saved_errno = errno;
            close(fds[0]);
            close(fds[1]);
            errno = saved_errno;

            return -1;
        }
    }

    return 0;
}

#endif

}

/// Implementation of pipe2() for platforms that don't have it (like macOS)
int Syscall::pipe2(int pipefd[2], int flags)
{
#if HAVE_PIPE2
    return ::pipe2(pipefd, flags);
#else
    if (pipe(pipefd) < 0)
        return -1;

    return set_fds_cloexec_nonblock(pipefd, flags & O_CLOEXEC, flags & O_NONBLOCK);
#endif
}

int Syscall::socketpair_cloexec_nonblock(int domain, int type, int protocol, int socket_vector[2])
{
#ifdef __linux__
    return ::socketpair(domain, type | SOCK_NONBLOCK | SOCK_CLOEXEC, protocol, socket_vector);
#else
    int rc = ::socketpair(domain, type, protocol, socket_vector);
    if (rc < 0) {
        return -1;
    }

    return set_fds_cloexec_nonblock(socket_vector, true, true);
#endif
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
