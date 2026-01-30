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

#include "DBusService.hpp"
#include "WebView.hpp"
#include "Log.hpp"
#include "LibreOfficeKit/LibreOfficeKit.h"
#include "qt.hpp"
#include <Poco/URI.h>
#include <Poco/Path.h>
#include <QDBusConnection>
#include <QDBusInterface>
#include <QDBusReply>
#include <QDBusConnectionInterface>
#include <QFileInfo>

constexpr const char* SERVICE_NAME = "com.collaboraoffice.Office";
constexpr const char* OBJECT_PATH = "/com/collaboraoffice/Office";

namespace coda
{
    void openFiles(const QStringList& files)
    {
        for (const QString& file : files)
        {
            Poco::URI fileURL(Poco::Path(file.toStdString()));

            // if document is already open, just activate it
            WebView* existingDocument = WebView::findOpenDocument(fileURL);
            if (existingDocument)
            {
                existingDocument->activateWindow();
                continue;
            }

            WebView* webViewInstance = new WebView(Application::getProfile());
            webViewInstance->load(fileURL);

            QFileInfo fileInfo(file);
            Poco::URI uri(Poco::Path(fileInfo.absoluteFilePath().toStdString()));
            Application::getRecentFiles().add(uri.toString());
        }
    }

    void openNewDocument(const QString& templateType)
    {
        WebView* webViewInstance = WebView::createNewDocument(Application::getProfile(), templateType.toStdString(), {}, {});
        if (!webViewInstance)
        {
            LOG_ERR("Failed to create new document");
        }
    }
}

DBusService::DBusService(QObject* parent)
    : QObject(parent)
{
}

DBusService::~DBusService()
{
    QDBusConnection sessionBus = QDBusConnection::sessionBus();

    // Unregister the object first
    sessionBus.unregisterObject(OBJECT_PATH);

    // Then unregister the service name
    sessionBus.unregisterService(SERVICE_NAME);
}

void DBusService::openFiles(const QStringList& files)
{
    coda::openFiles(files);
}

void DBusService::openNewDocument(const QString& templateType)
{
    coda::openNewDocument(templateType);
}

void DBusService::activate()
{
    if (auto instance = WebView::getAllInstances().front())
        instance->activateWindow();
}

bool DBusService::tryForwardToExistingInstance(const QStringList& files, const QString& templateType)
{
    QDBusConnection sessionBus = QDBusConnection::sessionBus();

    if (!sessionBus.interface()->isServiceRegistered(SERVICE_NAME))
    {
        // no existing instance
        return false;
    }

    QDBusInterface dbusInterface(SERVICE_NAME, OBJECT_PATH, SERVICE_NAME, sessionBus);

    if (!dbusInterface.isValid())
    {
        LOG_ERR("Failed to connect to existing instance via DBus: " << dbusInterface.lastError().message().toStdString());
        return false;
    }

    QDBusReply<void> reply;
    if (!files.isEmpty())
    {
        reply = dbusInterface.call("openFiles", files);
    }
    else if (!templateType.isEmpty())
    {
        reply = dbusInterface.call("openNewDocument", templateType);
    }
    else
    {
        reply = dbusInterface.call("activate");
    }

    if (!reply.isValid())
    {
        LOG_ERR("DBus call failed: " << reply.error().message().toStdString());
        return false;
    }

    return true;
}

bool DBusService::registerService(DBusService* service)
{
    QDBusConnection sessionBus = QDBusConnection::sessionBus();

    if (!sessionBus.registerService(SERVICE_NAME))
    {
        LOG_ERR("Failed to register DBus service: " << sessionBus.lastError().message().toStdString());
        return false;
    }

    if (!sessionBus.registerObject(OBJECT_PATH, service, QDBusConnection::ExportAllSlots))
    {
        LOG_ERR("Failed to register DBus object: " << sessionBus.lastError().message().toStdString());
        return false;
    }

    return true;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */

