/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>
#include <config_version.h>

#ifndef COOLWSD_BUILDCONFIG
#define COOLWSD_BUILDCONFIG
#endif

#include "Util.hpp"

#include <poll.h>

#if HAVE_GETENTROPY
#  include <unistd.h>
#endif

#if HAVE_SYS_RANDOM_H
#  include <sys/random.h>
#endif

#ifdef __linux__
#  include <sys/prctl.h>
#  include <sys/syscall.h>
#  include <sys/vfs.h>
#  include <sys/resource.h>
#elif defined __FreeBSD__
#  include <sys/resource.h>
#  include <sys/thr.h>
#elif defined IOS
#import <Foundation/Foundation.h>
#endif
#include <sys/stat.h>
#include <sys/uio.h>
#include <sys/types.h>
#include <unistd.h>
#include <dirent.h>
#include <fcntl.h>
#include <spawn.h>

#include <atomic>
#include <cassert>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <unordered_map>
#include <random>
#include <sstream>
#include <string>
#include <thread>
#include <limits>

#include <Poco/Base64Encoder.h>
#include <Poco/HexBinaryEncoder.h>
#include <Poco/ConsoleChannel.h>
#include <Poco/Exception.h>
#include <Poco/Format.h>
#include <Poco/JSON/JSON.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/TemporaryFile.h>
#include <Poco/Util/Application.h>
#include <Poco/URI.h>

#include "Log.hpp"
#include "Protocol.hpp"
#include "TraceEvent.hpp"

namespace Util
{
    namespace rng
    {
        static std::mutex _rngMutex;

        // Create the prng with a random-device for seed.
        // If we don't have a hardware random-device, we will get the same seed.
        // In that case we are better off with an arbitrary, but changing, seed.
        static std::mt19937_64 _rng = std::mt19937_64(rng::getSeed());

        uint_fast64_t getSeed()
        {
            std::vector<char> hardRandom = getBytes(16);
            uint_fast64_t seed = *reinterpret_cast<uint_fast64_t *>(hardRandom.data());
            return seed;
        }

        // A new seed is used to shuffle the sequence.
        // N.B. Always reseed after getting forked!
        void reseed()
        {
            _rng.seed(rng::getSeed());
        }

        // Returns a new random number.
        unsigned getNext()
        {
            std::unique_lock<std::mutex> lock(_rngMutex);
            return _rng();
        }

        std::vector<char> getBytes(const std::size_t length)
        {
            std::vector<char> v(length);

            int len = -1;
#if !HAVE_GETENTROPY && !HAVE_SYS_RANDOM_H
#  error "getentropy or getrandom are required for succesful function";
#endif

#if HAVE_GETENTROPY
            len = getentropy(v.data(), length);
#endif

#if HAVE_SYS_RANDOM_H
            if (len < int(length))
            {
                char *buffer = v.data();
                size_t toRead = length;
                while (toRead > 0)
                {
                    int got = getrandom(buffer, toRead, GRND_NONBLOCK);
                    if (got < 0 && errno != EINTR)
                        break;
                    buffer += got;
                    toRead -= got;
                    len += got;
                }
            }
#endif

            if (len < int(length))
            {
                const int fd = open("/dev/urandom", O_RDONLY);
                if (fd < 0 ||
                    (len = read(fd, v.data(), length)) < 0 ||
                    std::size_t(len) < length)
                {
                    fprintf(stderr, "No adequate source of randomness, "
                            "failed to read %ld bytes: with error %s\n",
                            (long int)length, strerror(errno));
                    // Potentially dangerous to continue without randomness
                    abort();
                }
                if (fd >= 0)
                    close(fd);
            }

            return v;
        }

        /// Generate a string of random characters.
        std::string getHexString(const std::size_t length)
        {
            std::stringstream ss;
            Poco::HexBinaryEncoder hex(ss);
            hex.rdbuf()->setLineLength(0); // Don't insert line breaks.
            hex.write(getBytes(length).data(), length);
            hex.close(); // Flush.
            return ss.str().substr(0, length);
        }

        /// Generates a random string in Base64.
        /// Note: May contain '/' characters.
        std::string getB64String(const std::size_t length)
        {
            std::stringstream ss;
            Poco::Base64Encoder b64(ss);
            b64.write(getBytes(length).data(), length);
            return ss.str().substr(0, length);
        }

