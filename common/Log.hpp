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

#pragma once

#include <sys/time.h>
#include <sys/syscall.h>
#include <unistd.h>

#include <cerrno>
#include <cstddef>
#include <functional>
#include <iostream>
#include <thread>
#include <sstream>
#include <string>

#ifdef __ANDROID__
#include <android/log.h>
#endif

#include "Util.hpp"
#include "StateEnum.hpp"

namespace Log
{
    enum Level
    {
        FTL = 1, // Fatal
        CTL,     // Critical
        ERR,     // Error
        WRN,     // Warning
        NTC,     // Notice
        INF,     // Information
        DBG,     // Debug
        TRC,     // Trace
        MAX
    };

    // Different logging domains
    STATE_ENUM(Area,
               Generic,
               Pixel,
               Socket,
               WebSocket,
               Http,
               WebServer,
               Storage,
               WOPI,
               Admin,
               Javascript);

    // Types of phases for unit test
    STATE_ENUM(Phase,
               Setup,
               Load,
               Edit);

    /// Initialize the logging system.
    void initialize(const std::string& name,
                    const std::string& logLevel,
                    const bool withColor,
                    const bool logToFile,
                    const std::map<std::string, std::string>& config);

    /// Shutdown and release the logging system.
    void shutdown();

    /// Cleanup state after forking
    void postFork();

    void setThreadLocalLogLevel(const std::string& logLevel);

    /// Generates log entry prefix. Example follows (without the pipes).
    /// |wsd-07272-07298 2020-04-25 17:29:28.928697 -0400 [ websrv_poll ] TRC  |
    /// This is fully signal-safe. Buffer must be at least 128 bytes.
    char* prefix(const timeval& tv, char* buffer, const char* level);
    template <int Size> inline char* prefix(char buffer[Size], const char* level)
    {
        static_assert(Size >= 128, "Buffer size must be at least 128 bytes.");

        struct timeval tv;
        gettimeofday(&tv, NULL);
        return prefix(tv, buffer, level);
    }

    /// is a certain level of logging enabled ?
    bool isEnabled(Level l, Area a = Area::Generic);

    inline bool traceEnabled()
    {
        return isEnabled(Log::Level::TRC);
    }

    /// Main entry function for all logging
    void log(Level l, const std::string &text);

    /// Setting the logging level
    void setLevel(const std::string &l);

    /// Set disabled areas
    void setDisabledAreas(const std::string &areas);

    /// Getting the logging level
    Level getLevel();

    std::string getLogLevelName(const std::string &channel);
    void setLogLevelByName(const std::string &channel,
                           const std::string &level);

    /// Getting the logging level as a string
    const std::string& getLevelName();

    /// Dump the invalid id as 0, otherwise dump in hex.
    /// Note: std::thread::id defines operator<< which
    /// serializes in decimal. We need this for hex.
    inline std::string to_string(const std::thread::id& id)
    {
        if (id != std::thread::id())
        {
            std::ostringstream os;
            os << std::hex << "0x" << id;
            return os.str();
        }

        return "0";
    }

} // namespace Log

/// A default implementation that is a NOP.
/// Any context can implement this to prefix its log entries.
inline void logPrefix(std::ostream&) {}

inline std::ostream& operator<<(std::ostream& lhs, const std::function<void(std::ostream&)>& f)
{
    f(lhs);
    return lhs;
}

#ifdef IOS
// We know that when building with Xcode, __FILE__ will always be a full path, with several slashes,
// so this will always work. We want just the file name, they are unique anyway.
/// Strip the path and leave only the filename.
template <std::size_t N>
static constexpr std::size_t skipPathToFilename(const char (&s)[N], std::size_t n = N - 1)
{
    return n == 0 ? 0 : s[n] == '/' ? n + 1 : skipPathToFilename(s, n - 1);
}

#define LOG_FILE_NAME(f) (&f[skipPathToFilename(f)])

