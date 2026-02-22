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

#include <vector>

#include <QString>
#include <QWidget>

struct SaveAsFormat
{
    QString action;      // e.g., "saveas-odt"
    QString extension;   // e.g., "odt"
    QString displayName; // e.g., "ODF text document (.odt)"
};

std::vector<SaveAsFormat> getSaveAsFormats(int docType);
void printDocument(unsigned appDocId, QWidget* parent = nullptr);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
