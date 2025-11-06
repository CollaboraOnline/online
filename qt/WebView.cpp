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
#include "qt.hpp"

#include <cstdlib>
#include <cstring>

#include <QMenuBar>
#include <QMenu>
#include <QAction>
#include <QFileDialog>
#include <QKeySequence>
#include <QGuiApplication>
#include <QScreen>
#include <QWebEngineFullScreenRequest>
#include <QWebEngineSettings>

namespace
{
unsigned generateNewAppDocId()
{
    static unsigned appIdCounter = 60407;
    DocumentData::allocate(appIdCounter);
    return appIdCounter++;
}

std::string getUILanguage()
{
    const char* envVars[] = {"LC_ALL", "LC_MESSAGES", "LANG", "LANGUAGE"};
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

WebView::WebView(QWidget* parent, QWebEngineProfile* profile, bool isWelcome)
    : _mainWindow(new QMainWindow(parent))
    , _webView(new QWebEngineView(_mainWindow))
    , _isWelcome(isWelcome)
{
    _mainWindow->setCentralWidget(_webView);

    QWebEnginePage* page = new QWebEnginePage(profile, _webView);
    _webView->setPage(page);

    page->settings()->setAttribute(QWebEngineSettings::FullScreenSupportEnabled, true);

    QObject::connect(page, &QWebEnginePage::fullScreenRequested,
                     [this](QWebEngineFullScreenRequest request)
                     {
                         if (request.toggleOn())
                             _mainWindow->showFullScreen();
                         else
                             _mainWindow->showNormal();
                         request.accept();
                     });
}

std::pair<int, int> getWindowSize(bool isWelcome)
{
    QScreen* screen = QGuiApplication::primaryScreen();
    const int viewportWidth = screen->availableGeometry().width();
    const int viewportHeight = screen->availableGeometry().height();

    if (!isWelcome)
        return { viewportWidth, viewportHeight };

    const int maxWidth = 1280;
    const int maxHeight = 720;
    const int minWidth = 800;
    const int minHeight = 450;

    int width = static_cast<int>(std::floor(viewportWidth * 0.4));
    int height = static_cast<int>(std::floor((width * 9.0) / 16.0));

    width = std::min(std::max(width, minWidth), maxWidth);
    height = std::min(std::max(height, minHeight), maxHeight);

    return { width, height };
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
    QSvgWidget* loadingOverlay = nullptr;
    if (_isWelcome)
    {
        const std::string svgPath = getTopSrcDir(TOPSRCDIR) + "/browser/dist/welcome/welcome.svg";
        loadingOverlay = new QSvgWidget(QString::fromStdString(svgPath), _webView);
    }

    auto bridge = new Bridge(channel, _document, _webView, loadingOverlay);
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
                                    "&userinterfacemode=notebookbar" +
                                    (_isWelcome ? "&welcome=true" : "");

    LOG_TRC("Open URL: " << urlAndQuery);
    _webView->load(QUrl(QString::fromStdString(urlAndQuery)));

    auto size = getWindowSize(_isWelcome);
    if (_isWelcome && loadingOverlay)
    {
        loadingOverlay->resize(size.first, size.second);
        loadingOverlay->setStyleSheet("background-color: white;");
        loadingOverlay->raise();
        loadingOverlay->show();
    }
    _mainWindow->resize(size.first, size.second);
    _mainWindow->show();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
