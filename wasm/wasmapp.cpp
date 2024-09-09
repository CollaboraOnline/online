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

#include "wasmapp.hpp"

#include <FakeSocket.hpp>
#include <Log.hpp>
#include <COOLWSD.hpp>
#include <Util.hpp>

#include "base64.hpp"
#include <emscripten/fetch.h>

int coolwsd_server_socket_fd = -1;

const char* user_name;
constexpr std::size_t SHOW_JS_MAXLEN = 200;

#define FILE_PATH "/sample.docx"
static std::string fileURL = "file://" FILE_PATH;
static COOLWSD *coolwsd = nullptr;
static int fakeClientFd;
static int closeNotificationPipeForForwardingThread[2] = {-1, -1};

static void send2JS(const std::vector<char>& buffer)
{
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
        js = "window.TheFakeWebSocket.onmessage({'data': Base64ToArrayBuffer('";
        js = js + macaron::Base64::Encode(std::string(buffer.data(), buffer.size()));
        js = js + "')});";
    }
    else
    {
        js = "window.TheFakeWebSocket.onmessage({'data': window.b64d('";
        js = js + macaron::Base64::Encode(std::string(buffer.data(), buffer.size()));
        js = js + "')});";
    }

    LOG_TRC_NOFILE("Evaluating JavaScript: " << js.substr(0, std::min(SHOW_JS_MAXLEN, js.size()))
                                             << (js.size() > SHOW_JS_MAXLEN ? "..." : ""));

    MAIN_THREAD_EM_ASM(eval(UTF8ToString($0)), js.c_str());
}

extern "C"
void handle_cool_message(const char *string_value)
{
    std::cout << "================ handle_cool_message(): '" << string_value << "'" << std::endl;

    if (strcmp(string_value, "HULLO") == 0)
    {
        // Now we know that the JS has started completely

        // Contact the permanently (during app lifetime) listening COOLWSD server
        // "public" socket
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
                                   send2JS(buf);
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
        std::cout << "Loading file [" << fileURL << "]" << std::endl;

        struct pollfd pollfd;
        pollfd.fd = fakeClientFd;
        pollfd.events = POLLOUT;
        fakeSocketPoll(&pollfd, 1, -1);
        fakeSocketWrite(fakeClientFd, fileURL.c_str(), fileURL.size());
    }
    else if (strcmp(string_value, "BYE") == 0)
    {
        LOG_TRC_NOFILE("Document window terminating on JavaScript side. Closing our end of the socket.");

        // Close one end of the socket pair, that will wake up the forwarding thread above
        fakeSocketClose(closeNotificationPipeForForwardingThread[0]);
    }
    else
    {
        // As above
        struct pollfd pollfd;
        pollfd.fd = fakeClientFd;
        pollfd.events = POLLOUT;
        fakeSocketPoll(&pollfd, 1, -1);
        fakeSocketWrite(fakeClientFd, string_value, strlen(string_value));
    }
}

void readWASMFile(emscripten::val& contentArray, size_t nRead, const std::vector<char>& filebuf)
{
    emscripten::val fileContentView = emscripten::val(emscripten::typed_memory_view(
        nRead,
        filebuf.data()));
    emscripten::val fileContentCopy = emscripten::val::global("ArrayBuffer").new_(nRead);
    emscripten::val fileContentCopyView = emscripten::val::global("Uint8Array").new_(fileContentCopy);
    fileContentCopyView.call<void>("set", fileContentView);
    contentArray.call<void>("push", fileContentCopyView);
}

