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

void lokit_main(const std::string& childRoot,
                const std::string& jailId,
                const std::string& sysTemplate,
                const std::string& loTemplate,
                const std::string& loSubPath,
                bool noCapabilities,
                bool queryVersionInfo,
                bool displayVersion);

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
    std::string userid;
    std::string username;
    bool isReadOnly;
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
