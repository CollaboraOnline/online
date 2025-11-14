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

#include "DetachableTabs.hpp"

#include <QApplication>

std::function<void(QTabWidget*)> DetachableTabWidget::tabSetupCallback = nullptr;

DetachableTabBar::DetachableTabBar(QWidget* parent)
    : QTabBar(parent) {}

void DetachableTabBar::mousePressEvent(QMouseEvent* event) {
    if (event->button() == Qt::LeftButton)
        _dragStartPos = event->pos();
    QTabBar::mousePressEvent(event);
}

void DetachableTabBar::mouseMoveEvent(QMouseEvent* event) {
    if (!(event->buttons() & Qt::LeftButton))
        return;
    if ((event->pos() - _dragStartPos).manhattanLength() < QApplication::startDragDistance())
        return;

    int index = tabAt(_dragStartPos);
    if (index != -1)
        emit detachTabRequested(index, mapToGlobal(event->pos()));
}

DetachableTabWidget::DetachableTabWidget(QWidget* parent)
    : QTabWidget(parent) {
    auto* tabBar = new DetachableTabBar(this);
    setTabBar(tabBar);
    connect(tabBar, &DetachableTabBar::detachTabRequested,
            this, &DetachableTabWidget::handleDetachRequest);
}

void DetachableTabWidget::addDetachableTab(QWidget* widget, const QString& label) {
    addTab(widget, label);
}

void DetachableTabWidget::reattachTab(QWidget* widget, const QString& label) {
    addTab(widget, label);
    setCurrentWidget(widget);
}

void DetachableTabWidget::handleDetachRequest(int index, QPoint globalPos) {
    QWidget* tab = widget(index);
    QString label = tabText(index);
    removeTab(index);

    auto* newWindow = new QMainWindow;
    auto* newTabs = new DetachableTabWidget(newWindow);
    if (tabSetupCallback)
        tabSetupCallback(newTabs);  // inject "+" button etc.

    newWindow->setCentralWidget(newTabs);
    newTabs->addDetachableTab(tab, label);
    newWindow->move(globalPos);
    newWindow->resize(800, 600);
    newWindow->show();

    if (count() == 0) {
        QMainWindow* mainWindow = qobject_cast<QMainWindow*>(window());
        if (mainWindow)
            mainWindow->close();
    }
}

