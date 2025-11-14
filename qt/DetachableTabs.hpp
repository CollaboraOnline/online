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

#include <functional>

#include <QTabWidget>
#include <QTabBar>
#include <QMouseEvent>
#include <QMainWindow>
#include <QDrag>
#include <QMimeData>

class DetachableTabBar : public QTabBar {
    Q_OBJECT
public:
    explicit DetachableTabBar(QWidget* parent = nullptr);

signals:
    void detachTabRequested(int index, QPoint globalPos);

protected:
    void mousePressEvent(QMouseEvent* event) override;
    void mouseMoveEvent(QMouseEvent* event) override;

private:
    QPoint _dragStartPos;
};

class DetachableTabWidget : public QTabWidget {
    Q_OBJECT
public:
    explicit DetachableTabWidget(QWidget* parent = nullptr);

     // Set by WebView.cpp to customize tab setup (e.g. add "+" button)
    static std::function<void(QTabWidget*)> tabSetupCallback;

    void addDetachableTab(QWidget* widget, const QString& label);
    void reattachTab(QWidget* widget, const QString& label);

private slots:
    void handleDetachRequest(int index, QPoint globalPos);
};

