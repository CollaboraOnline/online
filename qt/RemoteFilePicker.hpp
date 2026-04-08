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

#pragma once

#include <QDialog>
#include <QUrl>
#include <QString>

class QLineEdit;
class QPushButton;
class QTreeWidget;
class QTreeWidgetItem;
class QLabel;
class QStackedWidget;
class QNetworkAccessManager;
class QTimer;
class QWebEngineView;

/// Dialog for browsing and picking files from a Nextcloud instance via
/// WebDAV, using Nextcloud Login Flow v2 for authentication.
class RemoteFilePicker : public QDialog
{
    Q_OBJECT
public:
    explicit RemoteFilePicker(const QString& serverUrl, QWidget* parent = nullptr);

    QUrl serverUrl() const { return _serverUrl; }
    QString selectedPath() const { return _selectedPath; }
    QString selectedFileId() const { return _selectedFileId; }
    QString loginName() const { return _loginName; }
    QString appPassword() const { return _appPassword; }

private slots:
    void startAuth();
    void pollAuth();
    void onItemActivated(QTreeWidgetItem* item, int column);
    void onSelect();

private:
    void navigateTo(const QString& path);
    void showError(const QString& msg);

    // Widgets
    QStackedWidget* _stack;
    QWebEngineView* _authWebView;
    QTreeWidget* _tree;
    QPushButton* _selectBtn;
    QPushButton* _upBtn;

    // State
    QNetworkAccessManager* _nam;
    QUrl _serverUrl;
    QString _currentPath;
    QString _loginName;
    QString _appPassword;
    QString _selectedPath;
    QString _selectedFileId;
    QString _pollToken;
    QUrl _pollEndpoint;
    QTimer* _pollTimer;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
