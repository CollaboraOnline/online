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
#include "DetachableTabs.hpp"
#include "Window.hpp"

#include <QWebChannel>
#include <QTabWidget>
#include <QLabel>
#include <QMainWindow>
#include <QPushButton>
#include <QHBoxLayout>
#include <QVBoxLayout>
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
#include <QLabel>
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

void CODAWebEngineView::arrangePresentationWindows()
{
    if (!_presenterFSWindow)
        return;

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

    _presenterFSWindow->hide();
    QScreen* presenterScreen = externalScreen ? externalScreen : laptopScreen;
    _presenterFSWindow->setScreen(presenterScreen);
    _presenterFSWindow->move(presenterScreen->geometry().topLeft());
    _presenterFSWindow->showFullScreen();

    Window* consoleWindow = _presenterConsole ? static_cast<Window*>(_presenterConsole->mainWindow()) : nullptr;
    if (consoleWindow)
    {
        consoleWindow->hide();
        consoleWindow->setScreen(laptopScreen);
        if (externalScreen)
        {
            consoleWindow->move(laptopScreen->geometry().topLeft());
            consoleWindow->showFullScreen();
        }
        else
        {
            consoleWindow->showNormal();
            consoleWindow->resize(consoleWindow->sizeHint());
            consoleWindow->show();
        }
    }
}

void CODAWebEngineView::createPresentationFS()
{
    // Move the contents into the presentation window so the original
    // window will remain in position, so we can work around the
    // stubbornness of wayland to allow restoring a window back to its
    // original size and position on the screen it started on.
    _presenterFSWindow = std::make_unique<QMainWindow>(nullptr);
    _presenterFSWindow->setCentralWidget(this);
    QLabel* label = new QLabel(QObject::tr("Presenting"));
    label->setAlignment(Qt::AlignCenter);
    _mainWindow->setCentralWidget(label);
    _mainWindow->setEnabled(false);

    arrangePresentationWindows();

    _screenRemoved = QObject::connect(Application::getApp(), &QGuiApplication::screenRemoved,
                     [this]() {
                        arrangePresentationWindows();
                     });

    _screenAdded = QObject::connect(Application::getApp(), &QGuiApplication::screenAdded,
                     [this]() {
                        arrangePresentationWindows();
                     });
}

void CODAWebEngineView::destroyPresentationFS()
{
    if (_presenterFSWindow)
    {
        _mainWindow->setCentralWidget(this);
        _presenterFSWindow->setCentralWidget(nullptr);

        _presenterFSWindow->close();
        _presenterFSWindow.reset();

        _mainWindow->setEnabled(true);
    }
}

QWebEngineView* CODAWebEngineView::createWindow(QWebEnginePage::WebWindowType type)
{
    _presenterConsole = new WebView(Application::getProfile(), false);

    QWebEngineView* consoleView = _presenterConsole->webEngineView();
    QWebEnginePage* page = consoleView->page();
    QObject::connect(page, &QWebEnginePage::windowCloseRequested,
                     [this]() {
                         if (!_presenterConsole)
                             return;
                         QMainWindow* consoleWindow = _presenterConsole->mainWindow();
                         consoleWindow->close();
                     });

    Window* consoleWindow = static_cast<Window*>(_presenterConsole->mainWindow());
    consoleWindow->setCloseCallback(
                     [this]() {
                         _presenterConsole = nullptr;

                         destroyPresentationFS();
                     });

    createPresentationFS();

    return consoleView;
}

void CODAWebEngineView::exchangeMonitors()
{
    if (!_presenterFSWindow)
        return;

    QList<QScreen*> screens = QApplication::screens();
    if (screens.size() < 2)
        return;

    QMainWindow* consoleWindow = _presenterConsole ? _presenterConsole->mainWindow() : nullptr;

    size_t origConsoleScreen = 0;
    size_t origPresentationScreen = 0;
    for (size_t i = 0; i < screens.size(); ++i)
    {
        if (consoleWindow && screens[i] == consoleWindow->screen())
            origConsoleScreen = i;
        if (screens[i] == _presenterFSWindow->screen())
            origPresentationScreen = i;
    }

    _presenterFSWindow->hide();

    size_t newPresentationScreen = origPresentationScreen;

    if (consoleWindow)
    {
        consoleWindow->hide();

        // Rotate the console screen and rotate the presentation screen
        // every time the console catches up to it for the case there
        // are more than two screens. Typically there's just two screens
        // and they just swap.
        size_t newConsoleScreen = (origConsoleScreen + 1) % screens.size();
        if (newConsoleScreen == newPresentationScreen)
            newPresentationScreen = (newPresentationScreen + 1) % screens.size();

        consoleWindow->setScreen(screens[newConsoleScreen]);
        consoleWindow->move(screens[newConsoleScreen]->geometry().topLeft());
    }
    else
    {
        newPresentationScreen = (newPresentationScreen + 1) % screens.size();
    }

    _presenterFSWindow->setScreen(screens[newPresentationScreen]);
    _presenterFSWindow->move(screens[newPresentationScreen]->geometry().topLeft());

    _presenterFSWindow->showFullScreen();
    _presenterFSWindow->show();

    if (consoleWindow)
    {
        consoleWindow->showFullScreen();
        consoleWindow->show();
    }
}

