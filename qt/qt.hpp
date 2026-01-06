/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <QApplication>
#include <QWebEngineProfile>
#include "common/RecentFiles.hpp"

extern int coolwsd_server_socket_fd;
extern const char* user_name;
extern LibreOfficeKit* lo_kit;

class Application
{
private:
    static QWebEngineProfile* globalProfile;
    static RecentFiles recentFiles;

public:
    static void initialize();
    static QWebEngineProfile* getProfile();
    static RecentFiles& getRecentFiles();
};

namespace
{
inline std::string getDataDir()
{
    Poco::Path dir(qApp->applicationDirPath().toStdString());
    if (Poco::File(Poco::Path(dir, "run-from-build")).exists())
    {
        dir.makeParent();
        return dir.toString();
    }
    return COOLWSD_DATADIR;
}
} // namespace

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