void writeWASMFile(emscripten::val& contentArray, const std::string& rFileName)
{
    emscripten::val document = emscripten::val::global("document");
    emscripten::val window = emscripten::val::global("window");
    emscripten::val type = emscripten::val::object();
    type.set("type","application/octet-stream");
    emscripten::val contentBlob = emscripten::val::global("Blob").new_(contentArray, type);
    emscripten::val contentUrl = window["URL"].call<emscripten::val>("createObjectURL", contentBlob);
    emscripten::val contentLink = document.call<emscripten::val>("createElement", std::string("a"));
    contentLink.set("href", contentUrl);
    contentLink.set("download", rFileName);
    contentLink.set("style", "display:none");
    emscripten::val body = document["body"];
    body.call<void>("appendChild", contentLink);
    contentLink.call<void>("click");
    body.call<void>("removeChild", contentLink);
    window["URL"].call<emscripten::val>("revokeObjectURL", contentUrl);
}

// Copy file from online to WASM memory
void copyFileBufferToWasmMemory(const std::string& fileName, const std::vector<char>& filebuf)
{
    EM_ASM(
        {
            FS.writeFile(UTF8ToString($0), new Uint8Array(Module.HEAPU8.buffer, $1, $2));
        }, fileName.c_str(), filebuf.data(), filebuf.size());
}

/// Close the document.
void closeDocument()
{
    // Close one end of the socket pair, that will wake up the forwarding thread that was constructed in HULLO
    fakeSocketClose(closeNotificationPipeForForwardingThread[0]);

    LOG_DBG("Waiting for COOLWSD to finish...");
    std::unique_lock<std::mutex> lock(COOLWSD::lokit_main_mutex);
    LOG_DBG("COOLWSD has finished.");
}

int main(int argc, char* argv_main[])
{
    std::cout << "================ Here is main()" << std::endl;

    if (argc < 2)
    {
        std::cout << "Error: expected argument with document URL not found" << std::endl;
        return 1;
    }

    Log::initialize("WASM", "error", false, false, {});
    Util::setThreadName("main");

    fakeSocketSetLoggingCallback([](const std::string& line)
                                 {
                                     LOG_TRC_NOFILE(line);
                                 });

    char *argv[2];
    argv[0] = strdup("wasm");
    argv[1] = nullptr;
    Util::setThreadName("app");

    fakeClientFd = fakeSocketSocket();

    // We run COOOLWSD::run() in a thread of its own so that main() can return.
    std::thread(
        [&]
        {
            const std::string docURL = std::string(argv_main[1]);
            const std::string encodedWOPI = std::string(argv_main[2]);
            const std::string isWOPI = std::string(argv_main[3]);

            std::string url;
            if (isWOPI == "true")
                url = "/wasm/" + encodedWOPI;
            else
                url = docURL + "/contents";

            printf("isWOPI is %s: Fetching from url %s\n", isWOPI.c_str(), url.c_str());

            emscripten_fetch_attr_t attr;
            emscripten_fetch_attr_init(&attr);
            strcpy(attr.requestMethod, "GET");
            attr.attributes = EMSCRIPTEN_FETCH_LOAD_TO_MEMORY | EMSCRIPTEN_FETCH_SYNCHRONOUS;
            emscripten_fetch_t* fetch = emscripten_fetch(
                &attr, url.data()); // Blocks here until the operation is complete.
            if (fetch->status == 200)
            {
                printf("Finished downloading %llu bytes from URL %s.\n", fetch->numBytes,
                       fetch->url);
                // For now, we have a hard-coded filename that we open. Clobber it.
                FILE* f = fopen(FILE_PATH, "w");
                const int wrote = fwrite(fetch->data, 1, fetch->numBytes, f);
                fclose(f);
                printf("Wrote %d bytes into " FILE_PATH "\n", wrote);
            }
            else
            {
                printf("Downloading %s failed, HTTP failure status code: %d.\n", fetch->url,
                       fetch->status);
            }
            emscripten_fetch_close(fetch);

            coolwsd = new COOLWSD();
            coolwsd->run(1, argv);
            delete coolwsd;
        })
        .detach();

    std::cout << "================ main() is returning" << std::endl;
    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab cinoptions=b1,g0,N-s cinkeys+=0=break: */
