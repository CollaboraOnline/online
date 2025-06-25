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
#include "Clipboard.hpp"
#include "FakeSocket.hpp"
#include "Log.hpp"
#include "MobileApp.hpp"
#include "Protocol.hpp"
#include "Util.hpp"
#include "qt.hpp"

#include <Poco/MemoryStream.h>

#include <QApplication>
#include <QByteArray>
#include <QClipboard>
#include <QFileInfo>
#include <QMainWindow>
#include <QMetaObject>
#include <QMimeData>
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
#include <string_view>
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
unsigned appDocId = 0;

namespace
{

unsigned generateNewAppDocId()
{
    static unsigned appIdCounter = 60407;
    DocumentData::allocate(appIdCounter);
    return appIdCounter++;
}

} // namespace

void getClipboard()
{
    std::unique_ptr<QMimeData> mimeData(new QMimeData());

    lok::Document* loKitDoc = DocumentData::get(appDocId).loKitDocument;
    if (!loKitDoc)
    {
        LOG_DBG("Couldn't get the loKitDocument in getClipboardInternal");
        return;
    }

    const char** mimeTypes = nullptr;
    size_t outCount = 0;
    char** outMimeTypes = nullptr;
    size_t* outSizes = nullptr;
    char** outStreams = nullptr;

    if (!loKitDoc->getClipboard(mimeTypes, &outCount, &outMimeTypes, &outSizes, &outStreams))
    {
        LOG_DBG("Failed to fetch mime-types in getClipboardInternal");
        return;
    }

    if (outCount == 0)
        return;

    for (size_t i = 0; i < outCount; ++i)
    {
        QString mimeType = QString::fromUtf8(outMimeTypes[i]);
        QByteArray byteData(outStreams[i], static_cast<int>(outSizes[i]));

        if (mimeType == "text/plain")
        {
            QString text = QString::fromUtf8(byteData);
            mimeData->setText(text);
        }
        else if (mimeType.startsWith("image/"))
        {
            QImage image;
            image.loadFromData(byteData);
            if (!image.isNull())
                mimeData->setImageData(image);
        }

        // Always include raw data as well
        mimeData->setData(mimeType, byteData);
    }

    // Set the mime data to the system clipboard
    QClipboard* clipboard = QGuiApplication::clipboard();
    clipboard->setMimeData(mimeData.release());
}

void setClipboard()
{
    QClipboard* clipboard = QApplication::clipboard();
    if (!clipboard)
        return;

    const QString qText = clipboard->text(QClipboard::Clipboard);
    if (qText.isEmpty())
        return;

    QByteArray utf8Text = qText.toUtf8();

    const char* mimeTypes[] = { "text/plain;charset=utf-8" };
    const size_t sizes[] = { static_cast<size_t>(utf8Text.size()) };
    const char* streams[] = { utf8Text.constData() };

    DocumentData::get(appDocId).loKitDocument->setClipboard(1, mimeTypes, sizes, streams);
}

void setClipboardFromContent(const std::string& content)
{
    std::vector<const char*> streams;
    std::vector<const char*> mimeTypes;
    std::vector<size_t> sizes;
    ClipboardData data;

    if (content.rfind("<!DOCTYPE html>", 0) == 0) // prefix test
    {
        streams.push_back(content.data());
        mimeTypes.push_back("text/html");
        sizes.push_back(content.length());
    }
    else
    {
        Poco::MemoryInputStream mis(content.data(), content.size());

        data.read(mis); // parses into _content / _mimeTypes

        const size_t n = data.size();
        streams.reserve(n);
        mimeTypes.reserve(n);
        sizes.reserve(n);

        for (size_t i = 0; i < n; ++i)
        {
            streams.push_back(data._content[i].c_str());
            mimeTypes.push_back(data._mimeTypes[i].c_str());
            sizes.push_back(data._content[i].length());
        }
    }

    if (!streams.empty())
    {
        DocumentData::get(appDocId).loKitDocument->setClipboard(streams.size(), mimeTypes.data(),
                                                                sizes.data(), streams.data());
    }
}

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

QVariant Bridge::cool(const QString& msg)
{
    constexpr std::string_view CLIPBOARDSET = "CLIPBOARDSET ";

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
                std::string message(fileURL + (" " + std::to_string(appDocId)));
                fakeSocketWrite(fakeClientFd, message.c_str(), message.size());
            })
            .detach();
    }
    else if (utf8 == "BYE")
    {
        LOG_TRC_NOFILE("Document window terminating on JavaScript side → closing fake socket");
        fakeSocketClose(closeNotificationPipeForForwardingThread[0]);
    }
    else if (utf8 == "CLIPBOARDWRITE")
    {
        getClipboard();
    }
    else if (utf8 == "CLIPBOARDREAD")
    {
        // WARN: this is only cargo-culted and not tested yet.
        setClipboard();
        return "(internal)";
    }
    else if (utf8.starts_with(CLIPBOARDSET))
    {
        std::string content = utf8.substr(CLIPBOARDSET.size());
        setClipboardFromContent(content);
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
    return {};
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

    appDocId = generateNewAppDocId();
    const std::string urlAndQuery = std::string("file://") +
                               TOPSRCDIR "/browser/dist/cool.html" // same HTML frontend
                                         "?file_path=" +
                               fileURL +
                               "&closebutton=1" // mirror original query-params
                               "&permission=edit"
                               "&lang=en-US"
                               "&appdocid=" + std::to_string(appDocId) +
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
