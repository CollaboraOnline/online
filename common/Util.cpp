/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "Util.hpp"

#include <csignal>
#include <sys/poll.h>
#ifdef __linux
#  include <sys/prctl.h>
#  include <sys/syscall.h>
#  include <sys/vfs.h>
#  include <sys/resource.h>
#elif defined IOS
#import <Foundation/Foundation.h>
#endif
#include <sys/stat.h>
#include <sys/uio.h>
#include <sys/types.h>
#include <unistd.h>
#include <dirent.h>
#include <fcntl.h>

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

#include <Poco/Base64Encoder.h>
#include <Poco/HexBinaryEncoder.h>
#include <Poco/ConsoleChannel.h>
#include <Poco/Exception.h>
#include <Poco/Format.h>
#include <Poco/JSON/JSON.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/RandomStream.h>
#include <Poco/TemporaryFile.h>
#include <Poco/Timestamp.h>
#include <Poco/Util/Application.h>

#include "Common.hpp"
#include "Log.hpp"
#include "Protocol.hpp"
#include "Util.hpp"

using std::size_t;

namespace Util
{
    namespace rng
    {
        static std::random_device _rd;
        static std::mutex _rngMutex;
        static Poco::RandomBuf _randBuf;

        // Create the prng with a random-device for seed.
        // If we don't have a hardware random-device, we will get the same seed.
        // In that case we are better off with an arbitrary, but changing, seed.
        static std::mt19937_64 _rng = std::mt19937_64(_rd.entropy()
                                                    ? _rd()
                                                    : (clock() + getpid()));

        // A new seed is used to shuffle the sequence.
        // N.B. Always reseed after getting forked!
        void reseed()
        {
            _rng.seed(_rd.entropy() ? _rd() : (clock() + getpid()));
        }

        // Returns a new random number.
        unsigned getNext()
        {
            std::unique_lock<std::mutex> lock(_rngMutex);
            return _rng();
        }

        std::vector<char> getBytes(const size_t length)
        {
            std::vector<char> v(length);
            _randBuf.readFromDevice(v.data(), v.size());
            return v;
        }

        /// Generate a string of random characters.
        std::string getHexString(const size_t length)
        {
            std::stringstream ss;
            Poco::HexBinaryEncoder hex(ss);
            hex.rdbuf()->setLineLength(0); // Don't insert line breaks.
            hex.write(getBytes(length).data(), length);
            hex.close(); // Flush.
            return ss.str().substr(0, length);
        }

        /// Generate a string of harder random characters.
        std::string getHardRandomHexString(const size_t length)
        {
            std::stringstream ss;
            Poco::HexBinaryEncoder hex(ss);

            // a poor fallback but something.
            std::vector<char> random = getBytes(length);
            int fd = open("/dev/urandom", O_RDONLY);
            int len = 0;
            if (fd < 0 ||
                (len = read(fd, random.data(), length)) < 0 ||
                size_t(len) < length)
            {
                LOG_ERR("failed to read " << length << " hard random bytes, got " << len << " for hash: " << errno);
            }
            close(fd);

            hex.rdbuf()->setLineLength(0); // Don't insert line breaks.
            hex.write(random.data(), length);
            hex.close(); // Flush.
            return ss.str().substr(0, length);
        }

        /// Generates a random string in Base64.
        /// Note: May contain '/' characters.
        std::string getB64String(const size_t length)
        {
            std::stringstream ss;
            Poco::Base64Encoder b64(ss);
            b64.write(getBytes(length).data(), length);
            return ss.str().substr(0, length);
        }

        std::string getFilename(const size_t length)
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

    static std::string getDefaultTmpDir()
    {
        const char *tmp = getenv("TMPDIR");
        if (!tmp)
            tmp = getenv("TEMP");
        if (!tmp)
            tmp = getenv("TMP");
        if (!tmp)
            tmp = "/tmp";
        return tmp;
    }

    std::string createRandomTmpDir(std::string root)
    {
        if (root.empty())
            root = getDefaultTmpDir();
        const std::string newTmp = root + "/lool-" + rng::getFilename(16);
        if (::mkdir(newTmp.c_str(), S_IRWXU) < 0)
        {
            LOG_SYS("Failed to create random temp directory [" << newTmp << "]");
            return root;
        }
        return newTmp;
    }

#if !MOBILEAPP
    int getProcessThreadCount()
    {
        DIR *fdDir = opendir("/proc/self/task");
        if (!fdDir)
        {
            LOG_ERR("No proc mounted");
            return -1;
        }
        int tasks = 0;
        struct dirent *i;
        while ((i = readdir(fdDir)))
        {
            if (i->d_name[0] != '.')
                tasks++;
        }
        closedir(fdDir);
        return tasks;
    }

