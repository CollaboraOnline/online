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
#include <QWebChannel>
#include <QMainWindow>
#include "FakeSocket.hpp"
#include "MobileApp.hpp"
#include <cstdlib>
#include <cstring>

#include <QMenuBar>
#include <QMenu>
#include <QAction>
#include <QFileDialog>
#include <QKeySequence>
#include <QEvent>
#include <QMouseEvent>
#include <QCursor>
#include <QWindow>
#include <QVBoxLayout>
#include <QApplication>
#include <QPushButton>
#include <QHBoxLayout>
#include <QPainter>
#include <QStyleOption>

namespace
{
unsigned generateNewAppDocId()
{
    static unsigned appIdCounter = 60407;
    DocumentData::allocate(appIdCounter);
    return appIdCounter++;
}

std::string getTopSrcDir(const std::string& defaultPath)
{
    const char* envPath = std::getenv("COOL_TOPSRCDIR");
    if (envPath && std::strlen(envPath) > 0)
    {
        return std::string(envPath);
    }
    return defaultPath;
}
} // namespace

class EdgeResizeOverlay : public QWidget
{
public:
    explicit EdgeResizeOverlay(QMainWindow* window, int margin = 6)
        : QWidget(window)
        , _window(window)
        , _margin(margin)
    {
        // start as transparent; we will enable hit-testing only near edges
        setAttribute(Qt::WA_TransparentForMouseEvents, true);
        setAttribute(Qt::WA_NoSystemBackground, true);
        setAttribute(Qt::WA_AlwaysStackOnTop, true);
        setMouseTracking(true);
        setCursor(Qt::ArrowCursor);

        setGeometry(_window->rect());
        _window->installEventFilter(this);

        // observe global mouse moves so we can toggle transparency when cursor is over web content
        qApp->installEventFilter(this);

        createWindowControlButtons();

        raise();
        show();
    }

protected:
    bool eventFilter(QObject* obj, QEvent* ev) override
    {
        if (obj == _window && (ev->type() == QEvent::Resize || ev->type() == QEvent::Show))
        {
            setGeometry(_window->rect());
            updateButtonPosition();
            raise();
        }
        else if (ev->type() == QEvent::MouseMove)
        {
            const QPoint gpos = QCursor::pos();
            const QPoint localPos = mapFromGlobal(gpos);
            const bool near = isNearEdge(gpos);
            const bool overButtons =
                _buttonContainer && _buttonContainer->geometry().contains(localPos);

            // Allow mouse events for buttons, otherwise toggle based on edge proximity
            setAttribute(Qt::WA_TransparentForMouseEvents, !near && !overButtons);

            if (near)
            {
                updateCursor(edgesAt(gpos));
                raise();
            }
            else if (!overButtons)
            {
                unsetCursor();
            }
        }
        return QWidget::eventFilter(obj, ev);
    }

    void leaveEvent(QEvent*) override { unsetCursor(); }

    void mousePressEvent(QMouseEvent* e) override
    {
        if (e->button() != Qt::LeftButton)
            return;
        const Qt::Edges edges = edgesAt(mapToGlobal(e->pos()));
        if (edges != Qt::Edges{})
        {
            if (auto* wh = _window->windowHandle())
                wh->startSystemResize(edges);
            e->accept();
            return;
        }
        QWidget::mousePressEvent(e);
    }

private:
    bool isNearEdge(const QPoint& globalPos) const
    {
        const QRect r = _window->frameGeometry();
        const int x = globalPos.x() - r.x();
        const int y = globalPos.y() - r.y();
        const int w = r.width();
        const int h = r.height();
        const bool left = x <= _margin;
        const bool right = (w - x) <= _margin;
        const bool top = y <= _margin;
        const bool bottom = (h - y) <= _margin;

        return left || right || top || bottom;
    }

    Qt::Edges edgesAt(const QPoint& globalPos) const
    {
        const QRect r = _window->frameGeometry();
        const int x = globalPos.x() - r.x();
        const int y = globalPos.y() - r.y();
        const int w = r.width();
        const int h = r.height();
        const bool left = x <= _margin;
        const bool right = (w - x) <= _margin;
        const bool top = y <= _margin;
        const bool bottom = (h - y) <= _margin;

        Qt::Edges edges;
        if (left)
            edges |= Qt::LeftEdge;
        if (right)
            edges |= Qt::RightEdge;
        if (top)
            edges |= Qt::TopEdge;
        if (bottom)
            edges |= Qt::BottomEdge;
        return edges;
    }

