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

#include <functional>
#include <sstream>
#include <string>

#include <Poco/Logger.h>

namespace Log
{
    void initialize(const std::string& name,
                    const std::string& logLevel = "trace",
                    const bool withColor = true,
                    const bool logToFile = false,
                    std::map<std::string, std::string> config = {});
    Poco::Logger& logger();
    std::string prefix(const char* level);

    void trace(const std::string& msg);
    void debug(const std::string& msg);
    void info(const std::string& msg);
    void warn(const std::string& msg);
    void error(const std::string& msg);
    void syserror(const std::string& msg);
    void fatal(const std::string& msg);
    void sysfatal(const std::string& msg);

    inline bool traceEnabled() { return logger().getLevel() >= Poco::Message::PRIO_TRACE; }
    inline bool debugEnabled() { return logger().getLevel() >= Poco::Message::PRIO_DEBUG; }
    inline bool infoEnabled() { return logger().getLevel() >= Poco::Message::PRIO_INFORMATION; }
    inline bool warnEnabled() { return logger().getLevel() >= Poco::Message::PRIO_WARNING; }
    inline bool errorEnabled() { return logger().getLevel() >= Poco::Message::PRIO_ERROR; }
    inline bool fatalEnabled() { return logger().getLevel() >= Poco::Message::PRIO_FATAL; }

    /// Signal safe prefix logging
    void signalLogPrefix();
    /// Signal safe logging
    void signalLog(const char* message);

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

        StreamLogger(std::function<void(const std::string&)> func, const char* level)
          : _func(std::move(func)),
            _enabled(true)
        {
            _stream << prefix(level);
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

#define LOG_BODY(LVL, X) std::ostringstream oss_; oss_ << Log::prefix(LVL) << X << "| " << __FILE__ << ':' << __LINE__
#define LOG_TRC(X) if (Log::traceEnabled()) { LOG_BODY("TRC", X); Log::logger().trace(oss_.str()); }
#define LOG_DBG(X) if (Log::debugEnabled()) { LOG_BODY("DBG", X); Log::logger().debug(oss_.str()); }
#define LOG_INF(X) if (Log::infoEnabled()) { LOG_BODY("INF", X); Log::logger().information(oss_.str()); }
#define LOG_WRN(X) if (Log::warnEnabled()) { LOG_BODY("WRN", X); Log::logger().warning(oss_.str()); }
#define LOG_ERR(X) if (Log::errorEnabled()) { LOG_BODY("ERR", X); Log::logger().error(oss_.str()); }
#define LOG_SYS(X) if (Log::errorEnabled()) { LOG_BODY("ERR", X << " (errno: " << std::strerror(errno) << ")"); Log::logger().error(oss_.str()); }
#define LOG_FTL(X) if (Log::fatalEnabled()) { LOG_BODY("FTL", X); Log::logger().fatal(oss_.str()); }
#define LOG_SFL(X) if (Log::errorEnabled()) { LOG_BODY("FTL", X << " (errno: " << std::strerror(errno) << ")"); Log::logger().fatal(oss_.str()); }

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
