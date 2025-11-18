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
#include <memory>

#include <QMenuBar>
#include <QMenu>
#include <QAction>
#include <QFileDialog>
#include <QKeySequence>
#include <QGuiApplication>
#include <QScreen>
#include <QTimer>
#include <QWebEngineFullScreenRequest>
#include <QWebEngineSettings>
#include <QFile>
#include <QFileInfo>
#include <QDir>
#include <QApplication>
#include <QUrl>
#include <QCloseEvent>
#include <QMessageBox>
#include <algorithm>
#include <QDBusInterface>
#include <QDBusConnection>
#include <QDBusMessage>
#include <QDBusVariant>
#include <QDBusPendingCallWatcher>
#include <QDBusPendingReply>
#include <QVariant>
#include <QtDBus/QtDBus>

std::vector<WebView*> WebView::s_instances;

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
        // prompt user if document has unsaved changes
        if (owner_->isDocumentModified() || owner_->isPendingSave())
        {
            QMessageBox msgBox(this);
            msgBox.setWindowTitle(QApplication::translate("WebView", "Unsaved Changes"));
            msgBox.setText(QApplication::translate("WebView", "The document has unsaved changes. Do you want to close anyway?"));
            msgBox.setStandardButtons(QMessageBox::Discard | QMessageBox::Cancel);
            msgBox.setDefaultButton(QMessageBox::Cancel);
            msgBox.setIcon(QMessageBox::Warning);

            int ret = msgBox.exec();
            if (ret == QMessageBox::Cancel)
            {
                // user chose not to exit
                ev->ignore();
                return;
            }
        }

        auto const p = owner_;
        owner_ = nullptr;
        assert(p != nullptr);
        delete p;
        QMainWindow::closeEvent(ev);
    }

    WebView * owner_;
};
} // namespace

QWebEngineView* CODAWebEngineView::createWindow(QWebEnginePage::WebWindowType type)
{
    _presenterConsole = new WebView(Application::getProfile(), false);

    QWebEngineView* consoleView = _presenterConsole->webEngineView();

    QWebEnginePage* page = consoleView->page();

    QObject::connect(page, &QWebEnginePage::windowCloseRequested,
                     [this]()
                     {
                        QTimer::singleShot(0, [this]{

                            QScreen* laptopScreen = QGuiApplication::primaryScreen();
                            _mainWindow->showNormal();
                            _mainWindow->setScreen(laptopScreen);
                            _mainWindow->move(laptopScreen->geometry().topLeft());

                            QMainWindow* consoleWindow = _presenterConsole->mainWindow();
                            _presenterConsole = nullptr;
                            consoleWindow->close();
                        });
                     });

    QMainWindow* consoleWindow = _presenterConsole->mainWindow();

    QScreen* laptopScreen = QGuiApplication::primaryScreen();

    /* what we really want to happen by default is for the presenter
     * console to appear on the laptop screen and the presentation
     * on an external monitor. For now we'll assume the presentation
     * is already on the laptopScreen, which is nearly always the laptop,
     * and put the presenter console on the next available screen just
     * to test that we can put it somewhere else at all */
    QScreen* externalScreen = nullptr;
    QList<QScreen*> screens = QApplication::screens();
    for (QScreen* screen : screens)
    {
        if (screen != laptopScreen)
        {
            externalScreen = screen;
            break;
        }
    }

    if (externalScreen)
    {
        consoleWindow->setScreen(laptopScreen);
        consoleWindow->move(laptopScreen->geometry().topLeft());
        consoleWindow->showFullScreen();

        _mainWindow->setScreen(externalScreen);
        _mainWindow->move(externalScreen->geometry().topLeft());
        _mainWindow->showFullScreen();
    }

    return consoleView;
}

