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
    void setCloseCallback(const std::function<void()>& closeCallback)
    {
        closeCallback_ = closeCallback;
    }

private:
    void closeEvent(QCloseEvent * ev) override {
        if (closeCallback_)
            closeCallback_();

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
    std::function<void()> closeCallback_;
};
} // namespace

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

WebView::WebView(QWebEngineProfile* profile, bool isWelcome)
    :_webView(nullptr)
    , _isWelcome(isWelcome)
    , _bridge(nullptr)
{
    QScreen* screen = QGuiApplication::primaryScreen();
    QRect screenGeometry = screen->availableGeometry();

    static QTabWidget* s_tabWidget = nullptr;
    if (!s_mainWindow)
    {
        s_mainWindow = new QMainWindow(nullptr);
        s_tabWidget = new QTabWidget(s_mainWindow);
        s_tabWidget->setTabsClosable(true);
        s_tabWidget->setMovable(true);

        // Add a "+" button to create new documents
        QPushButton* newTabButton = new QPushButton("+");
        newTabButton->setMaximumWidth(30);
        // Place the button in a corner widget with a right-aligned layout
        QWidget* cornerWidget = new QWidget(s_tabWidget);
        QHBoxLayout* cornerLayout = new QHBoxLayout(cornerWidget);
        cornerLayout->setContentsMargins(0, 0, 0, 0);
        cornerLayout->addStretch();
        cornerLayout->addWidget(newTabButton);
        s_tabWidget->setCornerWidget(cornerWidget, Qt::TopRightCorner);

        // Capture a local automatic pointer so the lambda can use it
        // safely (capturing the static local s_tabWidget directly is not
        // allowed by the language).
        QTabWidget* tabPtr = s_tabWidget;
        QMainWindow* mainPtr = s_mainWindow;

        QObject::connect(newTabButton, &QPushButton::clicked,
                         [tabPtr]()
                         {
                             if (!tabPtr)
                                 return;
                             // Show a dialog to select document type
                             QDialog dialog(tabPtr);
                             dialog.setWindowTitle(QObject::tr("New Document"));
                             dialog.setModal(true);
                             dialog.setMinimumWidth(300);

                             QVBoxLayout* layout = new QVBoxLayout(&dialog);
                             QLabel* label = new QLabel(QObject::tr("Select document type:"));
                             layout->addWidget(label);

                             QPushButton* textBtn = new QPushButton(QObject::tr("Text Document"));
                             QPushButton* sheetBtn = new QPushButton(QObject::tr("Spreadsheet"));
                             QPushButton* slideBtn = new QPushButton(QObject::tr("Presentation"));
                             layout->addWidget(textBtn);
                             layout->addWidget(sheetBtn);
                             layout->addWidget(slideBtn);

                             QObject::connect(textBtn, &QPushButton::clicked,
                                              [&dialog]()
                                              {
                                                  dialog.setProperty("docType", "writer");
                                                  dialog.accept();
                                              });
                             QObject::connect(sheetBtn, &QPushButton::clicked,
                                              [&dialog]()
                                              {
                                                  dialog.setProperty("docType", "calc");
                                                  dialog.accept();
                                              });
                             QObject::connect(slideBtn, &QPushButton::clicked,
                                              [&dialog]()
                                              {
                                                  dialog.setProperty("docType", "impress");
                                                  dialog.accept();
                                              });

                             if (dialog.exec() == QDialog::Accepted)
                             {
                                 QString docType = dialog.property("docType").toString();
                                 if (!docType.isEmpty())
                                 {
                                     WebView* webViewInstance = WebView::createNewDocument(
                                         Application::getProfile(), docType.toStdString());
                                     if (!webViewInstance)
                                     {
                                         LOG_ERR("Failed to create new document of type: "
                                                 << docType.toStdString());
                                     }
                                 }
                             }
                         });

        QObject::connect(s_tabWidget, &QTabWidget::tabCloseRequested,
                         [tabPtr, mainPtr](int index)
                         {
                             if (!tabPtr)
                                 return;
                             QWidget* w = tabPtr->widget(index);
                             if (!w)
                                 return;
                             // Attempt to find the owning WebView and ask it to
                             // confirm close (prompt save if necessary).
                             quint64 ownerPtr = w->property("webview_owner").toULongLong();
                             WebView* owner = reinterpret_cast<WebView*>((quintptr)ownerPtr);
                             bool okToClose = true;
                             if (owner)
                             {
                                 okToClose = owner->confirmClose();
                             }
                             if (!okToClose)
                                 return; // user cancelled

                             tabPtr->removeTab(index);
                             if (w)
                                 w->deleteLater();

                             // If that was the last tab, quit the application
                             if (tabPtr->count() == 0)
                             {
                                 if (mainPtr)
                                     mainPtr->close();
                                 else
                                     QApplication::quit();
                             }
                         });
        // Update main window title when tab changes
        QObject::connect(s_tabWidget, QOverload<int>::of(&QTabWidget::currentChanged),
                         [tabPtr, mainPtr](int index)
                         {
                             if (!mainPtr || !tabPtr || index < 0)
                                 return;
                             QString tabTitle = tabPtr->tabText(index);
                             mainPtr->setWindowTitle(tabTitle + " - " APP_NAME);
                         });
        s_mainWindow->setCentralWidget(s_tabWidget);
        s_mainWindow->resize(1024, 768);
        s_mainWindow->show();
    }

    _webView = std::make_unique<CODAWebEngineView>(s_mainWindow);
    // tag the QWebEngineView with a pointer back to this WebView so tab
    // close handlers can find the owning WebView instance
    _webView->setProperty("webview_owner", (qulonglong) reinterpret_cast<quintptr>(this));
    // Add a placeholder tab; the label will be updated in load().
    int tabIndex = s_tabWidget->addTab(_webView.get(), QObject::tr("Document"));
    // Bring the new tab into focus
    s_tabWidget->setCurrentIndex(tabIndex);

    if (isWelcome)
    {
        s_mainWindow->setWindowFlags(Qt::FramelessWindowHint);
    }
    else
    {
        // Use 1/3 of screen size, but enforce reasonable bounds
        int minWidth = qBound(800, screenGeometry.width() / 3, 1400);
        int minHeight = qBound(600, screenGeometry.height() / 3, 1000);
        s_mainWindow->setMinimumSize(minWidth, minHeight);
    }

    QWebEnginePage* page = new QWebEnginePage(profile, _webView.get());
    _webView->setPage(page);

    page->settings()->setAttribute(QWebEngineSettings::FullScreenSupportEnabled, true);

    QObject::connect(page, &QWebEnginePage::fullScreenRequested,
                     [this](QWebEngineFullScreenRequest request)
                     {
                         if (request.toggleOn())
                             s_mainWindow->showFullScreen();
                         else
                             s_mainWindow->showNormal();
                         request.accept();
                     });

    s_instances.push_back(this);
}

