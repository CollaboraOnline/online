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

#include <QObject>
#include <QVariant>
#include <QWebEngineView>
#include "Document.hpp"
#include <QMainWindow>
#include <Poco/URI.h>

class Bridge;

class WebView
{
public:
    explicit WebView(QWidget* parent, QWebEngineProfile* profile, bool isWelcome = false);
    ~WebView();
    QWebEngineView* webEngineView() { return _webView; }

    void load(const Poco::URI& fileURL, bool newFile = false);
    static WebView* createNewDocument(QWidget* parent, QWebEngineProfile* profile, const std::string& templateType);

    static WebView* findOpenDocument(const Poco::URI& documentURI);
    static const std::vector<WebView*>& getAllInstances() { return s_instances; }
    void activateWindow();
    const Poco::URI& getSaveLocationURI() const { return _document._saveLocationURI; }

private:
    QMainWindow* _mainWindow;
    QWebEngineView* _webView;
    coda::DocumentData _document;
    bool _isWelcome;
    Bridge* _bridge;

    static std::vector<WebView*> s_instances;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
