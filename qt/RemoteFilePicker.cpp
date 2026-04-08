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

#include <qt/RemoteFilePicker.hpp>

#include <QBuffer>
#include <QHBoxLayout>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLabel>
#include <QLineEdit>
#include <QMessageBox>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QPushButton>
#include <QStackedWidget>
#include <QTimer>
#include <QTreeWidget>
#include <QTreeWidgetItem>
#include <QUrlQuery>
#include <QVBoxLayout>
#include <QWebEngineView>
#include <QXmlStreamReader>

RemoteFilePicker::RemoteFilePicker(const QString& serverUrl, QWidget* parent)
    : QDialog(parent)
    , _nam(new QNetworkAccessManager(this))
    , _serverUrl(QUrl(serverUrl))
    , _pollTimer(new QTimer(this))
{
    setWindowTitle("Open Remote File");
    resize(600, 400);

    _stack = new QStackedWidget;

    // Page 0: embedded web view for Nextcloud login
    _authWebView = new QWebEngineView;
    _authWebView->setUrl(QUrl("about:blank"));
    _stack->addWidget(_authWebView);
    resize(800, 600);

    // Page 1: file browser
    auto* page1 = new QWidget;
    auto* lay1 = new QVBoxLayout(page1);
    auto* toolbar = new QHBoxLayout;
    _upBtn = new QPushButton("Up");
    _upBtn->setAutoDefault(false);
    toolbar->addWidget(_upBtn);
    toolbar->addStretch();
    _selectBtn = new QPushButton("Open");
    _selectBtn->setAutoDefault(false);
    _selectBtn->setEnabled(false);
    toolbar->addWidget(_selectBtn);
    lay1->addLayout(toolbar);
    _tree = new QTreeWidget;
    _tree->setHeaderLabels({"Name", "Size", "Modified"});
    _tree->setRootIsDecorated(false);
    lay1->addWidget(_tree);
    _stack->addWidget(page1);

    auto* mainLay = new QVBoxLayout(this);
    mainLay->addWidget(_stack);

    _pollTimer->setInterval(2000);
    connect(_pollTimer, &QTimer::timeout, this, &RemoteFilePicker::pollAuth);
    connect(_tree, &QTreeWidget::itemActivated, this, &RemoteFilePicker::onItemActivated);
    connect(_tree, &QTreeWidget::itemSelectionChanged, this, [this]() {
        _selectBtn->setEnabled(!_tree->selectedItems().isEmpty());
    });
    connect(_selectBtn, &QPushButton::clicked, this, &RemoteFilePicker::onSelect);
    connect(_upBtn, &QPushButton::clicked, this, [this]() {
        if (_currentPath.isEmpty())
            return;
        QString parent = _currentPath;
        if (parent.endsWith('/'))
            parent.chop(1);
        int slash = parent.lastIndexOf('/');
        if (slash >= 0)
            navigateTo(parent.left(slash + 1));
        else
            navigateTo(QString());
    });

    // Start authentication immediately
    startAuth();
}

void RemoteFilePicker::startAuth()
{
    // Nextcloud Login Flow v2: POST to /index.php/login/v2
    QUrl initUrl = _serverUrl;
    initUrl.setPath(initUrl.path() + "/index.php/login/v2");

    QNetworkRequest req(initUrl);
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/x-www-form-urlencoded");

    QNetworkReply* reply = _nam->post(req, QByteArray());
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();

        if (reply->error() != QNetworkReply::NoError)
        {
            showError("Login flow init failed: " + reply->errorString());
            return;
        }

        QJsonDocument doc = QJsonDocument::fromJson(reply->readAll());
        QJsonObject obj = doc.object();

        QUrl loginUrl(obj["login"].toString());
        QJsonObject pollObj = obj["poll"].toObject();
        _pollToken = pollObj["token"].toString();
        _pollEndpoint = QUrl(pollObj["endpoint"].toString());

        _authWebView->load(loginUrl);
        _pollTimer->start();
    });
}

void RemoteFilePicker::pollAuth()
{
    QNetworkRequest req(_pollEndpoint);
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/x-www-form-urlencoded");

    QUrlQuery body;
    body.addQueryItem("token", _pollToken);

    QNetworkReply* reply = _nam->post(req, body.toString(QUrl::FullyEncoded).toUtf8());
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();

        if (reply->error() != QNetworkReply::NoError)
        {
            // 404 means user hasn't approved yet - keep polling
            if (reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt() == 404)
                return;
            _pollTimer->stop();
            showError("Poll failed: " + reply->errorString());
            return;
        }

        _pollTimer->stop();

        QJsonDocument doc = QJsonDocument::fromJson(reply->readAll());
        QJsonObject obj = doc.object();

        _serverUrl = QUrl(obj["server"].toString());
        _loginName = obj["loginName"].toString();
        _appPassword = obj["appPassword"].toString();

        _stack->setCurrentIndex(1);
        navigateTo(QString());
    });
}

