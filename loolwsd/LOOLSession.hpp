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

#include <map>
#include <set>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>

#include <Poco/Net/WebSocket.h>
#include <Poco/Buffer.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Types.h>

#include "TileCache.hpp"

// LOOLSession objects are used for three different purposes. This is probably not a good idea, I
// should introduce derived classes instead.

// 1) The Websocket session between the parent loolwsd process to the end-user LOOL client
// 2) The session between the parent loolwsd and a child loolwsd process, in the parent loolwsd
// 3) Ditto, in the child loolwsd

class LOOLSession
{
public:
    LOOLSession(Poco::Net::WebSocket& ws, LibreOfficeKit *loKit = nullptr, Poco::UInt64 childId = 0);
    ~LOOLSession();

    static const std::string jailDocumentURL;

    bool handleInput(char *buffer, int length);
    bool haveSeparateProcess() const;
    bool toChildProcess() const;

    void sendTextFrame(const std::string& text);
    void sendBinaryFrame(const char *buffer, int length);

    // Set up the chroot environment for one child process and start
    // it, in advance of it being actually needed
    static void preFork();

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

    void dispatchChild();
    void forwardRequest(const char *buffer, int length);

    static Poco::Path getJailPath(Poco::UInt64 childId);

    bool isChildProcess() const;

    // Fields common to parent and child:

    // In the parent process, the websocket to the LOOL client or the
    // child process. In a child process, the websocket to the
    // parent.
    Poco::Net::WebSocket *_ws;

    std::unique_ptr<TileCache> _tileCache;

    // Whether this session is to a LOOL client or to a child process
    bool _toChildProcess;

    // In the parent, the actual URL. In the child, the copy inside the chroot jail.
    std::string _docURL;

    // Parent only:

    // If haveSeparateProcess() is true and the child process has started and completed its
    // handshake with the parent process: Points to the websocket to in the LOOLSession object for
    // the child process handling the document in question, if any.

    // In the session to the child process, points to the websocket to the LOOL client. This will
    // obvious have to be rethought when we add collaboration and there can be several LOOL clients
    // per document being edited (i.e., per child process).
    Poco::Net::WebSocket *_peerWs;

    // The id of the child process
    Poco::UInt64 _childId;

    // Map from child ids to the corresponding session to the child
    // process.
    static std::map<Poco::UInt64, LOOLSession*> _childIdToChildSession;

    // Pre-forked child processes that haven't yet connected.
    static std::set<Poco::UInt64> _pendingPreForkedChildren;

    // Child processes that have connected but are not yet assigned a
    // document to work on.
    static std::set<LOOLSession*> _availableChildSessions;

    // Child only:
    std::string _jail;
    std::string _loSubPath;
    LibreOfficeKit *_loKit;
    LibreOfficeKitDocument *_loKitDocument;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
