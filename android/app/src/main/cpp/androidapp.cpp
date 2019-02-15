/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>
#include <jni.h>
#include <android/log.h>

#include <chrono>
#include <thread>

#include <FakeSocket.hpp>
#include <Log.hpp>
#include <LOOLWSD.hpp>
#include <Protocol.hpp>
#include <Util.hpp>

#include "Poco/Base64Encoder.h"

const int SHOW_JS_MAXLEN = 70;

int loolwsd_server_socket_fd = -1;

static std::string fileURL;
static LOOLWSD *loolwsd = nullptr;
static int fakeClientFd;
static int closeNotificationPipeForForwardingThread[2];

static void send2JS(JNIEnv *env, jobject obj, const std::vector<char>& buffer)
{
    LOG_TRC_NOFILE("Send to JS: " << LOOLProtocol::getAbbreviatedMessage(buffer.data(), buffer.size()));

    std::string js;

    // Check if the message is binary. We say that any message that isn't just a single line is
    // "binary" even if that strictly speaking isn't the case; for instance the commandvalues:
    // message has a long bunch of non-binary JSON on multiple lines. But _onMessage() in Socket.js
    // handles it fine even if such a message, too, comes in as an ArrayBuffer. (Look for the
    // "textMsg = String.fromCharCode.apply(null, imgBytes);".)

    const char *newline = (const char *)memchr(buffer.data(), '\n', buffer.size());
    if (newline != nullptr)
    {
        // The data needs to be an ArrayBuffer
        std::stringstream ss;
        ss << "Base64ToArrayBuffer('";

        Poco::Base64Encoder encoder(ss);
        encoder << std::string(buffer.data(), buffer.size());
        encoder.close();

        ss << "')";

        js = ss.str();
    }
    else
    {
        const unsigned char *ubufp = (const unsigned char *)buffer.data();
        std::vector<char> data;
        for (int i = 0; i < buffer.size(); i++)
        {
            if (ubufp[i] < ' ' || ubufp[i] == '\'' || ubufp[i] == '\\')
            {
                data.push_back('\\');
                data.push_back('x');
                data.push_back("0123456789abcdef"[(ubufp[i] >> 4) & 0x0F]);
                data.push_back("0123456789abcdef"[ubufp[i] & 0x0F]);
            }
            else
            {
                data.push_back(ubufp[i]);
            }
        }
        data.push_back(0);

        js = std::string(data.data(), data.size());
    }

    std::string subjs = js.substr(0, std::min(std::string::size_type(SHOW_JS_MAXLEN), js.length()));
    if (js.length() > SHOW_JS_MAXLEN)
        subjs += "...";

    LOG_TRC_NOFILE( "Sending to JavaScript: " << subjs);

    /* TODO commented out, see the other TODO wrt. the NewGlobalRef
    jstring jstr = env->NewStringUTF(js.c_str());
    jclass clazz = env->FindClass("org/libreoffice/androidapp/MainActivity");
    jmethodID callFakeWebsocket = env->GetMethodID(clazz, "callFakeWebsocketOnMessage", "(V)Ljava/lang/String;");
    env->CallObjectMethod(obj, callFakeWebsocket, jstr);
    */
}

