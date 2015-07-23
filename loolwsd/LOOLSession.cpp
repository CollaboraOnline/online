/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <sys/stat.h>
#include <sys/types.h>

#include <ftw.h>
#include <utime.h>

#include <cassert>
#include <condition_variable>
#include <cstring>
#include <fstream>
#include <iostream>
#include <iterator>
#include <map>
#include <memory>
#include <mutex>
#include <set>

#include "LOOLSession.hpp"
#include "Util.hpp"

using Poco::Net::WebSocket;

const std::string LOOLSession::jailDocumentURL = "/user/thedocument";

LOOLSession::LOOLSession(std::shared_ptr<WebSocket> ws, Kind kind) :
    _kind(kind),
    _ws(ws),
    _docURL("")
{
    std::cout << Util::logPrefix() << "LOOLSession ctor this=" << this << " " << _kind << " ws=" << _ws.get() << std::endl;
    if (kind == Kind::ToClient) {
        _kindString = "ToClient";
    }
    else if (kind == Kind::ToMaster) {
        _kindString = "ToMaster";
    }
    else if (kind == Kind::ToPrisoner) {
        _kindString = "ToPrisoner";
    }
}

LOOLSession::~LOOLSession()
{
    std::cout << Util::logPrefix() << "LOOLSession dtor this=" << this << " " << _kind << std::endl;
    Util::shutdownWebSocket(*_ws);
}

void LOOLSession::sendTextFrame(const std::string& text)
{
    std::unique_lock<std::mutex> lock(_mutex);

    _ws->sendFrame(text.data(), text.size());
}

void LOOLSession::sendBinaryFrame(const char *buffer, int length)
{
    std::unique_lock<std::mutex> lock(_mutex);

    if (length > 1000)
    {
        std::string nextmessage = "nextmessage: size=" + std::to_string(length);
        _ws->sendFrame(nextmessage.data(), nextmessage.size());
    }

    _ws->sendFrame(buffer, length, WebSocket::FRAME_BINARY);
}
/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
