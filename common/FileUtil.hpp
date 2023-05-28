/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <cerrno>
#include <chrono>
#include <string>
#include <sys/stat.h>

#include <Poco/Path.h>

#include "Log.hpp"

namespace FileUtil
{
    /// Used for anonymizing URLs
    void setUrlAnonymization(bool anonymize, const std::uint64_t salt);

    /// Anonymize the basename of filenames, preserving the path and extension.
    std::string anonymizeUrl(const std::string& url);

    /// Anonymize user names and IDs.
    /// Will use the Obfuscated User ID if one is provided via WOPI.
    std::string anonymizeUsername(const std::string& username);

    /// Create a secure, random directory path.
    std::string createRandomDir(const std::string& path);

    // Save data to a file (overwriting an existing file if necessary) with checks for errors. Write
    // to a temporary file in the same directory that is then atomically renamed to the desired name
    // if everything goes well. In case of any error, both the destination file (if it already
    // exists) and the temporary file (if was created, or existed already) are removed. Return true
    // if everything succeeded.
    bool saveDataToFileSafely(const std::string& fileName, const char* data, std::size_t size);

    // We work around some of the mess of using the same sources both on the server side and in unit
    // tests with conditional compilation based on BUILDING_TESTS.

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
    /// Suppresses exception when the file is already removed.
    /// This can happen when there is a race (unavoidable) or when
    /// we don't care to check before we remove (when no race exists).
    void removeFile(const std::string& path, const bool recursive = false);

    inline void removeFile(const Poco::Path& path, const bool recursive = false)
    {
        removeFile(path.toString(), recursive);
    }

    /// Returns true iff the directory is empty (or doesn't exist).
    bool isEmptyDirectory(const char* path);
    inline bool isEmptyDirectory(const std::string& path) { return isEmptyDirectory(path.c_str()); }

    /// Returns true iff the path given is writable by our *real* UID.
    bool isWritable(const char* path);
    inline bool isWritable(const std::string& path) { return isWritable(path.c_str()); }

    /// Update the access-time and modified-time metadata for the given file.
    bool updateTimestamps(const std::string& filename, timespec tsAccess, timespec tsModified);

    /// Copy the source file to the target.
    bool copy(const std::string& fromPath, const std::string& toPath, bool log,
              bool throw_on_error);

    /// Atomically copy a file and optionally preserve its timestamps.
    /// The file is copied with a temporary name, and then atomically renamed.
    /// NOTE: toPath must be a valid filename, not a directory.
    /// Does not log (except errors), does not throw. Returns true on success.
    bool copyAtomic(const std::string& fromPath, const std::string& toPath,
                    bool preserveTimestamps);

    /// Copy a file from @fromPath to @toPath, throws on failure.
    inline void copyFileTo(const std::string& fromPath, const std::string& toPath)
    {
        copy(fromPath, toPath, /*log=*/true, /*throw_on_error=*/true);
    }

    /// Try to hard-link, and fallback to copying it linking fails.
    /// Returns true iff either linking or copying succeeds.
    inline bool linkOrCopyFile(const std::string& source, const std::string& newPath)
    {
        // first try a simple hard-link
        if (link(source.c_str(), newPath.c_str()) == 0)
            return true;

        const auto onrre = errno;
        LOG_DBG("Failed to link [" << source << "] to [" << newPath << "] ("
                                   << Util::symbolicErrno(onrre) << ": " << std::strerror(onrre)
                                   << "), will try to copy");

        return FileUtil::copy(source, newPath, /*log=*/true, /*throw_on_error=*/false);
    }

    /// Returns the system temporary directory.
    std::string getSysTempDirectoryPath();

    /// Create randomized temporary directory in the root provided
    /// with S_IRWXU (read, write, and execute by owner) permissions.
    /// If root is empty, the current system temp directory is used.
    std::string createRandomTmpDir(std::string root = std::string());

    /// Create a temporary directory in the root provided
    std::string createTmpDir(std::string dirName, std::string root = std::string());

    /// Make a temp copy of a file, and prepend it with a prefix.
    /// Used by tests to avoid tainting the originals.
    std::string getTempFileCopyPath(const std::string& srcDir, const std::string& srcFilename,
                                const std::string& dstFilenamePrefix);

    /// Make a temp copy of a file.
    /// Used by tests to avoid tainting the originals.
    /// srcDir shouldn't end with '/' and srcFilename shouldn't contain '/'.
    /// Returns the created file path.
    inline std::string getTempFileCopyPath(const std::string& srcDir, const std::string& srcFilename)
    {
        return getTempFileCopyPath(srcDir, srcFilename, std::string());
    }

