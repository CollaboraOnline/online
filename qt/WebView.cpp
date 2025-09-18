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
#include <QMainWindow>
#include "FakeSocket.hpp"
#include "MobileApp.hpp"
#include <cstdlib>
#include <cstring>

#include <QMenuBar>
#include <QMenu>
#include <QAction>
#include <QFileDialog>
#include <QKeySequence>

namespace
{
unsigned generateNewAppDocId()
{
    static unsigned appIdCounter = 60407;
    DocumentData::allocate(appIdCounter);
    return appIdCounter++;
}

std::string getTopSrcDir(const std::string& defaultPath)
{
    const char* envPath = std::getenv("COOL_TOPSRCDIR");
    if (envPath && std::strlen(envPath) > 0)
    {
        return std::string(envPath);
    }
    return defaultPath;
}
} // namespace

WebView::WebView(QWidget* parent)
        : _mainWindow(new QMainWindow(parent))
        , _webView(new QWebEngineView(_mainWindow))
{
    _mainWindow->setCentralWidget(_webView);

    // populate menu bar
    QMenuBar* menuBar = _mainWindow->menuBar();
    QMenu* fileMenu = menuBar->addMenu(QObject::tr("&File"));

    QAction* openAct = fileMenu->addAction(QObject::tr("&Open..."));
    openAct->setShortcut(QKeySequence::Open);
    openAct->setStatusTip(QObject::tr("Open a file"));

    QObject::connect(openAct, &QAction::triggered, _mainWindow,
                     [this]()
                     {
                         const QString filePath = QFileDialog::getOpenFileName(
                             _mainWindow, QObject::tr("Open File"), QString(),
                             QObject::tr("All Files (*);;"
                                         "Text Documents (*.odt *.ott *.doc *.docx *.rtf *.txt);;"
                                         "Spreadsheets (*.ods *.ots *.xls *.xlsx *.csv);;"
                                         "Presentations (*.odp *.otp *.ppt *.pptx)"
                                         )
                         );
                         if (!filePath.isEmpty())
                         {
                             WebView* webViewInstance = new WebView(nullptr);
                             webViewInstance->load(filePath.toStdString());
                         }
                     });
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
    auto bridge = new Bridge(channel, _document, _webView);
    channel->registerObject("bridge", bridge);
    _webView->page()->setWebChannel(channel);

    const std::string urlAndQuery = std::string("file://") +
                                    getTopSrcDir(TOPSRCDIR) + "/browser/dist/cool.html"
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

    _mainWindow->resize(720, 1600);
    _mainWindow->show();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