void RemoteFilePicker::navigateTo(const QString& path)
{
    _currentPath = path;
    _upBtn->setEnabled(!path.isEmpty());
    _tree->clear();

    // WebDAV PROPFIND
    QUrl davUrl = _serverUrl;
    davUrl.setPath(davUrl.path() + "/remote.php/dav/files/" + _loginName + "/" + path);
    if (!davUrl.path().endsWith('/'))
        davUrl.setPath(davUrl.path() + '/');

    QNetworkRequest req(davUrl);
    req.setRawHeader("Depth", "1");
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/xml; charset=utf-8");
    QString cred = _loginName + ':' + _appPassword;
    req.setRawHeader("Authorization", "Basic " + cred.toUtf8().toBase64());

    QByteArray body =
        "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
        "<d:propfind xmlns:d=\"DAV:\" xmlns:oc=\"http://owncloud.org/ns\">"
        "  <d:prop>"
        "    <d:displayname/>"
        "    <d:resourcetype/>"
        "    <d:getcontentlength/>"
        "    <d:getcontenttype/>"
        "    <d:getlastmodified/>"
        "    <oc:fileid/>"
        "  </d:prop>"
        "</d:propfind>";

    auto* buf = new QBuffer(this);
    buf->setData(body);
    buf->open(QIODevice::ReadOnly);

    QNetworkReply* reply = _nam->sendCustomRequest(req, "PROPFIND", buf);
    connect(reply, &QNetworkReply::finished, this, [this, reply, buf, davUrl]() {
        buf->deleteLater();
        reply->deleteLater();

        if (reply->error() != QNetworkReply::NoError)
        {
            showError("WebDAV error: " + reply->errorString());
            return;
        }

        QXmlStreamReader xml(reply->readAll());
        bool inResponse = false;
        QString href, displayName, contentType;
        bool isCollection = false;
        qint64 contentLength = 0;
        QString lastModified, fileId;

        while (!xml.atEnd())
        {
            xml.readNext();
            if (xml.isStartElement())
            {
                if (xml.name() == u"response")
                {
                    inResponse = true;
                    href.clear();
                    displayName.clear();
                    contentType.clear();
                    isCollection = false;
                    contentLength = 0;
                    lastModified.clear();
                    fileId.clear();
                }
                else if (inResponse && xml.name() == u"href")
                    href = QUrl::fromPercentEncoding(xml.readElementText().toUtf8());
                else if (inResponse && xml.name() == u"displayname")
                    displayName = xml.readElementText();
                else if (inResponse && xml.name() == u"collection")
                    isCollection = true;
                else if (inResponse && xml.name() == u"getcontentlength")
                    contentLength = xml.readElementText().toLongLong();
                else if (inResponse && xml.name() == u"getcontenttype")
                    contentType = xml.readElementText();
                else if (inResponse && xml.name() == u"getlastmodified")
                    lastModified = xml.readElementText();
                else if (inResponse && xml.name() == u"fileid")
                    fileId = xml.readElementText();
            }
            else if (xml.isEndElement() && xml.name() == u"response")
            {
                inResponse = false;
                // Skip the directory itself
                if (href == davUrl.path())
                    continue;
                auto* item = new QTreeWidgetItem;
                QString name = displayName.isEmpty()
                    ? href.section('/', -1) : displayName;
                item->setText(0, name);
                item->setText(1, isCollection ? QString() : QString::number(contentLength));
                item->setText(2, lastModified);
                item->setData(0, Qt::UserRole, isCollection);
                // Store path relative to the user's DAV root
                QString davRoot = "/remote.php/dav/files/" + _loginName + "/";
                QString relPath = href;
                int rootIdx = relPath.indexOf(davRoot);
                if (rootIdx >= 0)
                    relPath = relPath.mid(rootIdx + davRoot.length());
                item->setData(0, Qt::UserRole + 1, relPath);
                item->setData(0, Qt::UserRole + 2, fileId);
                _tree->addTopLevelItem(item);
            }
        }
        _tree->resizeColumnToContents(0);
    });
}

void RemoteFilePicker::onItemActivated(QTreeWidgetItem* item, int)
{
    bool isDir = item->data(0, Qt::UserRole).toBool();
    QString path = item->data(0, Qt::UserRole + 1).toString();
    if (isDir)
        navigateTo(path);
    else
        onSelect();
}

void RemoteFilePicker::onSelect()
{
    auto sel = _tree->selectedItems();
    if (sel.isEmpty())
        return;
    auto* item = sel.first();
    if (item->data(0, Qt::UserRole).toBool())
        return;
    _selectedPath = item->data(0, Qt::UserRole + 1).toString();
    _selectedFileId = item->data(0, Qt::UserRole + 2).toString();
    accept();
}

void RemoteFilePicker::showError(const QString& msg)
{
    QMessageBox::warning(this, "Remote File Picker", msg);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
