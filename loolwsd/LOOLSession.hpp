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

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>

#include <Poco/Net/WebSocket.h>
#include <Poco/Buffer.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/Random.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Types.h>

#include "MessageQueue.hpp"
#include "TileCache.hpp"

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

    virtual bool getCommandValues(const char *buffer, int length, Poco::StringTokenizer& tokens) = 0;

    virtual bool getPartPageRectangles(const char *buffer, int length) = 0;

    virtual bool handleInput(const char *buffer, int length) = 0;

    static const std::string jailDocumentURL;

protected:
    LOOLSession(std::shared_ptr<Poco::Net::WebSocket> ws, Kind kind);
    virtual ~LOOLSession();

    const Kind _kind;

    std::string _kindString;

    void sendBinaryFrame(const char *buffer, int length);

    /// Parses the options of the "load" command, shared between MasterProcessSession::loadDocument() and ChildProcessSession::loadDocument().
    void parseDocOptions(const Poco::StringTokenizer& tokens, int& part, std::string& timestamp);

    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) = 0;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens) = 0;

    virtual void sendFontRendering(const char *buffer, int length, Poco::StringTokenizer& tokens) = 0;

    // Fields common to sessions in master and jailed processes:

    // In the master process, the websocket to the LOOL client or the jailed child process. In a
    // jailed process, the websocket to the parent.
    std::shared_ptr<Poco::Net::WebSocket> _ws;

    // The actual URL, also in the child, even if the child never accesses that.
    std::string _docURL;

    /// Document options: a JSON string, containing options (rendering, also possibly load in the future).
    std::string _docOptions;

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

class ChildProcessSession final : public LOOLSession
{
public:
    ChildProcessSession(std::shared_ptr<Poco::Net::WebSocket> ws, LibreOfficeKit *loKit, std::string _childId);
    virtual ~ChildProcessSession();

    virtual bool handleInput(const char *buffer, int length) override;

    virtual bool getStatus(const char *buffer, int length);

    virtual bool getCommandValues(const char *buffer, int length, Poco::StringTokenizer& tokens);

    virtual bool getPartPageRectangles(const char *buffer, int length) override;

    LibreOfficeKitDocument *_loKitDocument;
    std::string _docType;

 protected:
    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens);

    virtual void sendFontRendering(const char *buffer, int length, Poco::StringTokenizer& tokens);

    bool clientZoom(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool downloadAs(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool getChildId();
    bool getTextSelection(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool paste(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool insertFile(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool keyEvent(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool mouseEvent(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool unoCommand(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool selectText(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool selectGraphic(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool resetSelection(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool saveAs(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool setClientPart(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool setPage(const char *buffer, int length, Poco::StringTokenizer& tokens);

    std::string _loSubPath;
    LibreOfficeKit *_loKit;
    std::string _childId;

 private:
    int _clientPart;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
