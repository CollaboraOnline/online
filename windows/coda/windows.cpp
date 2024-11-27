// -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#include <config.h>

#include "windows.hpp"

#include <cstring>
#include <thread>

#include <common/Log.hpp>
#include <net/FakeSocket.hpp>
#include <wsd/COOLWSD.hpp>

const char *user_name = nullptr;

int coolwsd_server_socket_fd = -1;

LibreOfficeKit *lo_kit;

static COOLWSD *coolwsd = nullptr;

EXPORT
int get_coolwsd_server_socket_fd()
{
    return coolwsd_server_socket_fd;
}

EXPORT
int set_coolwsd_server_socket_fd(int fd)
{
    coolwsd_server_socket_fd = fd;
    return fd;
}

EXPORT
void initialize_cpp_things()
{
    Log::initialize("Mobile", "trace", false, false, {});
    Util::setThreadName("main");

    fakeSocketSetLoggingCallback([](const std::string& line)
                                 {
                                     LOG_TRC_NOFILE(line);
                                 });

    std::thread([]
                {
                    assert(coolwsd == nullptr);
                    char *argv[2];
                    // Yes, strdup() is apparently not standard, so MS wants you to call it as
                    // _strdup(), and warns if you call strdup(). Sure, we could just silence such
                    // warnings, but let's try to do as they want.
                    argv[0] = _strdup("mobile");
                    argv[1] = nullptr;
                    Util::setThreadName("app");
                    while (true)
                    {
                        coolwsd = new COOLWSD();
                        coolwsd->run(1, argv);
                        delete coolwsd;
                        LOG_TRC("One run of COOLWSD completed");
                    }
                }).detach();
}

// vim:set shiftwidth=4 softtabstop=4 expandtab:
