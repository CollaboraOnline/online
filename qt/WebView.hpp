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

#include <memory>

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
    explicit WebView(QWebEngineProfile* profile, bool isWelcome = false);
    ~WebView();
    QWebEngineView* webEngineView() { return _webView.get(); }

    void load(const Poco::URI& fileURL, bool newFile = false);
    static WebView* createNewDocument(QWebEngineProfile* profile, const std::string& templateType, const std::string& templatePath = "");

    static WebView* findOpenDocument(const Poco::URI& documentURI);
    static const std::vector<WebView*>& getAllInstances() { return s_instances; }
    void activateWindow();
    const Poco::URI& getSaveLocationURI() const { return _document._saveLocationURI; }

private:
    // query gnome font scaling factor and apply it to the web view
    void queryGnomeFontScalingUpdateZoom();
    QMainWindow* _mainWindow;
    std::unique_ptr<QWebEngineView> _webView;
    coda::DocumentData _document;
    bool _isWelcome;
    Bridge* _bridge;

    static std::vector<WebView*> s_instances;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