    /// Returns the realpath(3) of the provided path.
    std::string realpath(const char* path);
    inline std::string realpath(const std::string& path)
    {
        return realpath(path.c_str());
    }

    /// Returns file extension from the path
    std::string extractFileExtension(const std::string& path);

    /// Returns true iff the two files both exist, can be read,
    /// have equal size and every byte of their contents match.
    bool compareFileContents(const std::string& rhsPath, const std::string& lhsPath);

    /// File/Directory stat helper.
    class Stat
    {
        int clearStat() { memset (&_sb, 0, sizeof(_sb)); return 0; }
    public:
        /// Stat the given path. Symbolic links are stat'ed when @link is true.
        Stat(const std::string& file, bool link = false)
            : _path(file)
            , _res(clearStat() | (link ? lstat(file.c_str(), &_sb) : stat(file.c_str(), &_sb)))
            , _errno(errno)
        {
        }

        bool good() const { return _res == 0; }
        bool bad() const { return !good(); }
        bool erno() const { return _errno; }
        const struct ::stat& sb() const { return _sb; }

        const std::string path() const { return _path; }

        bool isDirectory() const { return S_ISDIR(_sb.st_mode); }
        bool isFile() const { return S_ISREG(_sb.st_mode); }
        bool isLink() const { return S_ISLNK(_sb.st_mode); }
        std::size_t hardLinkCount() const { return _sb.st_nlink; }
        ino_t inodeNumber() const { return _sb.st_ino; }

        /// Returns the filesize in bytes.
        std::size_t size() const { return _sb.st_size; }

        /// Returns the modified unix-time as timespec since epoch with
        /// nanosecond precision, if/when the filesystem supports it.
        timespec modifiedTime() const
        {
#ifdef IOS
            return _sb.st_mtimespec;
#else
            return _sb.st_mtim;
#endif
        }

        /// Returns the modified unix-time in microseconds since epoch.
        int64_t modifiedTimeUs() const
        {
            // cast to make sure the calculation happens with enough bits
            return (static_cast<int64_t>(modifiedTime().tv_sec) * 1000 * 1000) + (modifiedTime().tv_nsec / 1000);
        }

        /// Returns the modified unix-time in milliseconds since epoch.
        std::size_t modifiedTimeMs() const
        {
            return (modifiedTime().tv_sec * 1000) + (modifiedTime().tv_nsec / 1000000);
        }

        /// Returns the modified unix-time as time_point (in microsecond precision, if available).
        /// The units is system-dependent, but it's 100% safe as time_point does the conversion
        /// to whatever we request, remembering the original units.
        std::chrono::system_clock::time_point modifiedTimepoint() const
        {
            // The time in microseconds.
            const std::chrono::microseconds us{ modifiedTimeUs() };

            // Convert to the precision of the system_clock::time_point,
            // which can be different from microseconds.
            return std::chrono::system_clock::time_point(
                std::chrono::duration_cast<std::chrono::system_clock::duration>(us));
        }

        /// Returns true iff the path exists, regardless of access permission.
        bool exists() const { return good() || (_errno != ENOENT && _errno != ENOTDIR); }

        /// Returns true if both files exist and have
        /// the same size and same contents.
        bool isIdenticalTo(const Stat& other) const
        {
            // No need to check whether they are linked or not,
            // since if they are, the following check will match,
            // and if they aren't, we still need to rely on the following.
            // Finally, compare the contents, to avoid costly copying if we fail to update.
            return (exists() && other.exists() && !isDirectory() && !other.isDirectory() &&
                    size() == other.size() && compareFileContents(_path, other._path));
        }

        /// Returns true if both files exist and have
        /// the same size and modified timestamp.
        bool isUpToDate(const Stat& other) const
        {
            // No need to check whether they are linked or not,
            // since if they are, the following check will match,
            // and if they aren't, we still need to rely on the following.
            // Finally, compare the contents, to avoid costly copying if we fail to update.
            if (isIdenticalTo(other))
            {
                return true;
            }

            // Clearly, no match. Log something informative.
            LOG_DBG("File contents mismatch: ["
                    << _path << "] " << (exists() ? "exists" : "missing") << ", " << size()
                    << " bytes, modified at " << modifiedTime().tv_sec << " =/= [" << other._path
                    << "]: " << (other.exists() ? "exists" : "missing") << ", " << other.size()
                    << " bytes, modified at " << other.modifiedTime().tv_sec);
            return false;
        }

    private:
        const std::string _path;
        struct ::stat _sb;
        const int _res;
        const int _errno;
    };

} // end namespace FileUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