    // close what we have - far faster than going up to a 1m open_max eg.
    static bool closeFdsFromProc(std::map<int, int> *mapFdsToKeep = nullptr)
    {
          DIR *fdDir = opendir("/proc/self/fd");
          if (!fdDir)
              return false;

          struct dirent *i;

          while ((i = readdir(fdDir))) {
              if (i->d_name[0] == '.')
                  continue;

              char *e = NULL;
              errno = 0;
              long fd = strtol(i->d_name, &e, 10);
              if (errno != 0 || !e || *e)
                  continue;

              if (fd == dirfd(fdDir))
                  continue;

              if (fd < 3)
                  continue;

              if (mapFdsToKeep && mapFdsToKeep->find(fd) != mapFdsToKeep->end())
                  continue;

              if (close(fd) < 0)
                  std::cerr << "Unexpected failure to close fd " << fd << std::endl;
          }

          closedir(fdDir);
          return true;
    }

    static void closeFds(std::map<int, int> *mapFdsToKeep = nullptr)
    {
        if (!closeFdsFromProc(mapFdsToKeep))
        {
            std::cerr << "Couldn't close fds efficiently from /proc" << std::endl;
            for (int fd = 3; fd < sysconf(_SC_OPEN_MAX); ++fd)
                if (mapFdsToKeep->find(fd) != mapFdsToKeep->end())
                    close(fd);
        }
    }

    int spawnProcess(const std::string &cmd, const StringVector &args, const std::vector<int>* fdsToKeep, int *stdInput)
    {
        int pipeFds[2] = { -1, -1 };
        if (stdInput)
        {
            if (pipe2(pipeFds, O_NONBLOCK) < 0)
            {
                LOG_ERR("Out of file descriptors spawning " << cmd);
                throw Poco::SystemException("Out of file descriptors");
            }
        }

        // Create a vector of zero-terminated strings.
        std::vector<std::string> argStrings(args.size());
        for (const auto& arg : args)
        {
            argStrings.emplace_back(args.getParam(arg));
        }

        std::vector<char *> params;
        params.push_back(const_cast<char *>(cmd.c_str()));
        for (const auto& i : argStrings)
            params.push_back(const_cast<char *>(i.c_str()));
        params.push_back(nullptr);

        std::map<int, int> mapFdsToKeep;

        if (fdsToKeep)
            for (const auto& i : *fdsToKeep)
                mapFdsToKeep[i] = i;

        int pid = fork();
        if (pid < 0)
        {
            LOG_ERR("Failed to fork for command '" << cmd);
            throw Poco::SystemException("Failed to fork for command ", cmd);
        }
        else if (pid == 0) // child
        {
            if (stdInput)
                dup2(pipeFds[0], STDIN_FILENO);

            closeFds(&mapFdsToKeep);

            int ret = execvp(params[0], &params[0]);
            if (ret < 0)
                LOG_SFL("Failed to exec command '" << cmd << '\'');
            Log::shutdown();
            _exit(42);
        }
        // else spawning process still
        if (stdInput)
        {
            close(pipeFds[0]);
            *stdInput = pipeFds[1];
        }
        return pid;
    }

#endif

