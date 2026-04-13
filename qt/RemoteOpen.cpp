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

#include <qt/RemoteOpen.hpp>

#include <qt/RemoteFilePicker.hpp>
#include <qt/WebView.hpp>
#include <common/Log.hpp>

#include <QDir>
#include <QEventLoop>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QTemporaryFile>
#include <QTimer>
#include <QUrl>
#include <QUrlQuery>
#include <QWebEnginePage>
#include <QWebSocket>

namespace coda
{

void openRemoteFile(const QString& serverUrl, QWidget* parent,
                    QWebEngineProfile* profile)
{
    RemoteFilePicker picker(serverUrl, parent);
    if (picker.exec() != QDialog::Accepted)
        return;

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
        LOG_ERR("openRemoteFile: OCS error: "
                << ocsReply->errorString().toStdString());
        ocsReply->deleteLater();
        return;
    }

    QJsonDocument ocsDoc = QJsonDocument::fromJson(ocsReply->readAll());
    ocsReply->deleteLater();
    QString directUrl = ocsDoc["ocs"]["data"]["url"].toString();

    // Step 2: Load the direct URL in a hidden QWebEnginePage to
    // extract WOPI parameters from the richdocuments iframe URL.
    class WopiInterceptPage : public QWebEnginePage {
    public:
        QString wopiSrc;
        QString accessToken;
        QString coolServerUrl;
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

    QUrl directQUrl(directUrl);
    page->load(directQUrl);
    loop.exec();

    QString wopiSrc = page->wopiSrc;
    QString accessToken = page->accessToken;
    QString coolServer = page->coolServerUrl;
    page->deleteLater();

    if (wopiSrc.isEmpty() || accessToken.isEmpty())
    {
        LOG_ERR("openRemoteFile: failed to extract WOPI params");
        return;
    }

    // Step 3: Download the file via the COOL server's /co/collab
    // WebSocket endpoint.
    QString wsUrl = coolServer;
    wsUrl.replace("http://", "ws://");
    wsUrl.replace("https://", "wss://");
    wsUrl += "/co/collab?WOPISrc="
          + QUrl::toPercentEncoding(wopiSrc);

    auto* collabWs = new QWebSocket;
    auto* downloadUrl = new QString;
    auto* downloadDone = new bool(false);
    auto* collabLoop = new QEventLoop;
    auto* pendingMessages = new QStringList;

    QObject::connect(collabWs, &QWebSocket::connected,
        [collabWs, &accessToken]() {
            collabWs->sendTextMessage("access_token " + accessToken);
        });
    QObject::connect(collabWs, &QWebSocket::textMessageReceived,
        [downloadUrl, downloadDone, collabWs, collabLoop, pendingMessages]
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
                LOG_ERR("openRemoteFile: collab error: "
                        << msg.toStdString());
                collabWs->close();
            }
            else
            {
                // Buffer messages for replay after loadRemote wires
                // up the JS forwarding (user_list, user_joined, etc.)
                LOG_TRC("openRemoteFile: buffering collab msg: "
                        << msg.toStdString().substr(0, 100));
                pendingMessages->append(msg);
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
            LOG_ERR("openRemoteFile: collab WebSocket timeout");
            collabWs->close();
        });
    collabTimeout.start(30000);

    collabWs->open(QUrl(wsUrl));
    collabLoop->exec();

    if (downloadUrl->isEmpty())
    {
        LOG_ERR("openRemoteFile: failed to get download URL");
        delete downloadDone;
        delete downloadUrl;
        delete collabLoop;
        delete collabWs;
        return;
    }

    QString dlUrlStr = *downloadUrl;
    if (dlUrlStr.startsWith('/'))
        dlUrlStr = coolServer + dlUrlStr;

    delete downloadDone;
    delete downloadUrl;
    delete collabLoop;
    QStringList bufferedMessages = *pendingMessages;
    delete pendingMessages;

    // Download the file
    QUrl dlUrl(dlUrlStr);
    QNetworkRequest dlReq(dlUrl);
    QNetworkReply* dlReply = nam.get(dlReq);
    QObject::connect(dlReply, &QNetworkReply::finished,
                     &loop, &QEventLoop::quit);
    loop.exec();

    if (dlReply->error() != QNetworkReply::NoError)
    {
        LOG_ERR("openRemoteFile: download error: "
                << dlReply->errorString().toStdString());
        dlReply->deleteLater();
        delete collabWs;
        return;
    }

    // Preserve file extension for filter detection
    QString ext;
    QString selectedPath = picker.selectedPath();
    int dot = selectedPath.lastIndexOf('.');
    if (dot >= 0)
        ext = selectedPath.mid(dot);

    auto* tmp = new QTemporaryFile(
        QDir::tempPath() + "/coda-XXXXXX" + ext);
    (void)tmp->open();
    tmp->write(dlReply->readAll());
    QString localPath = tmp->fileName();
    tmp->close();
    tmp->setAutoRemove(false);
    dlReply->deleteLater();

    // Disconnect download-phase handlers before transferring
    // ownership to RemoteDocInfo.
    collabWs->disconnect();

    auto remoteInfo = std::make_shared<RemoteDocInfo>();
    remoteInfo->wopiSrc = wopiSrc;
    remoteInfo->accessToken = accessToken;
    remoteInfo->coolServer = coolServer;
    remoteInfo->collabWs.reset(collabWs);
    remoteInfo->pendingCollabMessages = std::move(bufferedMessages);

    WebView* webViewInstance = new WebView(profile);
    webViewInstance->loadRemote(localPath, std::move(remoteInfo));
}

} // namespace coda

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
