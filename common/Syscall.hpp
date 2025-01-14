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

#pragma once

/**
 * This is a place for platform-dependent syscalls, to be able to extend them conveniently.
 */
namespace Syscall {

    /**
     * Implement pipe2() on platforms that don't have it.
     */
    int pipe2(int pipefd[2], int flags);

    /**
     * Implement socket() with CLOEXEC and NONBLOCK on platforms that don't have those flags.
     */
    int socket_cloexec_nonblock(int domain, int type, int protocol);

    /**
     * Implement socket_pair() with CLOEXEC and NONBLOCK on platforms that don't have those flags.
     */
    int socketpair_cloexec_nonblock(int domain, int type, int protocol, int socket_vector[2]);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
