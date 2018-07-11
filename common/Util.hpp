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
#include <cerrno>
#include <cstddef>
#include <atomic>
#include <functional>
#include <memory>
#include <mutex>
#include <set>
#include <sstream>
#include <string>

#include <memory.h>

#include <Poco/File.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/RegularExpression.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

namespace Util
{
    namespace rng
    {
        void reseed();
        unsigned getNext();

        /// Generate an array of random characters.
        std::vector<char> getBytes(const size_t length);

        /// Generates a random string suitable for
        /// file/directory names.
        std::string getFilename(const size_t length);
    }

    /// Create randomized temporary directory
    std::string createRandomTmpDir();

    /// Get number of threads in this process or -1 on error
    int getProcessThreadCount();

    /// Spawn a process if stdInput is non-NULL it contains a writable descriptor
    /// to send data to the child.
    int spawnProcess(const std::string &cmd, const std::vector<std::string> &args,
                     int *stdInput = nullptr);

    /// Hex to unsigned char
    bool dataFromHexString(const std::string& hexString, std::vector<unsigned char>& data);
    /// Encode an integral ID into a string, with padding support.
    std::string encodeId(const unsigned number, const int padding = 5);
    /// Decode an integral ID from a string.
    unsigned decodeId(const std::string& str);

    bool windowingAvailable();

#if !defined(BUILDING_TESTS) && !defined(KIT_IN_PROCESS)

    /// Send a message to all clients.
    void alertAllUsers(const std::string& msg);

    /// Send a 'error:' message with the specified cmd and kind parameters to all connected
    /// clients. This function can be called either in loolwsd or loolkit processes, even if only
    /// loolwsd obviously has contact with the actual clients; in loolkit it will be forwarded to
    /// loolwsd for redistribution. (This function must be implemented separately in each program
    /// that uses it, it is not in Util.cpp.)
    void alertAllUsers(const std::string& cmd, const std::string& kind);
#else

    /// No-op implementation in the test programs
    inline void alertAllUsers(const std::string&)
    {
    }

    /// No-op implementation in the test programs
    inline void alertAllUsers(const std::string&, const std::string&)
    {
    }
#endif

    /// Assert that a lock is already taken.
    template <typename T>
    void assertIsLocked(const T& lock)
    {
#ifdef NDEBUG
        (void) lock;
#else
        assert(lock.owns_lock());
#endif
    }

    inline void assertIsLocked(std::mutex& mtx)
    {
#ifdef NDEBUG
        (void) mtx;
#else
        assert(!mtx.try_lock());
#endif
    }

    /// Print given number of bytes in human-understandable form (KB,MB, etc.)
    std::string getHumanizedBytes(unsigned long nBytes);

    /// Returns the total physical memory (in kB) available in the system
    size_t getTotalSystemMemoryKb();

    /// Returns the process PSS in KB (works only when we have perms for /proc/pid/smaps).
    size_t getMemoryUsagePSS(const Poco::Process::PID pid);

    /// Returns the process RSS in KB.
    size_t getMemoryUsageRSS(const Poco::Process::PID pid);

    /// Returns the RSS and PSS of the current process in KB.
    /// Example: "procmemstats: pid=123 rss=12400 pss=566"
    std::string getMemoryStats(FILE* file);

    size_t getCpuUsage(const Poco::Process::PID pid);

    size_t getStatFromPid(const Poco::Process::PID pid, int ind);

    std::string replace(std::string s, const std::string& a, const std::string& b);

    std::string formatLinesForLog(const std::string& s);

    void setThreadName(const std::string& s);

    const char *getThreadName();

    pid_t getThreadId();

    /// Get version information
    void getVersionInfo(std::string& version, std::string& hash);

    /// Return a string that is unique across processes and calls.
    std::string UniqueId();

    // Extract all json entries into a map.
    std::map<std::string, std::string> JsonToMap(const std::string& jsonString);

    /// Dump a lineof data as hex
    inline std::string stringifyHexLine(
                            const std::vector<char> &buffer,
                            unsigned int offset,
                            const unsigned int width = 32)
    {
        char scratch[64];
        std::stringstream os;

        for (unsigned int i = 0; i < width; i++)
        {
            if (i && (i % 8) == 0)
                os << " ";
            if ((offset + i) < buffer.size())
                sprintf (scratch, "%.2x ", (unsigned char)buffer[offset+i]);
            else
                sprintf (scratch, "   ");
            os << scratch;
        }
        os << " | ";

        for (unsigned int i = 0; i < width; i++)
        {
            if ((offset + i) < buffer.size() && ::isprint(buffer[offset+i]))
                sprintf (scratch, "%c", buffer[offset+i]);
            else
                sprintf (scratch, ".");
            os << scratch;
        }

        return os.str();
    }

