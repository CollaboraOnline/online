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
#include <QPointer>
#include <QTimer>
#include <QUuid>

const QString kTabKey = "application/x-detachable-tab";
const QString kSourceKey = "application/x-detachable-source";
const QString kPosKey = "application/x-detachable-pos";

#define kStartIndexKey "dragStartIndex"
#define kStartPosKey "dragStartPos"

static int g_tabWidgetCounter = 0;

std::function<void(QTabWidget*)> DetachableTabWidget::tabSetupCallback = nullptr;

DetachableTabBar::DetachableTabBar(QWidget* parent)
    : QTabBar(parent) {
    setMovable(true);
    setTabsClosable(true);
}

void DetachableTabBar::mousePressEvent(QMouseEvent* event) {
    int index = tabAt(event->pos());
    if (index != -1 && event->button() == Qt::LeftButton) {
        setProperty(kStartIndexKey, index);
        setProperty(kStartPosKey, event->pos());
    }

    QTabBar::mousePressEvent(event);
}

void DetachableTabBar::mouseReleaseEvent(QMouseEvent* event) {
    setProperty(kStartIndexKey, QVariant());
    setProperty(kStartPosKey, QVariant());

    QTabBar::mouseReleaseEvent(event);
}

void DetachableTabBar::mouseMoveEvent(QMouseEvent* event) {
    if (!(event->buttons() & Qt::LeftButton))
        return;

    QPoint globalPos = mapToGlobal(event->pos());

    // Only start custom drag if we're dragging *outside* this tab bar
    QRect tabBarRect = QRect(mapToGlobal(QPoint(0, 0)), size());
    if (tabBarRect.contains(globalPos)) {
        QTabBar::mouseMoveEvent(event); // Let Qt handle reordering
        return;
    }

    QVariant startVar = property(kStartPosKey);
    if (!startVar.isValid()) {
        return;
    }

    QPoint dragStartPos = startVar.toPoint();
    if ((event->pos() - dragStartPos).manhattanLength() < QApplication::startDragDistance()) {
        return;
    }

    QVariant indexVar = property(kStartIndexKey);
    if (!indexVar.isValid()) {
        return;
    }
    QMainWindow* mainWindow = qobject_cast<QMainWindow*>(this->window());
    DetachableTabWidget* sourceWidget = nullptr;
    if (mainWindow)
        sourceWidget = qobject_cast<DetachableTabWidget*>(mainWindow->centralWidget());

    if (!sourceWidget) {
        return;
    }

    int index = indexVar.toInt();

    QWidget* tabToDetach = sourceWidget->widget(index);
    QString labelToDetach = sourceWidget->tabText(index);
    QPoint globalStart = mapToGlobal(event->pos());
    QMimeData* mimeData = new QMimeData;
    mimeData->setData(kTabKey, QByteArray::number(index));
    mimeData->setData(kSourceKey, sourceWidget->objectName().toUtf8());
    mimeData->setData(kPosKey, QByteArray::number(globalStart.x()) + "," + QByteArray::number(globalStart.y()));

    QPointer<DetachableTabWidget> safeSource = sourceWidget;
    int capturedIndex = index;
    // QPoint capturedGlobalPos = mapToGlobal(event->pos());

    QDrag* drag = new QDrag(this);
    drag->setMimeData(mimeData);
    drag->setHotSpot(event->pos());
    Qt::DropAction result = drag->exec(Qt::MoveAction, Qt::MoveAction);
    if (result == Qt::IgnoreAction && sourceWidget) {
        emit sourceWidget->tabBar()->detachTabRequested(globalStart, tabToDetach, labelToDetach);
    }
    setProperty(kStartIndexKey, QVariant());
    setProperty(kStartPosKey, QVariant());
}