void CODAWebEngineView::exchangeMonitors()
{
    if (!_presenterConsole)
        return;

    QList<QScreen*> screens = QApplication::screens();
    if (screens.size() < 2)
        return;

    QMainWindow* consoleWindow = _presenterConsole->mainWindow();

    _mainWindow->showNormal();
    consoleWindow->showNormal();

    size_t origConsoleScreen = 0;
    size_t origPresentationScreen = 0;
    for (size_t i = 0; i < screens.size(); ++i)
    {
        if (screens[i] == consoleWindow->screen())
            origConsoleScreen = i;
        if (screens[i] == _mainWindow->screen())
            origPresentationScreen = i;
    }

    // Rotate the console screen and rotate the presentation screen
    // every time the console catches up to it for the case there
    // are more than two screens. Typically there's just two screens
    // and they just swap.
    size_t newConsoleScreen = (origConsoleScreen + 1) % screens.size();
    size_t newPresentationScreen = origPresentationScreen;
    if (newConsoleScreen == newPresentationScreen)
        newPresentationScreen = (newPresentationScreen + 1) % screens.size();

    consoleWindow->setScreen(screens[newConsoleScreen]);
    consoleWindow->move(screens[newConsoleScreen]->geometry().topLeft());

    _mainWindow->setScreen(screens[newPresentationScreen]);
    _mainWindow->move(screens[newPresentationScreen]->geometry().topLeft());

    _mainWindow->showFullScreen();
    consoleWindow->showFullScreen();
}

WebView::WebView(QWebEngineProfile* profile, bool isWelcome)
    : _mainWindow(new Window(nullptr, this))
    , _webView(std::make_unique<CODAWebEngineView>(_mainWindow))
    , _isWelcome(isWelcome)
    , _bridge(nullptr)
{
    _mainWindow->setCentralWidget(_webView.get());

    QScreen* screen = QGuiApplication::primaryScreen();
    QRect screenGeometry = screen->availableGeometry();

    if (_isWelcome)
    {
        _mainWindow->setWindowFlags(Qt::FramelessWindowHint);
    }
    else
    {
        // Use 1/3 of screen size, but enforce reasonable bounds
        int minWidth = qBound(800, screenGeometry.width() / 3, 1400);
        int minHeight = qBound(600, screenGeometry.height() / 3, 1000);
        _mainWindow->setMinimumSize(minWidth, minHeight);
    }

    QWebEnginePage* page = new QWebEnginePage(profile, _webView.get());
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

    s_instances.push_back(this);
}