    /// Dump data as hex and chars to stream
    inline void dumpHex (std::ostream &os, const char *legend, const char *prefix,
                         const std::vector<char> &buffer, bool skipDup = true,
                         const unsigned int width = 32)
    {
        unsigned int j;
        char scratch[64];
        int skip = 0;
        std::string lastLine;

        os << legend;
        for (j = 0; j < buffer.size() + width - 1; j += width)
        {
            sprintf (scratch, "%s0x%.4x  ", prefix, j);
            os << scratch;

            std::string line = stringifyHexLine(buffer, j, width);
            if (skipDup && lastLine == line)
                skip++;
            else {
                if (skip > 0)
                {
                    os << "... dup " << skip - 1 << "...";
                    skip = 0;
                }
                else
                    os << line;
            }
            lastLine.swap(line);

            os << "\n";
        }
        os.flush();
    }

    /// Trim spaces from the left. Just spaces.
    inline std::string& ltrim(std::string& s)
    {
        const size_t pos = s.find_first_not_of(' ');
        if (pos != std::string::npos)
        {
            s = s.substr(pos);
        }

        return s;
    }

    /// Trim spaces from the left and copy. Just spaces.
    inline std::string ltrimmed(const std::string& s)
    {
        const size_t pos = s.find_first_not_of(' ');
        if (pos != std::string::npos)
        {
            return s.substr(pos);
        }

        return s;
    }

    /// Trim spaces from both left and right. Just spaces.
    inline std::string& trim(std::string& s)
    {
        const size_t first = s.find_first_not_of(' ');
        const size_t last = s.find_last_not_of(' ');
        if (first != std::string::npos)
        {
            if (last != std::string::npos)
            {
                s = s.substr(first, last + 1 - first);
            }
            else
            {
                s = s.substr(first);
            }
        }
        else
        {
            if (last != std::string::npos)
            {
                s = s.substr(0, last + 1);
            }
            else
            {
                s.clear();
            }
        }

        return s;
    }

    /// Trim spaces from both left and right and copy. Just spaces.
    inline std::string trimmed(const std::string& s)
    {
        const size_t first = s.find_first_not_of(' ');
        const size_t last = s.find_last_not_of(' ');
        if (first != std::string::npos)
        {
            if (last != std::string::npos)
            {
                return s.substr(first, last + 1 - first);
            }

            return s.substr(first);
        }

        if (last != std::string::npos)
        {
            return s.substr(0, last + 1);
        }

        return std::string();
    }

    /// Trim spaces from left and right. Just spaces.
    inline std::string trimmed(const char* s)
    {
        return trimmed(std::string(s));
    }

    inline bool startsWith(const std::string& s, const std::string& t)
    {
        return s.length() >= t.length() && memcmp(s.c_str(), t.c_str(), t.length()) == 0;
    }

