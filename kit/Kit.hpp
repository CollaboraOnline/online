/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
#ifndef INCLUDED_LOOLKIT_HPP
#define INCLUDED_LOOLKIT_HPP

#include <map>
#include <string>

#include <common/Util.hpp>

#ifdef MOBILEAPP

#include "Socket.hpp"

class JS2OnlineBridge
{
public:
    void registerSocket(SocketPoll& socketPoll)
    {
        _SocketPoll = &socketPoll;
    }

    void registerJSSender(void (*function)(const char *, int, void *), void *data)
    {
        _JSCallbackFunction = function;
        _JSCallbackData = data;
    }

    void sendToOnline(const std::string& payload)
    {
        _SocketPoll->feed(payload);
    }

    void sendToJS(const char *data, int length)
    {
        _JSCallbackFunction(data, length, _JSCallbackData);
    }

private:
    SocketPoll *_SocketPoll;
    void (*_JSCallbackFunction)(const char *, int, void *);
    void *_JSCallbackData;
};

#endif

void lokit_main(
#ifndef MOBILEAPP
                const std::string& childRoot,
                const std::string& jailId,
                const std::string& sysTemplate,
                const std::string& loTemplate,
                const std::string& loSubPath,
                bool noCapabilities,
                bool noSeccomp,
                bool queryVersionInfo,
                bool displayVersion
#else
                const std::string& documentUri,
                JS2OnlineBridge& bridge
#endif
                );

bool globalPreinit(const std::string& loTemplate);
/// Wrapper around private Document::ViewCallback().
void documentViewCallback(const int type, const char* p, void* data);

class IDocumentManager;

/// Descriptor class used to link a LOK
/// callback to a specific view.
struct CallbackDescriptor
{
    IDocumentManager* const Doc;
    const int ViewId;
};

/// User Info container used to store user information
/// till the end of process lifecycle - including
/// after any child session goes away
struct UserInfo
{
    UserInfo()
    {
    }

    UserInfo(const std::string& userId,
             const std::string& username,
             const std::string& userExtraInfo,
             const bool readonly) :
        UserId(userId),
        Username(username),
        UserExtraInfo(userExtraInfo),
        IsReadOnly(readonly)
    {
    }

    std::string UserId;
    std::string Username;
    std::string UserExtraInfo;
    bool IsReadOnly;
};

/// Check the ForkCounter, and if non-zero, fork more of them accordingly.
/// @param limit If non-zero, set the ForkCounter to this limit.
void forkLibreOfficeKit(const std::string& childRoot,
                        const std::string& sysTemplate,
                        const std::string& loTemplate,
                        const std::string& loSubPath,
                        int limit = 0);

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
