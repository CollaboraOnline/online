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
#include "FakeSocket.hpp"
#include "MobileApp.hpp"

namespace
{
unsigned generateNewAppDocId()
{
    static unsigned appIdCounter = 60407;
    DocumentData::allocate(appIdCounter);
    return appIdCounter++;
}
} // namespace

WebView::WebView(QWidget* parent)
    : _webView(new QWebEngineView(parent))
{
}

void WebView::load(const std::string& fileURL)
{
    _document = {
        ._fileURL = fileURL,
        ._fakeClientFd = fakeSocketSocket(),
        ._appDocId = generateNewAppDocId(),
    };

    // setup js c++ communication
    QWebChannel* channel = new QWebChannel(_webView->page());
    // TODO: pass webview as a ref instead.
    auto bridge = new Bridge(channel, _document, *this);
    channel->registerObject("bridge", bridge);
    _webView->page()->setWebChannel(channel);

    const std::string urlAndQuery = std::string("file://") +
                                    TOPSRCDIR "/browser/dist/cool.html" // same HTML frontend
                                              "?file_path=" +
                                    _document._fileURL +
                                    "&closebutton=1" // mirror original query-params
                                    "&permission=edit"
                                    "&lang=en-US"
                                    "&appdocid=" +
                                    std::to_string(_document._appDocId) +
                                    "&userinterfacemode=notebookbar";

    LOG_TRC("Open URL: " << urlAndQuery);
    _webView->load(QUrl(QString::fromStdString(urlAndQuery)));

    _webView->resize(720, 1600);
    _webView->show();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
