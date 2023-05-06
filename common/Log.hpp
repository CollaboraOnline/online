/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <sys/syscall.h>
#include <unistd.h>

#include <cerrno>
#include <cstddef>
#include <functional>
#include <iostream>
#include <thread>
#include <sstream>
#include <string>

#include <Poco/LocalDateTime.h>
#include <Poco/DateTimeFormat.h>
#include <Poco/DateTimeFormatter.h>
#include <Poco/Logger.h>

#ifdef __ANDROID__
#include <android/log.h>
#endif

#include "Util.hpp"

namespace Log
{
    /// Initialize the logging system.
    void initialize(const std::string& name,
                    const std::string& logLevel,
                    const bool withColor,
                    const bool logToFile,
                    const std::map<std::string, std::string>& config);

    /// Returns the underlying logging system. Return value is effectively thread-local.
    Poco::Logger& logger();

    /// Shutdown and release the logging system.
    void shutdown();

    void setThreadLocalLogLevel(const std::string& logLevel);

#if !MOBILEAPP
    extern bool IsShutdown;

    /// Was static shutdown() called? If so, producing more logs should be avoided.
    inline bool isShutdownCalled() { return IsShutdown; }
#else
    constexpr bool isShutdownCalled() { return false; }
#endif

    /// Generates log entry prefix. Example follows (without the pipes).
    /// |wsd-07272-07298 2020-04-25 17:29:28.928697 [ websrv_poll ] TRC  |
    /// This is fully signal-safe. Buffer must be at least 128 bytes.
    char* prefix(const Poco::LocalDateTime& time, char* buffer, const char* level);
    template <int Size> inline char* prefix(char buffer[Size], const char* level)
    {
        static_assert(Size >= 128, "Buffer size must be at least 128 bytes.");
        return prefix(Poco::LocalDateTime(), buffer, level);
    }

    inline bool traceEnabled() { return logger().trace(); }
    inline bool debugEnabled() { return logger().debug(); }
    inline bool infoEnabled() { return logger().information(); }
    inline bool warnEnabled() { return logger().warning(); }
    inline bool errorEnabled() { return logger().error(); }
    inline bool fatalEnabled() { return logger().fatal(); }

    const std::string& getLevel();

    /// The following is to write streaming logs.
    /// Log::info() << "Value: 0x" << std::hex << value
    ///             << ", pointer: " << this << Log::end;
    static const struct _end_marker
    {
        _end_marker()
        {
        }
    } end;

    /// Helper class to support implementing streaming
    /// operator for logging.
    class StreamLogger
    {
    public:
        /// No-op instance.
        StreamLogger()
          : _enabled(false)
        {
        }

        StreamLogger(std::function<void(const std::string&)> func, const char*level)
          : _func(std::move(func)),
            _enabled(true)
        {
            char buffer[1024];
            _stream << prefix<sizeof(buffer) - 1>(buffer, level);
        }

        StreamLogger(StreamLogger&& sl) noexcept
          : _stream(sl._stream.str()),
            _func(std::move(sl._func)),
            _enabled(sl._enabled)
        {
        }

        bool enabled() const { return _enabled; }

        void flush() const
        {
            if (_enabled)
            {
                _func(_stream.str());
            }
        }

        std::ostringstream& getStream() { return _stream; }

    private:
        std::ostringstream _stream;

        std::function<void(const std::string&)> _func;
        const bool _enabled;
    };

    inline StreamLogger trace()
    {
        return traceEnabled()
             ? StreamLogger([](const std::string& msg) { logger().trace(msg); }, "TRC")
             : StreamLogger();
    }

    inline StreamLogger debug()
    {
        return debugEnabled()
             ? StreamLogger([](const std::string& msg) { logger().debug(msg); }, "DBG")
             : StreamLogger();
    }

    inline StreamLogger info()
    {
        return infoEnabled()
             ? StreamLogger([](const std::string& msg) { logger().information(msg); }, "INF")
             : StreamLogger();
    }