        std::string getFilename(const std::size_t length)
        {
            std::string s = getB64String(length * 2);
            s.erase(std::remove_if(s.begin(), s.end(),
                                   [](const std::string::value_type& c)
                                   {
                                       // Remove undesirable characters in a filename.
                                       return c == '/' || c == ' ' || c == '+';
                                   }),
                     s.end());
            return s.substr(0, length);
        }
    }

    std::string encodeId(const std::uint64_t number, const int padding)
    {
        std::ostringstream oss;
        oss << std::hex << std::setw(padding) << std::setfill('0') << number;
        return oss.str();
    }

    std::uint64_t decodeId(const std::string& str)
    {
        std::uint64_t id = 0;
        std::stringstream ss;
        ss << std::hex << str;
        ss >> id;
        return id;
    }

    bool windowingAvailable()
    {
        return std::getenv("DISPLAY") != nullptr;
    }

    bool kitInProcess = false;
    void setKitInProcess(bool value) { kitInProcess = value; }
    bool isKitInProcess() { return kitInProcess || isFuzzing() || isMobileApp(); }

    std::string replace(std::string result, const std::string& a, const std::string& b)
    {
        const std::size_t aSize = a.size();
        if (aSize > 0)
        {
            const std::size_t bSize = b.size();
            std::string::size_type pos = 0;
            while ((pos = result.find(a, pos)) != std::string::npos)
            {
                result.replace(pos, aSize, b);
                pos += bSize; // Skip the replacee to avoid endless recursion.
            }
        }

        return result;
    }

    std::string replaceAllOf(const std::string &str, const std::string& match, const std::string& repl)
    {
        std::ostringstream os;

        assert(match.size() == repl.size());
        if (match.size() != repl.size())
            return std::string("replaceAllOf failed");

        const std::size_t strSize = str.size();
        for (size_t i = 0; i < strSize; ++i)
        {
            auto pos = match.find(str[i]);
            if (pos != std::string::npos)
                os << repl[pos];
            else
                os << str[i];
        }

        return os.str();
    }

    std::string cleanupFilename(const std::string &filename)
    {
        static const std::string mtch(",/?:@&=+$#'\"");
        static const std::string repl("------------");
        return replaceAllOf(filename, mtch, repl);
    }

    std::string formatLinesForLog(const std::string& s)
    {
        std::string r;
        std::string::size_type n = s.size();
        if (n > 0 && s.back() == '\n')
            r = s.substr(0, n-1);
        else
            r = s;
        return replace(r, "\n", " / ");
    }

#if defined __linux__
    static thread_local pid_t ThreadTid = 0;

    pid_t getThreadId()
#else
    static thread_local long ThreadTid = 0;

    long getThreadId()
#endif
    {
        // Avoid so many redundant system calls
#if defined __linux__
        if (!ThreadTid)
            ThreadTid = ::syscall(SYS_gettid);
        return ThreadTid;
#elif defined __FreeBSD__
        if (!ThreadTid)
            thr_self(&ThreadTid);
        return ThreadTid;
#else
        static long threadCounter = 1;
        if (!ThreadTid)
            ThreadTid = threadCounter++;
        return ThreadTid;
#endif
    }

    void killThreadById(int tid, int signal)
    {
#if defined __linux__
        ::syscall(SYS_tgkill, getpid(), tid, signal);
#else
        LOG_WRN("No tgkill for thread " << tid);
#endif
    }

    // prctl(2) supports names of up to 16 characters, including null-termination.
    // Although in practice on linux more than 16 chars is supported.
    static thread_local char ThreadName[32] = {0};
    static_assert(sizeof(ThreadName) >= 16, "ThreadName should have a statically known size, and not be a pointer.");

    void setThreadName(const std::string& s)
    {
        // Clear the cache - perhaps we forked
        ThreadTid = 0;

        // Copy the current name.
        const std::string knownAs
            = ThreadName[0] ? "known as [" + std::string(ThreadName) + ']' : "unnamed";

        // Set the new name.
        strncpy(ThreadName, s.c_str(), sizeof(ThreadName) - 1);
        ThreadName[sizeof(ThreadName) - 1] = '\0';
#ifdef __linux__
        if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(s.c_str()), 0, 0, 0) != 0)
            LOG_SYS("Cannot set thread name of "
                    << getThreadId() << " (" << std::hex << std::this_thread::get_id() << std::dec
                    << ") of process " << getpid() << " currently " << knownAs << " to [" << s
                    << ']');
        else
            LOG_INF("Thread " << getThreadId() << " (" << std::hex << std::this_thread::get_id()
                              << std::dec << ") of process " << getpid() << " formerly " << knownAs
                              << " is now called [" << s << ']');
