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
    std::string prefix();

    void trace(const std::string& msg);
    void debug(const std::string& msg);
    void info(const std::string& msg);
    void warn(const std::string& msg);
    void error(const std::string& msg);
    void syserror(const std::string& msg);
    void fatal(const std::string& msg);
    void sysfatal(const std::string& msg);

    inline bool traceEnabled() { return logger().getLevel() > Poco::Message::PRIO_TRACE; }

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

        StreamLogger(std::function<void(const std::string&)> func)
          : _func(std::move(func)),
            _enabled(true)
        {
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
             ? StreamLogger([](const std::string& msg) { trace(msg); })
             : StreamLogger();
    }

    inline StreamLogger debug()
    {
        return StreamLogger([](const std::string& msg) { debug(msg); });
    }

    inline StreamLogger info()
    {
        return StreamLogger([](const std::string& msg) { info(msg); });
    }

    inline StreamLogger warn()
    {
        return StreamLogger([](const std::string& msg) { warn(msg); });
    }

    inline StreamLogger error()
    {
        return StreamLogger([](const std::string& msg) { error(msg); });
    }

    inline StreamLogger fatal()
    {
        return StreamLogger([](const std::string& msg) { fatal(msg); });
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

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
