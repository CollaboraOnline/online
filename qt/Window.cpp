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
#include "DetachableTabs.hpp"

#include <QApplication>
#include <QMessageBox>
#include <QTabWidget>
#include <QTabBar>
#include <QWidget>
#include <QCloseEvent>
#include <LibreOfficeKit/LibreOfficeKit.h>
#include "qt.hpp"
#include "Window.hpp"

Window::Window(QWidget * parent, WebView * owner): QMainWindow(parent), owner_(owner) {}

void Window::setCloseCallback(const std::function<void()>& closeCallback)
{
    closeCallback_ = closeCallback;
}

// Used when + button is clicked to open a new tab
void Window::plusClicked() {
    // Try to invoke the web UI for the focused tab, if available.
    QTabWidget* tabWidget = qobject_cast<QTabWidget*>(this->centralWidget());
    QTabBar* tabBar = tabWidget ? tabWidget->tabBar() : nullptr;
    int currentIndex = tabBar ? tabBar->currentIndex() : -1;

    WebView* owner = nullptr;
    if (currentIndex != -1 && tabWidget) {
        QWidget* w = tabWidget->widget(currentIndex);
        if (w) {
            quint64 ownerPtr = w->property("webview_owner").toULongLong();
            owner = reinterpret_cast<WebView*>((quintptr)ownerPtr);
        }
    }

    if (owner) {
        // Let the page show the new-document UI
        owner->runJS("app.map.backstageView.show();");
        return;
    }

    // No owner available (placeholder tab or transient state). Create a
    // new document programmatically using the application profile so we
    // never rely on the native dialog fallback.
    WebView* newWebView = WebView::createNewDocument(Application::getProfile(), "writer");
    if (newWebView)
        newWebView->activateWindow();
}

void Window::closeEvent(QCloseEvent * ev) {
    if (closeCallback_) {
        closeCallback_();
    }
    
    auto const p = owner_;
    owner_ = nullptr;
    assert(p != nullptr);
    if (p)
    {
        // If the underlying QWebEngineView has been reparented (moved to another
        // window during a drag/drop), avoid prompting the user or deleting the
        // WebView here because the document is now hosted elsewhere. We detect
        // that by walking the widget parent chain of the web engine view and
        // verifying whether it is still a child of this window.
        QWidget* webWidget = p->webEngineView();
        bool webWidgetStillInThisWindow = false;
        if (webWidget) {
            QWidget* parent = webWidget->parentWidget();
            while (parent) {
                if (parent == this) {
                    webWidgetStillInThisWindow = true;
                    break;
                }
                parent = parent->parentWidget();
            }
        }

        // Only prompt about unsaved changes if the document is still hosted
        // in this window. If it was moved to another window (reparented),
        // don't ask the user to save here — the new host window will handle
        // any required confirmation when it closes.
        if (webWidgetStillInThisWindow && (p->isDocumentModified() || p->isPendingSave()))
        {
            QMessageBox msgBox(this);
            msgBox.setWindowTitle(QApplication::translate("WebView", "Unsaved Changes"));
            msgBox.setText(QApplication::translate("WebView", "The document has unsaved changes. Do you want to close anyway?"));
            msgBox.setStandardButtons(QMessageBox::Discard | QMessageBox::Cancel);
            msgBox.setDefaultButton(QMessageBox::Cancel);
            msgBox.setIcon(QMessageBox::Warning);

            int ret = msgBox.exec();
            if (ret == QMessageBox::Cancel)
            {
                // user chose not to exit
                ev->ignore();
                // Restore owner_ so the window's state remains consistent.
                owner_ = p;
                return;
            }
        }

        if (webWidgetStillInThisWindow) {
            p->prepareForClose();
            delete p;
        } else {
            // The web view was moved to another window — don't delete the
            // WebView here. Just clear our owner_ pointer and continue closing
            // this window.
        }
    }
    QMainWindow::closeEvent(ev);
}

