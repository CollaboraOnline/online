// -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#include <config.h>

#include "windows.hpp"

#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <thread>

#include <common/Log.hpp>
#include <common/MobileApp.hpp>
#include <net/FakeSocket.hpp>
#include <wsd/COOLWSD.hpp>

const char *user_name = nullptr;

int coolwsd_server_socket_fd = -1;

LibreOfficeKit *lo_kit;

static COOLWSD *coolwsd = nullptr;
static int fakeClientFd;
static int closeNotificationPipeForForwardingThread[2];

typedef void (*send2JS_t)(char *buffer, long length);

static send2JS_t send2JSfunction;

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
int generate_new_app_doc_id()
{
    // Start with a random document id to catch code that might assume it to be some fixed value,
    // like 0 or 1. Also make it obvious that this numeric "app doc id", used by the mobile apps and
    // CODA, is not related to the string document ids (usually with several leading zeroes) used in
    // the C++ bits of normal COOL.
    static int appDocId = 42 + (std::time(nullptr) % 100);

    DocumentData::allocate(appDocId);
    return appDocId++;
}

EXPORT
void initialize_cpp_things()
{
    // FIXME: Code snippet shared with gtk/mobile.cpp, factor out into separate file.

    Log::initialize("Mobile", "trace");
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

    fakeClientFd = fakeSocketSocket();
}

EXPORT
void set_send2JS_function(send2JS_t f)
{
    send2JSfunction = f;
}

EXPORT
void do_hullo_handling_things(const char *fileURL, int appDocId)
{
    // FIXME: Code snippet shared with gtk/mobile.cpp, factor out into separate file.

    // Now we know that the JS has started completely

    // Contact the permanently (during app lifetime) listening COOLWSD server "public" socket
    assert(coolwsd_server_socket_fd != -1);
    int rc = fakeSocketConnect(fakeClientFd, coolwsd_server_socket_fd);
    assert(rc != -1);

    // Create a socket pair to notify the below thread when the document has been closed
    fakeSocketPipe2(closeNotificationPipeForForwardingThread);

    // Start another thread to read responses and forward them to the JavaScript
    std::thread([]
    {
        Util::setThreadName("app2js");
        while (true)
        {
            struct pollfd pollfd[2];
            pollfd[0].fd = fakeClientFd;
            pollfd[0].events = POLLIN;
            pollfd[1].fd = closeNotificationPipeForForwardingThread[1];
            pollfd[1].events = POLLIN;
            if (fakeSocketPoll(pollfd, 2, -1) > 0)
            {
                if (pollfd[1].revents == POLLIN)
                {
                    // The code below handling the "BYE" fake Websocket message has closed the other
                    // end of the closeNotificationPipeForForwardingThread. Let's close the other
                    // end too just for cleanliness, even if a FakeSocket as such is not a system
                    // resource so nothing is saved by closing it.
                    fakeSocketClose(closeNotificationPipeForForwardingThread[1]);

                    // Close our end of the fake socket connection to the ClientSession thread, so
                    // that it terminates.
                    fakeSocketClose(fakeClientFd);

                    return;
                }
                if (pollfd[0].revents == POLLIN)
                {
                    int n = fakeSocketAvailableDataLength(fakeClientFd);
                    // I don't want to check for n being -1 here, even if that will lead to a crash,
                    // as n being -1 is a sign of something being wrong elsewhere anyway, and I
                    // prefer to fix the root cause. Let's see how well this works out.
                    if (n == 0)
                        return;
                    std::vector<char> buf(n);
                    n = fakeSocketRead(fakeClientFd, buf.data(), n);
                    send2JSfunction(buf.data(), n);
                }
            }
            else
            {
                break;
            }
        }
        assert(false);
    }).detach();

    // First we simply send it the URL. This corresponds to the GET request with Upgrade to
    // WebSocket.
    LOG_TRC_NOFILE("Actually sending to Online:" << fileURL);

    // Must do this in a thread, too, so that we can return to the main loop
    // Must duplicate fileURL as it exists only while this function is called from C#.
    char *fileURLcopy = _strdup(fileURL);
    std::thread([fileURLcopy, appDocId]
    {
        struct pollfd pollfd;
        pollfd.fd = fakeClientFd;
        pollfd.events = POLLOUT;
        fakeSocketPoll(&pollfd, 1, -1);
        std::string message(fileURLcopy + (" " + std::to_string(appDocId)));
        fakeSocketWrite(fakeClientFd, message.c_str(), message.size());
        std::free(fileURLcopy);
    }).detach();
}

EXPORT
void do_bye_handling_things()
{
    LOG_TRC_NOFILE("Document window terminating on JavaScript side. Closing our end of the socket.");

    // Close one end of the socket pair, that will wake up the forwarding thread above
    fakeSocketClose(closeNotificationPipeForForwardingThread[0]);
}

EXPORT
void do_other_message_handling_things(const char *message)
{
    LOG_TRC_NOFILE("Handling other message:'" << message << "'");

    char *string_copy = _strdup(message);
    // As above, must do this in a thread
    std::thread([=]
    {
        struct pollfd pollfd;
        pollfd.fd = fakeClientFd;
        pollfd.events = POLLOUT;
        fakeSocketPoll(&pollfd, 1, -1);
        fakeSocketWrite(fakeClientFd, string_copy, strlen(string_copy));
        free(string_copy);
    }).detach();
}

// vim:set shiftwidth=4 softtabstop=4 expandtab:
