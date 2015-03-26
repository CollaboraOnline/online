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

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>

#include <Poco/Net/WebSocket.h>
#include <Poco/Buffer.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Types.h>

#include "TileCache.hpp"

class LOOLSession
{
public:
    LOOLSession(Poco::Net::WebSocket& ws, LibreOfficeKit *loKit = nullptr);
    ~LOOLSession();

    bool handleInput(char *buffer, int length);
    bool haveSeparateProcess() const;
    bool toChildProcess() const;

    void sendTextFrame(const std::string& text);
    void sendBinaryFrame(const char *buffer, int length);

private:
    bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool getStatus(const char *buffer, int length);

    void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens);

    bool keyEvent(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool mouseEvent(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool unoCommand(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool selectText(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool selectGraphic(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool resetSelection(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool saveAs(const char *buffer, int length, Poco::StringTokenizer& tokens);

    void forkOff();
    void forwardRequest(const char *buffer, int length);

    std::string _docURL;

    bool isChildProcess() const;

    // Fields common to parent and child:

    // In the parent process, the websocket to the LOOL client or the
    // child process. In a child process, the websocket to the
    // parent.
    Poco::Net::WebSocket& _ws;

    std::unique_ptr<TileCache> _tileCache;

    // Whether this session is to a LOOL client or to a child process
    bool _toChildProcess;

    // Parent only:

    // In sessions to LOOL clients only:

    // This points to the other websocket to the child process handling the
    // document in question, if any. (If haveSeparateProcess() is true
    // and the child process has started and completed its handshake
    // with the parent process). In the session to the child process,
    // this points to the websocket to the LOOL client.
    Poco::Net::WebSocket *_peerWs;

    // The id of the child process
    Poco::UInt64 _childId;

    // Buffer for requests to be forwarded to the child process once
    // it has completed its handshake.
    std::vector<Poco::Buffer<char>*> _backLog;

    // Map from child ids to the corresponding client session
    static std::map<Poco::UInt64, LOOLSession*> _childToClient;

    // Child only:
    LibreOfficeKit *_loKit;
    LibreOfficeKitDocument *_loKitDocument;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