WebView::~WebView() {
    std::erase(s_instances, this);

    auto const channel = _webView->page()->webChannel();
    if (_bridge != nullptr) {
        channel->deregisterObject(_bridge);
        delete _bridge;
    }
    _webView->setPage(nullptr);
    delete channel;
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

std::optional<bool> portalPrefersDark() {
    QDBusInterface iface(
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop",
        "org.freedesktop.portal.Settings",
        QDBusConnection::sessionBus()
    );
    if (!iface.isValid()) return std::nullopt;

    QDBusReply<QVariant> reply = iface.call("Read",
        "org.freedesktop.appearance", "color-scheme");
    if (!reply.isValid()) return std::nullopt;

    QVariant v = reply.value();
    if (v.userType() == qMetaTypeId<QDBusVariant>())
        v = qvariant_cast<QDBusVariant>(v).variant();

    bool ok = false;
    const uint code = v.toUInt(&ok);
    if (!ok || code == 0) return std::nullopt;     // 0 = no preference
    if (code == 1) return true;                    // 1 = prefer dark
    if (code == 2) return false;                   // 2 = prefer light
    return std::nullopt;
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
    // query gnome font scaling factor asynchronously and apply it to the web view
    queryGnomeFontScalingUpdateZoom();

    assert(_bridge == nullptr);
    _bridge = new Bridge(channel, _document, _mainWindow, _webView.get());
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

    if (portalPrefersDark())
        urlAndQuery.addQueryParameter("darkTheme", "true");
    if (newFile)
        urlAndQuery.addQueryParameter("isnewdocument", "true");
    if (_isWelcome)
        urlAndQuery.addQueryParameter("welcome", "true");

    const std::string urlAndQueryStr = urlAndQuery.toString();
    LOG_TRC("Open URL: " << urlAndQueryStr);

    Poco::Path uriPath(_document._fileURL.getPath());
    QString fileName = QString::fromStdString(uriPath.getFileName());
    QString applicationTitle = fileName + " - " APP_NAME;
    QApplication::setApplicationName(applicationTitle);
    // set file name in window title
    if (_webView->window())
        _webView->window()->setWindowTitle(applicationTitle);

    _webView->load(QUrl(QString::fromStdString(urlAndQueryStr)));

    auto size = getWindowSize(_isWelcome);
    _mainWindow->resize(size.first, size.second);
    _mainWindow->show();
}

WebView* WebView::createNewDocument(QWebEngineProfile* profile, const std::string& templateType, const std::string& templatePath)
{
    Poco::URI templateURI;
    // if templatePath is empty or the file doesn't exist fileToLoad is mapped to default templateType template
    if (templatePath.empty() || !QFileInfo(QString::fromStdString(templatePath)).exists())
    {
        // Map template type to template filename
        std::string templateFileName = "TextDocument.odt"; // default fallback
        if (templateType == "impress")
            templateFileName = "Presentation.odp";
        else if (templateType == "writer")
            templateFileName = "TextDocument.odt";
        else if (templateType == "calc")
            templateFileName = "Spreadsheet.ods";
        else if (templateType == "draw")
            templateFileName = "Drawing.odg";

        Poco::Path templatePathObj(getTopSrcDir(TOPSRCDIR));
        templatePathObj.append("browser/dist/templates");
        templatePathObj.append(templateFileName);
        templateURI = Poco::URI(templatePathObj);
    }
    else
    {
        templateURI = Poco::URI(Poco::Path(templatePath));
    }

    // Create WebView and load template without a set save location
    WebView* webViewInstance = new WebView(profile, false);
    webViewInstance->load(templateURI, true);

    return webViewInstance;
}

WebView* WebView::findOpenDocument(const Poco::URI& documentURI)
{
    for (WebView* instance : s_instances)
    {
        if (!instance->_document._saveLocationURI.empty() &&
            instance->_document._saveLocationURI.getPath() == documentURI.getPath())
        {
            return instance;
        }
    }
    return nullptr;
}

void WebView::activateWindow()
{
    if (_mainWindow)
    {
        _mainWindow->raise();
        _mainWindow->activateWindow();
    }
}

bool WebView::isDocumentModified() const
{
    return _bridge && _bridge->isModified();
}

bool WebView::isPendingSave() const
{
    return _bridge && _bridge->isPendingSave();
}

void WebView::queryGnomeFontScalingUpdateZoom()
{
    QDBusInterface portalInterface("org.freedesktop.portal.Desktop",
                                   "/org/freedesktop/portal/desktop",
                                   "org.freedesktop.portal.Settings",
                                   QDBusConnection::sessionBus());

    if (!portalInterface.isValid())
        return;

    QDBusPendingCall pendingCall = portalInterface.asyncCall("Read",
                                                              "org.gnome.desktop.interface",
                                                              "text-scaling-factor");

    QDBusPendingCallWatcher* watcher = new QDBusPendingCallWatcher(pendingCall, _webView.get());
    QObject::connect(watcher, &QDBusPendingCallWatcher::finished,
                     [this](QDBusPendingCallWatcher* watcher)
                     {
                         QDBusPendingReply<QVariant> reply = *watcher;
                         watcher->deleteLater();

                         if (reply.isError())
                             return;

                         QVariant result = reply.value();
                         // reply seems to be a (<<scalingFactor>>,)
                         // i.e. a tuple where there's a double nested variant as the first element.
                         if (!result.canConvert<QDBusVariant>())
                             return;

                         QDBusVariant dbusVariant = result.value<QDBusVariant>();
                         QVariant innerVariant = dbusVariant.variant();

                         // unwrap nested QDBusVariant if present
                         if (innerVariant.canConvert<QDBusVariant>())
                         {
                             QDBusVariant innerDbusVariant = innerVariant.value<QDBusVariant>();
                             innerVariant = innerDbusVariant.variant();
                         }

                         bool ok;
                         double factor = innerVariant.toDouble(&ok);
                         if (ok)
                             _webView->setZoomFactor(factor);
                     });
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
