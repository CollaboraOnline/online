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

#include <Poco/DateTime.h>
#include <Poco/DateTimeFormat.h>
#include <Poco/DateTimeFormatter.h>
#include <Poco/Logger.h>

#ifdef __ANDROID__
#include <android/log.h>
#endif

#include "Util.hpp"

inline std::ostream& operator<< (std::ostream& os, const Poco::Timestamp& ts)
{
    os << Poco::DateTimeFormatter::format(Poco::DateTime(ts),
                                          Poco::DateTimeFormat::ISO8601_FRAC_FORMAT);
    return os;
}

inline std::ostream& operator<< (std::ostream& os, const std::chrono::system_clock::time_point& ts)
{
    os << Util::getIso8601FracformatTime(ts);
    return os;
}

/// Format seconds with the units suffix until we migrate to C++20.
inline std::ostream& operator<<(std::ostream& os, const std::chrono::seconds& s)
{
    os << s.count() << 's';
    return os;
}

/// Format milliseconds with the units suffix until we migrate to C++20.
inline std::ostream& operator<<(std::ostream& os, const std::chrono::milliseconds& ms)
{
    os << ms.count() << "ms";
    return os;
}

/// Format microeconds with the units suffix until we migrate to C++20.
inline std::ostream& operator<<(std::ostream& os, const std::chrono::microseconds& ms)
{
    os << ms.count() << "us";
    return os;
}

namespace Log
{
    /// Initialize the logging system.
    void initialize(const std::string& name,
                    const std::string& logLevel,
                    const bool withColor,
                    const bool logToFile,
                    const std::map<std::string, std::string>& config);

    /// Returns the underlying logging system.
    Poco::Logger& logger();

    /// Shutdown and release the logging system.
    void shutdown();

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
    char* prefix(const Poco::DateTime& time, char* buffer, const char* level);
    template <int Size> inline char* prefix(char buffer[Size], const char* level)
    {
        static_assert(Size >= 128, "Buffer size must be at least 128 bytes.");
        return prefix(Poco::DateTime(), buffer, level);
    }

    inline bool traceEnabled() { return logger().trace(); }
    inline bool debugEnabled() { return logger().debug(); }
    inline bool infoEnabled() { return logger().information(); }
    inline bool warnEnabled() { return logger().warning(); }
    inline bool errorEnabled() { return logger().error(); }
    inline bool fatalEnabled() { return logger().fatal(); }

    /// Signal safe prefix logging
    void signalLogPrefix();
    /// Signal safe logging
    void signalLog(const char* message);
    /// Signal log number
    void signalLogNumber(std::size_t num);

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

    template <typename U>
    StreamLogger& operator<<(StreamLogger& lhs, const U& rhs)
    {
        if (lhs.enabled())
        {
            lhs.getStream() << rhs;
        }

        return lhs;
    }

    template <typename U>
    StreamLogger& operator<<(StreamLogger&& lhs, U&& rhs)
    {
        if (lhs.enabled())
        {
            lhs.getStream() << rhs;
        }

        return lhs;
    }

    inline StreamLogger& operator<<(StreamLogger& lhs, const Poco::Timestamp& rhs)
    {
        if (lhs.enabled())
        {
            lhs.getStream() << Poco::DateTimeFormatter::format(Poco::DateTime(rhs),
                                                           Poco::DateTimeFormat::ISO8601_FRAC_FORMAT);
        }

        return lhs;
    }

    inline StreamLogger& operator<<(StreamLogger& lhs, const std::chrono::system_clock::time_point& rhs)
    {
        if (lhs.enabled())
        {
            lhs.getStream() << Util::getIso8601FracformatTime(rhs);
        }

        return lhs;
    }

    inline void operator<<(StreamLogger& lhs, const _end_marker&)
    {
        (void)end;
        lhs.flush();
    }

    /// Dump the invalid id as 0, otherwise dump in hex.
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

    inline StreamLogger& operator<<(StreamLogger& lhs, const std::thread::id& rhs)
    {
        if (lhs.enabled())
        {
            lhs.getStream() << Log::to_string(rhs);
        }

        return lhs;
    }

}

#ifndef IOS
#define LOG_FILE_NAME(f) f
#else
// We know that when building with Xcode, __FILE__ will always be a full path, with several slashes,
// so this will always work. We want just the file name, they are unique anyway.
#define LOG_FILE_NAME(f) (strrchr(f, '/') + 1)
#endif

