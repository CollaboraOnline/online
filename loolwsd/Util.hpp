/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_UTIL_HPP
#define INCLUDED_UTIL_HPP

#include <string>

#include <Poco/Net/WebSocket.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

enum class LOOLExitCode
{
    LOOL_NO_ERROR = 0,
    /* pipe was detected - second office must terminate itself */
    LOOL_SECOND_OFFICE = 1,
    /* an uno exception was catched during startup */
    LOOL_FATAL_ERROR = 77, /* Only the low 8 bits are significant 333 % 256 = 77 */
    /* user force automatic restart after crash */
    LOOL_CRASH_WITH_RESTART = 79,
    /* the office restarts itself */
    LOOL_NORMAL_RESTART = 81,
    /* internal software error */
    LOOL_EXIT_SOFTWARE = 70
};

namespace Util
{
    std::string logPrefix();

    bool windowingAvailable();

    // Sadly, older libpng headers don't use const for the pixmap pointer parameter to
    // png_write_row(), so can't use const here for pixmap.
    bool encodeBufferToPNG(unsigned char* pixmap, int width, int height,
                           std::vector<char>& output, LibreOfficeKitTileMode mode);
    bool encodeSubBufferToPNG(unsigned char* pixmap, int startX, int startY, int width, int height,
                              int bufferWidth, int bufferHeight,
                              std::vector<char>& output, LibreOfficeKitTileMode mode);

    // Call WebSocket::shutdown() ignoring Poco::IOException
    void shutdownWebSocket(Poco::Net::WebSocket& ws);

    std::string signalName(int signo);
    int getChildStatus(const int nCode);
    int getSignalStatus(const int nCode);
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
