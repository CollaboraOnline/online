/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_MASTERPROCESSSESSION_HPP
#define INCLUDED_MASTERPROCESSSESSION_HPP

#include <time.h>

#include <Poco/Random.h>

#include "LOOLSession.hpp"
#include "MessageQueue.hpp"

class DocumentBroker;

class MasterProcessSession : public LOOLSession
{
 public:
    MasterProcessSession(const std::string& id,
                         const Kind kind,
                         std::shared_ptr<Poco::Net::WebSocket> ws,
                         std::shared_ptr<DocumentBroker> docBroker);
    virtual ~MasterProcessSession();

    std::shared_ptr<DocumentBroker> getDocumentBroker() const { return _docBroker; }

    bool shutdownPeer(Poco::UInt16 statusCode, const std::string& message);

 protected:
    void dispatchChild();
    void forwardToPeer(const char *buffer, int length);

    // If _kind==ToPrisoner and the child process has started and completed its handshake with the
    // parent process: Points to the WebSocketSession for the child process handling the document in
    // question, if any.

    // In the session to the child process, points to the LOOLSession for the LOOL client. This will
    // obvious have to be rethought when we add collaboration and there can be several LOOL clients
    // per document being edited (i.e., per child process).
    std::weak_ptr<MasterProcessSession> _peer;

    int _loadPart;
    std::shared_ptr<DocumentBroker> _docBroker;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
