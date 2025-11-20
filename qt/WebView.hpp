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
#include "DetachableTabs.hpp"
#include "Document.hpp"
#include "Window.hpp"
#include <QMainWindow>
#include <Poco/URI.h>

class Bridge;

class WebView
{
public:
    // If `targetWindow` is non-null, the new WebView will be added as a
    // tab into that window's tab widget instead of creating a new top-level
    // window. If `targetWindow` is null, the constructor will prefer the
    // currently active `Window` when creating the tab (default behavior).
    explicit WebView(QWebEngineProfile* profile, bool isWelcome = false, Window* targetWindow = nullptr);
    ~WebView();
    QWebEngineView* webEngineView() { return _webView.get(); }
    // Prompt to save if modified and return true if it's OK to close the document
    bool confirmClose();
    // Prepare this WebView for being closed: unregister bridge and prevent
    // further JS calls into the web view.
    void prepareForClose();

    void load(const Poco::URI& fileURL, bool newFile = false);
    static WebView* createNewDocument(QWebEngineProfile* profile, const std::string& templateType, const std::string& templatePath = "");

    static WebView* findOpenDocument(const Poco::URI& documentURI);
    static const std::vector<WebView*>& getAllInstances() { return s_instances; }
    void activateWindow();
    // Return the owning top-level Window for this WebView (may be nullptr).
    Window* getMainWindow() const { return _mainWindow; }
    // Update the main window pointer (used when a WebView is moved between windows).
    void setMainWindow(Window* w) { _mainWindow = w; }
    const Poco::URI& getSaveLocationURI() const { return _document._saveLocationURI; }
    bool isDocumentModified() const;
    bool isPendingSave() const;

    // Run the given javascript code via the bridge.
    void runJS(const QString& jsCode);

private:
    // query gnome font scaling factor and apply it to the web view
    void queryGnomeFontScalingUpdateZoom();
    Window *_mainWindow;
    std::unique_ptr<QWebEngineView> _webView;
    coda::DocumentData _document;
    bool _isWelcome;
    Bridge* _bridge;
    // true if this WebView constructed a top-level Window for itself
    bool _createdWindow = false;

    static std::vector<WebView*> s_instances;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