    bool dataFromHexString(const std::string& hexString, std::vector<unsigned char>& data)
    {
        if (hexString.length() % 2 != 0)
        {
            return false;
        }

        data.clear();
        std::stringstream stream;
        unsigned value;
        for (unsigned long offset = 0; offset < hexString.size(); offset += 2)
        {
            stream.clear();
            stream << std::hex << hexString.substr(offset, 2);
            stream >> value;
            data.push_back(static_cast<unsigned char>(value));
        }

        return true;
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

#if !MOBILEAPP

    static const char *startsWith(const char *line, const char *tag)
    {
        size_t len = std::strlen(tag);
        if (!strncmp(line, tag, len))
        {
            while (!isdigit(line[len]) && line[len] != '\0')
                ++len;

            return line + len;
        }

        return nullptr;
    }

    std::string getHumanizedBytes(unsigned long nBytes)
    {
        constexpr unsigned factor = 1024;
        short count = 0;
        float val = nBytes;
        while (val >= factor && count < 4) {
            val /= factor;
            count++;
        }
        std::string unit;
        switch (count)
        {
        case 0: unit = ""; break;
        case 1: unit = "ki"; break;
        case 2: unit = "Mi"; break;
        case 3: unit = "Gi"; break;
        case 4: unit = "Ti"; break;
        default: assert(false);
        }

        unit += 'B';
        std::stringstream ss;
        ss << std::fixed << std::setprecision(1) << val << ' ' << unit;
        return ss.str();
    }

    size_t getTotalSystemMemoryKb()
    {
        size_t totalMemKb = 0;
        FILE* file = fopen("/proc/meminfo", "r");
        if (file != nullptr)
        {
            char line[4096] = { 0 };
            while (fgets(line, sizeof(line), file))
            {
                const char* value;
                if ((value = startsWith(line, "MemTotal:")))
                {
                    totalMemKb = atoi(value);
                    break;
                }
            }
        }

        return totalMemKb;
    }

    std::pair<size_t, size_t> getPssAndDirtyFromSMaps(FILE* file)
    {
        size_t numPSSKb = 0;
        size_t numDirtyKb = 0;
        if (file)
        {
            rewind(file);
            char line[4096] = { 0 };
            while (fgets(line, sizeof (line), file))
            {
                const char *value;
                // Shared_Dirty is accounted for by forkit's RSS
                if ((value = startsWith(line, "Private_Dirty:")))
                {
                    numDirtyKb += atoi(value);
                }
                else if ((value = startsWith(line, "Pss:")))
                {
                    numPSSKb += atoi(value);
                }
            }
        }

        return std::make_pair(numPSSKb, numDirtyKb);
    }

    std::string getMemoryStats(FILE* file)
    {
        const std::pair<size_t, size_t> pssAndDirtyKb = getPssAndDirtyFromSMaps(file);
        std::ostringstream oss;
        oss << "procmemstats: pid=" << getpid()
            << " pss=" << pssAndDirtyKb.first
            << " dirty=" << pssAndDirtyKb.second;
        LOG_TRC("Collected " << oss.str());
        return oss.str();
    }

    size_t getMemoryUsagePSS(const pid_t pid)
    {
        if (pid > 0)
        {
            const auto cmd = "/proc/" + std::to_string(pid) + "/smaps";
            FILE* fp = fopen(cmd.c_str(), "r");
            if (fp != nullptr)
            {
                const size_t pss = getPssAndDirtyFromSMaps(fp).first;
                fclose(fp);
                return pss;
            }
        }

        return 0;
    }

    size_t getMemoryUsageRSS(const pid_t pid)
    {
        static const int pageSizeBytes = getpagesize();
        size_t rss = 0;

        if (pid > 0)
        {
            rss = getStatFromPid(pid, 23);
            rss *= pageSizeBytes;
            rss /= 1024;
            return rss;
        }
        return 0;
    }

    size_t getCpuUsage(const pid_t pid)
    {
        if (pid > 0)
        {
            size_t totalJiffies = 0;
            totalJiffies += getStatFromPid(pid, 13);
            totalJiffies += getStatFromPid(pid, 14);
            return totalJiffies;
        }
        return 0;
    }

    size_t getStatFromPid(const pid_t pid, int ind)
    {
        if (pid > 0)
        {
            const auto cmd = "/proc/" + std::to_string(pid) + "/stat";
            FILE* fp = fopen(cmd.c_str(), "r");
            if (fp != nullptr)
            {
                char line[4096] = { 0 };
                if (fgets(line, sizeof (line), fp))
                {
                    const std::string s(line);
                    int index = 1;
                    size_t pos = s.find(' ');
                    while (pos != std::string::npos)
                    {
                        if (index == ind)
                        {
                            fclose(fp);
                            return strtol(&s[pos], nullptr, 10);
                        }
                        ++index;
                        pos = s.find(' ', pos + 1);
                    }
                }
            }
        }
        return 0;
    }

    void setProcessAndThreadPriorities(const pid_t pid, int prio)
    {
        int res = setpriority(PRIO_PROCESS, pid, prio);
        LOG_TRC("Lowered kit [" << (int)pid << "] priority: " << prio << " with result: " << res);

        // rely on Linux thread-id priority setting to drop this thread' priority
        pid_t tid = getThreadId();
        res = setpriority(PRIO_PROCESS, tid, prio);
        LOG_TRC("Lowered own thread [" << (int)tid << "] priority: " << prio << " with result: " << res);
    }

#endif

    std::string replace(std::string result, const std::string& a, const std::string& b)
    {
        const size_t aSize = a.size();
        if (aSize > 0)
        {
            const size_t bSize = b.size();
            std::string::size_type pos = 0;
            while ((pos = result.find(a, pos)) != std::string::npos)
            {
                result = result.replace(pos, aSize, b);
                pos += bSize; // Skip the replacee to avoid endless recursion.
            }
        }

        return result;
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

    // prctl(2) supports names of up to 16 characters, including null-termination.
    // Although in practice on linux more than 16 chars is supported.
    static thread_local char ThreadName[32] = {0};
    static_assert(sizeof(ThreadName) >= 16, "ThreadName should have a statically known size, and not be a pointer.");

    void setThreadName(const std::string& s)
    {
        // Copy the current name.
        const std::string knownAs
            = ThreadName[0] ? "known as [" + std::string(ThreadName) + ']' : "unnamed";

        // Set the new name.
        strncpy(ThreadName, s.c_str(), sizeof(ThreadName) - 1);
        ThreadName[sizeof(ThreadName) - 1] = '\0';
#ifdef __linux
        if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(s.c_str()), 0, 0, 0) != 0)
            LOG_SYS("Cannot set thread name of "
                    << getThreadId() << " (" << std::hex << std::this_thread::get_id() << std::dec
                    << ") of process " << getpid() << " currently " << knownAs << " to [" << s
                    << "].");
        else
            LOG_INF("Thread " << getThreadId() << " (" << std::hex << std::this_thread::get_id()
                              << std::dec << ") of process " << getpid() << " formerly " << knownAs
                              << " is now called [" << s << "].");
#elif defined IOS
        [[NSThread currentThread] setName:[NSString stringWithUTF8String:ThreadName]];
        LOG_INF("Thread " << getThreadId() <<
                ") is now called [" << s << "].");
#endif
    }

