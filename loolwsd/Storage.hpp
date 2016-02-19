/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Storage abstraction.
#ifndef INCLUDED_STORAGE_HPP
#define INCLUDED_STORAGE_HPP

#include <string>

#include "Auth.hpp"
#include "Util.hpp"

/// Base class of all Storage abstractions.
class StorageBase
{
public:

    /// Returns a local file path given a URI.
    /// If necessary copies the file locally first.
    virtual std::string getFilePathFromURI(const std::string& uri) = 0;

    /// Writes the contents of the file back to the URI.
    virtual bool restoreFileToURI(const std::string& path, const std::string& uri) = 0;

};

/// Trivial implementation of local storage that does not need do anything.
class LocalStorage : public StorageBase
{
public:

    std::string getFilePathFromURI(const std::string& uri) override
    {
        // It's local already.
        // TODO: Validate access?
        return uri;
    }

    bool restoreFileToURI(const std::string& path, const std::string& uri)
    {
        // Nothing to do.
        (void)path;
        (void)uri;
        return false;
    }
};

class WebDAVStorage : public StorageBase
{
public:

    WebDAVStorage(const std::string& url, std::unique_ptr<AuthBase> authAgent) :
        _url(url),
        _authAgent(std::move(authAgent))
    {
    }

    std::string getFilePathFromURI(const std::string& uri) override
    {
        // TODO: implement webdav GET.
        return uri;
    }

    bool restoreFileToURI(const std::string& path, const std::string& uri)
    {
        // TODO: implement webdav PUT.
        (void)path;
        (void)uri;
        return false;
    }

private:
    const std::string _url;
    std::unique_ptr<AuthBase> _authAgent;
};

#endif
/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
