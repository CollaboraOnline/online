/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOOLSESSION_HPP
#define INCLUDED_LOOLSESSION_HPP

#include <unistd.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include <Poco/Net/WebSocket.h>
#include <Poco/StringTokenizer.h>

struct LOOLSession
{
    LOOLSession(Poco::Net::WebSocket& ws, LibreOfficeKit *loKit);
    ~LOOLSession();
    bool handleInput(char *buffer, int length);
    void sendTextFrame(std::string text);
    void sendBinaryFrame(const char *buffer, int length);
    void loadDocument(Poco::StringTokenizer& tokens);
    std::string getStatus();
    void sendTile(Poco::StringTokenizer& tokens);

    bool _haveSeparateProcess;
    pid_t _pid;
    int _pipe;

    Poco::Net::WebSocket& _ws;
    LibreOfficeKit *_loKit;
    LibreOfficeKitDocument *_loKitDocument;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
