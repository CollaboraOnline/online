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
#include "FileUtil.hpp"
#include "Log.hpp"
#include "qt.hpp"
#include <Poco/URI.h>
#include <Poco/Path.h>

#include <cassert>
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
#include <QFile>
#include <QFileInfo>
#include <QDir>
#include <QApplication>

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

class Window: public QMainWindow {
public:
    Window(QWidget * parent, WebView * owner): QMainWindow(parent), owner_(owner) {}

private:
    void closeEvent(QCloseEvent * ev) override {
        auto const p = owner_;
        owner_ = nullptr;
        assert(p != nullptr);
        delete p;
        QMainWindow::closeEvent(ev);
    }

    WebView * owner_;
};
} // namespace

WebView::WebView(QWidget* parent, QWebEngineProfile* profile, bool isWelcome)
    : _mainWindow(new Window(parent, this))
    , _webView(new QWebEngineView(_mainWindow))
    , _isWelcome(isWelcome)
    , _bridge(nullptr)
{
    _mainWindow->setCentralWidget(_webView);

    if (isWelcome)
        _mainWindow->setWindowFlags(Qt::FramelessWindowHint);

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

WebView::~WebView() {
    if (_bridge != nullptr) {
        _webView->page()->webChannel()->deregisterObject(_bridge);
        delete _bridge;
    }
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

void WebView::load(const Poco::URI& fileURL, bool newFile)
{
    _document = {
        ._fakeClientFd = fakeSocketSocket(),
        ._appDocId = generateNewAppDocId(),
    };

    // operate on a temp copy of the file
    if (!_isWelcome && fileURL.getScheme() == "file")
    {
        try
        {
            Poco::Path originalPath(fileURL.getPath());
            if (!newFile)
            {
                _document._saveLocationURI = fileURL;
            }

            const std::string tempDirectoryPath = FileUtil::createRandomTmpDir();
            const std::string& fileName = originalPath.getFileName();

            Poco::Path tempFilePath(tempDirectoryPath, fileName);
            const std::string tempFilePathStr = tempFilePath.toString();
            if (!FileUtil::copyAtomic(originalPath.toString(), tempFilePath.toString(), false))
            {
                LOG_ERR("Failed to copy file to temporary location: " << tempFilePath.toString());
                return;
            }

            _document._fileURL = Poco::URI(tempFilePath);
        }
        catch (const std::exception& e)
        {
            LOG_ERR("Exception while copying file to temp: " << e.what());
            return;
        }
    }
    else
    {
        // For welcome-slideshow use original URL directly
        _document._saveLocationURI = fileURL;
        _document._fileURL = fileURL;
    }

    // setup js c++ communication
    QWebChannel* channel = new QWebChannel(_webView->page());

    assert(_bridge == nullptr);
    _bridge = new Bridge(channel, _document, _webView);
    channel->registerObject("bridge", _bridge);
    _webView->page()->setWebChannel(channel);

    Poco::Path coolHtmlPath(getTopSrcDir(TOPSRCDIR));
    coolHtmlPath.append("/browser/dist/cool.html");
    Poco::URI urlAndQuery(coolHtmlPath);
    urlAndQuery.setScheme("file");
    urlAndQuery.addQueryParameter("file_path", _document._fileURL.toString());
    urlAndQuery.addQueryParameter("permission", "edit");
    urlAndQuery.addQueryParameter("lang", getUILanguage());
    urlAndQuery.addQueryParameter("appdocid", std::to_string(_document._appDocId));
    urlAndQuery.addQueryParameter("userinterfacemode", "notebookbar");
    if (_isWelcome)
        urlAndQuery.addQueryParameter("welcome", "true");

    const std::string urlAndQueryStr = urlAndQuery.toString();
    LOG_TRC("Open URL: " << urlAndQueryStr);
    Poco::Path uriPath(_document._fileURL.getPath());
    QApplication::setApplicationName(QString::fromStdString(uriPath.getFileName()) + " - " APP_NAME);
    _webView->load(QUrl(QString::fromStdString(urlAndQueryStr)));

    auto size = getWindowSize(_isWelcome);
    _mainWindow->resize(size.first, size.second);
    _mainWindow->show();
}

WebView* WebView::createNewDocument(QWidget* parent, QWebEngineProfile* profile, const std::string& templateType)
{
    // Map template type to template filename
    std::string templateFileName;
    if (templateType == "odp")
    {
        templateFileName = "Presentation.odp";
    }
    else if (templateType == "odt")
    {
        templateFileName = "Text Document.odt";
    }
    else if (templateType == "ods")
    {
        templateFileName = "Spreadsheet.ods";
    }
    else
    {
        LOG_ERR("Unknown template type: " << templateType);
        return nullptr;
    }

    // TODO: get rid of the hardcoded template path, preferably it should be somewhere under the browser/dist/...
    const std::string templatePath = getTopSrcDir(TOPSRCDIR) + "/windows/coda/templates/" + templateFileName;

    struct stat st;
    if (FileUtil::getStatOfFile(templatePath, st) != 0)
    {
        LOG_ERR("Template file not found: " << templatePath);
        return nullptr;
    }

    // Create WebView and load template without save location
    WebView* webViewInstance = new WebView(parent, profile, false);
    Poco::URI templateURI{Poco::Path(templatePath)};
    webViewInstance->load(templateURI, true);

    return webViewInstance;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