CODAWebEngineView::~CODAWebEngineView()
{
    if (_screenAdded)
        QObject::disconnect(_screenAdded);
    if (_screenRemoved)
        QObject::disconnect(_screenRemoved);
}

// Shared main window and tab widget (lazily created).
static QMainWindow* s_mainWindow = nullptr;

WebView::WebView(QWebEngineProfile* profile, bool isWelcome, Window* targetWindow)
    :_webView(nullptr)
    , _isWelcome(isWelcome)
    , _bridge(nullptr)
{
    QScreen* screen = QGuiApplication::primaryScreen();
    QRect screenGeometry = screen->availableGeometry();
    // If a target window was provided explicitly, use it. Otherwise prefer
    // the currently active `Window` (so new/open operations default to
    // opening a tab in the current window). If `profile` is null we treat
    // this as a special case and force creation of a new top-level window
    // (this preserves the previous detach/new-window behavior used by
    // the drag/detach code which passes nullptr profile).
    bool forceNewWindow = (profile == nullptr);
    if (targetWindow)
    {
        _mainWindow = targetWindow;
    }
    else if (!forceNewWindow)
    {
        _mainWindow = qobject_cast<Window*>(QApplication::activeWindow());
    }

    bool createdWindow = false;
    if (!_mainWindow)
    {
        _mainWindow = new Window(nullptr, this);
        createdWindow = true;
    }

    // Record whether we created the window so callers (load) can avoid
    // resizing an existing application window when adding a tab.
    _createdWindow = createdWindow;

    if (createdWindow)
    {
        if (isWelcome)
            _mainWindow->setWindowFlags(Qt::FramelessWindowHint);
        else
        {
            int minWidth = qBound(800, screenGeometry.width() / 3, 1400);
            int minHeight = qBound(600, screenGeometry.height() / 3, 1000);
            _mainWindow->setMinimumSize(minWidth, minHeight);
        }
    }

    Window *mainWindow = _mainWindow;

    // Determine or create a DetachableTabWidget for hosting tabs.
    DetachableTabWidget* tabWidget = qobject_cast<DetachableTabWidget*>(_mainWindow->centralWidget());
    if (!tabWidget)
    {
        // If we created the window, set up a new DetachableTabWidget and
        // connect the signals. If we're reusing an existing window without
        // a suitable central widget, create one here as well.
        tabWidget = new DetachableTabWidget(_mainWindow);
        QObject::connect(tabWidget, &DetachableTabWidget::plusButtonClicked, _mainWindow, &Window::plusClicked);

        QObject::connect(tabWidget, &QTabWidget::tabCloseRequested,
                         [tabWidget, mainWindow](int index)
                         {
                             if (!tabWidget)
                                 return;

                             QWidget* w = tabWidget->widget(index);
                             if (!w)
                                 return;
                             quint64 ownerPtr = w->property("webview_owner").toULongLong();
                             WebView* owner = reinterpret_cast<WebView*>((quintptr)ownerPtr);
                             bool okToClose = true;
                             if (owner)
                             {
                                 okToClose = owner->confirmClose();
                             }
                             if (!okToClose)
                             {
                                 return; // user cancelled
                             }

                             if (owner)
                                 owner->prepareForClose();

                             tabWidget->removeTab(index);
                             if (w)
                                 w->deleteLater();
                             tabWidget->updateTabBarVisibility();

                             if (tabWidget->count() == 0)
                             {
                                 if (mainWindow)
                                     mainWindow->close();
                                 else
                                     QApplication::quit();
                             }
                         });

        QObject::connect(tabWidget, QOverload<int>::of(&QTabWidget::currentChanged),
                        [tabWidget, mainWindow](int index)
                        {
                            if (!mainWindow || !tabWidget || index < 0)
                                return;
                            QString tabTitle = tabWidget->tabText(index);
                            mainWindow->setWindowTitle(tabTitle + " - " APP_NAME);
                        });

        _mainWindow->setCentralWidget(tabWidget);
        tabWidget->updateTabBarVisibility();
        if (createdWindow)
            _mainWindow->show();
    }

    _webView = std::make_unique<CODAWebEngineView>(s_mainWindow);
    // tag the QWebEngineView with a pointer back to this WebView so tab
    // close handlers can find the owning WebView instance
    _webView->setProperty("webview_owner", (qulonglong) reinterpret_cast<quintptr>(this));
    // Add a placeholder tab; the label will be updated in load().
    int tabIndex = tabWidget->addTab(_webView.get(), QObject::tr("Document"));
    // Bring the new tab into focus
    tabWidget->setCurrentIndex(tabIndex);
    tabWidget->updateTabBarVisibility();


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

WebView::~WebView()
{
    std::erase(s_instances, this);

    // Let Qt handle deletion of _webView and its page and _bridge
}

void WebView::prepareForClose()
{
    // If there's a bridge and a live web view, deregister the bridge from
    // the QWebChannel so the JavaScript side won't attempt to call into
    // deleted C++ objects. Then clear the bridge's webview pointer and
    // delete the bridge.
    if (_bridge && _webView)
    {
        QWebEnginePage* p = _webView->page();
        if (p)
        {
            QWebChannel* ch = p->webChannel();
            if (ch)
                ch->deregisterObject(_bridge);
        }
        _bridge->clearWebView();
        delete _bridge;
        _bridge = nullptr;
    }
}

bool WebView::confirmClose()
{
    return confirmClose(QString());
}

bool WebView::confirmClose(const QString& documentName)
{
    // If there's no bridge or we don't know of modifications, allow close
    if (!_bridge)
        return true;

    if (!_bridge->isModified())
        return true;

    QString message;
    if (documentName.isEmpty()) {
        message = QObject::tr("The document has unsaved changes. Do you want to save them?");
    } else {
        message = QObject::tr("The document \"%1\" has unsaved changes. Do you want to save them?").arg(documentName);
    }

    const QMessageBox::StandardButton choice = QMessageBox::warning(
        _webView.get(), QObject::tr("Save Document"),
        message,
        QMessageBox::Save | QMessageBox::Discard | QMessageBox::Cancel);

    if (choice == QMessageBox::Save)
    {
        // Ask bridge to run Save As flow
        bool saved = _bridge->promptSaveAs();
        return saved;
    }
    if (choice == QMessageBox::Discard)
        return true;
    return false; // Cancel
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

void WebView::load(const Poco::URI& fileURL, bool newFile, bool isStarterMode)
{
    if (isStarterMode)
    {
        // Starter screen mode: no COOLWSD connection needed
        _document = {
            ._fakeClientFd = -1,
            ._appDocId = 0,
        };
    }
    else
    {
        // Normal document mode
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
    }

    // setup js <-> c++ communication
    QWebChannel* channel = new QWebChannel(_webView->page());
    // query gnome font scaling factor asynchronously and apply it to the web view
    queryGnomeFontScalingUpdateZoom();

    assert(_bridge == nullptr);
    _bridge = new Bridge(channel, _document, _mainWindow, _webView.get());
    // Set the WebView as parent so the Bridge is deleted when the WebView is deleted
    _bridge->setParent(_webView.get());
    // Update the tab widget when the document modified state changes
    QObject::connect(_bridge, &Bridge::modifiedChanged,
                     [this](bool modified)
                     {
                         if (!_webView)
                             return;
                         QWidget* p = _webView->parentWidget();
                         QTabWidget* tabWidget = nullptr;
                         while (p)
                         {
                             tabWidget = qobject_cast<QTabWidget*>(p);
                             if (tabWidget)
                                 break;
                             p = p->parentWidget();
                         }
                         if (!tabWidget)
                             return;
                         const int index = tabWidget->indexOf(_webView.get());
                         if (index == -1)
                             return;
                         QString title = tabWidget->tabText(index);
                         // Remove any existing modified prefix
                         if (title.startsWith("* "))
                             title = title.mid(2);
                         if (modified)
                             tabWidget->setTabText(index, QStringLiteral("* ") + title);
                         else
                             tabWidget->setTabText(index, title);
                        // If this webview's tab is the currently visible tab,
                        // also update the top-level window title so detached
                        // windows (or any window hosting this tab) reflect
                        // changes such as the modified-state prefix.
                        if (_mainWindow && tabWidget->currentIndex() == index)
                        {
                            _mainWindow->setWindowTitle(tabWidget->tabText(index) + " - " APP_NAME);
                        }
                     });
    channel->registerObject("bridge", _bridge);
    _webView->page()->setWebChannel(channel);

    Poco::Path coolHtmlPath(getTopSrcDir(TOPSRCDIR));
    coolHtmlPath.append("/browser/dist/cool.html");
    Poco::URI urlAndQuery(coolHtmlPath);
    urlAndQuery.setScheme("file");

    if (isStarterMode)
    {
        urlAndQuery.addQueryParameter("starterMode", "true");
    }
    else
    {
        urlAndQuery.addQueryParameter("file_path", _document._fileURL.toString());
        urlAndQuery.addQueryParameter("permission", "edit");
        urlAndQuery.addQueryParameter("lang", getUILanguage());
        urlAndQuery.addQueryParameter("appdocid", std::to_string(_document._appDocId));
        urlAndQuery.addQueryParameter("userinterfacemode", "notebookbar");
    }

    if (portalPrefersDark())
        urlAndQuery.addQueryParameter("darkTheme", "true");

    if (!isStarterMode)
    {
        if (newFile)
            urlAndQuery.addQueryParameter("isnewdocument", "true");
        if (_isWelcome)
            urlAndQuery.addQueryParameter("welcome", "true");
    }

    const std::string urlAndQueryStr = urlAndQuery.toString();
    LOG_TRC("Open URL: " << urlAndQueryStr);

    // Set window title
    QString applicationTitle;
    Poco::Path uriPath(_document._fileURL.getPath());
    QString fileName = QString::fromStdString(uriPath.getFileName());
    if (isStarterMode)
    {
        applicationTitle = QString(APP_NAME) + " - Start";
    }
    else
    {
        applicationTitle = fileName + " - " APP_NAME;
    }
    QApplication::setApplicationName(applicationTitle);
    if (_webView->window())
        _webView->window()->setWindowTitle(applicationTitle);

    _webView->load(QUrl(QString::fromStdString(urlAndQueryStr)));

    QWidget* p = _webView->parentWidget();
    QTabWidget* tabWidget = nullptr;
    while (p) {
        tabWidget = qobject_cast<QTabWidget*>(p);
        if (tabWidget)
            break;
        p = p->parentWidget();
    }
    if (tabWidget) {
        const int index = tabWidget->indexOf(_webView.get());
        if (index != -1) {
            QString label = fileName.isEmpty() ? QObject::tr("Document") : fileName;
            if (_bridge && _bridge->isModified())
                label = QStringLiteral("* ") + label;
            tabWidget->setTabText(index, label);
        }
    }

    auto size = getWindowSize(_isWelcome || isStarterMode);
    // If this WebView created its own window, apply sizing and show it.
    if (_mainWindow && _createdWindow)
    {
        // TODO: Starter screen uses 1.5x welcome dimensions (width and height) as a temporary
        // solution. This should be refined with proper sizing logic based on user feedback.
        if (isStarterMode) {
            size.first = 1.5 * size.first;
            size.second = 1.5 * size.second;
        }

        _mainWindow->resize(size.first, size.second);
        _mainWindow->show();
    }
    else if (_mainWindow)
    {
        // We are reusing an existing window (adding a tab): update the
        // main window title to reflect the current tab without resizing.
        QWidget* p = _webView->parentWidget();
        QTabWidget* tabWidget = nullptr;
        while (p)
        {
            tabWidget = qobject_cast<QTabWidget*>(p);
            if (tabWidget)
                break;
            p = p->parentWidget();
        }
        if (tabWidget)
        {
            const QString title = QString::fromStdString(Poco::Path(_document._fileURL.getPath()).getFileName());
            const int index = tabWidget->indexOf(_webView.get());
            if (index != -1)
            {
                QString label = title.isEmpty() ? QObject::tr("Document") : title;
                if (_bridge && _bridge->isModified())
                    label = QStringLiteral("* ") + label;
                tabWidget->setTabText(index, label);
                _mainWindow->setWindowTitle(tabWidget->tabText(index) + " - " APP_NAME);
            }
        }
    }
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

    // Add the new document as a tab in the currently active Window.
    Window* activeWindow = qobject_cast<Window*>(QApplication::activeWindow());
    WebView* webViewInstance = new WebView(profile, false, activeWindow);
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

WebView* WebView::findStarterScreen()
{
    for (WebView* instance : s_instances)
    {
        if (instance->isStarterScreen())
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

void WebView::runJS(const QString& jsCode)
{
    if (_bridge)
    {
        _bridge->evalJS(jsCode.toStdString());
    }
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
