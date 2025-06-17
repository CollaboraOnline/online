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
#include "bridge.hpp"
#include "COOLWSD.hpp"
#include "FakeSocket.hpp"
#include "Log.hpp"
#include "Protocol.hpp"
#include "Util.hpp"
#include "qt.hpp"

#include <QApplication>
#include <QByteArray>
#include <QFileInfo>
#include <QMainWindow>
#include <QMetaObject>
#include <QObject>
#include <QThread>
#include <QTimer>
#include <QUrl>
#include <QWebChannel>
#include <QWebEngineProfile>
#include <QWebEngineView>
#include <cassert>
#include <cstdlib>
#include <cstring>
#include <poll.h>
#include <string>
#include <thread>
#include <vector>

const char* user_name = "Dummy";

const int SHOW_JS_MAXLEN = 300;

int coolwsd_server_socket_fd = -1;
std::string fileURL; // absolute document URL passed to Online
COOLWSD* coolwsd = nullptr;
int fakeClientFd = -1;
int closeNotificationPipeForForwardingThread[2]{ -1, -1 };
QWebEngineView* webView = nullptr;

void evalJS(const std::string& script)
{
    if (!webView)
        return;
    // Ensure execution on GUI thread – queued if needed
    QMetaObject::invokeMethod(
        webView, [script] { webView->page()->runJavaScript(QString::fromStdString(script)); },
        Qt::QueuedConnection);
}

void send2JS(const std::vector<char>& buffer)
{
    LOG_TRC_NOFILE(
        "Send to JS: " << COOLProtocol::getAbbreviatedMessage(buffer.data(), buffer.size()));

    std::string js;
    const char* newline = static_cast<const char*>(memchr(buffer.data(), '\n', buffer.size()));
    if (newline)
    {
        // treat as binary – deliver Base64 ArrayBuffer
        QByteArray base64 = QByteArray(buffer.data(), static_cast<int>(buffer.size())).toBase64();
        js = "window.TheFakeWebSocket.onmessage({data: Base64ToArrayBuffer('" +
             base64.toStdString() + "')});";
    }
    else
    {
        // escape non-printables similar to original implementation
        std::string data;
        data.reserve(buffer.size() * 2);
        static const char hex[] = "0123456789abcdef";
        for (unsigned char ch : buffer)
        {
            if (ch < ' ' || ch >= 0x80 || ch == '\'' || ch == '\\')
            {
                data.push_back('\\');
                data.push_back('x');
                data.push_back(hex[(ch >> 4) & 0xF]);
                data.push_back(hex[ch & 0xF]);
            }
            else
                data.push_back(static_cast<char>(ch));
        }
        js = "window.TheFakeWebSocket.onmessage({data: '" + data + "'});";
    }

    std::string subjs = js.substr(0, std::min<std::string::size_type>(SHOW_JS_MAXLEN, js.length()));
    if (js.length() > SHOW_JS_MAXLEN)
        subjs += "...";
    LOG_TRC_NOFILE("Evaluating JavaScript: " << subjs);

    evalJS(js);
}

void Bridge::debug(const QString& msg) { LOG_TRC_NOFILE("From JS: debug: " << msg.toStdString()); }

void Bridge::error(const QString& msg) { LOG_TRC_NOFILE("From JS: error: " << msg.toStdString()); }

