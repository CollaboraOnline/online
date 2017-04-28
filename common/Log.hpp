/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOG_HPP
#define INCLUDED_LOG_HPP

#include <sys/syscall.h>
#include <unistd.h>

#include <functional>
#include <sstream>
#include <string>

#include <Poco/Logger.h>

namespace Log
{
    void initialize(const std::string& name,
                    const std::string& logLevel,
                    const bool withColor,
                    const bool logToFile,
                    std::map<std::string, std::string> config);
    Poco::Logger& logger();

    char* prefix(char* buffer, const char* level, bool sigSafe);

    void trace(const std::string& msg);
    void debug(const std::string& msg);
    void info(const std::string& msg);
    void warn(const std::string& msg);
    void error(const std::string& msg);
    void syserror(const std::string& msg);
    void fatal(const std::string& msg);
    void sysfatal(const std::string& msg);

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
    void signalLogNumber(size_t num);

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
            _stream << prefix(buffer, level, syscall(SYS_gettid));
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

        std::ostringstream _stream;

    private:
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
            lhs._stream << rhs;
        }

        return lhs;
    }

    template <typename U>
    StreamLogger& operator<<(StreamLogger&& lhs, U&& rhs)
    {
        if (lhs.enabled())
        {
            lhs._stream << rhs;
        }

        return lhs;
    }

    inline void operator<<(StreamLogger& lhs, const _end_marker&)
    {
        (void)end;
        lhs.flush();
    }
}

#define LOG_BODY_(PRIO, LVL, X) Poco::Message m_(l_.name(), "", Poco::Message::PRIO_##PRIO); char b_[1024]; std::ostringstream oss_(Log::prefix(b_, LVL, false), std::ostringstream::ate); oss_ << std::boolalpha << X << "| " << __FILE__ << ':' << __LINE__; m_.setText(oss_.str()); l_.log(m_);
#define LOG_TRC(X) do { auto& l_ = Log::logger(); if (l_.trace()) { LOG_BODY_(TRACE, "TRC", X); } } while (false)
#define LOG_DBG(X) do { auto& l_ = Log::logger(); if (l_.debug()) { LOG_BODY_(DEBUG, "DBG", X); } } while (false)
#define LOG_INF(X) do { auto& l_ = Log::logger(); if (l_.information()) { LOG_BODY_(INFORMATION, "INF", X); } } while (false)
#define LOG_WRN(X) do { auto& l_ = Log::logger(); if (l_.warning()) { LOG_BODY_(WARNING, "WRN", X); } } while (false)
#define LOG_ERR(X) do { auto& l_ = Log::logger(); if (l_.error()) { LOG_BODY_(ERROR, "ERR", X); } } while (false)
#define LOG_SYS(X) do { auto& l_ = Log::logger(); if (l_.error()) { LOG_BODY_(ERROR, "ERR", X << " (errno: " << std::strerror(errno) << ")"); } } while (false)
#define LOG_FTL(X) do { auto& l_ = Log::logger(); if (l_.fatal()) { LOG_BODY_(FATAL, "FTL", X); } } while (false)
#define LOG_SFL(X) do { auto& l_ = Log::logger(); if (l_.error()) { LOG_BODY_(FATAL, "FTL", X << " (errno: " << std::strerror(errno) << ")"); } } while (false)

#define LOG_END(l) do { l << __FILE__ << ':' << __LINE__; l.flush(); } while (false)

#define LOG_CHECK(X) do { if (!(X)) { LOG_ERR("Check failed. Expected (" #X ")."); } } while (false)
#define LOG_CHECK_RET(X, RET) do { if (!(X)) { LOG_ERR("Check failed. Expected (" #X ")."); return RET; } } while (false)

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
