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

class WebView
{
public:
    explicit WebView(QWidget* parent, QWebEngineProfile* profile, bool isWelcome = false);
    QWebEngineView* webEngineView() { return _webView; }

    void load(const std::string& fileURL);

private:
    QMainWindow* _mainWindow;
    QWebEngineView* _webView;
    coda::DocumentData _document;
    bool _isWelcome;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
