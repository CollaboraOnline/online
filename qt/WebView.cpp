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

#include "WebView.hpp"
#include "bridge.hpp"
#include <QWebChannel>
#include <QMainWindow>
#include "FakeSocket.hpp"
#include "MobileApp.hpp"
#include <cstdlib>
#include <cstring>

#include <QMenuBar>
#include <QMenu>
#include <QAction>
#include <QFileDialog>
#include <QKeySequence>

namespace
{
unsigned generateNewAppDocId()
{
    static unsigned appIdCounter = 60407;
    DocumentData::allocate(appIdCounter);
    return appIdCounter++;
}

std::string getTopSrcDir(const std::string& defaultPath)
{
    const char* envPath = std::getenv("COOL_TOPSRCDIR");
    if (envPath && std::strlen(envPath) > 0)
    {
        return std::string(envPath);
    }
    return defaultPath;
}
std::string getUILanguage()
{
    const char* envVars[] = {"LC_ALL", "LC_MESSAGES", "LANGUAGE", "LANG"};
    std::string lang;

    // 1. Check environment variables in precedence order
    for (const char* var : envVars) {
        const char* val = std::getenv(var);
        if (val && *val) {
            lang = val;
            if (std::string(var) == "LANGUAGE") {
                // LANGUAGE can be a colon-separated list, take the first
                std::size_t pos = lang.find(':');
                if (pos != std::string::npos)
                    lang = lang.substr(0, pos);
            }
            break;
        }
    }

    // 2. Replace '_' with '-'
    for (char& c : lang)
        if (c == '_')
            c = '-';

    // 3. Strip encoding suffix (e.g. ".UTF-8", ".ISO8859-2")
    if (auto dot = lang.find('.'); dot != std::string::npos)
        lang.erase(dot);

    // 4. Now check for empty or C/POSIX-like locales
    if (lang.empty() || lang == "C" || lang == "POSIX")
        lang = "en-US";

    return lang;
}
} // namespace

WebView::WebView(QWidget* parent)
    : _mainWindow(new QMainWindow(parent))
    , _webView(new QWebEngineView(_mainWindow))
{
    _mainWindow->setCentralWidget(_webView);

    QWebEngineProfile* profile = new QWebEngineProfile(QStringLiteral("PersistentProfile"), _mainWindow);

    // use XDG-compliant paths
    QString appData =
        QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QString cacheData =
        QStandardPaths::writableLocation(QStandardPaths::CacheLocation);
    QString storagePath = appData + "/PersistentProfile/storage";
    QDir().mkpath(storagePath);
    QDir().mkpath(cacheData);

    profile->setPersistentStoragePath(storagePath);
    profile->setCachePath(cacheData);
    profile->setHttpCacheType(QWebEngineProfile::DiskHttpCache);

    QWebEnginePage* page = new QWebEnginePage(profile, _webView);
    _webView->setPage(page);
}

void WebView::load(const std::string& fileURL)
{
    _document = {
        ._fileURL = fileURL,
        ._fakeClientFd = fakeSocketSocket(),
        ._appDocId = generateNewAppDocId(),
    };

    // setup js c++ communication
    QWebChannel* channel = new QWebChannel(_webView->page());
    auto bridge = new Bridge(channel, _document, _webView);
    channel->registerObject("bridge", bridge);
    _webView->page()->setWebChannel(channel);

    const std::string urlAndQuery = std::string("file://") + getTopSrcDir(TOPSRCDIR) +
                                    "/browser/dist/cool.html"
                                    "?file_path=" +
                                    _document._fileURL +
                                    "&permission=edit"
                                    "&lang=" +
                                    getUILanguage() +
                                    "&appdocid=" +
                                    std::to_string(_document._appDocId) +
                                    "&userinterfacemode=notebookbar";

    LOG_TRC("Open URL: " << urlAndQuery);
    _webView->load(QUrl(QString::fromStdString(urlAndQuery)));

    _mainWindow->resize(1600, 900);
    _mainWindow->show();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
