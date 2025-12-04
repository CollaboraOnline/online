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
#include "WebView.hpp"
#include "Window.hpp"
#include <LibreOfficeKit/LibreOfficeKit.h>
#include "qt.hpp"
#include "config.h"

#include <QApplication>
#include <QHBoxLayout>
#include <QPointer>
#include <QPushButton>
#include <QTimer>
#include <QUuid>

// (Temporary debug helper removed)

const QString kTabKey = "application/x-detachable-tab";
const QString kSourceKey = "application/x-detachable-source";
const QString kPosKey = "application/x-detachable-pos";

#define kStartIndexKey "dragStartIndex"
#define kStartPosKey "dragStartPos"

static int g_tabWidgetCounter = 0;

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

    // Only start custom drag if we're dragging *outside* this tab bar OR
    // the user has moved substantially in the vertical direction from the
    // initial press. The latter allows users to drag a tab slightly inside
    // the tab bar area (e.g. due to window decorations or screen edges)
    // and still trigger a detach by pulling up/down.
    QRect tabBarRect = QRect(mapToGlobal(QPoint(0, 0)), size());
    QVariant startVar = property(kStartPosKey);
    if (!startVar.isValid()) {
        return;
    }

    QPoint dragStartPos = startVar.toPoint();
    QPoint delta = event->pos() - dragStartPos;
    bool verticalDrag = std::abs(delta.y()) >= QApplication::startDragDistance();
    bool contains = tabBarRect.contains(globalPos);

    if (contains && !verticalDrag) {
        QTabBar::mouseMoveEvent(event); // Let Qt handle reordering
        return;
    }

    if (delta.manhattanLength() < QApplication::startDragDistance()) {
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

    QPushButton* newTabButton = new QPushButton("+");
    newTabButton->setMaximumWidth(30);

    QWidget* cornerWidget = new QWidget(this);
    QHBoxLayout* cornerLayout = new QHBoxLayout(cornerWidget);
    cornerLayout->setContentsMargins(0, 0, 0, 0);
    cornerLayout->addStretch();
    cornerLayout->addWidget(newTabButton);
    setCornerWidget(cornerWidget, Qt::TopRightCorner);
    connect(newTabButton, &QPushButton::clicked,
            this, &DetachableTabWidget::plusButtonClicked);

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

void DetachableTabWidget::updateTabBarVisibility() {
    // Hide tab bar when there's only one tab, show it when there are multiple tabs
    if (tabBar()) {
        tabBar()->setVisible(count() > 1);
    }
}

void DetachableTabWidget::addDetachableTab(QWidget* widget, const QString& label) {
    int newIndex = addTab(widget, label);
    Q_UNUSED(newIndex);
    updateTabBarVisibility();
}

void DetachableTabWidget::handleDetachRequest(QPoint globalPos, QWidget* tabWidget, const QString& tabLabel) {
    int tabIndex = indexOf(tabWidget);

    if (tabIndex == -1) {

        return;
    }

    removeTab(tabIndex); // ✅ remove before reparenting

    // If the widget being detached has an owning WebView, reuse that
    // WebView's ownership and update its main window so we don't create
    // a duplicate WebView/Window pair. Fall back to creating a new
    // WebView only if we cannot find an owning WebView.
    quint64 ownerPtr = tabWidget->property("webview_owner").toULongLong();
    WebView* ownerWebView = reinterpret_cast<WebView*>((quintptr)ownerPtr);

    Window* newWindow = nullptr;
    DetachableTabWidget* newTabs = nullptr;

    if (ownerWebView)
    {
        // Create a new top-level window and a tab widget to host the
        // detached tab, and update the WebView to reference the new
        // window as its main window.
        newWindow = new Window(nullptr, ownerWebView);
        newTabs = new DetachableTabWidget(newWindow);
        newWindow->setCentralWidget(newTabs);
        ownerWebView->setMainWindow(newWindow);
        // Ensure the new window shows a correct title for the moved tab
        // and keep it in sync when the current tab changes in the
        // new tab widget (the WebView's existing connections update the
        // tab text; append app name for consistency with other windows).
        newWindow->setWindowTitle(tabLabel + QStringLiteral(" - ") + QString::fromLatin1(APP_NAME));
        QObject::connect(newTabs, QOverload<int>::of(&QTabWidget::currentChanged),
                         [newTabs, newWindow](int index)
                         {
                             if (!newWindow || !newTabs || index < 0)
                                 return;
                             newWindow->setWindowTitle(newTabs->tabText(index) + QStringLiteral(" - ") + QString::fromLatin1(APP_NAME));
                         });
    }
    else
    {
        // No owning WebView found; construct the window and tab widget
        // first, then create a WebView that attaches into that window.
        newWindow = new Window(nullptr, /*owner*/ nullptr);
        newTabs = new DetachableTabWidget(newWindow);
        newWindow->setCentralWidget(newTabs);

        // Create a WebView that will use the new window as its target so
        // it will place its view into the `newTabs` widget.
        auto* webView = new WebView(Application::getProfile(), /*isWelcome*/ false, newWindow);
        // Now set the window owner to the created WebView so `closeEvent`
        // and other logic see a consistent owner.
        newWindow->setOwner(webView);
    }

    newTabs->addDetachableTab(tabWidget, tabLabel); // ✅ tab is still valid

    newWindow->move(globalPos);
    newWindow->resize(800, 600);
    newWindow->show();
    newTabs->setObjectName(QString("tabwidget_%1").arg(++g_tabWidgetCounter));
    updateTabBarVisibility();

    // Clear transient drag-start properties on the source and destination
    // tab bars so subsequent drags start fresh and are not misclassified
    // as internal reorders due to stale state.
    if (this->tabBar()) {
        this->tabBar()->setProperty(kStartIndexKey, QVariant());
        this->tabBar()->setProperty(kStartPosKey, QVariant());
    }
    if (newTabs->tabBar()) {
        newTabs->tabBar()->setProperty(kStartIndexKey, QVariant());
        newTabs->tabBar()->setProperty(kStartPosKey, QVariant());
    }

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
            event->ignore(); // prevent self-drop during detach
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

    if (tabIndexStr.isEmpty()) {
        return;
    }

    QString sourceName = QString::fromUtf8(ev->mimeData()->data(kSourceKey));
    DetachableTabWidget* source = nullptr;
    for (DetachableTabWidget* widget : s_allTabWidgets) {
        if (widget->objectName() == sourceName) {
            source = widget;
            break;
        }
    }

    if (!source || source == this) {
        return;
    }

    int index = tabIndexStr.toInt();
    QWidget* tabWidget = source->widget(index);
    if (!tabWidget) {
        return;
    }

    /* debug dump removed */

    // Determine the current index of the widget in the source (it may have
    // changed since the drag started). Use that index to remove the tab
    // safely before reparenting to avoid removing the wrong tab.
    // Diagnostic: record pointers, parent, visibility and counts before move
    // diagnostic removed: we previously logged pointer and count info here

    int actualIndex = source->indexOf(tabWidget);

    // If the recorded index is stale, try to find the tab by pointer as a
    // defensive fallback (race conditions can change indices during drags).
        if (actualIndex == -1) {
        for (int i = 0; i < source->count(); ++i) {
            if (source->widget(i) == tabWidget) {
                actualIndex = i;
                break;
            }
        }
        if (actualIndex == -1) {
            return; // cannot find the widget in source
        }
    }

    QString label = source->tabText(actualIndex);

    // Remove from source first, then reparent and add to target.
    source->removeTab(actualIndex);
    source->updateTabBarVisibility();

    // Reparent and make sure the widget is visible in the target tab widget.
    tabWidget->setParent(this);
    tabWidget->setVisible(true);
    addDetachableTab(tabWidget, label);
    setCurrentWidget(tabWidget);
    tabWidget->show();

    // Clear transient drag-start properties on both bars after a successful
    // drop to avoid stale state interfering with the next drag action.
    DetachableTabBar* srcBar = source->tabBar();
    DetachableTabBar* dstBar = tabBar();
    if (srcBar) {
        srcBar->setProperty(kStartIndexKey, QVariant());
        srcBar->setProperty(kStartPosKey, QVariant());
    }
    if (dstBar) {
        dstBar->setProperty(kStartIndexKey, QVariant());
        dstBar->setProperty(kStartPosKey, QVariant());
    }

    // finished moving widget into this tab widget
    ev->acceptProposedAction();

    if (source->count() == 0) {
        QMainWindow* sourceWindow = qobject_cast<QMainWindow*>(source->window());
        if (sourceWindow) {
            // Defer closing the source window to avoid racing with reparenting
            // and potential deletion of widgets while we are still moving them.
            QPointer<QMainWindow> safeWin = sourceWindow;
            QPointer<DetachableTabWidget> safeSource = source;
            QTimer::singleShot(150, this, [safeWin, safeSource]() {
                if (!safeWin)
                    return;
                if (!safeSource || safeSource->count() == 0) {

                    safeWin->close();
                }
            });
        }
    }
}

