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

#include <QMainWindow>

class WebView;
class Window: public QMainWindow {
    Q_OBJECT
public:
    Window(QWidget * parent, WebView * owner);
    void setCloseCallback(const std::function<void()>& closeCallback);

    // Allow setting the owner after construction (used when moving tabs
    // between windows or when constructing the window before the WebView).
    void setOwner(WebView* owner) { owner_ = owner; }

public slots:
    // Used when + button is clicked to open a new tab
    void plusClicked();

private:

    void closeEvent(QCloseEvent * ev) override;
    WebView * owner_;
    std::function<void()> closeCallback_;
};