    const char *getThreadName()
    {
        // Main process and/or not set yet.
        if (ThreadName[0] == '\0')
        {
#ifdef __linux
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

#ifdef __linux
    static thread_local pid_t ThreadTid = 0;

    pid_t getThreadId()
#else
    std::thread::id getThreadId()
#endif
    {
        // Avoid so many redundant system calls
#ifdef __linux
        if (!ThreadTid)
            ThreadTid = ::syscall(SYS_gettid);
        return ThreadTid;
#else
        return std::this_thread::get_id();
#endif
    }

    void getVersionInfo(std::string& version, std::string& hash)
    {
        version = std::string(LOOLWSD_VERSION);
        hash = std::string(LOOLWSD_VERSION_HASH);
        hash.resize(std::min(8, (int)hash.length()));
    }

    std::string getProcessIdentifier()
    {
        static std::string id = Util::rng::getHexString(8);

        return id;
    }

    std::string getVersionJSON()
    {
        std::string version, hash;
        Util::getVersionInfo(version, hash);
        return
            "{ \"Version\":  \"" + version + "\", "
            "\"Hash\":     \"" + hash + "\", "
            "\"Protocol\": \"" + LOOLProtocol::GetProtocolVersion() + "\", "
            "\"Id\":  \"" + Util::getProcessIdentifier() + "\" }";
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

    /// Split a string in two at the delimiter and give the delimiter to the first.
    static
    std::pair<std::string, std::string> splitLast2(const char* s, const int length, const char delimiter = ' ')
    {
        if (s != nullptr && length > 0)
        {
            const int pos = getLastDelimiterPosition(s, length, delimiter);
            if (pos < length)
                return std::make_pair(std::string(s, pos + 1), std::string(s + pos + 1));
        }

        // Not found; return in first.
        return std::make_pair(std::string(s, length), std::string());
    }

    std::tuple<std::string, std::string, std::string, std::string> splitUrl(const std::string& url)
    {
        // In case we have a URL that has parameters.
        std::string base;
        std::string params;
        std::tie(base, params) = Util::split(url, '?', false);

        std::string filename;
        std::tie(base, filename) = Util::splitLast2(base.c_str(), base.size(), '/');
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
        const std::string res
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

    std::string getHttpTimeNow()
    {
        char time_now[64];
        std::chrono::system_clock::time_point now = std::chrono::system_clock::now();
        std::time_t now_c = std::chrono::system_clock::to_time_t(now);
        std::tm now_tm = *std::gmtime(&now_c);
        strftime(time_now, sizeof(time_now), "%a, %d %b %Y %T", &now_tm);

        return time_now;
    }

    std::string getHttpTime(std::chrono::system_clock::time_point time)
    {
        char http_time[64];
        std::time_t time_c = std::chrono::system_clock::to_time_t(time);
        std::tm time_tm = *std::gmtime(&time_c);
        strftime(http_time, sizeof(http_time), "%a, %d %b %Y %T", &time_tm);

        return http_time;
    }

    size_t findInVector(const std::vector<char>& tokens, const char *cstring)
    {
        assert(cstring);
        for (size_t i = 0; i < tokens.size(); ++i)
        {
            size_t j;
            for (j = 0; i + j < tokens.size() && cstring[j] != '\0' && tokens[i + j] == cstring[j]; ++j)
                ;
            if (cstring[j] == '\0')
                return i;
        }
        return std::string::npos;
    }

    std::chrono::system_clock::time_point getFileTimestamp(const std::string& str_path)
    {
        struct stat file;
        stat(str_path.c_str(), &file);
        std::chrono::seconds ns{file.st_mtime};
        std::chrono::system_clock::time_point mod_time_point{ns};

        return mod_time_point;
    }

    std::string getIso8601FracformatTime(std::chrono::system_clock::time_point time){
        char time_modified[64];
        std::time_t lastModified_us_t = std::chrono::system_clock::to_time_t(time);
        std::tm lastModified_tm = *std::gmtime(&lastModified_us_t);
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
        const size_t us = strtoul(trailing + 1, &end, 10); // Skip the '.' and read as integer.

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

    std::string getSteadyClockAsString(const std::chrono::steady_clock::time_point &time)
    {
        auto now = std::chrono::steady_clock::now();
        const std::time_t t = std::chrono::system_clock::to_time_t(
            std::chrono::time_point_cast<std::chrono::seconds>(
                std::chrono::system_clock::now() + (time - now)));
        return std::ctime(&t);
    }

    bool isFuzzing()
    {
#if LIBFUZZER
        return true;
#else
        return false;
#endif
    }

    std::map<std::string, std::string> stringVectorToMap(std::vector<std::string> sVector, const char delimiter)
    {
        std::map<std::string, std::string> result;

        for (std::vector<std::string>::iterator it = sVector.begin(); it != sVector.end(); it++)
        {
            size_t delimiterPosition = 0;
            delimiterPosition = (*it).find(delimiter, 0);
            if (delimiterPosition != std::string::npos)
            {
                std::string key = (*it).substr(0, delimiterPosition);
                delimiterPosition++;
                std::string value = (*it).substr(delimiterPosition);
                result[key] = value;
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

    #if !MOBILEAPP
        // If OS is not mobile, it must be Linux.
        std::string getLinuxVersion(){
            // Read operating system info. We can read "os-release" file, located in /etc.
            std::ifstream ifs("/etc/os-release");
            std::string str(std::istreambuf_iterator<char>{ifs}, {});
            std::vector<std::string> infoList = Util::splitStringToVector(str, '\n');
            std::map<std::string, std::string> releaseInfo = Util::stringVectorToMap(infoList, '=');

            auto it = releaseInfo.find("PRETTY_NAME");
            if (it != releaseInfo.end())
            {
                return it->second;
            }
            else
            {
                return "unknown";
            }
        }
    #endif

    StringVector tokenizeAnyOf(const std::string& s, const char* delimiters)
    {
        // trim from the end so that we do not have to check this exact case
        // later
        std::size_t length = s.length();
        while (length > 0 && s[length - 1] == ' ')
            --length;

        if (length == 0)
            return StringVector();

        std::size_t delimitersLength = std::strlen(delimiters);
        std::size_t start = 0;

        std::vector<StringToken> tokens;
        tokens.reserve(16);

        while (start < length)
        {
            // ignore the leading whitespace
            while (start < length && s[start] == ' ')
                ++start;

            // anything left?
            if (start == length)
                break;

            std::size_t end = s.find_first_of(delimiters, start, delimitersLength);
            if (end == std::string::npos)
                end = length;

            // trim the trailing whitespace
            std::size_t trimEnd = end;
            while (start < trimEnd && s[trimEnd - 1] == ' ')
                --trimEnd;

            // add only non-empty tokens
            if (start < trimEnd)
                tokens.emplace_back(start, trimEnd - start);

            start = end + 1;
        }

        return StringVector(s, std::move(tokens));
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
