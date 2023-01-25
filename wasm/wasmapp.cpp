/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "wasmapp.hpp"

#include "base64.hpp"

int coolwsd_server_socket_fd = -1;

const char* user_name;
const int SHOW_JS_MAXLEN = 200;

static std::string fileURL = "file:///sample.docx";
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
        const unsigned char *ubufp = (const unsigned char *)buffer.data();
        std::vector<char> data;
        for (size_t i = 0; i < buffer.size(); i++)
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

        js = "window.TheFakeWebSocket.onmessage({'data': '";
        js = js + std::string(data.data(), data.size());
        js = js + "'});";
    }

    std::string subjs = js.substr(0, std::min(std::string::size_type(SHOW_JS_MAXLEN), js.length()));
    if (js.length() > SHOW_JS_MAXLEN)
        subjs += "...";

    LOG_TRC_NOFILE( "Evaluating JavaScript: " << subjs);

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

int main(int, char*[])
{
    std::cout << "================ Here is main()" << std::endl;

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
    std::thread([&]
                {
                    coolwsd = new COOLWSD();
                    coolwsd->run(1, argv);
                    delete coolwsd;
                }).detach();

    std::cout << "================ main() is returning" << std::endl;
    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab cinoptions=b1,g0,N-s cinkeys+=0=break: */
