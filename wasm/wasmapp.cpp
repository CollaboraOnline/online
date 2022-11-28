/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "wasmapp.hpp"

int coolwsd_server_socket_fd = -1;

const char* user_name;

static std::string fileURL;
static COOLWSD *coolwsd = nullptr;
static int fakeClientFd;
static int closeNotificationPipeForForwardingThread[2] = {-1, -1};
emscripten::val contentArray = emscripten::val::array();


/// Close the document.
void closeDocument()
{
    // Close one end of the socket pair, that will wake up the forwarding thread that was constructed in HULLO
    fakeSocketClose(closeNotificationPipeForForwardingThread[0]);

    LOG_DBG("Waiting for COOLWSD to finish...");
    std::unique_lock<std::mutex> lock(COOLWSD::lokit_main_mutex);
    LOG_DBG("COOLWSD has finished.");
}

int main(int argc, char* argv[])
{
    if (argc != 2)
    {
        fprintf(stderr, "Usage: %s document\n", argv[0]);
        _exit(1); // avoid log cleanup
    }

    Log::initialize("WASM", "trace", false, false, {});
    Util::setThreadName("main");

    fakeSocketSetLoggingCallback([](const std::string& line)
                                 {
                                     LOG_TRC_NOFILE(line);
                                 });

    std::thread([]
                {
                    assert(coolwsd == nullptr);
                    char *argv[2];
                    argv[0] = strdup("wasm");
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

    fakeClientFd = fakeSocketSocket();

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab cinoptions=b1,g0,N-s cinkeys+=0=break: */
