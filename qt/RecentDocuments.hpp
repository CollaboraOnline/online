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

#include <QString>
#include <Poco/JSON/Array.h>

class QSettings;

class RecentDocuments
{
public:
    static void add(const QString& filePath);
    static Poco::JSON::Array::Ptr getForAppType(int docType = -1);

private:
    static int getAppTypeFromExtension(const QString& suffix);
    static QString getGroupName(int docType);
    static QString getDocTypeString(int docType);
    static QSettings getSettings();
    static bool isValidFile(const QString& filePath);
};

