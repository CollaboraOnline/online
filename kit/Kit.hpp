/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <map>
#include <string>

#include <common/Util.hpp>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.hxx>

#if MOBILEAPP

#include "ClientSession.hpp"
#include "DocumentBroker.hpp"
#include "Socket.hpp"

#endif

void lokit_main(
#if !MOBILEAPP
                const std::string& childRoot,
                const std::string& jailId,
                const std::string& sysTemplate,
                const std::string& loTemplate,
                bool noCapabilities,
                bool noSeccomp,
                bool queryVersionInfo,
                bool displayVersion,
#else
                int docBrokerSocket,
                const std::string& userInterface,
#endif
                std::size_t numericIdentifier
                );

#ifdef IOS
void runKitLoopInAThread();
#endif

bool globalPreinit(const std::string& loTemplate);
/// Wrapper around private Document::ViewCallback().
void documentViewCallback(const int type, const char* p, void* data);

class DocumentManagerInterface;

/// Descriptor class used to link a LOK
/// callback to a specific view.
struct CallbackDescriptor
{
    CallbackDescriptor(DocumentManagerInterface* const doc,
                       const int viewId) :
        _doc(doc),
        _viewId(viewId)
    {
    }

    DocumentManagerInterface* getDoc() const
    {
        return _doc;
    }

    int getViewId() const
    {
        return _viewId;
    }

private:
    DocumentManagerInterface* const _doc;
    const int _viewId;
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
             const std::string& userName,
             const std::string& userExtraInfo,
             bool readOnly) :
        _userId(userId),
        _userName(userName),
        _userExtraInfo(userExtraInfo),
        _readOnly(readOnly)
    {
    }

    const std::string& getUserId() const
    {
        return _userId;
    }

    const std::string& getUserName() const
    {
        return _userName;
    }

    const std::string& getUserExtraInfo() const
    {
        return _userExtraInfo;
    }

    bool isReadOnly() const
    {
        return _readOnly;
    }

private:
    std::string _userId;
    std::string _userName;
    std::string _userExtraInfo;
    bool _readOnly;
};

/// Check the ForkCounter, and if non-zero, fork more of them accordingly.
/// @param limit If non-zero, set the ForkCounter to this limit.
void forkLibreOfficeKit(const std::string& childRoot,
                        const std::string& sysTemplate,
                        const std::string& loTemplate,
                        int limit = 0);

/// Anonymize the basename of filenames, preserving the path and extension.
std::string anonymizeUrl(const std::string& url);

/// Anonymize usernames.
std::string anonymizeUsername(const std::string& username);

#ifdef __ANDROID__
/// For the Android app, for now, we need access to the one and only document open to perform eg. saveAs() for printing.
std::shared_ptr<lok::Document> getLOKDocumentForAndroidOnly();
#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
