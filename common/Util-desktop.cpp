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

#include "Util.hpp"

#ifdef __linux__
#include <sys/resource.h>
#elif defined __FreeBSD__
#include <sys/resource.h>
#endif

#include <dirent.h>
#include <spawn.h>

#include <fstream>
#include <iomanip>

#include "Log.hpp"

namespace Util
{
bool isMobileApp() { return false; }

DirectoryCounter::DirectoryCounter(const char* procPath)
    : _tasks(opendir(procPath))
{
    if (!_tasks)
        LOG_ERR("No proc mounted, can't count threads");
}

DirectoryCounter::~DirectoryCounter() { closedir(reinterpret_cast<DIR*>(_tasks)); }

int DirectoryCounter::count()
{
    auto dir = reinterpret_cast<DIR*>(_tasks);

    if (!dir)
        return -1;

    rewinddir(dir);

    int tasks = 0;
    struct dirent* i;
    while ((i = readdir(dir)))
    {
        if (i->d_name[0] != '.')
            tasks++;
    }

    return tasks;
}

int spawnProcess(const std::string& cmd, const StringVector& args)
{
    // Create a vector of zero-terminated strings.
    std::vector<std::string> argStrings;
    for (const auto& arg : args)
        argStrings.push_back(args.getParam(arg));

    std::vector<char*> params;
    params.push_back(const_cast<char*>(cmd.c_str()));
    for (const auto& i : argStrings)
        params.push_back(const_cast<char*>(i.c_str()));
    params.push_back(nullptr);

    pid_t pid = -1;
    int status = posix_spawn(&pid, params[0], nullptr, nullptr, params.data(), environ);
    if (status < 0)
    {
        LOG_ERR("Failed to posix_spawn for command '" << cmd);
        throw Poco::SystemException("Failed to fork posix_spawn command ", cmd);
    }

    return pid;
}

static const char* startsWith(const char* line, const char* tag, std::size_t tagLen)
{
    assert(strlen(tag) == tagLen);

    std::size_t len = tagLen;
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
    while (val >= factor && count < 4)
    {
        val /= factor;
        count++;
    }
    std::string unit;
    switch (count)
    {
        case 0:
            unit = "";
            break;
        case 1:
            unit = "ki";
            break;
        case 2:
            unit = "Mi";
            break;
        case 3:
            unit = "Gi";
            break;
        case 4:
            unit = "Ti";
            break;
        default:
            assert(false);
    }

    unit += 'B';
    std::stringstream ss;
    ss << std::fixed << std::setprecision(1) << val << ' ' << unit;
    return ss.str();
}

std::size_t getTotalSystemMemoryKb()
{
    std::size_t totalMemKb = 0;
    FILE* file = fopen("/proc/meminfo", "r");
    if (file != nullptr)
    {
        char line[4096] = { 0 };
        // coverity[tainted_data_argument : FALSE] - we trust the kernel-provided data
        while (fgets(line, sizeof(line), file))
        {
            const char* value;
            if ((value = startsWith(line, "MemTotal:", 9)))
            {
                totalMemKb = atoll(value);
                break;
            }
        }
        fclose(file);
    }

    return totalMemKb;
}

std::size_t getFromCGroup(const std::string& group, const std::string& key)
{
    std::size_t num = 0;

    std::string groupPath;
    FILE* cg = fopen("/proc/self/cgroup", "r");
    if (cg != nullptr)
    {
        char line[4096] = { 0 };
        while (fgets(line, sizeof(line), cg))
        {
            StringVector bits = StringVector::tokenize(line, strlen(line), ':');
            if (bits.size() > 2 && bits[1] == group)
            {
                groupPath = "/sys/fs/cgroup/" + group + bits[2];
                break;
            }
        }
        LOG_TRC("control group path for " << group << " is " << groupPath);
        fclose(cg);
    }

    if (groupPath.empty())
        return 0;

    std::string path = groupPath + "/" + key;
    LOG_TRC("Read from " << path);
    FILE* file = fopen(path.c_str(), "r");
    if (file != nullptr)
    {
        char line[4096] = { 0 };
        if (fgets(line, sizeof(line), file))
            num = atoll(line);
        fclose(file);
    }

    return num;
}

std::size_t getCGroupMemLimit()
{
#ifdef __linux__
    return getFromCGroup("memory", "memory.limit_in_bytes");
#else
    return 0;
#endif
}

std::size_t getCGroupMemSoftLimit()
{
#ifdef __linux__
    return getFromCGroup("memory", "memory.soft_limit_in_bytes");
#else
    return 0;
#endif
}

std::pair<std::size_t, std::size_t> getPssAndDirtyFromSMaps(FILE* file)
{
    std::size_t numPSSKb = 0;
    std::size_t numDirtyKb = 0;
    if (file)
    {
        rewind(file);
        char line[4096] = { 0 };
        while (fgets(line, sizeof(line), file))
        {
            if (line[0] != 'P')
                continue;

            const char* value;

            // Shared_Dirty is accounted for by forkit's RSS
            if ((value = startsWith(line, "Private_Dirty:", 14)))
            {
                numDirtyKb += atoi(value);
            }
            else if ((value = startsWith(line, "Pss:", 4)))
            {
                numPSSKb += atoi(value);
            }
        }
    }

    return std::make_pair(numPSSKb, numDirtyKb);
}

std::string getMemoryStats(FILE* file)
{
    const std::pair<std::size_t, std::size_t> pssAndDirtyKb = getPssAndDirtyFromSMaps(file);
    std::ostringstream oss;
    oss << "procmemstats: pid=" << getpid() << " pss=" << pssAndDirtyKb.first
        << " dirty=" << pssAndDirtyKb.second;
    LOG_TRC("Collected " << oss.str());
    return oss.str();
}

std::size_t getMemoryUsagePSS(const pid_t pid)
{
    if (pid > 0)
    {
        // beautifully aggregated data in a single entry:
        const auto cmd_rollup = "/proc/" + std::to_string(pid) + "/smaps_rollup";
        FILE* fp = fopen(cmd_rollup.c_str(), "r");
        if (!fp)
        {
            const auto cmd = "/proc/" + std::to_string(pid) + "/smaps";
            fp = fopen(cmd.c_str(), "r");
        }

        if (fp != nullptr)
        {
            const std::size_t pss = getPssAndDirtyFromSMaps(fp).first;
            fclose(fp);
            return pss;
        }
    }

    return 0;
}

std::size_t getMemoryUsageRSS(const pid_t pid)
{
    static const int pageSizeBytes = getpagesize();
    std::size_t rss = 0;

    if (pid > 0)
    {
        rss = getStatFromPid(pid, 23);
        rss *= pageSizeBytes;
        rss /= 1024;
        return rss;
    }
    return 0;
}

size_t getCurrentThreadCount()
{
    DIR* dir = opendir("/proc/self/task");
    if (!dir)
    {
        LOG_TRC("Failed to open /proc/self/task");
        return 0;
    }

    size_t threads = 0;
    struct dirent* it;
    while ((it = readdir(dir)) != nullptr)
    {
        if (it->d_name[0] == '.')
            continue;
        threads++;
    }
    closedir(dir);
    LOG_TRC("We have " << threads << " threads");
    return threads;
}

std::size_t getCpuUsage(const pid_t pid)
{
    if (pid > 0)
    {
        std::size_t totalJiffies = 0;
        totalJiffies += getStatFromPid(pid, 13);
        totalJiffies += getStatFromPid(pid, 14);
        return totalJiffies;
    }
    return 0;
}

std::size_t getStatFromPid(const pid_t pid, int ind)
{
    if (pid > 0)
    {
        const auto cmd = "/proc/" + std::to_string(pid) + "/stat";
        FILE* fp = fopen(cmd.c_str(), "r");
        if (fp != nullptr)
        {
            char line[4096] = { 0 };
            if (fgets(line, sizeof(line), fp))
            {
                const std::string s(line);
                int index = 1;
                std::size_t pos = s.find(' ');
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
            fclose(fp);
        }
    }
    return 0;
}

void setProcessAndThreadPriorities(const pid_t pid, int prio)
{
    int res = setpriority(PRIO_PROCESS, pid, prio);
    LOG_TRC("Lowered kit [" << (int)pid << "] priority: " << prio << " with result: " << res);

#ifdef __linux__
    // rely on Linux thread-id priority setting to drop this thread' priority
    pid_t tid = getThreadId();
    res = setpriority(PRIO_PROCESS, tid, prio);
    LOG_TRC("Lowered own thread [" << (int)tid << "] priority: " << prio
                                   << " with result: " << res);
#endif
}
// If OS is not mobile, it must be Linux.
std::string getLinuxVersion()
{
    // Read operating system info. We can read "os-release" file, located in /etc.
    std::ifstream ifs("/etc/os-release");
    std::string str(std::istreambuf_iterator<char>{ ifs }, {});
    std::vector<std::string> infoList = Util::splitStringToVector(str, '\n');
    std::map<std::string, std::string> releaseInfo = Util::stringVectorToMap(infoList, '=');

    auto it = releaseInfo.find("PRETTY_NAME");
    if (it != releaseInfo.end())
    {
        std::string name = it->second;

        // See os-release(5). It says that the lines are "environment-like shell-compatible
        // variable assignments". What that means, *exactly*, is up for debate, but probably
        // of mainly academic interest. (It does say that variable expansion at least is not
        // supported, that is a relief.)

        // The value of PRETTY_NAME might be quoted with double-quotes or
        // single-quotes.

        // FIXME: In addition, it might contain backslash-escaped special
        // characters, but we ignore that possibility for now.

        // FIXME: In addition, if it really does support shell syntax (except variable
        // expansion), it could for instance consist of multiple concatenated quoted strings (with no
        // whitespace inbetween), as in:
        // PRETTY_NAME="Foo "'bar'" mumble"
        // But I guess that is a pretty remote possibility and surely no other code that
        // reads /etc/os-release handles that like a proper shell, either.

        if (name.length() >= 2 && ((name[0] == '"' && name[name.length() - 1] == '"') ||
                                   (name[0] == '\'' && name[name.length() - 1] == '\'')))
            name = name.substr(1, name.length() - 2);
        return name;
    }
    else
    {
        return "unknown";
    }
}

#if defined(BUILDING_TESTS)
/// No-op implementation in the test programs
void alertAllUsers(const std::string&) {}

/// No-op implementation in the test programs
void alertAllUsers(const std::string&, const std::string&) {}
#endif
}
