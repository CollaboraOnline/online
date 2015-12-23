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
#include <Poco/Logger.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

namespace Util
{
    namespace rng
    {
       unsigned getNext();
    }

    std::string logPrefix();

    bool windowingAvailable();

    // Sadly, older libpng headers don't use const for the pixmap pointer parameter to
    // png_write_row(), so can't use const here for pixmap.
    bool encodePNGAndAppendToBuffer(unsigned char *pixmap, int width, int height, std::vector<char>& output, LibreOfficeKitTileMode mode);

    // Call WebSocket::shutdown() ignoring Poco::IOException
    void shutdownWebSocket(Poco::Net::WebSocket& ws);

    std::string signalName(int signo);

    ssize_t writeFIFO(int nPipe, const char* pBuffer, ssize_t nSize);

    ssize_t readFIFO(int nPipe, char* pBuffer, ssize_t nSize);

    ssize_t readMessage(int nPipe, char* pBuffer, ssize_t nSize);
};

//TODO: Move to own file.
namespace Log
{
    void initialize(const std::string& name);
    Poco::Logger& logger();

    void debug(const std::string& msg);
    void info(const std::string& msg);
    void warn(const std::string& msg);
    void error(const std::string& msg);
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
