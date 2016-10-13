/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_UTIL_HPP
#define INCLUDED_UTIL_HPP

#include <cassert>
#include <string>
#include <sstream>
#include <functional>
#include <memory>
#include <set>

#include <Poco/File.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/RegularExpression.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include "Log.hpp"

/// Flag to stop pump loops.
extern volatile bool TerminationFlag;

namespace Util
{
    namespace rng
    {
        void reseed();
        unsigned getNext();
    }

    /// Encode an integral ID into a string, with padding support.
    std::string encodeId(const unsigned number, const int padding = 5);
    /// Decode an integral ID from a string.
    unsigned decodeId(const std::string& str);

    /// Creates a randomly name directory within path and returns the name.
    std::string createRandomDir(const std::string& path);

    bool windowingAvailable();

    // Save data to a file (overwriting an existing file if necessary) with checks for errors. Write
    // to a temporary file in the same directory that is then atomically renamed to the desired name
    // if everything goes well. In case of any error, both the destination file (if it already
    // exists) and the temporary file (if was created, or existed already) are removed. Return true
    // if everything succeeded.
    bool saveDataToFileSafely(std::string fileName, const char *data, size_t size);

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
    // minute.
    void checkDiskSpaceOnRegisteredFileSystems();

    // Check disk space on a specific file system, the one where 'path' is located. This does not
    // add that file system to the list used by 'registerFileSystemForDiskSpaceChecks'. If the free
    // space on the file system is below 5%, return false, otherwise true. Note that this function
    // does not call 'alertAllUsers'.
    bool checkDiskSpace(const std::string& path);

    // Sadly, older libpng headers don't use const for the pixmap pointer parameter to
    // png_write_row(), so can't use const here for pixmap.
    bool encodeBufferToPNG(unsigned char* pixmap, int width, int height,
                           std::vector<char>& output, LibreOfficeKitTileMode mode);
    bool encodeSubBufferToPNG(unsigned char* pixmap, int startX, int startY, int width, int height,
                              int bufferWidth, int bufferHeight,
                              std::vector<char>& output, LibreOfficeKitTileMode mode);

    /// Assert that a lock is already taken.
    template <typename T>
    void assertIsLocked(T& lock)
    {
        assert(!lock.try_lock());
    }

    /// Safely remove a file or directory.
    /// Supresses exception when the file is already removed.
    /// This can happen when there is a race (unavoidable) or when
    /// we don't care to check before we remove (when no race exists).
    inline
    void removeFile(const std::string& path, const bool recursive = false)
    {
        try
        {
            Poco::File(path).remove(recursive);
        }
        catch (const std::exception&)
        {
            // Already removed or we don't care about failures.
        }
    }

    inline
    void removeFile(const Poco::Path& path, const bool recursive = false)
    {
        removeFile(path.toString(), recursive);
    }

    /// Make a temp copy of a file.
    /// Primarily used by tests to avoid tainting the originals.
    /// srcDir shouldn't end with '/' and srcFilename shouldn't contain '/'.
    /// Returns the created file path.
    std::string getTempFilePath(const std::string srcDir, const std::string& srcFilename);

    /// Returns the name of the signal.
    const char *signalName(int signo);

    /// Trap signals to cleanup and exit the process gracefully.
    void setTerminationSignals();
    void setFatalSignals();

    void requestTermination(const Poco::Process::PID& pid);

    int getMemoryUsage(const Poco::Process::PID nPid);

    std::string replace(const std::string& s, const std::string& a, const std::string& b);

    std::string formatLinesForLog(const std::string& s);

    void setThreadName(const std::string& s);

    /// Get version information
    void getVersionInfo(std::string& version, std::string& hash);

    /// Return a string that is unique across processes and calls.
    std::string UniqueId();

    /// Given one or more patterns to allow, and one or more to deny,
    /// the match member will return true if, and only if, the subject
    /// matches the allowed list, but not the deny.
    /// By default, everything is denied.
    class RegexListMatcher
    {
    public:
        RegexListMatcher()
        {
        }

        RegexListMatcher(std::initializer_list<std::string> allowed) :
            _allowed(allowed)
        {
        }

        RegexListMatcher(std::initializer_list<std::string> allowed,
                         std::initializer_list<std::string> denied) :
            _allowed(allowed),
            _denied(denied)
        {
        }

        void allow(const std::string& pattern) { _allowed.insert(pattern); }
        void deny(const std::string& pattern)
        {
            _allowed.erase(pattern);
            _denied.insert(pattern);
        }

        void clear()
        {
            _allowed.clear();
            _denied.clear();
        }

        bool match(const std::string& subject) const
        {
            return (match(_allowed, subject) && !match(_denied, subject));
        }

    private:
        bool match(const std::set<std::string>& set, const std::string& subject) const
        {
            if (set.find(subject) != set.end())
            {
                return true;
            }

            // Not a perfect match, try regex.
            for (const auto& value : set)
            {
                try
                {
                    // Not performance critical to warrant caching.
                    Poco::RegularExpression re(value, Poco::RegularExpression::RE_CASELESS);
                    Poco::RegularExpression::Match reMatch;

                    // Must be a full match.
                    if (re.match(subject, reMatch) && reMatch.offset == 0 && reMatch.length == subject.size())
                    {
                        return true;
                    }
                }
                catch (const std::exception& exc)
                {
                    // Nothing to do; skip.
                }
            }

            return false;
        }

    private:
        std::set<std::string> _allowed;
        std::set<std::string> _denied;
    };

    template<typename T>
    class RuntimeConstant
    {
        T mValue;
        bool mInitialized;

    public:
        RuntimeConstant()
            : mValue()
            , mInitialized(false)
        {}

        const T& get()
        {
            if(mInitialized)
            {
                return mValue;
            }
            else
            {
                throw std::runtime_error("RuntimeConstant instance read before being initialized.");
            }
        }

        void set(const T& value)
        {
            assert(!mInitialized);

            mInitialized = true;
            mValue = value;
        }
    };
} // end namespace Util

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
