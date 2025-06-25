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
#include <string>

// Helper: post JavaScript code safely on GUI thread
void evalJS(const std::string& script);

// send Online → JS
void send2JS(const std::vector<char>& buffer);

// Qt ⇄ JavaScript bridge
class Bridge : public QObject
{
    Q_OBJECT
public:
    explicit Bridge(QObject* parent = nullptr)
        : QObject(parent)
    {
    }

public slots: // called from JavaScript
    // Called from JS via window.postMobileMessage
    void debug(const QString& msg);
    // Called from JS via window.postMobileError
    void error(const QString& msg);
    /**
    * Called from JS via window.postMobileMessage()
    *
    * If the function has a meaningful reply for JavaScript, return a valid QVariant holding a
    * QString — this arrives in JS as that string. Otherwise return an *invalid* QVariant (e.g.
    * `return {}` or `return QVariant{}`); the Qt-to-JS marshaller converts an invalid QVariant to
    * the JavaScript value **undefined**.
    */
    QVariant cool(const QString& msg);
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
