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

    // Check if we have a tabbed interface
    QTabWidget* tabWidget = qobject_cast<QTabWidget*>(centralWidget());

    if (tabWidget && tabWidget->count() > 0) {
        // Tabbed interface: prompt for each modified tab individually
        for (int i = 0; i < tabWidget->count(); ++i) {
            QWidget* w = tabWidget->widget(i);
            if (w) {
                quint64 ownerPtr = w->property("webview_owner").toULongLong();
                WebView* webView = reinterpret_cast<WebView*>((quintptr)ownerPtr);

                if (webView && webView->isDocumentModified()) {
                    // Make this tab current so user can see which document they're being asked about
                    tabWidget->setCurrentIndex(i);

                    // Use the same confirmClose dialog as individual tab closes, but include document name
                    QString tabText = tabWidget->tabText(i);
                    // Remove the "* " prefix if present (indicates modified)
                    if (tabText.startsWith("* ")) {
                        tabText = tabText.mid(2);
                    }
                    bool okToClose = webView->confirmClose(tabText);

                    if (!okToClose) {
                        // User cancelled - abort window close
                        ev->ignore();
                        return;
                    }
                }
            }
        }

        // User confirmed or no unsaved changes - clean up all tabs
        for (int i = 0; i < tabWidget->count(); ++i) {
            QWidget* w = tabWidget->widget(i);
            if (w) {
                quint64 ownerPtr = w->property("webview_owner").toULongLong();
                WebView* webView = reinterpret_cast<WebView*>((quintptr)ownerPtr);
                if (webView) {
                    webView->prepareForClose();
                    delete webView;
                }
            }
        }
    } else {
        // Single document mode (no tabs or owner_ based)
        auto const p = owner_;
        owner_ = nullptr;

        if (p) {
            // If the underlying QWebEngineView has been reparented (moved to another
            // window during a drag/drop), avoid prompting the user or deleting the
            // WebView here because the document is now hosted elsewhere.
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

            if (webWidgetStillInThisWindow && (p->isDocumentModified() || p->isPendingSave())) {
                QMessageBox msgBox(this);
                msgBox.setWindowTitle(QApplication::translate("WebView", "Unsaved Changes"));
                msgBox.setText(QApplication::translate("WebView", "The document has unsaved changes. Do you want to close anyway?"));
                msgBox.setStandardButtons(QMessageBox::Discard | QMessageBox::Cancel);
                msgBox.setDefaultButton(QMessageBox::Cancel);
                msgBox.setIcon(QMessageBox::Warning);

                int ret = msgBox.exec();
                if (ret == QMessageBox::Cancel) {
                    ev->ignore();
                    owner_ = p;
                    return;
                }
            }

            if (webWidgetStillInThisWindow) {
                p->prepareForClose();
                delete p;
            }
        }
    }

    QMainWindow::closeEvent(ev);
}