#else

/// Strip the path prefix ("./") that is noisy.
template <std::size_t N>
static constexpr std::size_t skipPathPrefix(const char (&s)[N], std::size_t n = 0)
{
    return s[n] == '.' || s[n] == '/' ? skipPathPrefix(s, n + 1) : n;
}

#define LOG_FILE_NAME(f) (&f[skipPathPrefix(f)])
#endif

#define STRING(X) STRINGIFY(X)

#ifdef __ANDROID__

#define LOG_LOG(LVL, STR) \
    ((void)__android_log_print(ANDROID_LOG_DEBUG, \
                               "coolwsd", "%s %s", #LVL, STR.c_str()))
#else

#define LOG_LOG(LVL, STR)  Log::log(Log::LVL, STR)
#endif

#define LOG_END_NOFILE(LOG) (void)0

#define LOG_END(LOG) LOG << "| " << LOG_FILE_NAME(__FILE__) << ":" STRING(__LINE__)

#define LOG_MESSAGE_(LVL, A, X, PREFIX, SUFFIX)  \
    do                                          \
    {                                           \
        if (LOG_CONDITIONAL(LVL, A))              \
        {                                       \
            LOG_BODY_(LVL, X, PREFIX, SUFFIX);    \
        }                                       \
    } while (false)


#define LOG_BODY_(LVL, X, PREFIX, END)        \
    char b_[1024];                              \
    std::ostringstream oss_(                    \
        Log::prefix<sizeof(b_) - 1>(b_, #LVL),  \
        std::ostringstream::ate);               \
    PREFIX(oss_);                               \
    oss_ << std::boolalpha << X;                \
    END(oss_);                                  \
    LOG_LOG(LVL, oss_.str())

#define LOG_ANY(X)                              \
    char b_[1024];                              \
    std::ostringstream oss_(                    \
        Log::prefix<sizeof(b_) - 1>(b_, "INF"), \
        std::ostringstream::ate);               \
    logPrefix(oss_);                            \
    oss_ << std::boolalpha << X;                \
    LOG_END(oss_);                              \
    Log::log(Log::Level::INF, oss_.str());

#if defined __GNUC__ || defined __clang__
#  define LOG_CONDITIONAL(type, area)  \
    __builtin_expect(Log::isEnabled(Log::Level::type, Log::Area::area), 0)
#else
#  define LOG_CONDITIONAL(type) Log::isEnabled(Log::Level::type, Log::Level::area)
#endif

#define LOG_TRC(X)        LOGA_TRC(Generic, X)
#define LOG_TRC_NOFILE(X) LOGA_TRC_NOFILE(Generic, X)
#define LOG_DBG(X)        LOGA_DBG(Generic, X)
#define LOG_INF(X)        LOGA_INF(Generic, X)
#define LOG_INF_NOFILE(X) LOGA_INF_NOFILE(Generic, X)
#define LOG_WRN(X)        LOG_MESSAGE_(WRN, Generic, X, logPrefix, LOG_END)
#define LOG_ERR(X)        LOG_MESSAGE_(ERR, Generic, X, logPrefix, LOG_END)

#define LOGA_TRC(A,X)        LOG_MESSAGE_(TRC, A, X, logPrefix, LOG_END)
#define LOGA_TRC_NOFILE(A,X) LOG_MESSAGE_(TRC, A, X, logPrefix, LOG_END_NOFILE)
#define LOGA_DBG(A,X)        LOG_MESSAGE_(DBG, A, X, logPrefix, LOG_END)
#define LOGA_INF(A,X)        LOG_MESSAGE_(INF, A, X, logPrefix, LOG_END)
#define LOGA_INF_NOFILE(A,X) LOG_MESSAGE_(INF, A, X, logPrefix, LOG_END_NOFILE)
// WRN and ERR should not be filtered by area

/// Log an ERR entry with the given errno appended.
#define LOG_SYS_ERRNO(ERRNO, X)                                                                    \
    do                                                                                             \
    {                                                                                              \
        const auto onrre = ERRNO; /* Save errno immediately while avoiding name clashes*/          \
        LOG_ERR(X << " (" << Util::symbolicErrno(onrre) << ": " << std::strerror(onrre) << ')');   \
    } while (false)

/// Log an ERR entry with errno appended.
/// NOTE: Must be called immediately after an API that sets errno.
/// Use LOG_SYS_ERRNO to pass errno explicitly.
#define LOG_SYS(X) LOG_SYS_ERRNO(errno, X)

#define LOG_FTL(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        std::cerr << X << std::endl;                                                               \
        if (LOG_CONDITIONAL(FTL, Generic))                                      \
        {                                                                                          \
            LOG_BODY_(FTL, X, logPrefix, LOG_END);  \
        }                                                                                          \
    } while (false)

/// Log an FTL (fatal) entry with errno appended.
/// NOTE: Must be called immediately after an API that sets errno.
#define LOG_SFL(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        const auto onrre = errno; /* Save errno immediately while avoiding name clashes*/          \
        LOG_FTL(X << " (" << Util::symbolicErrno(onrre) << ": " << std::strerror(onrre) << ')');   \
    } while (false)

/// No-prefix versions:
#define LOG_TRC_S(X) LOG_MESSAGE_(TRC, Generic, X, (void), LOG_END)
#define LOG_DBG_S(X) LOG_MESSAGE_(DBG, Generic, X, (void), LOG_END)
#define LOG_INF_S(X) LOG_MESSAGE_(INF, Generic, X, (void), LOG_END)
#define LOG_WRN_S(X) LOG_MESSAGE_(WRN, Generic, X, (void), LOG_END)
#define LOG_ERR_S(X) LOG_MESSAGE_(ERR, Generic, X, (void), LOG_END)

#define LOG_CHECK(X)                                                                               \
    do                                                                                             \
    {                                                                                              \
        if (!(X))                                                                                  \
        {                                                                                          \
            LOG_ERR("Check failed. Expected (" #X ").");                                           \
        }                                                                                          \
    } while (false)

#define LOG_CHECK_RET(X, RET)                                                                      \
    do                                                                                             \
    {                                                                                              \
        if (!(X))                                                                                  \
        {                                                                                          \
            LOG_ERR("Check failed. Expected (" #X ").");                                           \
            return RET;                                                                            \
        }                                                                                          \
    } while (false)

/// Assert the truth of a condition, with a custom message.
#define LOG_ASSERT_INTERNAL(condition, message, LOG)                                               \
    do                                                                                             \
    {                                                                                              \
        if (!(condition))                                                                          \
        {                                                                                          \
            std::ostringstream oss##__LINE__;                                                      \
            oss##__LINE__ << message;                                                              \
            const auto msg##__LINE__ = oss##__LINE__.str();                                        \
            LOG("ERROR: Assertion failure: "                                                       \
                << (msg##__LINE__.empty() ? "" : msg##__LINE__ + ". ")                             \
                << "Condition: " << (#condition));                                                 \
            assert(!#condition); /* NOLINT(misc-static-assert) */                                  \
        }                                                                                          \
    } while (false)

/// Assert the truth of a condition.
#if defined(NDEBUG)
// In release mode assertions are logged as debug-level, since they are for developers.
#define LOG_ASSERT_MSG(condition, message)                                                         \
    LOG_ASSERT_INTERNAL(condition, "Precondition failed", LOG_DBG)
#define LOG_ASSERT(condition) LOG_ASSERT_MSG(condition, "Precondition failed")
#else
// In debug mode assertions are errors.
#define LOG_ASSERT_MSG(condition, message) LOG_ASSERT_INTERNAL(condition, message, LOG_ERR)
#define LOG_ASSERT(condition) LOG_ASSERT_MSG(condition, "Precondition failed")
#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
