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

#include <atomic>
#include <cassert>
#include <functional>
#include <memory>
#include <regex>
#include <set>
#include <sstream>
#include <string>

#include <Poco/File.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Message.h>
#include <Poco/Path.h>
#include <Poco/Process.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

/// Flag to stop pump loops.
extern std::atomic<bool> TerminationFlag;

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
    // if everything succeeded. If priority is PRIO_CRITICAL or PRIO_FATAL, we will try to make sure
    // an error message reaches a sysadmin. Such a message will be produced at most once every four
    // hours during the runtime of the process to make it less likely they are ignored as spam.
    bool saveDataToFileSafely(std::string fileName, const char *data, size_t size, Poco::Message::Priority priority);

    // Log the message with priority PRIO_CRITICAL. Don't log messages with the same tag more often
    // than maxMessagesPerDay.
    void alertSysadminWithoutSpamming(const std::string& message, const std::string& tag, int maxMessagesPerDay);

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
    std::string getTempFilePath(const std::string& srcDir, const std::string& srcFilename);

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
        RegexListMatcher() :
            _allowByDefault(false)
        {
        }

        RegexListMatcher(const bool allowByDefault) :
            _allowByDefault(allowByDefault)
        {
        }

        RegexListMatcher(std::initializer_list<std::string> allowed) :
            _allowByDefault(false),
            _allowed(allowed)
        {
        }

        RegexListMatcher(std::initializer_list<std::string> allowed,
                         std::initializer_list<std::string> denied) :
            _allowByDefault(false),
            _allowed(allowed),
            _denied(denied)
        {
        }

        RegexListMatcher(const bool allowByDefault,
                         std::initializer_list<std::string> denied) :
            _allowByDefault(allowByDefault),
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
            return (_allowByDefault || match(_allowed, subject)) &&
                    !match(_denied, subject);
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
                    Poco::RegularExpression::Match reMatch{};

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
        const bool _allowByDefault;
        std::set<std::string> _allowed;
        std::set<std::string> _denied;
    };

    /// A logical constant that is allowed to initialize
    /// exactly once and checks usage before initialization.
    template<typename T>
    class RuntimeConstant
    {
        T _value;
        std::atomic<bool> _initialized;

    public:
        RuntimeConstant()
            : _value()
            , _initialized(false)
        {
        }

        /// Use a compile-time const instead.
        RuntimeConstant(const T& value) = delete;

        const T& get()
        {
            if (_initialized)
            {
                return _value;
            }

            throw std::runtime_error("RuntimeConstant instance read before being initialized.");
        }

        void set(const T& value)
        {
            assert(!_initialized);

            _initialized = true;
            _value = value;
        }
    };
} // end namespace Util

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
