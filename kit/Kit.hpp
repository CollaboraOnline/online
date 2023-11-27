/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <Poco/Util/XMLConfiguration.h>
#include <map>
#include <string>

#include <common/Util.hpp>
#include <wsd/TileDesc.hpp>
#include "Socket.hpp"

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.hxx>

#if MOBILEAPP

#include "ClientSession.hpp"
#include "DocumentBroker.hpp"

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
        : _readOnly(false)
    {
    }

    UserInfo(const std::string& userId,
             const std::string& userName,
             const std::string& userExtraInfo,
             const std::string& userPrivateInfo,
             bool readOnly) :
        _userId(userId),
        _userName(userName),
        _userExtraInfo(userExtraInfo),
        _userPrivateInfo(userPrivateInfo),
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

    const std::string& getUserPrivateInfo() const
    {
        return _userPrivateInfo;
    }

    bool isReadOnly() const
    {
        return _readOnly;
    }

private:
    std::string _userId;
    std::string _userName;
    std::string _userExtraInfo;
    std::string _userPrivateInfo;
    bool _readOnly;
};


/// We have two types of password protected documents
/// 1) Documents which require password to view
/// 2) Document which require password to modify
enum class DocumentPasswordType { ToView, ToModify };

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

/// Ensure there is no fatal system setup problem
void consistencyCheckJail();

/// Fetch the latest montonically incrementing wire-id
TileWireId getCurrentWireId(bool increment = false);

#ifdef __ANDROID__
/// For the Android app, for now, we need access to the one and only document open to perform eg. saveAs() for printing.
std::shared_ptr<lok::Document> getLOKDocumentForAndroidOnly();
#endif

extern _LibreOfficeKit* loKitPtr;

/// Check if URP is enabled
bool isURPEnabled();

/// Start a URP connection, checking if URP is enabled and there is not already an active URP session
bool startURP(std::shared_ptr<lok::Office> LOKit, void** ppURPContext);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