DetachableTabWidget::DetachableTabWidget(QWidget* parent)
    : QTabWidget(parent) {
    s_allTabWidgets.push_back(this);
    auto* tabBar = new DetachableTabBar(this);
    setObjectName(QString("tabwidget_%1").arg(++g_tabWidgetCounter));

    setTabsClosable(true);
    setAcceptDrops(true);
    setMovable(true);
    setMouseTracking(true);
    setTabBar(tabBar);
    connect(tabBar, &DetachableTabBar::detachTabRequested,
            this, &DetachableTabWidget::handleDetachRequest);
}

DetachableTabWidget::~DetachableTabWidget() {
    std::erase(s_allTabWidgets, this);
}

DetachableTabBar* DetachableTabWidget::tabBar() const {
    return static_cast<DetachableTabBar*>(QTabWidget::tabBar());
}

void DetachableTabWidget::addDetachableTab(QWidget* widget, const QString& label) {
    addTab(widget, label);
}

void DetachableTabWidget::reattachTab(QWidget* widget, const QString& label) {
    addTab(widget, label);
    setCurrentWidget(widget);
}

void DetachableTabWidget::handleDetachRequest(QPoint globalPos, QWidget* tabWidget, const QString& tabLabel) {
    int tabIndex = indexOf(tabWidget);
    if (tabIndex == -1) {
        qDebug() << "Tab widget not found in current tab set";
        return;
    }

    removeTab(tabIndex); // ✅ remove before reparenting

    auto* newWindow = new QMainWindow;
    auto* newTabs = new DetachableTabWidget(newWindow);
    if (tabSetupCallback)
        tabSetupCallback(newTabs);

    newWindow->setCentralWidget(newTabs);
    newTabs->addDetachableTab(tabWidget, tabLabel); // ✅ tab is still valid
    newWindow->move(globalPos);
    newWindow->resize(800, 600);
    newWindow->show();
    newTabs->setObjectName(QString("tabwidget_%1").arg(++g_tabWidgetCounter));

    if (count() == 0) {
    QMainWindow* mainWindow = qobject_cast<QMainWindow*>(window());
    if (mainWindow)
            mainWindow->close();
    }
}

void DetachableTabWidget::dragEnterEvent(QDragEnterEvent* event) {
    if (event->mimeData()->hasFormat(kTabKey)) {
        QString sourceName = QString::fromUtf8(event->mimeData()->data(kSourceKey));
        DetachableTabWidget* source = nullptr;

        for (DetachableTabWidget* widget : s_allTabWidgets) {
            if (widget->objectName() == sourceName) {
                source = widget;
                break;
            }
        }
        if (source && source != this) {
            event->acceptProposedAction();
        } else {
            event->ignore(); // 🔥 prevent self-drop during detach
        }
    }
}

void DetachableTabWidget::dropEvent(QDropEvent* ev) {
    QString tabIndexStr = QString::fromUtf8(ev->mimeData()->data(kTabKey));
    QByteArray posData = ev->mimeData()->data(kPosKey);
    QPoint globalPos;
    const QList<QByteArray> parts = posData.split(',');
    if (parts.size() == 2)
        globalPos = QPoint(parts[0].toInt(), parts[1].toInt());

    if (tabIndexStr.isEmpty())
        return;

    QString sourceName = QString::fromUtf8(ev->mimeData()->data(kSourceKey));
    DetachableTabWidget* source = nullptr;
    for (DetachableTabWidget* widget : s_allTabWidgets) {
        if (widget->objectName() == sourceName) {
            source = widget;
            break;
        }
    }

    if (!source || source == this)
        return;

    int index = tabIndexStr.toInt();
    QWidget* tabWidget = source->widget(index);
    if (!tabWidget)
        return;

    QString label = source->tabText(index);
    source->removeTab(index);
    addDetachableTab(tabWidget, label);
    setCurrentWidget(tabWidget);
    ev->acceptProposedAction();

    if (source->count() == 0) {
        QMainWindow* sourceWindow = qobject_cast<QMainWindow*>(source->window());
        if (sourceWindow)
            sourceWindow->close();
    }
}
