/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <string>

#include <Poco/File.h>
#include <Poco/Path.h>

namespace FileUtil
{
    /// Used for anonymizing URLs
    void setUrlAnonymization(bool anonymize, const std::uint64_t salt);

    /// Anonymize the basename of filenames, preserving the path and extension.
    std::string anonymizeUrl(const std::string& url);

    /// Anonymize user names and IDs.
    /// Will use the Obfuscated User ID if one is provied via WOPI.
    std::string anonymizeUsername(const std::string& username);

    /// Create a secure, random directory path.
    std::string createRandomDir(const std::string& path);

    // Save data to a file (overwriting an existing file if necessary) with checks for errors. Write
    // to a temporary file in the same directory that is then atomically renamed to the desired name
    // if everything goes well. In case of any error, both the destination file (if it already
    // exists) and the temporary file (if was created, or existed already) are removed. Return true
    // if everything succeeded.
    bool saveDataToFileSafely(const std::string& fileName, const char* data, size_t size);

    // We work around some of the mess of using the same sources both on the server side and in unit
    // tests with conditional compilation based on BUILDING_TESTS.

#ifndef BUILDING_TESTS
    // Send a 'error:' message with the specified cmd and kind parameters to all connected
    // clients. This function can be called either in loolwsd or loolkit processes, even if only
    // loolwsd obviously has contact with the actual clients; in loolkit it will be forwarded to
    // loolwsd for redistribution. (This function must be implemented separately in each program
    // that uses it, it is not in Util.cpp.)
    void alertAllUsers(const std::string& cmd, const std::string& kind);
#else
    // No-op implementation in the test programs
    inline void alertAllUsers(const std::string&, const std::string&)
    {
    }
#endif

    // Add the file system that 'path' is located on to a list of file systems that are periodically
    // checked for available space. The list is initially empty.
    void registerFileSystemForDiskSpaceChecks(const std::string& path);

    // Perform the check. If the free space on any of the registered file systems is below 5%, call
    // 'alertAllUsers("internal", "diskfull")'. The check will be made no more often than once a
    // minute if cacheLastCheck is set to true.
    std::string checkDiskSpaceOnRegisteredFileSystems(const bool cacheLastCheck = true);

    // Check disk space on a specific file system, the one where 'path' is located. This does not
    // add that file system to the list used by 'registerFileSystemForDiskSpaceChecks'. If the free
    // space on the file system is below 5%, return false, otherwise true. Note that this function
    // does not call 'alertAllUsers'.
    bool checkDiskSpace(const std::string& path);

    /// Safely remove a file or directory.
    /// Supresses exception when the file is already removed.
    /// This can happen when there is a race (unavoidable) or when
    /// we don't care to check before we remove (when no race exists).
    void removeFile(const std::string& path, const bool recursive = false);

    inline void removeFile(const Poco::Path& path, const bool recursive = false)
    {
        removeFile(path.toString(), recursive);
    }

    /// Copy a file from @fromPath to @toPath, throws on failure.
    void copyFileTo(const std::string &fromPath, const std::string &toPath);

    /// Make a temp copy of a file, and prepend it with a prefix.
    std::string getTempFilePath(const std::string& srcDir, const std::string& srcFilename,
                                const std::string& dstFilenamePrefix);

    /// Make a temp copy of a file.
    /// Primarily used by tests to avoid tainting the originals.
    /// srcDir shouldn't end with '/' and srcFilename shouldn't contain '/'.
    /// Returns the created file path.
    inline std::string getTempFilePath(const std::string& srcDir, const std::string& srcFilename)
    {
        return getTempFilePath(srcDir, srcFilename, std::string());
    }

} // end namespace FileUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