WebView::~WebView()
{
    std::erase(s_instances, this);

    // Let Qt handle deletion of _webView and its page and _bridge
}

bool WebView::confirmClose()
{
    // If there's no bridge or we don't know of modifications, allow close
    if (!_bridge)
        return true;

    if (!_bridge->isModified())
        return true;

    const QMessageBox::StandardButton choice = QMessageBox::warning(
        _webView.get(), QObject::tr("Save Document"),
        QObject::tr("The document has unsaved changes. Do you want to save them?"),
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
    _bridge = new Bridge(channel, _document, s_mainWindow, _webView.get());
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
    // If this WebView has its own main window, apply sizing and show it.
    if (s_mainWindow)
    {
        // TODO: Starter screen uses 1.5x welcome dimensions (width and height) as a temporary
        // solution. This should be refined with proper sizing logic based on user feedback.
        if (isStarterMode) {
            size.first = 1.5 * size.first;
            size.second = 1.5 * size.second;
        }

        s_mainWindow->resize(size.first, size.second);
        s_mainWindow->show();
    }
    else
    {
        // Update the tab label to the file name (or URL) so users can
        // distinguish documents. Walk up the parent chain to find the
        // QTabWidget because the direct parent may be an internal container.
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
            const QString title =
                QString::fromStdString(Poco::Path(_document._fileURL.getPath()).getFileName());
            const int index = tabWidget->indexOf(_webView.get());
            if (index != -1)
            {
                QString label = title.isEmpty() ? QObject::tr("Document") : title;
                // If the document is currently modified, show a modified indicator
                if (_bridge && _bridge->isModified())
                    label = QStringLiteral("* ") + label;
                tabWidget->setTabText(index, label);
                // Update the main window title to match the current tab
                QMainWindow* mainWindow = qobject_cast<QMainWindow*>(tabWidget->window());
                if (mainWindow)
                    mainWindow->setWindowTitle(tabWidget->tabText(index) + " - " APP_NAME);
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
    if (s_mainWindow)
    {
        s_mainWindow->raise();
        s_mainWindow->activateWindow();
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
