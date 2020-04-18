/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#if MOBILEAPP

#include <string>

#include <poll.h>

#ifndef __linux
#ifndef SOCK_NONBLOCK
#define SOCK_NONBLOCK 0x100
#endif
#endif

void fakeSocketSetLoggingCallback(void (*)(const std::string&));

int fakeSocketSocket();

int fakeSocketPipe2(int pipefd[2]);

int fakeSocketPoll(struct pollfd *fds, int nfds, int timeout);

int fakeSocketListen(int fd);

int fakeSocketConnect(int fd1, int fd2);

int fakeSocketAccept4(int fd);

int fakeSocketPeer(int fd);

ssize_t fakeSocketAvailableDataLength(int fd);

ssize_t fakeSocketRead(int fd, void *buf, size_t nbytes);

ssize_t fakeSocketWrite(int fd, const void *buf, size_t nbytes);

int fakeSocketShutdown(int fd);

int fakeSocketClose(int fd);

void fakeSocketDumpState();

#endif // MOBILEAPP

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
