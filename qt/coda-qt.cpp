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

#include <wsd/COOLWSD.hpp>
#include <qt/DBusService.hpp>
#include <net/FakeSocket.hpp>
#include <common/Log.hpp>
#include <common/Util.hpp>
#include <qt/RemoteFilePicker.hpp>
#include <qt/WebView.hpp>
#include <qt/qt.hpp>

#include <QEventLoop>
#include <QJsonDocument>
#include <QJsonObject>
#include <QDir>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QTemporaryFile>
#include <QTimer>
#include <QUrlQuery>
#include <QWebEnginePage>
#include <QWebSocket>


#include <Poco/URI.h>

#include <QApplication>
#include <QByteArray>
#include <QCommandLineOption>
#include <QCommandLineParser>
#include <QDBusConnection>
#include <QDBusReply>
#include <QDir>
#include <QLocale>
#include <QLoggingCategory>
#include <QString>
#include <QTranslator>
#include <QWebEngineProfile>

#include <pwd.h>

#include <unistd.h>

const char* user_name = nullptr;

int coolwsd_server_socket_fd = -1;
static COOLWSD* coolwsd = nullptr;
static std::thread coolwsdThread;

// Disable accessibility
void disableA11y() { qputenv("QT_LINUX_ACCESSIBILITY_ALWAYS_ON", "0"); }

namespace
{
    const char* getUserName()
    {
        static QByteArray storage;
        storage.clear();

        QDBusMessage message = QDBusMessage::createMethodCall(
            "org.freedesktop.portal.Desktop",
            "/org/freedesktop/portal/desktop",
            "org.freedesktop.portal.Accounts",
            "GetUserInformation"
        );

        QDBusReply<QVariantMap> reply = QDBusConnection::sessionBus().call(message);

        if (reply.isValid()) {
            QVariantMap map = reply.value();

            QString realName = map.value("realName").toString();
            QString userName = map.value("userName").toString();

            QString chosen;
            if (!realName.isEmpty())
                chosen = realName;
            else if (!userName.isEmpty())
                chosen = userName;

            if (!chosen.isEmpty()) {
                storage = chosen.toUtf8();
                return storage.constData();
            }
        }

        // fallback to /etc/passwd

        struct passwd *pw = getpwuid(getuid());
        if (pw) {
            if (pw->pw_gecos && pw->pw_gecos[0] != '\0') {
                QString gecos = QString::fromLocal8Bit(pw->pw_gecos);
                QString full = gecos.section(',', 0, 0);

                if (!full.isEmpty()) {
                    storage = full.toUtf8();
                    return storage.constData();
                }
            }

            // fallback to Linux username
            storage = QByteArray(pw->pw_name);
            return storage.constData();
        }

        return nullptr;
    }

    void stopServer()
    {
        LOG_TRC("Requesting shutdown");
        SigUtil::requestShutdown();

        // wait until coolwsdThread is torn down, so that we don't start cleaning up too early
        coolwsdThread.join();

        QWebEngineProfile* profile = Application::getProfile();
        if (profile) {
            profile->deleteLater();
        }
    }

    void updateBrowserEnvironment(void)
    {
        const char *varName = "QTWEBENGINE_CHROMIUM_FLAGS";
        std::string val = (getenv(varName) ? getenv(varName) : "");
        // avoiding a crasher bug around check-box state emission for now cool#14039
        val = "--disable-renderer-accessibility --force-renderer-accessibility=false " + val;
        setenv(varName, val.c_str(), 1);
    }
} // namespace