#define LOG_END(LOG, FILEP)                                                                        \
    do                                                                                             \
    {                                                                                              \
        if (FILEP)                                                                                 \
            LOG << "| " << LOG_FILE_NAME(__FILE__) << ':' << __LINE__;                             \
        LOG.flush();                                                                               \
    } while (false)

#ifdef __ANDROID__

#define LOG_BODY_(LOG, PRIO, LVL, X, FILEP)                                                        \
    char b_[1024];                                                                                 \
    std::ostringstream oss_(Log::prefix<sizeof(b_) - 1>(b_, LVL), std::ostringstream::ate);        \
    oss_ << std::boolalpha << X;                                                                   \
    LOG_END(oss_, FILEP);                                                                          \
    ((void)__android_log_print(ANDROID_LOG_DEBUG, "loolwsd", "%s %s", LVL, oss_.str().c_str()))

#else

#define LOG_BODY_(LOG, PRIO, LVL, X, FILEP)                                                        \
    char b_[1024];                                                                                 \
    std::ostringstream oss_(Log::prefix<sizeof(b_) - 1>(b_, LVL), std::ostringstream::ate);        \
    oss_ << std::boolalpha << X;                                                                   \
    LOG_END(oss_, FILEP);                                                                          \
    LOG.log(Poco::Message(LOG.name(), oss_.str(), Poco::Message::PRIO_##PRIO));

#endif

#define LOG_TRC(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (log_.trace() && !Log::isShutdownCalled())                                              \
        {                                                                                          \
            LOG_BODY_(log_, TRACE, "TRC", X, true);                                                \
        }                                                                                          \
    } while (false)

#define LOG_TRC_NOFILE(X)                                                                          \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (log_.trace() && !Log::isShutdownCalled())                                              \
        {                                                                                          \
            LOG_BODY_(log_, TRACE, "TRC", X, false);                                               \
        }                                                                                          \
    } while (false)

#define LOG_DBG(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (log_.debug() && !Log::isShutdownCalled())                                              \
        {                                                                                          \
            LOG_BODY_(log_, DEBUG, "DBG", X, true);                                                \
        }                                                                                          \
    } while (false)

#define LOG_INF(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (log_.information() && !Log::isShutdownCalled())                                        \
        {                                                                                          \
            LOG_BODY_(log_, INFORMATION, "INF", X, true);                                          \
        }                                                                                          \
    } while (false)

#define LOG_INF_NOFILE(X)                                                                          \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (log_.information() && !Log::isShutdownCalled())                                        \
        {                                                                                          \
            LOG_BODY_(log_, INFORMATION, "INF", X, false);                                         \
        }                                                                                          \
    } while (false)

#define LOG_WRN(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (!Log::isShutdownCalled() && log_.warning())                                            \
        {                                                                                          \
            LOG_BODY_(log_, WARNING, "WRN", X, true);                                              \
        }                                                                                          \
    } while (false)

#define LOG_ERR(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (!Log::isShutdownCalled() && log_.error())                                              \
        {                                                                                          \
            LOG_BODY_(log_, ERROR, "ERR", X, true);                                                \
        }                                                                                          \
    } while (false)

#define LOG_SYS(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (!Log::isShutdownCalled() && log_.error())                                              \
        {                                                                                          \
            LOG_BODY_(log_, ERROR, "ERR",                                                          \
                      X << " (" << Util::symbolicErrno(errno) << ": " << std::strerror(errno)      \
                        << ')',                                                                    \
                      true);                                                                       \
        }                                                                                          \
    } while (false)

#define LOG_FTL(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        std::cerr << X << std::endl;                                                               \
        auto& log_ = Log::logger();                                                                \
        if (!Log::isShutdownCalled() && log_.fatal())                                              \
        {                                                                                          \
            LOG_BODY_(log_, FATAL, "FTL", X, true);                                                \
        }                                                                                          \
    } while (false)

#define LOG_SFL(X)                                                                                 \
    do                                                                                             \
    {                                                                                              \
        auto& log_ = Log::logger();                                                                \
        if (!Log::isShutdownCalled() && log_.error())                                              \
        {                                                                                          \
            LOG_BODY_(log_, FATAL, "FTL",                                                          \
                      X << " (" << Util::symbolicErrno(errno) << ": " << std::strerror(errno)      \
                        << ')',                                                                    \
                      true);                                                                       \
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

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