    inline StreamLogger warn()
    {
        return warnEnabled()
             ? StreamLogger([](const std::string& msg) { logger().warning(msg); }, "WRN")
             : StreamLogger();
    }

    inline StreamLogger error()
    {
        return errorEnabled()
             ? StreamLogger([](const std::string& msg) { logger().error(msg); }, "ERR")
             : StreamLogger();
    }

    inline StreamLogger fatal()
    {
        return fatalEnabled()
             ? StreamLogger([](const std::string& msg) { logger().fatal(msg); }, "FTL")
             : StreamLogger();
    }

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

template <typename U> Log::StreamLogger& operator<<(Log::StreamLogger& lhs, const U& rhs)
{
    if (lhs.enabled())
    {
        lhs.getStream() << rhs;
    }

    return lhs;
}

template <typename U> Log::StreamLogger& operator<<(Log::StreamLogger&& lhs, U&& rhs)
{
    if (lhs.enabled())
    {
        lhs.getStream() << rhs;
    }

    return lhs;
}

inline Log::StreamLogger& operator<<(Log::StreamLogger& lhs,
                                     const std::chrono::system_clock::time_point& rhs)
{
    if (lhs.enabled())
    {
        lhs.getStream() << Util::getIso8601FracformatTime(rhs);
    }

    return lhs;
}

inline void operator<<(Log::StreamLogger& lhs, const Log::_end_marker&) { lhs.flush(); }

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

#define STRINGIFY(X) #X
#define STRING(X) STRINGIFY(X)

#ifdef __ANDROID__

#define LOG_LOG(LOG, PRIO, LVL, STR)                                                               \
    ((void)__android_log_print(ANDROID_LOG_DEBUG, "coolwsd", "%s %s", LVL, STR.c_str()))

#else

#define LOG_LOG(LOG, PRIO, LVL, STR)                                                               \
    LOG.log(Poco::Message(LOG.name(), STR, Poco::Message::PRIO_##PRIO))

#endif

#define LOG_END_NOFILE(LOG) (void)0

#define LOG_END(LOG) LOG << "| " << LOG_FILE_NAME(__FILE__) << ":" STRING(__LINE__)

/// Used to end multi-statement logging via Log::StreamLogger.
#define LOG_END_FLUSH(LOG)                                                                         \
    do                                                                                             \
    {                                                                                              \
        LOG_END(LOG);                                                                              \
        LOG.flush();                                                                               \
    } while (false)

#define LOG_BODY_(LOG, PRIO, LVL, X, PREFIX, END)                                                  \
    char b_[1024];                                                                                 \
    std::ostringstream oss_(Log::prefix<sizeof(b_) - 1>(b_, LVL), std::ostringstream::ate);        \
    PREFIX(oss_);                                                                                  \
    oss_ << std::boolalpha << X;                                                                   \
    END(oss_);                                                                                     \
    LOG_LOG(LOG, PRIO, LVL, oss_.str())

#define LOG_ANY(X)                                                                                 \
    char b_[1024];                                                                                 \
    std::ostringstream oss_(Log::prefix<sizeof(b_) - 1>(b_, "INF"), std::ostringstream::ate);      \
    logPrefix(oss_);                                                                               \
    oss_ << std::boolalpha << X;                                                                   \
    LOG_END(oss_);                                                                                 \
    Poco::AutoPtr<Poco::Channel> channel = Log::logger().getChannel();                             \
    channel->log(Poco::Message("", oss_.str(), Poco::Message::Priority::PRIO_INFORMATION))

#if defined __GNUC__ || defined __clang__
#  define LOG_CONDITIONAL(log,type)                                                                \
    __builtin_expect((!Log::isShutdownCalled() && log.type()), 0)
#else
#  define LOG_CONDITIONAL(log,type)                                                                \
    (!Log::isShutdownCalled() && log.type())
#endif

#define LOG_TRC(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (LOG_CONDITIONAL(log_, trace))                                                          \
        {                                                                                          \
            LOG_BODY_(log_, TRACE, "TRC", X, logPrefix, LOG_END);                                  \
        }                                                                                          \
    } while (false)

#define LOG_TRC_NOFILE(X)                                                                          \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (LOG_CONDITIONAL(log_, trace))                                                          \
        {                                                                                          \
            LOG_BODY_(log_, TRACE, "TRC", X, logPrefix, LOG_END_NOFILE);                           \
        }                                                                                          \
    } while (false)

#define LOG_DBG(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (LOG_CONDITIONAL(log_, debug))                                                          \
        {                                                                                          \
            LOG_BODY_(log_, DEBUG, "DBG", X, logPrefix, LOG_END);                                  \
        }                                                                                          \
    } while (false)

