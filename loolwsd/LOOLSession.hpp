/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOOLSESSION_HPP
#define INCLUDED_LOOLSESSION_HPP

#include <cassert>
#include <condition_variable>
#include <map>
#include <memory>
#include <mutex>
#include <ostream>
#include <set>

#include <Poco/Net/WebSocket.h>
#include <Poco/StringTokenizer.h>

// We have three kinds of Websocket sessions
// 1) Between the master loolwsd server to the end-user LOOL client
// 2) Between the master loolwsd server and a jailed loolwsd child process, in the master process
// 3) Ditto, in the jailed loolwsd process

class LOOLSession
{
public:
    enum class Kind { ToClient, ToPrisoner, ToMaster };

    void sendTextFrame(const std::string& text);

    virtual bool getStatus(const char *buffer, int length) = 0;

    virtual bool handleInput(const char *buffer, int length) = 0;

protected:
    LOOLSession(std::shared_ptr<Poco::Net::WebSocket> ws, Kind kind);
    virtual ~LOOLSession();

    static const std::string jailDocumentURL;

    const Kind _kind;

    std::string _kindString;

    void sendBinaryFrame(const char *buffer, int length);

    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) = 0;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens) = 0;

    // Fields common to sessions in master and jailed processes:

    // In the master process, the websocket to the LOOL client or the jailed child process. In a
    // jailed process, the websocket to the parent.
    std::shared_ptr<Poco::Net::WebSocket> _ws;

    // The actual URL, also in the child, even if the child never accesses that.
    std::string _docURL;

private:
    std::mutex _mutex;
};

template<typename charT, typename traits>
inline std::basic_ostream<charT, traits> & operator <<(std::basic_ostream<charT, traits> & stream, LOOLSession::Kind kind)
{
    switch (kind)
    {
    case LOOLSession::Kind::ToClient:
        return stream << "TO_CLIENT";
    case LOOLSession::Kind::ToPrisoner:
        return stream << "TO_PRISONER";
    case LOOLSession::Kind::ToMaster:
        return stream << "TO_MASTER";
    default:
        assert(false);
        return stream << "UNK_" + std::to_string(static_cast<int>(kind));
    }
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