/// Handle a message from JavaScript.
extern "C" JNIEXPORT void JNICALL
Java_org_libreoffice_androidapp_MainActivity_postMobileMessage(JNIEnv *env, jobject obj, jstring message)
{
    const char *string_value = env->GetStringUTFChars(message, nullptr);

    if (string_value)
    {
        LOG_TRC_NOFILE("From JS: lool: " << string_value);

        if (strcmp(string_value, "HULLO") == 0)
        {
            // Now we know that the JS has started completely

            // Contact the permanently (during app lifetime) listening LOOLWSD server
            // "public" socket
            assert(loolwsd_server_socket_fd != -1);
            int rc = fakeSocketConnect(fakeClientFd, loolwsd_server_socket_fd);
            assert(rc != -1);

            // Create a socket pair to notify the below thread when the document has been closed
            fakeSocketPipe2(closeNotificationPipeForForwardingThread);

            // Start another thread to read responses and forward them to the JavaScript
            // TODO here we actually need to do NewGlobalRef and pass that to
            // the thread; not the env and obj itself
            std::thread([&env, &obj]
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
                                       // The code below handling the "BYE" fake Websocket
                                       // message has closed the other end of the
                                       // closeNotificationPipeForForwardingThread. Let's close
                                       // the other end too just for cleanliness, even if a
                                       // FakeSocket as such is not a system resource so nothing
                                       // is saved by closing it.
                                       fakeSocketClose(closeNotificationPipeForForwardingThread[1]);

                                       // Close our end of the fake socket connection to the
                                       // ClientSession thread, so that it terminates
                                       fakeSocketClose(fakeClientFd);

                                       return;
                                   }
                                   if (pollfd[0].revents == POLLIN)
                                   {
                                       int n = fakeSocketAvailableDataLength(fakeClientFd);
                                       if (n == 0)
                                           return;
                                       std::vector<char> buf(n);
                                       n = fakeSocketRead(fakeClientFd, buf.data(), n);
                                       send2JS(env, obj, buf);
                                   }
                               }
                               else
                                   break;
                           }
                           assert(false);
                        }).detach();

            // First we simply send it the URL. This corresponds to the GET request with Upgrade to
            // WebSocket.
            LOG_TRC_NOFILE("Actually sending to Online:" << fileURL);

            // Must do this in a thread, too, so that we can return to the GTK+ main loop
            std::thread([]
                        {
                            struct pollfd pollfd;
                            pollfd.fd = fakeClientFd;
                            pollfd.events = POLLOUT;
                            fakeSocketPoll(&pollfd, 1, -1);
                            fakeSocketWrite(fakeClientFd, fileURL.c_str(), fileURL.size());
                        }).detach();
        }
        else if (strcmp(string_value, "BYE") == 0)
        {
            LOG_TRC_NOFILE("Document window terminating on JavaScript side. Closing our end of the socket.");

            // Close one end of the socket pair, that will wake up the forwarding thread above
            fakeSocketClose(closeNotificationPipeForForwardingThread[0]);

            // ???
        }
        else
        {
            // As above
            char *string_copy = strdup(string_value);
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
    }
    else
        LOG_TRC_NOFILE("From JS: lool: some object");
}

extern "C" jboolean libreofficekit_initialize(JNIEnv* env, jstring dataDir, jstring cacheDir, jstring apkFile, jobject assetManager);

/// Create the LOOLWSD instance.
extern "C" JNIEXPORT void JNICALL
Java_org_libreoffice_androidapp_MainActivity_createLOOLWSD(JNIEnv *env, jobject, jstring dataDir, jstring cacheDir, jstring apkFile, jobject assetManager, jstring loadFileURL)
{
    libreofficekit_initialize(env, dataDir, cacheDir, apkFile, assetManager);

    fileURL = std::string(env->GetStringUTFChars(loadFileURL, nullptr));

    Log::initialize("Mobile", "trace", false, false, {});
    Util::setThreadName("main");

    fakeSocketSetLoggingCallback([](const std::string& line)
                                 {
                                     LOG_TRC_NOFILE(line);
                                 });

    std::thread([]
                {
                    assert(loolwsd == nullptr);
                    char *argv[2];
                    argv[0] = strdup("mobile");
                    argv[1] = nullptr;
                    Util::setThreadName("app");
                    while (true)
                    {
                        loolwsd = new LOOLWSD();
                        loolwsd->run(1, argv);
                        delete loolwsd;
                        LOG_TRC("One run of LOOLWSD completed");
                        std::this_thread::sleep_for(std::chrono::milliseconds(100));
                    }
                }).detach();

    fakeClientFd = fakeSocketSocket();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab cinoptions=b1,g0,N-s cinkeys+=0=break: */