#define LOG_INF(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (LOG_CONDITIONAL(log_, information))                                                    \
        {                                                                                          \
            LOG_BODY_(log_, INFORMATION, "INF", X, logPrefix, LOG_END);                            \
        }                                                                                          \
    } while (false)

#define LOG_INF_NOFILE(X)                                                                          \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (LOG_CONDITIONAL(log_, information))                                                    \
        {                                                                                          \
            LOG_BODY_(log_, INFORMATION, "INF", X, logPrefix, LOG_END_NOFILE);                     \
        }                                                                                          \
    } while (false)

#define LOG_WRN(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (LOG_CONDITIONAL(log_, warning))                                                        \
        {                                                                                          \
            LOG_BODY_(log_, WARNING, "WRN", X, logPrefix, LOG_END);                                \
        }                                                                                          \
    } while (false)

#define LOG_ERR(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (LOG_CONDITIONAL(log_, error))                                                          \
        {                                                                                          \
            LOG_BODY_(log_, ERROR, "ERR", X, logPrefix, LOG_END);                                  \
        }                                                                                          \
    } while (false)

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
        auto& log_ = Log::logger();                                                                \
        if (LOG_CONDITIONAL(log_, fatal))                                                          \
        {                                                                                          \
            LOG_BODY_(log_, FATAL, "FTL", X, logPrefix, LOG_END);                                  \
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

/// No-prefix version of LOG_TRC.
#define LOG_TRC_S(X)                                                                               \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (LOG_CONDITIONAL(log_, debug))                                                          \
        {                                                                                          \
            LOG_BODY_(log_, TRACE, "TRC", X, (void), LOG_END);                                     \
        }                                                                                          \
    } while (false)

/// No-prefix version of LOG_DBG.
#define LOG_DBG_S(X)                                                                               \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (LOG_CONDITIONAL(log_, debug))                                                          \
        {                                                                                          \
            LOG_BODY_(log_, DEBUG, "DBG", X, (void), LOG_END);                                     \
        }                                                                                          \
    } while (false)

/// No-prefix version of LOG_INF.
#define LOG_INF_S(X)                                                                               \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (LOG_CONDITIONAL(log_, error))                                                          \
        {                                                                                          \
            LOG_BODY_(log_, INFORMATION, "INF", X, (void), LOG_END);                               \
        }                                                                                          \
    } while (false)

/// No-prefix version of LOG_WRN.
#define LOG_WRN_S(X)                                                                               \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (LOG_CONDITIONAL(log_, error))                                                          \
        {                                                                                          \
            LOG_BODY_(log_, WARNING, "WRN", X, (void), LOG_END);                                   \
        }                                                                                          \
    } while (false)

/// No-prefix version of LOG_ERR.
#define LOG_ERR_S(X)                                                                               \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (LOG_CONDITIONAL(log_, error))                                                          \
        {                                                                                          \
            LOG_BODY_(log_, ERROR, "ERR", X, (void), LOG_END);                                     \
        }                                                                                          \
    } while (false)

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
        auto&& cond##__LINE__ = !!(condition);                                                     \
        if (!cond##__LINE__)                                                                       \
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