    void updateCursor(Qt::Edges edges)
    {
        if (edges.testFlag(Qt::TopEdge) && edges.testFlag(Qt::LeftEdge))
            setCursor(Qt::SizeFDiagCursor);
        else if (edges.testFlag(Qt::TopEdge) && edges.testFlag(Qt::RightEdge))
            setCursor(Qt::SizeBDiagCursor);
        else if (edges.testFlag(Qt::BottomEdge) && edges.testFlag(Qt::LeftEdge))
            setCursor(Qt::SizeBDiagCursor);
        else if (edges.testFlag(Qt::BottomEdge) && edges.testFlag(Qt::RightEdge))
            setCursor(Qt::SizeFDiagCursor);
        else if (edges.testFlag(Qt::TopEdge) || edges.testFlag(Qt::BottomEdge))
            setCursor(Qt::SizeVerCursor);
        else if (edges.testFlag(Qt::LeftEdge) || edges.testFlag(Qt::RightEdge))
            setCursor(Qt::SizeHorCursor);
        else
            unsetCursor();
    }

private:
    void createWindowControlButtons()
    {
        // Create button container
        _buttonContainer = new QWidget(this);
        _buttonContainer->setAttribute(Qt::WA_TransparentForMouseEvents, false);
        _buttonContainer->setAttribute(Qt::WA_NoSystemBackground, true);
        _buttonContainer->setFixedSize(72, 24);
        _buttonContainer->raise();

        // Create horizontal layout for buttons
        QHBoxLayout* layout = new QHBoxLayout(_buttonContainer);
        layout->setContentsMargins(0, 0, 0, 0);
        layout->setSpacing(2);

        // Create minimize button
        _minimizeButton = new QPushButton("−", _buttonContainer);
        _minimizeButton->setAttribute(Qt::WA_TransparentForMouseEvents, false);
        _minimizeButton->setFixedSize(18, 18);
        _minimizeButton->setStyleSheet("QPushButton {"
                                       "    background-color: #e8e8e8;"
                                       "    border: none;"
                                       "    font-weight: bold;"
                                       "    font-size: 12px;"
                                       "    color: #333333;"
                                       "}"
                                       "QPushButton:hover {"
                                       "    background-color: #c0bfbc;"
                                       "    color: #000000;"
                                       "}"
                                       "QPushButton:pressed {"
                                       "    background-color: #a8a8a8;"
                                       "}");
        connect(_minimizeButton, &QPushButton::clicked, this, &EdgeResizeOverlay::minimizeWindow);

        // Create maximize/restore button
        _maximizeButton = new QPushButton("□", _buttonContainer);
        _maximizeButton->setAttribute(Qt::WA_TransparentForMouseEvents, false);
        _maximizeButton->setFixedSize(18, 18);
        _maximizeButton->setStyleSheet("QPushButton {"
                                       "    background-color: #e8e8e8;"
                                       "    border: none;"
                                       "    font-weight: bold;"
                                       "    font-size: 10px;"
                                       "    color: #333333;"
                                       "}"
                                       "QPushButton:hover {"
                                       "    background-color: #c0bfbc;"
                                       "    color: #000000;"
                                       "}"
                                       "QPushButton:pressed {"
                                       "    background-color: #a8a8a8;"
                                       "}");
        connect(_maximizeButton, &QPushButton::clicked, this,
                &EdgeResizeOverlay::toggleMaximizeWindow);

        // Create close button
        _closeButton = new QPushButton("×", _buttonContainer);
        _closeButton->setAttribute(Qt::WA_TransparentForMouseEvents, false);
        _closeButton->setFixedSize(18, 18);
        _closeButton->setStyleSheet("QPushButton {"
                                    "    background-color: #e8e8e8;"
                                    "    border: none;"
                                    "    font-weight: bold;"
                                    "    font-size: 12px;"
                                    "    color: #333333;"
                                    "}"
                                    "QPushButton:hover {"
                                    "    background-color: #c0bfbc;"
                                    "    color: #000000;"
                                    "}"
                                    "QPushButton:pressed {"
                                    "    background-color: #a8a8a8;"
                                    "}");
        connect(_closeButton, &QPushButton::clicked, this, &EdgeResizeOverlay::closeWindow);

        // Add buttons to layout
        layout->addWidget(_minimizeButton);
        layout->addWidget(_maximizeButton);
        layout->addWidget(_closeButton);

        // Position buttons in top-right corner
        updateButtonPosition();
    }

    void updateButtonPosition()
    {
        if (_buttonContainer)
        {
            const QRect windowRect = _window->rect();
            const int buttonWidth = _buttonContainer->width();
            const int buttonHeight = _buttonContainer->height();
            const int margin = 8; // Small margin from window edge

            _buttonContainer->move(windowRect.width() - buttonWidth - margin, margin);
            _buttonContainer->raise();
        }
    }

    void minimizeWindow() { _window->showMinimized(); }

    void toggleMaximizeWindow()
    {
        if (_window->isMaximized())
        {
            _window->showNormal();
            _maximizeButton->setText("□");
        }
        else
        {
            _window->showMaximized();
            _maximizeButton->setText("❐");
        }
    }

    void closeWindow() { _window->close(); }

private:
    QMainWindow* _window;
    int _margin;
    QWidget* _buttonContainer;
    QPushButton* _minimizeButton;
    QPushButton* _maximizeButton;
    QPushButton* _closeButton;
};

WebView::WebView(QWidget* parent)
    : _mainWindow(new QMainWindow(parent))
    , _webView(new QWebEngineView(_mainWindow))
{
    _mainWindow->setCentralWidget(_webView);

    // Make window frameless
    //_mainWindow->setWindowFlag(Qt::FramelessWindowHint, true);
    //_mainWindow->setMouseTracking(true);
    //_webView->setMouseTracking(true);
    //new EdgeResizeOverlay(_mainWindow);
}

void WebView::load(const std::string& fileURL)
{
    _document = {
        ._fileURL = fileURL,
        ._fakeClientFd = fakeSocketSocket(),
        ._appDocId = generateNewAppDocId(),
    };

    // setup js c++ communication
    QWebChannel* channel = new QWebChannel(_webView->page());
    auto bridge = new Bridge(channel, _document, _webView);
    channel->registerObject("bridge", bridge);
    _webView->page()->setWebChannel(channel);

    const std::string urlAndQuery = std::string("file://") + getTopSrcDir(TOPSRCDIR) +
                                    "/browser/dist/cool.html"
                                    "?file_path=" +
                                    _document._fileURL +
                                    "&permission=edit"
                                    "&lang=en-US"
                                    "&appdocid=" +
                                    std::to_string(_document._appDocId) +
                                    "&userinterfacemode=notebookbar";

    LOG_TRC("Open URL: " << urlAndQuery);
    _webView->load(QUrl(QString::fromStdString(urlAndQuery)));

    _mainWindow->resize(1600, 900);
    _mainWindow->show();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
