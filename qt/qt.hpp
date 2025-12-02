/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <QWebEngineProfile>

extern int coolwsd_server_socket_fd;
extern const char* user_name;
extern LibreOfficeKit* lo_kit;
class QApplication;

class Application
{
private:
    static QWebEngineProfile* globalProfile;
    static QApplication* globalApp;

public:
    static void initialize(QApplication* app);
    static QWebEngineProfile* getProfile();
    static QApplication* getApp();
};

namespace
{
inline std::string getTopSrcDir(const std::string& defaultPath)
{
    const char* envPath = std::getenv("COOL_TOPSRCDIR");
    if (envPath && std::strlen(envPath) > 0)
    {
        return std::string(envPath);
    }
    return defaultPath;
}
} // namespace

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
