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

#include "CoolUrlSchemeHandler.hpp"

#include <common/Log.hpp>
#include <common/Uri.hpp>
#include <wsd/DocumentBroker.hpp>
#include <wsd/RequestDetails.hpp>

#include <Poco/URI.h>

#include <QByteArray>
#include <QFile>
#include <QFileInfo>
#include <QMimeDatabase>
#include <QMultiMap>
#include <QUrl>
#include <QWebEngineUrlRequestJob>

#include <map>
#include <memory>
#include <mutex>
#include <string>

extern std::map<std::string, std::shared_ptr<DocumentBroker>> DocBrokers;
extern std::mutex DocBrokersMutex;

CoolUrlSchemeHandler::CoolUrlSchemeHandler(QObject* parent)
    : QWebEngineUrlSchemeHandler(parent)
{
}

void CoolUrlSchemeHandler::requestStarted(QWebEngineUrlRequestJob* job)
{
    const QUrl url = job->requestUrl();
    const QString path = url.path();

    const bool isMedia = (path == QStringLiteral("/cool/media"));
    const bool isVtt = (path == QStringLiteral("/cool/mediavtt"));
    if (!isMedia && !isVtt)
    {
        LOG_WRN_S("CoolUrlSchemeHandler: unhandled path [" << path.toStdString() << ']');
        job->fail(QWebEngineUrlRequestJob::UrlNotFound);
        return;
    }

    // The server emits media URLs with the query separators themselves
    // percent-encoded (see ClientSession::createPublicURI + Uri::encode with
    // '&' reserved), so decode once before parsing.
    const std::string decoded = Uri::decode(url.toString(QUrl::FullyEncoded).toStdString());
    std::string wopiSrc, tag;
    try
    {
        for (const auto& kv : Poco::URI(decoded).getQueryParameters())
        {
            if (kv.first == "WOPISrc")
                wopiSrc = kv.second;
            else if (kv.first == "Tag")
                tag = kv.second;
        }
    }
    catch (const std::exception& e)
    {
        LOG_ERR_S("CoolUrlSchemeHandler: parse failed: " << e.what());
        job->fail(QWebEngineUrlRequestJob::UrlInvalid);
        return;
    }

    if (tag.empty() || wopiSrc.empty())
    {
        LOG_ERR_S("CoolUrlSchemeHandler: missing WOPISrc or Tag in "
                  << url.toString().toStdString());
        job->fail(QWebEngineUrlRequestJob::UrlInvalid);
        return;
    }

    std::shared_ptr<DocumentBroker> docBroker;
    {
        const std::string docKey = RequestDetails::getDocKey(wopiSrc);
        std::lock_guard<std::mutex> lock(DocBrokersMutex);
        const auto it = DocBrokers.find(docKey);
        if (it != DocBrokers.end())
            docBroker = it->second;
    }

    if (!docBroker)
    {
        LOG_ERR_S("CoolUrlSchemeHandler: no DocBroker for WOPISrc [" << wopiSrc << ']');
        job->fail(QWebEngineUrlRequestJob::UrlNotFound);
        return;
    }

    const std::string mediaPath = docBroker->getEmbeddedMediaPath(tag);
    if (mediaPath.empty())
    {
        LOG_ERR_S("CoolUrlSchemeHandler: no media path for tag [" << tag << ']');
        job->fail(QWebEngineUrlRequestJob::UrlNotFound);
        return;
    }

    auto* file = new QFile(QString::fromStdString(mediaPath), job);
    if (!file->open(QIODevice::ReadOnly))
    {
        LOG_ERR_S("CoolUrlSchemeHandler: cannot open [" << mediaPath
                  << "]: " << file->errorString().toStdString());
        job->fail(QWebEngineUrlRequestJob::RequestFailed);
        return;
    }

    QByteArray mime;
    if (isVtt)
    {
        mime = "text/vtt";
    }
    else
    {
        const QMimeType mt =
            QMimeDatabase().mimeTypeForFile(QFileInfo(*file), QMimeDatabase::MatchExtension);
        mime = mt.isValid() ? mt.name().toUtf8() : QByteArray("application/octet-stream");
    }

    // The page is loaded from file:// (origin "null"); without this header the
    // browser withholds the response body on cross-origin grounds for
    // <video crossOrigin="anonymous"> (used by the slideshow renderer).
    QMultiMap<QByteArray, QByteArray> responseHeaders;
    responseHeaders.insert("Access-Control-Allow-Origin", "null");
    job->setAdditionalResponseHeaders(responseHeaders);

    job->reply(mime, file);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
