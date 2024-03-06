/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * The main entry point for the LibreOfficeKit process serving
 * a document editing session.
 */

#include <config.h>

#include <Poco/URI.h>
#include <sysexits.h> // EX_OK

#include <common/Seccomp.hpp>
#include <common/TraceEvent.hpp>
#include <common/MessageQueue.hpp>

#include <Kit.hpp>
#include "KitWebSocket.hpp"

using Poco::Exception;
using Poco::URI;

void KitWebSocketHandler::handleMessage(const std::vector<char>& data)
{
    // To get A LOT of Trace Events, to exercise their handling, uncomment this:
    // ProfileZone profileZone("KitWebSocketHandler::handleMessage");

    std::string message(data.data(), data.size());

#if !MOBILEAPP
    if (UnitKit::get().filterKitMessage(this, message))
        return;
#endif
    StringVector tokens = StringVector::tokenize(message);

    LOG_DBG(_socketName << ": recv [" << [&](auto& log) {
        for (const auto& token : tokens)
        {
            // Don't log user-data, there are anonymized versions that get logged instead.
            if (tokens.startsWith(token, "jail") || tokens.startsWith(token, "author") ||
                tokens.startsWith(token, "name") || tokens.startsWith(token, "url"))
                continue;

            log << tokens.getParam(token) << ' ';
        }
    });

    // Note: Syntax or parsing errors here are unexpected and fatal.
    if (SigUtil::getTerminationFlag())
    {
        LOG_DBG("Too late, TerminationFlag is set, we're going down");
    }
    else if (tokens.equals(0, "session"))
    {
        const std::string& sessionId = tokens[1];
        _docKey = tokens[2];
        const std::string& docId = tokens[3];
        const std::string fileId = Util::getFilenameFromURL(_docKey);
        Util::mapAnonymized(fileId, fileId); // Identity mapping, since fileId is already obfuscated

        std::string url;
        URI::decode(_docKey, url);
#ifndef IOS
        Util::setThreadName("kit" SHARED_DOC_THREADNAME_SUFFIX + docId);
#endif
        if (!_document)
        {
            _document = std::make_shared<Document>(
                _loKit, _jailId, _docKey, docId, url, _queue,
                std::static_pointer_cast<WebSocketHandler>(shared_from_this()), _mobileAppDocId);
            _ksPoll->setDocument(_document);

            // We need to send the process name information to WSD if Trace Event recording is enabled (but
            // not turned on) because it might be turned on later.
            // We can do this only after creating the Document object.
            TraceEvent::emitOneRecordingIfEnabled(
                std::string("{\"name\":\"process_name\",\"ph\":\"M\",\"args\":{\"name\":\"") +
                "Kit-" + docId + "\"},\"pid\":" + std::to_string(getpid()) +
                ",\"tid\":" + std::to_string(Util::getThreadId()) + "},\n");
        }

        // Validate and create session.
        if (!(url == _document->getUrl() && _document->createSession(sessionId)))
        {
            LOG_DBG("CreateSession failed.");
        }
    }

    else if (tokens.equals(0, "exit"))
    {
#if !MOBILEAPP
        LOG_INF("Terminating immediately due to parent 'exit' command.");
        flushTraceEventRecordings();
        _document.reset();
        if (!Util::isKitInProcess())
            Util::forcedExit(EX_OK);
        else
            SigUtil::setTerminationFlag();
#else
#ifdef IOS
        LOG_INF("Setting our KitSocketPoll's termination flag due to 'exit' command.");
        std::unique_lock<std::mutex> lock(_ksPoll->terminationMutex);
        _ksPoll->terminationFlag = true;
        _ksPoll->terminationCV.notify_all();
#else
        LOG_INF("Setting TerminationFlag due to 'exit' command.");
        SigUtil::setTerminationFlag();
#endif
        _document.reset();
#endif
    }
    else if (tokens.equals(0, "tile") || tokens.equals(0, "tilecombine") ||
             tokens.equals(0, "paintwindow") || tokens.equals(0, "resizewindow") ||
             COOLProtocol::getFirstToken(tokens[0], '-') == "child")
    {
        if (_document)
        {
            _queue->put(message);
        }
        else
        {
            LOG_WRN("No document while processing " << tokens[0] << " request.");
        }
    }
    else if (tokens.size() == 3 && tokens.equals(0, "setconfig"))
    {
#if !MOBILEAPP && !defined(BUILDING_TESTS)
        // Currently only rlimit entries are supported.
        if (!Rlimit::handleSetrlimitCommand(tokens))
        {
            LOG_ERR("Unknown setconfig command: " << message);
        }
#endif
    }
    else if (tokens.equals(0, "setloglevel"))
    {
        Log::logger().setLevel(tokens[1]);
    }
    else
    {
        LOG_ERR("Bad or unknown token [" << tokens[0] << ']');
    }
}

void KitWebSocketHandler::enableProcessInput(bool enable)
{
    WebSocketHandler::enableProcessInput(enable);
    if (_document)
        _document->enableProcessInput(enable);

    // Wake up poll to process data from socket input buffer
    if (enable && _ksPoll)
        _ksPoll->wakeup();
}

void KitWebSocketHandler::onDisconnect()
{
#if !MOBILEAPP
    //FIXME: We could try to recover.
    LOG_ERR("Kit for DocBroker ["
            << _docKey
            << "] connection lost without exit arriving from wsd. Setting TerminationFlag");
    SigUtil::setTerminationFlag();
#endif
#ifdef IOS
    {
        std::unique_lock<std::mutex> lock(_ksPoll->terminationMutex);
        _ksPoll->terminationFlag = true;
        _ksPoll->terminationCV.notify_all();
    }
#endif
    _ksPoll.reset();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