void Bridge::cool(const QString& msg)
{
    const std::string utf8 = msg.toStdString();
    LOG_TRC_NOFILE("From JS: cool: " << utf8);

    if (utf8 == "HULLO")
    {
        // JS side fully initialised – open our fake WebSocket to COOLWSD
        assert(coolwsd_server_socket_fd != -1);
        int rc = fakeSocketConnect(fakeClientFd, coolwsd_server_socket_fd);
        assert(rc != -1);

        fakeSocketPipe2(closeNotificationPipeForForwardingThread);

        // Thread pumping Online → JS
        std::thread(
            []
            {
                Util::setThreadName("app2js");
                while (true)
                {
                    struct pollfd pfd[2];
                    pfd[0].fd = fakeClientFd;
                    pfd[0].events = POLLIN;
                    pfd[1].fd = closeNotificationPipeForForwardingThread[1];
                    pfd[1].events = POLLIN;
                    if (fakeSocketPoll(pfd, 2, -1) > 0)
                    {
                        if (pfd[1].revents & POLLIN)
                        {
                            fakeSocketClose(closeNotificationPipeForForwardingThread[1]);
                            fakeSocketClose(fakeClientFd);
                            return; // document closed
                        }
                        if (pfd[0].revents & POLLIN)
                        {
                            int n = fakeSocketAvailableDataLength(fakeClientFd);
                            if (n == 0)
                                return;
                            std::vector<char> buf(n);
                            fakeSocketRead(fakeClientFd, buf.data(), n);
                            send2JS(buf);
                        }
                    }
                }
            })
            .detach();

        // 1st request: the initial GET /?file_path=...  (mimic WebSocket upgrade)
        std::thread(
            []
            {
                struct pollfd p
                {
                };
                p.fd = fakeClientFd;
                p.events = POLLOUT;
                fakeSocketPoll(&p, 1, -1);
                fakeSocketWrite(fakeClientFd, fileURL.c_str(), fileURL.size());
            })
            .detach();
    }
    else if (utf8 == "BYE")
    {
        LOG_TRC_NOFILE("Document window terminating on JavaScript side → closing fake socket");
        fakeSocketClose(closeNotificationPipeForForwardingThread[0]);
    }
    else
    {
        // Forward arbitrary payload from JS → Online
        std::string copy = utf8; // make lifetime explicit
        std::thread(
            [copy]
            {
                struct pollfd p
                {
                };
                p.fd = fakeClientFd;
                p.events = POLLOUT;
                fakeSocketPoll(&p, 1, -1);
                fakeSocketWrite(fakeClientFd, copy.c_str(), copy.size());
            })
            .detach();
    }
}

Bridge* bridge = nullptr;

// Disable accessibility
void disableA11y() { qputenv("QT_LINUX_ACCESSIBILITY_ALWAYS_ON", "0"); }

int main(int argc, char** argv)
{
    if (argc != 2)
    {
        fprintf(stderr, "Usage: %s /path/to/document\n", argv[0]);
        _exit(1);
    }

    Log::initialize("Mobile", "trace");
    Util::setThreadName("main");

    fakeSocketSetLoggingCallback([](const std::string& line) { LOG_TRC_NOFILE(line); });

    // COOLWSD in a background thread
    std::thread(
        []
        {
            Util::setThreadName("app");
            char* argv_local[2] = { strdup("mobile"), nullptr };
            while (true)
            {
                coolwsd = new COOLWSD();
                coolwsd->run(1, argv_local);
                delete coolwsd;
                LOG_TRC("One run of COOLWSD completed");
            }
        })
        .detach();

    fakeClientFd = fakeSocketSocket();

    disableA11y();

    QApplication app(argc, argv);
    QApplication::setApplicationName("COOLQt");

    QMainWindow mainWin;
    mainWin.resize(720, 1600);

    // WebView + profile
    webView = new QWebEngineView(&mainWin);
    QWebEngineProfile* profile = webView->page()->profile();
    profile->setHttpUserAgent(
        "Mozilla/5.0 (Linux; U; Android 2.3.5; en-us; HTC Vision Build/GRI40) "
        "AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1");

    // WebChannel for JS ⇄ C++ communication
    QWebChannel* channel = new QWebChannel(webView->page());
    bridge = new Bridge(channel);
    channel->registerObject("bridge", bridge);
    webView->page()->setWebChannel(channel);

    mainWin.setCentralWidget(webView);
    mainWin.show();

    // Resolve absolute file URL to pass into Online
    fileURL = "file://" + FileUtil::realpath(argv[1]);

    const std::string urlAndQuery = std::string("file://") +
                               TOPSRCDIR "/browser/dist/cool.html" // same HTML frontend
                                         "?file_path=" +
                               fileURL +
                               "&closebutton=1" // mirror original query-params
                               "&permission=edit"
                               "&lang=en-US"
                               "&userinterfacemode=notebookbar";

    LOG_TRC("Open URL: " << urlAndQuery);
    webView->load(QUrl(QString::fromStdString(urlAndQuery)));

    // Show DevTools after 5 seconds
    QTimer::singleShot(5000,
                       []()
                       {
                           // Create a new view for DevTools
                           QWebEngineView* devToolsView = new QWebEngineView;
                           devToolsView->resize(800, 600);
                           devToolsView->setWindowTitle("DevTools");
                           devToolsView->show();

                           // Set it as the DevTools page for the main web view
                           QWebEnginePage* devToolsPage =
                               new QWebEnginePage(webView->page()->profile());
                           devToolsView->setPage(devToolsPage);
                           webView->page()->setDevToolsPage(devToolsPage);
                       });

    return app.exec();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
