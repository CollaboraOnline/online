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
#include "MobileApp.hpp"
#include "Clipboard.hpp"
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
#include "WebView.hpp"

const char* user_name = "Dummy";

const int SHOW_JS_MAXLEN = 300;

int coolwsd_server_socket_fd = -1;
static COOLWSD* coolwsd = nullptr;
static int closeNotificationPipeForForwardingThread[2]{ -1, -1 };

void getClipboard(unsigned appDocId)
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

void setClipboard(unsigned appDocId)
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

void setClipboardFromContent(unsigned appDocId, const std::string& content)
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

void Bridge::evalJS(const std::string& script)
{
    // Ensure execution on GUI thread – queued if needed
    QMetaObject::invokeMethod(
        // TODO: fix needless `this` captures...
        _webView.webEngineView(), [this, script]
        { _webView.webEngineView()->page()->runJavaScript(QString::fromStdString(script)); },
        Qt::QueuedConnection);
}

void Bridge::send2JS(const std::vector<char>& buffer)
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
        int rc = fakeSocketConnect(_document._fakeClientFd, coolwsd_server_socket_fd);
        assert(rc != -1);

        fakeSocketPipe2(closeNotificationPipeForForwardingThread);

        // Thread pumping Online → JS
        std::thread(
            [this]
            {
                Util::setThreadName("app2js");
                while (true)
                {
                    struct pollfd pfd[2];
                    pfd[0].fd = _document._fakeClientFd;
                    pfd[0].events = POLLIN;
                    pfd[1].fd = closeNotificationPipeForForwardingThread[1];
                    pfd[1].events = POLLIN;
                    if (fakeSocketPoll(pfd, 2, -1) > 0)
                    {
                        if (pfd[1].revents & POLLIN)
                        {
                            fakeSocketClose(closeNotificationPipeForForwardingThread[1]);
                            fakeSocketClose(_document._fakeClientFd);
                            return; // document closed
                        }
                        if (pfd[0].revents & POLLIN)
                        {
                            int n = fakeSocketAvailableDataLength(_document._fakeClientFd);
                            if (n == 0)
                                return;
                            std::vector<char> buf(n);
                            fakeSocketRead(_document._fakeClientFd, buf.data(), n);
                            send2JS(buf);
                        }
                    }
                }
            })
            .detach();

        // 1st request: the initial GET /?file_path=...  (mimic WebSocket upgrade)
        std::thread(
            [this]
            {
                struct pollfd p
                {
                };
                p.fd = _document._fakeClientFd;
                p.events = POLLOUT;
                fakeSocketPoll(&p, 1, -1);
                std::string message(_document._fileURL +
                                    (" " + std::to_string(_document._appDocId)));
                fakeSocketWrite(_document._fakeClientFd, message.c_str(), message.size());
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
        getClipboard(_document._appDocId);
    }
    else if (utf8 == "CLIPBOARDREAD")
    {
        // WARN: this is only cargo-culted and not tested yet.
        setClipboard(_document._appDocId);
        return "(internal)";
    }
    else if (utf8.starts_with(CLIPBOARDSET))
    {
        std::string content = utf8.substr(CLIPBOARDSET.size());
        setClipboardFromContent(_document._appDocId, content);
    }
    else
    {
        // Forward arbitrary payload from JS → Online
        std::string copy = utf8; // make lifetime explicit
        std::thread(
            [this, copy]
            {
                struct pollfd p
                {
                };
                p.fd = _document._fakeClientFd;
                p.events = POLLOUT;
                fakeSocketPoll(&p, 1, -1);
                fakeSocketWrite(_document._fakeClientFd, copy.c_str(), copy.size());
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
    if (argc != 3)
    {
        fprintf(stderr, "Usage: %s /path/to/document /path/to/document2\n", argv[0]);
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
            char* argv_local[2] = { strdup("coda"), nullptr };
            coolwsd = new COOLWSD();
            coolwsd->run(1, argv_local);
            delete coolwsd;
            LOG_TRC("One run of COOLWSD completed");
        })
        .detach();

    QApplication app(argc, argv);
    QApplication::setApplicationName("CODA-Q");

    // Resolve absolute file URL to pass into Online
    std::string fileURL = "file://" + FileUtil::realpath(argv[1]);
    WebView firstView(nullptr);
    firstView.load(fileURL);

    fileURL = "file://" + FileUtil::realpath(argv[2]);
    WebView secondView(nullptr);

    // there seems to be some race conditions going on -> need to debug. on top of that the second
    // file only loads properly if the first document is interacted with..
    // could it be some idle logic somewhere?
    QTimer::singleShot(10000, [&]() { secondView.load(fileURL); });

    return app.exec();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