    /// Return the symbolic name for an errno value, or in decimal if not handled here.
    inline std::string symbolicErrno(int e)
    {
        // Errnos from <asm-generic/errno-base.h> and <asm-generic/errno.h> on Linux.
        switch (e)
        {
        case EPERM: return "EPERM";
        case ENOENT: return "ENOENT";
        case ESRCH: return "ESRCH";
        case EINTR: return "EINTR";
        case EIO: return "EIO";
        case ENXIO: return "ENXIO";
        case E2BIG: return "E2BIG";
        case ENOEXEC: return "ENOEXEC";
        case EBADF: return "EBADF";
        case ECHILD: return "ECHILD";
        case EAGAIN: return "EAGAIN";
        case ENOMEM: return "ENOMEM";
        case EACCES: return "EACCES";
        case EFAULT: return "EFAULT";
        case ENOTBLK: return "ENOTBLK";
        case EBUSY: return "EBUSY";
        case EEXIST: return "EEXIST";
        case EXDEV: return "EXDEV";
        case ENODEV: return "ENODEV";
        case ENOTDIR: return "ENOTDIR";
        case EISDIR: return "EISDIR";
        case EINVAL: return "EINVAL";
        case ENFILE: return "ENFILE";
        case EMFILE: return "EMFILE";
        case ENOTTY: return "ENOTTY";
        case ETXTBSY: return "ETXTBSY";
        case EFBIG: return "EFBIG";
        case ENOSPC: return "ENOSPC";
        case ESPIPE: return "ESPIPE";
        case EROFS: return "EROFS";
        case EMLINK: return "EMLINK";
        case EPIPE: return "EPIPE";
        case EDOM: return "EDOM";
        case ERANGE: return "ERANGE";
        case EDEADLK: return "EDEADLK";
        case ENAMETOOLONG: return "ENAMETOOLONG";
        case ENOLCK: return "ENOLCK";
        case ENOSYS: return "ENOSYS";
        case ENOTEMPTY: return "ENOTEMPTY";
        case ELOOP: return "ELOOP";
        case ENOMSG: return "ENOMSG";
        case EIDRM: return "EIDRM";
        case ECHRNG: return "ECHRNG";
        case EL2NSYNC: return "EL2NSYNC";
        case EL3HLT: return "EL3HLT";
        case EL3RST: return "EL3RST";
        case ELNRNG: return "ELNRNG";
        case EUNATCH: return "EUNATCH";
        case ENOCSI: return "ENOCSI";
        case EL2HLT: return "EL2HLT";
        case EBADE: return "EBADE";
        case EBADR: return "EBADR";
        case EXFULL: return "EXFULL";
        case ENOANO: return "ENOANO";
        case EBADRQC: return "EBADRQC";
        case EBADSLT: return "EBADSLT";
        case EBFONT: return "EBFONT";
        case ENOSTR: return "ENOSTR";
        case ENODATA: return "ENODATA";
        case ETIME: return "ETIME";
        case ENOSR: return "ENOSR";
        case ENONET: return "ENONET";
        case ENOPKG: return "ENOPKG";
        case EREMOTE: return "EREMOTE";
        case ENOLINK: return "ENOLINK";
        case EADV: return "EADV";
        case ESRMNT: return "ESRMNT";
        case ECOMM: return "ECOMM";
        case EPROTO: return "EPROTO";
        case EMULTIHOP: return "EMULTIHOP";
        case EDOTDOT: return "EDOTDOT";
        case EBADMSG: return "EBADMSG";
        case EOVERFLOW: return "EOVERFLOW";
        case ENOTUNIQ: return "ENOTUNIQ";
        case EBADFD: return "EBADFD";
        case EREMCHG: return "EREMCHG";
        case ELIBACC: return "ELIBACC";
        case ELIBBAD: return "ELIBBAD";
        case ELIBSCN: return "ELIBSCN";
        case ELIBMAX: return "ELIBMAX";
        case ELIBEXEC: return "ELIBEXEC";
        case EILSEQ: return "EILSEQ";
        case ERESTART: return "ERESTART";
        case ESTRPIPE: return "ESTRPIPE";
        case EUSERS: return "EUSERS";
        case ENOTSOCK: return "ENOTSOCK";
        case EDESTADDRREQ: return "EDESTADDRREQ";
        case EMSGSIZE: return "EMSGSIZE";
        case EPROTOTYPE: return "EPROTOTYPE";
        case ENOPROTOOPT: return "ENOPROTOOPT";
        case EPROTONOSUPPORT: return "EPROTONOSUPPORT";
        case ESOCKTNOSUPPORT: return "ESOCKTNOSUPPORT";
        case EOPNOTSUPP: return "EOPNOTSUPP";
        case EPFNOSUPPORT: return "EPFNOSUPPORT";
        case EAFNOSUPPORT: return "EAFNOSUPPORT";
        case EADDRINUSE: return "EADDRINUSE";
        case EADDRNOTAVAIL: return "EADDRNOTAVAIL";
        case ENETDOWN: return "ENETDOWN";
        case ENETUNREACH: return "ENETUNREACH";
        case ENETRESET: return "ENETRESET";
        case ECONNABORTED: return "ECONNABORTED";
        case ECONNRESET: return "ECONNRESET";
        case ENOBUFS: return "ENOBUFS";
        case EISCONN: return "EISCONN";
        case ENOTCONN: return "ENOTCONN";
        case ESHUTDOWN: return "ESHUTDOWN";
        case ETOOMANYREFS: return "ETOOMANYREFS";
        case ETIMEDOUT: return "ETIMEDOUT";
        case ECONNREFUSED: return "ECONNREFUSED";
        case EHOSTDOWN: return "EHOSTDOWN";
        case EHOSTUNREACH: return "EHOSTUNREACH";
        case EALREADY: return "EALREADY";
        case EINPROGRESS: return "EINPROGRESS";
        case ESTALE: return "ESTALE";
        case EUCLEAN: return "EUCLEAN";
        case ENOTNAM: return "ENOTNAM";
        case ENAVAIL: return "ENAVAIL";
        case EISNAM: return "EISNAM";
        case EREMOTEIO: return "EREMOTEIO";
        case EDQUOT: return "EDQUOT";
        case ENOMEDIUM: return "ENOMEDIUM";
        case EMEDIUMTYPE: return "EMEDIUMTYPE";
        case ECANCELED: return "ECANCELED";
        case ENOKEY: return "ENOKEY";
        case EKEYEXPIRED: return "EKEYEXPIRED";
        case EKEYREVOKED: return "EKEYREVOKED";
        case EKEYREJECTED: return "EKEYREJECTED";
        case EOWNERDEAD: return "EOWNERDEAD";
        case ENOTRECOVERABLE: return "ENOTRECOVERABLE";
        case ERFKILL: return "ERFKILL";
        case EHWPOISON: return "EHWPOISON";
        default: return std::to_string(e);
        }
    }

    /// Check for the URI scheme validity.
    /// For now just a basic sanity check, can be extended if necessary.
    bool isValidURIScheme(const std::string& scheme);

    /// Check for the URI host validity.
    /// For now just a basic sanity check, can be extended if necessary.
    bool isValidURIHost(const std::string& host);

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
            return (_allowByDefault || match(_allowed, subject)) && !match(_denied, subject);
        }

    private:
        static bool match(const std::set<std::string>& set, const std::string& subject)
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
        const bool _allowByDefault;
        std::set<std::string> _allowed;
        std::set<std::string> _denied;
    };

    /// A logical constant that is allowed to initialize
    /// exactly once and checks usage before initialization.
    template <typename T>
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