#elif defined IOS
        [[NSThread currentThread] setName:[NSString stringWithUTF8String:ThreadName]];
        LOG_INF("Thread " << getThreadId() << ") is now called [" << s << ']');
#endif

        // Emit a metadata Trace Event identifying this thread. This will invoke a different function
        // depending on which executable this is in.
        TraceEvent::emitOneRecordingIfEnabled("{\"name\":\"thread_name\",\"ph\":\"M\",\"args\":{\"name\":\""
                                              + s
                                              + "\"},\"pid\":"
                                              + std::to_string(getpid())
                                              + ",\"tid\":"
                                              + std::to_string(Util::getThreadId())
                                              + "},\n");
    }

    const char *getThreadName()
    {
        // Main process and/or not set yet.
        if (ThreadName[0] == '\0')
        {
#ifdef __linux__
            // prctl(2): The buffer should allow space for up to 16 bytes; the returned string will be null-terminated.
            if (prctl(PR_GET_NAME, reinterpret_cast<unsigned long>(ThreadName), 0, 0, 0) != 0)
                strncpy(ThreadName, "<noid>", sizeof(ThreadName) - 1);
#elif defined IOS
            const char *const name = [[[NSThread currentThread] name] UTF8String];
            strncpy(ThreadName, name, sizeof(ThreadName) - 1);
#endif
            ThreadName[sizeof(ThreadName) - 1] = '\0';
        }

        // Avoid so many redundant system calls
        return ThreadName;
    }

    void getVersionInfo(std::string& version, std::string& hash)
    {
        version = std::string(COOLWSD_VERSION);
        hash = std::string(COOLWSD_VERSION_HASH);
        hash.resize(std::min(8, (int)hash.length()));
    }

    const std::string& getProcessIdentifier()
    {
        static std::string id = Util::rng::getHexString(8);

        return id;
    }

    std::string getVersionJSON(bool enableExperimental)
    {
        std::string version, hash;
        Util::getVersionInfo(version, hash);
        return
            "{ \"Version\":     \"" + version + "\", "
              "\"Hash\":        \"" + hash + "\", "
              "\"BuildConfig\": \"" + std::string(COOLWSD_BUILDCONFIG) + "\", "
              "\"Protocol\":    \"" + COOLProtocol::GetProtocolVersion() + "\", "
              "\"Id\":          \"" + Util::getProcessIdentifier() + "\", "
              "\"Options\":     \"" + std::string(enableExperimental ? " (E)" : "") + "\" }";
    }

    std::string UniqueId()
    {
        static std::atomic_int counter(0);
        return std::to_string(getpid()) + '/' + std::to_string(counter++);
    }

    std::map<std::string, std::string> JsonToMap(const std::string& jsonString)
    {
        std::map<std::string, std::string> map;
        if (jsonString.empty())
            return map;

        Poco::JSON::Parser parser;
        const Poco::Dynamic::Var result = parser.parse(jsonString);
        const auto& json = result.extract<Poco::JSON::Object::Ptr>();

        std::vector<std::string> names;
        json->getNames(names);

        for (const auto& name : names)
        {
            map[name] = json->get(name).toString();
        }

        return map;
    }

    bool isValidURIScheme(const std::string& scheme)
    {
        if (scheme.empty())
            return false;

        for (char c : scheme)
        {
            if (!isalpha(c))
                return false;
        }

        return true;
    }

    bool isValidURIHost(const std::string& host)
    {
        if (host.empty())
            return false;

        for (char c : host)
        {
            if (!isalnum(c) && c != '_' && c != '-' && c != '.' && c !=':' && c != '[' && c != ']')
                return false;
        }

        return true;
    }

    std::string encodeURIComponent(const std::string& uri, const std::string& reserved)
    {
        std::string encoded;
        Poco::URI::encode(uri, reserved, encoded);
        return encoded;
    }

    std::string decodeURIComponent(const std::string& uri)
    {
        std::string decoded;
        Poco::URI::decode(uri, decoded);
        return decoded;
    }

    bool needsURIEncoding(const std::string& uri, const std::string& reserved)
    {
        const std::string decoded = decodeURIComponent(uri);
        if (decoded != uri)
        {
            // We could decode it; must have been encoded already.
            return false;
        }

        // Identical when decoded, might need encoding.
        const std::string encoded = encodeURIComponent(uri, reserved);

        // If identical, then doesn't need encoding.
        return encoded != uri;
    }

    /// Split a string in two at the delimiter and give the delimiter to the first.
    static
    std::pair<std::string, std::string> splitLast2(const std::string& str, const char delimiter = ' ')
    {
        if (!str.empty())
        {
            const char* s = str.c_str();
            const int length = str.size();
            const int pos = getLastDelimiterPosition(s, length, delimiter);
            if (pos < length)
                return std::make_pair(std::string(s, pos + 1), std::string(s + pos + 1));
        }

        // Not found; return in first.
        return std::make_pair(str, std::string());
    }

    std::tuple<std::string, std::string, std::string, std::string> splitUrl(const std::string& url)
    {
        // In case we have a URL that has parameters.
        std::string base;
        std::string params;
        std::tie(base, params) = Util::split(url, '?', false);

        std::string filename;
        std::tie(base, filename) = Util::splitLast2(base, '/');
        if (filename.empty())
        {
            // If no '/', then it's only filename.
            std::swap(base, filename);
        }

        std::string ext;
        std::tie(filename, ext) = Util::splitLast(filename, '.', false);

        return std::make_tuple(base, filename, ext, params);
    }

    static std::unordered_map<std::string, std::string> AnonymizedStrings;
    static std::atomic<unsigned> AnonymizationCounter(0);
    static std::mutex AnonymizedMutex;

    void mapAnonymized(const std::string& plain, const std::string& anonymized)
    {
        if (plain.empty() || anonymized.empty())
            return;

        if (Log::traceEnabled() && plain != anonymized)
            LOG_TRC("Anonymizing [" << plain << "] -> [" << anonymized << "].");

        std::unique_lock<std::mutex> lock(AnonymizedMutex);

        AnonymizedStrings[plain] = anonymized;
    }

    std::string anonymize(const std::string& text, const std::uint64_t nAnonymizationSalt)
    {
        {
            std::unique_lock<std::mutex> lock(AnonymizedMutex);

            const auto it = AnonymizedStrings.find(text);
            if (it != AnonymizedStrings.end())
            {
                if (Log::traceEnabled() && text != it->second)
                    LOG_TRC("Found anonymized [" << text << "] -> [" << it->second << "].");
                return it->second;
            }
        }

        // Modified 64-bit FNV-1a to add salting.
        // For the algorithm and the magic numbers, see http://isthe.com/chongo/tech/comp/fnv/
        std::uint64_t hash = 0xCBF29CE484222325LL;
        hash ^= nAnonymizationSalt;
        hash *= 0x100000001b3ULL;
        for (const char c : text)
        {
            hash ^= static_cast<std::uint64_t>(c);
            hash *= 0x100000001b3ULL;
        }

        hash ^= nAnonymizationSalt;
        hash *= 0x100000001b3ULL;

        // Generate the anonymized string. The '#' is to hint that it's anonymized.
        // Prepend with count to make it unique within a single process instance,
        // in case we get collisions (which we will, eventually). N.B.: Identical
        // strings likely to have different prefixes when logged in WSD process vs. Kit.
        std::string res
            = '#' + Util::encodeId(AnonymizationCounter++, 0) + '#' + Util::encodeId(hash, 0) + '#';
        mapAnonymized(text, res);
        return res;
    }

    void clearAnonymized()
    {
        AnonymizedStrings.clear();
    }

    std::string getFilenameFromURL(const std::string& url)
    {
        std::string base;
        std::string filename;
        std::string ext;
        std::string params;
        std::tie(base, filename, ext, params) = Util::splitUrl(url);
        return filename;
    }

    std::string anonymizeUrl(const std::string& url, const std::uint64_t nAnonymizationSalt)
    {
        std::string base;
        std::string filename;
        std::string ext;
        std::string params;
        std::tie(base, filename, ext, params) = Util::splitUrl(url);

        return base + Util::anonymize(filename, nAnonymizationSalt) + ext + params;
    }

    std::string getTimeNow(const char* format)
    {
        char time_now[64];
        std::chrono::system_clock::time_point now = std::chrono::system_clock::now();
        std::time_t now_c = std::chrono::system_clock::to_time_t(now);
        std::tm now_tm;
        gmtime_r(&now_c, &now_tm);
        strftime(time_now, sizeof(time_now), format, &now_tm);

        return time_now;
    }

    std::string getHttpTimeNow()
    {
        return getTimeNow("%a, %d %b %Y %T");
    }

    std::string getHttpTime(std::chrono::system_clock::time_point time)
    {
        char http_time[64];
        std::time_t time_c = std::chrono::system_clock::to_time_t(time);
        std::tm time_tm;
        gmtime_r(&time_c, &time_tm);
        strftime(http_time, sizeof(http_time), "%a, %d %b %Y %T", &time_tm);

        return http_time;
    }

    std::size_t findInVector(const std::vector<char>& tokens, const char *cstring, std::size_t offset)
    {
        assert(cstring);
        for (std::size_t i = 0; i < tokens.size() - offset; ++i)
        {
            std::size_t j;
            for (j = 0; i + j < tokens.size() - offset && cstring[j] != '\0' && tokens[i + j + offset] == cstring[j]; ++j)
                ;
            if (cstring[j] == '\0')
                return i + offset;
        }
        return std::string::npos;
    }

    std::string getIso8601FracformatTime(std::chrono::system_clock::time_point time){
        char time_modified[64];
        std::time_t lastModified_us_t = std::chrono::system_clock::to_time_t(time);
        std::tm lastModified_tm;
        gmtime_r(&lastModified_us_t,&lastModified_tm);
        strftime(time_modified, sizeof(time_modified), "%FT%T.", &lastModified_tm);

        auto lastModified_s = std::chrono::time_point_cast<std::chrono::seconds>(time);

        std::ostringstream oss;
        oss << std::setfill('0')
            << time_modified
            << std::setw(6)
            << (time - lastModified_s).count() / (std::chrono::system_clock::period::den / std::chrono::system_clock::period::num / 1000000)
            << 'Z';

        return oss.str();
    }

    std::string time_point_to_iso8601(std::chrono::system_clock::time_point tp)
    {
        const std::time_t tt = std::chrono::system_clock::to_time_t(tp);
        std::tm tm;
        gmtime_r(&tt, &tm);

        std::ostringstream oss;
        oss << tm.tm_year + 1900 << '-' << std::setfill('0') << std::setw(2) << tm.tm_mon + 1 << '-'
            << std::setfill('0') << std::setw(2) << tm.tm_mday << 'T';
        oss << std::setfill('0') << std::setw(2) << tm.tm_hour << ':';
        oss << std::setfill('0') << std::setw(2) << tm.tm_min << ':';
        const std::chrono::duration<double> sec
            = tp - std::chrono::system_clock::from_time_t(tt) + std::chrono::seconds(tm.tm_sec);
        if (sec.count() < 10)
            oss << '0';
        oss << std::fixed << sec.count() << 'Z';

        return oss.str();
    }

    std::chrono::system_clock::time_point iso8601ToTimestamp(const std::string& iso8601Time,
                                                             const std::string& logName)
    {
        std::chrono::system_clock::time_point timestamp;
        std::tm tm;
        const char* cstr = iso8601Time.c_str();
        const char* trailing;
        if (!(trailing = strptime(cstr, "%Y-%m-%dT%H:%M:%S", &tm)))
        {
            LOG_WRN(logName << " [" << iso8601Time << "] is in invalid format."
                            << "Returning " << timestamp.time_since_epoch().count());
            return timestamp;
        }

        timestamp += std::chrono::seconds(timegm(&tm));
        if (trailing[0] == '\0')
            return timestamp;

        if (trailing[0] != '.')
        {
            LOG_WRN(logName << " [" << iso8601Time << "] is in invalid format."
                            << ". Returning " << timestamp.time_since_epoch().count());
            return timestamp;
        }

        char* end = nullptr;
        const std::size_t us = strtoul(trailing + 1, &end, 10); // Skip the '.' and read as integer.

        std::size_t denominator = 1;
        for (const char* i = trailing + 1; i != end; i++)
        {
            denominator *= 10;
        }

        const std::size_t seconds_us = us * std::chrono::system_clock::period::den
                                       / std::chrono::system_clock::period::num / denominator;

        timestamp += std::chrono::system_clock::duration(seconds_us);

        return timestamp;
    }

    /// Returns the given system_clock time_point as string in the local time.
    /// Format: Thu Jan 27 03:45:27.123 2022
    std::string getSystemClockAsString(const std::chrono::system_clock::time_point &time)
    {
        const auto ms = std::chrono::time_point_cast<std::chrono::milliseconds>(time);
        const std::time_t t = std::chrono::system_clock::to_time_t(ms);
        const int msFraction =
            std::chrono::duration_cast<std::chrono::milliseconds>(time.time_since_epoch())
                .count() %
            1000;

        std::tm tm;
        localtime_r(&t, &tm);

        char buffer[128] = { 0 };
        std::strftime(buffer, 80, "%a %b %d %H:%M", &tm);
        std::stringstream ss;
        ss << buffer << '.' << std::setfill('0') << std::setw(3) << msFraction << ' '
           << tm.tm_year + 1900;
        return ss.str();
    }

    bool isFuzzing()
    {
#if LIBFUZZER
        return true;
#else
        return false;
#endif
    }

    std::map<std::string, std::string> stringVectorToMap(const std::vector<std::string>& strvector, const char delimiter)
    {
        std::map<std::string, std::string> result;

        for (auto it = strvector.begin(); it != strvector.end(); ++it)
        {
            std::size_t delimiterPosition = 0;
            delimiterPosition = (*it).find(delimiter, 0);
            if (delimiterPosition != std::string::npos)
            {
                std::string key = (*it).substr(0, delimiterPosition);
                delimiterPosition++;
                result[key] = (*it).substr(delimiterPosition);
            }
            else
            {
                LOG_WRN("Util::stringVectorToMap => record is misformed: " << (*it));
            }
        }

        return result;
    }

    static std::string ApplicationPath;
    void setApplicationPath(const std::string& path)
    {
        ApplicationPath = Poco::Path(path).absolute().toString();
    }

    std::string getApplicationPath()
    {
        return ApplicationPath;
    }

    int safe_atoi(const char* p, int len)
    {
        long ret{};
        if (!p || !len)
        {
            return ret;
        }

        int multiplier = 1;
        int offset = 0;
        while (isspace(p[offset]))
        {
            ++offset;
            if (offset >= len)
            {
                return ret;
            }
        }

        switch (p[offset])
        {
            case '-':
                multiplier = -1;
                ++offset;
                break;
            case '+':
                ++offset;
                break;
        }
        if (offset >= len)
        {
            return ret;
        }

        while (isdigit(p[offset]))
        {
            std::int64_t next = ret * 10 + (p[offset] - '0');
            if (next >= std::numeric_limits<int>::max())
                return multiplier * std::numeric_limits<int>::max();
            ret = next;
            ++offset;
            if (offset >= len)
            {
                return multiplier * ret;
            }
        }

        return multiplier * ret;
    }

    void forcedExit(int code)
    {
        if (code)
            LOG_FTL("Forced Exit with code: " << code);
        else
            LOG_INF("Forced Exit with code: " << code);

        Log::shutdown();

#if CODE_COVERAGE
        __gcov_dump();
#endif

        std::_Exit(code);
    }

    bool matchRegex(const std::set<std::string>& set, const std::string& subject)
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
                if (re.match(subject, reMatch) && reMatch.offset == 0 &&
                    reMatch.length == subject.size())
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

    std::string getValue(const std::map<std::string, std::string>& map, const std::string& subject)
    {
        if (map.find(subject) != map.end())
        {
            return map.at(subject);
        }

        // Not a perfect match, try regex.
        for (const auto& value : map)
        {
            try
            {
                // Not performance critical to warrant caching.
                Poco::RegularExpression re(value.first, Poco::RegularExpression::RE_CASELESS);
                Poco::RegularExpression::Match reMatch;

                // Must be a full match.
                if (re.match(subject, reMatch) && reMatch.offset == 0 &&
                    reMatch.length == subject.size())
                {
                    return value.second;
                }
            }
            catch (const std::exception& exc)
            {
                // Nothing to do; skip.
            }
        }

        return std::string();
    }

    std::string getValue(const std::set<std::string>& set, const std::string& subject)
    {
        auto search = set.find(subject);
        if (search != set.end())
        {
            return *search;
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
                if (re.match(subject, reMatch) && reMatch.offset == 0 &&
                    reMatch.length == subject.size())
                {
                    return value;
                }
            }
            catch (const std::exception& exc)
            {
                // Nothing to do; skip.
            }
        }

        return std::string();
    }

    void assertCorrectThread(std::thread::id owner, const char* fileName, int lineNo)
    {
        // uninitialized owner means detached and can be invoked by any thread.
        const bool sameThread = (owner == std::thread::id() || owner == std::this_thread::get_id());
        if (!sameThread)
            LOG_ERR("Incorrect thread affinity. Expected: "
                    << Log::to_string(owner) << " but called from "
                    << Log::to_string(std::this_thread::get_id()) << " (" << Util::getThreadId()
                    << "). (" << fileName << ":" << lineNo << ")");

        assert(sameThread);
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
