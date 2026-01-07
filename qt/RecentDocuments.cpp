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

#include "RecentDocuments.hpp"
#include "Log.hpp"
#include "LibreOfficeKit/LibreOfficeKit.h"

#include <QFileInfo>
#include <QSettings>
#include <QUrl>
#include <QDateTime>
#include <Poco/JSON/Object.h>

namespace
{
    constexpr int MAX_RECENT = 15;
    constexpr const char* KEY_URIS = "uris";
    constexpr const char* KEY_NAMES = "names";
    constexpr const char* KEY_TIMESTAMPS = "timestamps";

    LibreOfficeKitDocumentType getAppTypeFromExtension(const QString& suffix)
    {
        QString ext = suffix.toLower();
        if (ext == "odt" || ext == "ott" || ext == "doc" || ext == "docx" ||
            ext == "rtf" || ext == "txt" || ext == "odm" || ext == "fodt")
            return LOK_DOCTYPE_TEXT;
        if (ext == "ods" || ext == "ots" || ext == "xls" || ext == "xlsx" ||
            ext == "csv" || ext == "fods")
            return LOK_DOCTYPE_SPREADSHEET;
        if (ext == "odp" || ext == "otp" || ext == "ppt" || ext == "pptx" ||
            ext == "fodp")
            return LOK_DOCTYPE_PRESENTATION;
        return LOK_DOCTYPE_TEXT; // default fallback
    }

    QString getGroupName(LibreOfficeKitDocumentType docType)
    {
        switch (docType) {
            case LOK_DOCTYPE_SPREADSHEET: return "RecentDocuments_Calc";
            case LOK_DOCTYPE_PRESENTATION: return "RecentDocuments_Impress";
            case LOK_DOCTYPE_TEXT:
            default: return "RecentDocuments_Writer";
        }
    }

    QString getDocTypeString(LibreOfficeKitDocumentType docType)
    {
        switch (docType) {
            case LOK_DOCTYPE_SPREADSHEET: return "calc";
            case LOK_DOCTYPE_PRESENTATION: return "impress";
            case LOK_DOCTYPE_TEXT:
            default: return "writer";
        }
    }

    QSettings getSettings()
    {
        return QSettings("Collabora", "CODA-RecentDocuments");
    }

    bool isValidFile(const QString& filePath)
    {
        QFileInfo info(filePath);
        return info.exists() && info.isFile();
    }
}

namespace RecentDocuments
{
    void add(const QString& filePath)
    {
        LOG_INF("RecentDocuments::add: called with filePath=" << filePath.toStdString());

        if (!isValidFile(filePath)) {
            LOG_DBG("RecentDocuments::add: invalid file: " << filePath.toStdString());
            return;
        }

        QFileInfo fileInfo(filePath);
        LibreOfficeKitDocumentType docType = getAppTypeFromExtension(fileInfo.suffix());

        QSettings settings = getSettings();
        settings.beginGroup(getGroupName(docType));
        QStringList uris = settings.value(KEY_URIS).toStringList();
        QStringList names = settings.value(KEY_NAMES).toStringList();
        QStringList timestamps = settings.value(KEY_TIMESTAMPS).toStringList();

        QString uri = QUrl::fromLocalFile(filePath).toString();
        int index = uris.indexOf(uri);
        if (index >= 0) {
            uris.removeAt(index);
            names.removeAt(index);
            timestamps.removeAt(index);
        }

        uris.prepend(uri);
        names.prepend(fileInfo.fileName());
        timestamps.prepend(QDateTime::currentDateTime().toString(Qt::ISODate));

        if (uris.size() > MAX_RECENT) {
            uris = uris.mid(0, MAX_RECENT);
            names = names.mid(0, MAX_RECENT);
            timestamps = timestamps.mid(0, MAX_RECENT);
        }

        settings.setValue(KEY_URIS, uris);
        settings.setValue(KEY_NAMES, names);
        settings.setValue(KEY_TIMESTAMPS, timestamps);
        settings.endGroup();
        settings.sync();
        LOG_INF("RecentDocuments::add: added " << fileInfo.fileName().toStdString());
    }

    Poco::JSON::Array::Ptr getForAppType(LibreOfficeKitDocumentType docType)
    {
        QSettings settings = getSettings();
        settings.beginGroup(getGroupName(docType));

        QStringList uris = settings.value(KEY_URIS).toStringList();
        QStringList names = settings.value(KEY_NAMES).toStringList();
        QStringList timestamps = settings.value(KEY_TIMESTAMPS).toStringList();
        settings.endGroup();

        Poco::JSON::Array::Ptr recentDocs = new Poco::JSON::Array();
        int count = qMin(uris.size(), qMin(names.size(), timestamps.size()));

        for (int i = 0; i < count; ++i) {
            // TODO: Add file existence validation if needed (currently skipped for performance)
            Poco::JSON::Object::Ptr docObj = new Poco::JSON::Object();
            docObj->set("uri", uris[i].toStdString());
            docObj->set("name", names[i].toStdString());
            docObj->set("timestamp", timestamps[i].toStdString());

            QString docTypeStr = getDocTypeString(docType);
            docObj->set("doctype", docTypeStr.toStdString());

            recentDocs->add(docObj);
        }

        LOG_DBG("RecentDocuments::getForAppType: returning " << recentDocs->size() << " valid documents");
        return recentDocs;
    }
}