int main(int argc, char** argv)
{
    QApplication app(argc, argv);

    user_name = getUserName();

    updateBrowserEnvironment();

    QTranslator translator;
    QString locale = QLocale::system().name();
    QString appDir = QCoreApplication::applicationDirPath();
    QString dataDir = QDir(appDir + "/../share/coda-qt").absolutePath();

    if (translator.load("coda_" + locale, appDir + "/translations"))
        app.installTranslator(&translator);
    else if (translator.load("coda_" + locale, dataDir + "/translations"))
        app.installTranslator(&translator);

    // default application name
    QApplication::setApplicationName(APP_NAME);
    QApplication::setWindowIcon(QIcon::fromTheme("com.collaboraoffice.Office.startcenter"));

    QCommandLineParser argParser;
    argParser.setApplicationDescription("Collabora Office - Desktop Office Suite");
    argParser.addHelpOption();
    argParser.addVersionOption();

    QCommandLineOption debugOption(
        QStringList() << "d" << "debug",
        "Enable debug output (shortcut for --log-level=trace)."
    );
    QCommandLineOption logLevelOption(
        QStringList() << "log-level",
        "Set log level (none, fatal, critical, error, warning, notice, information, debug, trace).",
        "level",
        "warning"
    );
    QCommandLineOption logDisabledAreasOption(
        QStringList() << "log-disabled-areas",
        "Comma-separated list of log areas to disable (Generic, Pixel, Socket, WebSocket, Http, WebServer, Storage, WOPI, Admin, Javascript).",
        "areas",
        "Socket,WebSocket,Admin,Pixel"
    );
    QCommandLineOption textDocumentOption(
        QStringList() << "textdocument" << "writer",
        "Create a new text document."
    );
    QCommandLineOption spreadsheetOption(
        QStringList() << "spreadsheet" << "calc",
        "Create a new spreadsheet."
    );
    QCommandLineOption presentationOption(
        QStringList() << "presentation" << "impress",
        "Create a new presentation."
    );
    QCommandLineOption drawingOption(
        QStringList() << "drawing" << "draw",
        "Create a new vector drawing."
    );
    QCommandLineOption remoteOption(
        "remote",
        "Browse and open a file from a remote server (e.g. Nextcloud).",
        "url"
    );

    argParser.addOption(debugOption);
    argParser.addOption(logLevelOption);
    argParser.addOption(logDisabledAreasOption);
    argParser.addOption(textDocumentOption);
    argParser.addOption(spreadsheetOption);
    argParser.addOption(presentationOption);
    argParser.addOption(drawingOption);
    argParser.addOption(remoteOption);
    argParser.addPositionalArgument("DOCUMENT", "Document file(s) to open", "[DOCUMENT...]");
    argParser.process(app);
    QStringList files = argParser.positionalArguments();

    std::string logLevel = argParser.value(logLevelOption).toStdString();
    bool debugMode = argParser.isSet(debugOption);
    if (debugMode)
        logLevel = "trace";

    // Disable QtWebEngine's JavaScript console logging (js: ... messages) unless
    // in debug mode or user has set QT_LOGGING_RULES environment variable
    if (!debugMode && !qEnvironmentVariableIsSet("QT_LOGGING_RULES"))
        QLoggingCategory::setFilterRules(QStringLiteral("js=false"));

    // --remote: show the remote file picker, authenticate via
    // Nextcloud Login Flow v2, get WOPI parameters via richdocuments,
    // download the file via the COOL server's /co/collab endpoint, and
    // open it locally.
    QString remoteWopiSrc, remoteAccessToken, remoteCoolServer;
    // Picker credentials needed for WebDAV download fallback
    QUrl remoteServerUrl;
    QString remoteLoginName, remoteAppPassword, remoteSelectedPath;
    if (argParser.isSet(remoteOption))
    {
        RemoteFilePicker picker(argParser.value(remoteOption));
        if (picker.exec() != QDialog::Accepted)
            _Exit(0);

        remoteServerUrl = picker.serverUrl();
        remoteLoginName = picker.loginName();
        remoteAppPassword = picker.appPassword();
        remoteSelectedPath = picker.selectedPath();

        qDebug() << "Selected:" << remoteSelectedPath
                 << "fileId:" << picker.selectedFileId();

        QNetworkAccessManager nam;
        QString cred = picker.loginName() + ':' + picker.appPassword();
        QByteArray authHeader = "Basic " + cred.toUtf8().toBase64();
        QEventLoop loop;

        // Step 1: Get a direct editing URL via the richdocuments OCS API.
        QUrl ocsUrl = picker.serverUrl();
        ocsUrl.setPath(ocsUrl.path()
                       + "/ocs/v2.php/apps/richdocuments/api/v1/document");
        QNetworkRequest ocsReq(ocsUrl);
        ocsReq.setHeader(QNetworkRequest::ContentTypeHeader,
                         "application/x-www-form-urlencoded");
        ocsReq.setRawHeader("OCS-APIREQUEST", "true");
        ocsReq.setRawHeader("Authorization", authHeader);

        QNetworkReply* ocsReply = nam.post(
            ocsReq, "fileId=" + picker.selectedFileId().toUtf8()
                    + "&format=json");
        QObject::connect(ocsReply, &QNetworkReply::finished,
                         &loop, &QEventLoop::quit);
        loop.exec();

        if (ocsReply->error() != QNetworkReply::NoError)
        {
            qWarning() << "OCS error:" << ocsReply->errorString();
            ocsReply->deleteLater();
            _Exit(1);
        }

        QJsonDocument ocsDoc = QJsonDocument::fromJson(ocsReply->readAll());
        ocsReply->deleteLater();
        QString directUrl = ocsDoc["ocs"]["data"]["url"].toString();
        qDebug() << "Direct URL:" << directUrl;

        // Step 2: Load the direct URL in a hidden QWebEnginePage.
        // Nextcloud's richdocuments JS will construct an iframe src like
        //   http://cool:9980/browser/.../cool.html?WOPISrc=...&access_token=...
        // We intercept that navigation request to extract the params.
        class WopiInterceptPage : public QWebEnginePage {
        public:
            QString wopiSrc;
            QString accessToken;
            QString coolServerUrl; // e.g. "http://localhost:9980"
            QEventLoop* evLoop;
            using QWebEnginePage::QWebEnginePage;
        protected:
            bool acceptNavigationRequest(
                const QUrl& url, NavigationType, bool) override
            {
                QUrlQuery q(url);
                if (q.hasQueryItem("WOPISrc"))
                {
                    wopiSrc = q.queryItemValue(
                        "WOPISrc", QUrl::FullyDecoded);
                    accessToken = q.queryItemValue(
                        "access_token", QUrl::FullyDecoded);
                    coolServerUrl = url.scheme() + "://"
                        + url.host() + ":"
                        + QString::number(url.port(80));
                    if (accessToken.isEmpty())
                    {
                        // Extract from the richdocuments initial state
                        // embedded in the page
                        runJavaScript(
                            "(() => {"
                            "  var el = document.getElementById("
                            "    'initial-state-richdocuments-document');"
                            "  if (!el) return '';"
                            "  try {"
                            "    return JSON.parse(atob(el.value)).token"
                            "      || '';"
                            "  } catch(e) { return ''; }"
                            "})()",
                            [this](const QVariant& result) {
                                accessToken = result.toString();
                                if (evLoop)
                                    evLoop->quit();
                            });
                        return false;
                    }
                    qDebug() << "Intercepted COOL URL:" << url;
                    if (evLoop)
                        evLoop->quit();
                    return false;
                }
                return true;
            }
        };

        auto* page = new WopiInterceptPage;
        page->evLoop = &loop;
        page->load(QUrl("about:blank"));

        QTimer timeout;
        timeout.setSingleShot(true);
        QObject::connect(&timeout, &QTimer::timeout,
                         &loop, &QEventLoop::quit);
        timeout.start(15000);

        page->load(QUrl(directUrl));
        loop.exec();

        remoteWopiSrc = page->wopiSrc;
        remoteAccessToken = page->accessToken;
        remoteCoolServer = page->coolServerUrl;
        page->deleteLater();

        if (remoteWopiSrc.isEmpty() || remoteAccessToken.isEmpty())
        {
            qWarning() << "Timed out or failed to get WOPI params";
            _Exit(1);
        }

        qDebug() << "WOPISrc:" << remoteWopiSrc;
        qDebug() << "access_token:" << remoteAccessToken;
    }

    Log::initialize(QApplication::applicationName().toStdString(), logLevel);
    Log::setDisabledAreas(argParser.value(logDisabledAreasOption).toStdString());

    ProcUtil::setThreadName("main");

    fakeSocketSetLoggingCallback([](const std::string& line) { LOG_TRC_NOFILE(line); });

    QStringList absoluteFiles;
    QString templateType;

    if (files.size() > 0)
    {
        // Convert relative paths to absolute paths
        for (const QString& file : files)
        {
            QFileInfo fileInfo(file);
            absoluteFiles << fileInfo.absoluteFilePath();
        }
    }
    else
    {
        if (argParser.isSet(presentationOption))
            templateType = "impress";
        else if (argParser.isSet(spreadsheetOption))
            templateType = "calc";
        else if (argParser.isSet(textDocumentOption))
            templateType = "writer";
        else if (argParser.isSet(drawingOption))
            templateType = "draw";
    }

    // single-instance using DBus: try to forward to existing instance
    if (DBusService::tryForwardToExistingInstance(absoluteFiles, templateType))
    {
        // Successfully forwarded to existing instance, exit
        return 0;
    }

    // COOLWSD in a background thread
    coolwsdThread = std::thread(
        []
        {
            ProcUtil::setThreadName("app");
            char* argv_local[2] = { strdup("coda"), nullptr };
            coolwsd = new COOLWSD();
            coolwsd->run(1, argv_local);
            delete coolwsd;
            LOG_TRC("One run of COOLWSD completed");
        });

    Application::initialize();

    // register DBus service and object
    DBusService* dbusService = new DBusService(&app);
    DBusService::registerService(dbusService);

    if (!remoteWopiSrc.isEmpty())
    {
        // Download the file via the COOL server's /co/collab endpoint,
        // same flow as the COWASM wasm build uses.  Keep the WebSocket
        // open afterwards to receive collab notifications (user
        // join/leave, etc.).
        qDebug() << "WOPISrc:" << remoteWopiSrc;
        qDebug() << "COOL server:" << remoteCoolServer;

        QString wsUrl = QString(remoteCoolServer)
                            .replace("http://", "ws://")
                            .replace("https://", "wss://")
                      + "/co/collab?WOPISrc="
                      + QUrl::toPercentEncoding(remoteWopiSrc);

        // Heap-allocated so it outlives the download phase and stays
        // open while the document is being edited.
        auto* collabWs = new QWebSocket;

        // State shared between the download phase (synchronous, in this
        // scope) and the monitoring phase (asynchronous, via app.exec).
        // Heap-allocated so the lambda doesn't capture dead stack refs.
        auto* downloadUrl = new QString;
        auto* downloadDone = new bool(false);
        auto* collabLoop = new QEventLoop;

        QObject::connect(collabWs, &QWebSocket::connected,
            [collabWs, &remoteAccessToken]() {
                collabWs->sendTextMessage("access_token "
                                          + remoteAccessToken);
            });
        QObject::connect(collabWs, &QWebSocket::textMessageReceived,
            [downloadUrl, downloadDone, collabWs, collabLoop]
            (const QString& msg) {
                QJsonDocument jdoc = QJsonDocument::fromJson(msg.toUtf8());
                QJsonObject jobj = jdoc.object();
                QString type = jobj["type"].toString();

                if (type == "authenticated")
                {
                    collabWs->sendTextMessage(
                        "{\"type\":\"fetch\","
                        "\"stream\":\"contents\","
                        "\"requestId\":\"coda-init\"}");
                }
                else if (type == "fetch_url"
                         && jobj["requestId"].toString() == "coda-init")
                {
                    *downloadUrl = jobj["url"].toString();
                    *downloadDone = true;
                    collabLoop->quit();
                }
                else if (type == "error" || type == "fetch_error")
                {
                    qWarning() << "Collab error:" << msg;
                    collabWs->close();
                }
                else if (*downloadDone)
                {
                    // Monitoring phase: handle collab notifications
                    // while the document is open.
                    // TODO: act on these (e.g., offer to switch to
                    // online collaborative editing when another user
                    // joins)
                    if (type == "user_joined")
                    {
                        QJsonObject user = jobj["user"].toObject();
                        (void)user;
                    }
                    else if (type == "user_left")
                    {
                        QJsonObject user = jobj["user"].toObject();
                        (void)user;
                    }
                }
            });
        QObject::connect(collabWs, &QWebSocket::disconnected,
            [downloadUrl, collabLoop]() {
                if (downloadUrl->isEmpty())
                    collabLoop->quit();
            });

        QTimer collabTimeout;
        collabTimeout.setSingleShot(true);
        QObject::connect(&collabTimeout, &QTimer::timeout,
            [collabWs]() {
                qWarning() << "Collab WebSocket timeout";
                collabWs->close();
            });
        collabTimeout.start(30000);

        collabWs->open(QUrl(wsUrl));
        collabLoop->exec();

        if (downloadUrl->isEmpty())
        {
            qWarning() << "Failed to get download URL from collab";
            delete downloadDone;
            delete downloadUrl;
            delete collabWs;
            _Exit(1);
        }

        // Resolve relative URL against COOL server
        QString dlUrlStr = *downloadUrl;
        if (dlUrlStr.startsWith('/'))
            dlUrlStr = remoteCoolServer + dlUrlStr;

        // Download the file
        QNetworkAccessManager dlNam;
        QUrl dlUrl(dlUrlStr);
        QNetworkRequest dlReq(dlUrl);
        QEventLoop dlLoop;
        QNetworkReply* dlReply = dlNam.get(dlReq);
        QObject::connect(dlReply, &QNetworkReply::finished,
                         &dlLoop, &QEventLoop::quit);
        dlLoop.exec();

        if (dlReply->error() != QNetworkReply::NoError)
        {
            qWarning() << "Download error:" << dlReply->errorString();
            dlReply->deleteLater();
            delete collabWs;
            _Exit(1);
        }

        // Preserve file extension for filter detection
        QString ext;
        int dot = remoteSelectedPath.lastIndexOf('.');
        if (dot >= 0)
            ext = remoteSelectedPath.mid(dot);

        auto* tmp = new QTemporaryFile(
            QDir::tempPath() + "/coda-XXXXXX" + ext);
        (void)tmp->open();
        tmp->write(dlReply->readAll());
        QString localPath = tmp->fileName();
        tmp->close();
        tmp->setAutoRemove(false);
        dlReply->deleteLater();

        // Don't close collabWs - it stays open for collab notifications.
        qDebug() << "Downloaded to:" << localPath;
        coda::openFiles(QStringList() << localPath);
    }
    else if (!absoluteFiles.isEmpty())
    {
        coda::openFiles(absoluteFiles);
    }
    else if (!templateType.isEmpty())
    {
        coda::openNewDocument(templateType);
    }
    else
    {
        WebView* starterView = new WebView(Application::getProfile());
        starterView->load(Poco::URI(), false, true);
    }

    auto const ret = app.exec();
    stopServer();
    return ret;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
