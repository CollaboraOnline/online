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

#ifdef __linux__
#include <sys/prctl.h>
#include <sys/syscall.h>
#endif
#include <unistd.h>

#include <atomic>
#include <cassert>
#include <cstdint>
#include <cstring>
#include <ctime>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <unordered_map>

#include <Poco/AutoPtr.h>
#include <Poco/FileChannel.h>

#include "Log.hpp"
#include "Util.hpp"

namespace
{
/// Tracks the number of thread-local buffers (for debugging purposes).
std::atomic_int32_t ThreadLocalBufferCount(0);

#if WASMAPP
/// In WASM, stdout works best.
constexpr int LOG_FILE_FD = STDOUT_FILENO;
#else
/// By default, write to stderr.
constexpr int LOG_FILE_FD = STDERR_FILENO;
#endif

} // namespace

namespace Log
{
    using namespace Poco;

    class ConsoleChannel : public Poco::Channel
    {
    public:
        static constexpr std::size_t BufferSize = 64 * 1024;

        void close() override { flush(); }

        /// Write the given buffer to stderr directly.
        static inline int writeRaw(const char* data, std::size_t size)
        {
            std::size_t i = 0;
            for (; i < size;)
            {
                int wrote;
                while ((wrote = ::write(LOG_FILE_FD, data + i, size - i)) < 0 && errno == EINTR)
                {
                }

                if (wrote < 0)
                {
                    return i;
                }

                i += wrote;
            }

            return i;
        }

        template <std::size_t N> inline void writeRaw(const char (&data)[N])
        {
            writeRaw(data, N - 1); // Minus the null.
        }

        inline void writeRaw(const std::string& string) { writeRaw(string.data(), string.size()); }

        /// Flush the stderr file data.
        static inline bool flush() { return ::fflush(stderr) == 0; }

        /// Overloaded log function that takes a naked data pointer to log.
        /// Appends new-line to the given data.
        inline void log(const char* data, std::size_t size)
        {
            char buffer[BufferSize];
            if (size < sizeof(buffer) - 1)
            {
                memcpy(buffer, data, size);
                buffer[size] = '\n';
                writeRaw(buffer, size + 1);
            }
            else
            {
                // The buffer is too small, we must split the write.
                writeRaw(data, size);
                writeRaw("\n", 1);
            }
        }

        /// Implement the Channel log virtual.
        void log(const Poco::Message& msg) override
        {
            const std::string& s = msg.getText();
            log(s.data(), s.size());
        }
    };

    class BufferedConsoleChannel : public ConsoleChannel
    {
        class ThreadLocalBuffer
        {
            static constexpr std::size_t BufferSize = ConsoleChannel::BufferSize;
            static constexpr std::size_t FlushBufferSize =
                std::min<std::size_t>(512UL, ConsoleChannel::BufferSize / 4); // ~4-5 entries.
            static constexpr std::int64_t MaxDelayMicroseconds = 5 * 1000 * 1000; // 5 seconds.

        public:
            ThreadLocalBuffer()
                : _size(0)
                , _oldest_time_us(0)
            {
                ++ThreadLocalBufferCount;
            }

            ~ThreadLocalBuffer()
            {
                flush();
                --ThreadLocalBufferCount;
            }

            std::size_t size() const { return _size; }
            std::size_t available() const { return BufferSize - _size; }

            inline void flush()
            {
                if (_size)
                {
                    ConsoleChannel::writeRaw(_buffer, _size);
                    _size = 0;
                    ConsoleChannel::flush();
                }
            }

            inline void log(const char* data, std::size_t size, bool force, std::int64_t ts)
            {
                if (_size + size > BufferSize - 1)
                {
                    flush();
                    if (size > BufferSize - 1)
                    {
                        // The buffer is too small, we must split the write.
                        ConsoleChannel::writeRaw(data, size);
                        ConsoleChannel::writeRaw("\n", 1);
                        return;
                    }
                }

                // Fits.
                if (_size == 0)
                    _oldest_time_us = ts;
                buffer(data, size);
                _buffer[_size] = '\n';
                ++_size;

                // Flush important messages and large caches immediately.
                if (force || _size >= FlushBufferSize ||
                    (ts - _oldest_time_us) > MaxDelayMicroseconds)
                {
                    flush();
                }
            }

            inline void buffer(const char* data, std::size_t size)
            {
                assert(_size + size <= BufferSize && "Buffer overflow");

                memcpy(_buffer + _size, data, size);
                _size += size;

                assert(_size <= BufferSize && "Buffer overflow");
            }

        template <std::size_t N> inline void buffer(const char (&data)[N])
        {
            buffer(data, N - 1); // Minus the null.
        }

        inline void buffer(const std::string& string) { buffer(string.data(), string.size()); }

    private:
        char _buffer[BufferSize];
        std::size_t _size;
        std::int64_t _oldest_time_us; //< The timestamp of the oldest buffered entry.
        };

    protected:
        inline std::size_t size() const { return _tlb.size(); }
        inline std::size_t available() const { return _tlb.available(); }

        inline void flush() { _tlb.flush(); }

        inline void buffer(const char* data, std::size_t size) { _tlb.buffer(data, size); }

        template <std::size_t N> inline void buffer(const char (&data)[N])
        {
            buffer(data, N - 1); // Minus the null.
        }

        inline void buffer(const std::string& string) { buffer(string.data(), string.size()); }

    public:
        ~BufferedConsoleChannel() { flush(); }

        void close() override { flush(); }

        void log(const Poco::Message& msg) override
        {
            const std::string& s = msg.getText();
            _tlb.log(s.data(), s.size(), msg.getPriority() <= Message::PRIO_WARNING,
                     msg.getTime().raw());
        }

    private:
        static thread_local ThreadLocalBuffer _tlb;
    };

    thread_local BufferedConsoleChannel::ThreadLocalBuffer BufferedConsoleChannel::_tlb;

    /// Colored Console channel (needs to be buffered).
    class ColorConsoleChannel : public BufferedConsoleChannel
    {
    public:
        ColorConsoleChannel()
        {
            _colorByPriority.emplace(Message::PRIO_FATAL, "\033[1;31m"); // Bold Red
            _colorByPriority.emplace(Message::PRIO_CRITICAL, "\033[1;31m"); // Bold Red
            _colorByPriority.emplace(Message::PRIO_ERROR, "\033[1;35m"); // Bold Magenta
            _colorByPriority.emplace(Message::PRIO_WARNING, "\033[1;33m"); // Bold Yellow
            _colorByPriority.emplace(Message::PRIO_NOTICE, "\033[0;34m"); // Blue
            _colorByPriority.emplace(Message::PRIO_INFORMATION, "\033[0;34m"); // Blue
            _colorByPriority.emplace(Message::PRIO_DEBUG, "\033[0;36m"); // Teal
            _colorByPriority.emplace(Message::PRIO_TRACE, "\033[0;37m"); // Grey
        }

        void log(const Poco::Message& msg) override
        {
            const auto it = _colorByPriority.find(msg.getPriority());

            const std::string& s = msg.getText();
            const std::size_t need = s.size() + 12; // + Colors.

            if (available() < need)
            {
                flush();
                if (BufferSize < need)
                {
                    // Write directly, it will not fit.
                    if (it != _colorByPriority.end())
                    {
                        writeRaw(it->second);
                    }

                    writeRaw(s);
                    writeRaw("\033[0m\n"); // Restore default color.
                    return;
                }
            }

            // Fits.
            if (it != _colorByPriority.end())
            {
                buffer(it->second);
            }

            buffer(s);
            buffer("\033[0m\n"); // Restore default color.

            // Flush important messages and large caches immediately.
            if (msg.getPriority() <= Message::PRIO_WARNING || size() >= BufferSize / 2)
            {
                flush();
            }
        }

    private:
        std::unordered_map<Poco::Message::Priority, std::string> _colorByPriority;
    };

    /// Helper to avoid destruction ordering issues.
    static struct StaticHelper
    {
    private:
        Poco::Logger* _logger;
        static thread_local Poco::Logger* _threadLocalLogger;
        std::string _name;
        std::string _logLevel;
        std::string _id;
        std::atomic<bool> _inited;
    public:
        StaticHelper() :
            _logger(nullptr),
            _inited(true)
        {
        }
        ~StaticHelper()
        {
            _inited = false;
        }

        bool getInited() const { return _inited; }

        void setId(const std::string& id) { _id = id; }

        const std::string& getId() const { return _id; }

        void setName(const std::string& name) { _name = name; }

        const std::string& getName() const { return _name; }

        void setLevel(const std::string& logLevel) { _logLevel = logLevel; }

        const std::string& getLevel() const { return _logLevel; }

        void setLogger(Poco::Logger* logger) { _logger = logger; };

        void setThreadLocalLogger(Poco::Logger* logger)
        {
            // FIXME: What to do with the previous thread-local logger, if any? Will deleting it
            // destroy also its channel? That won't be good as we use the same channel for all
            // loggers. Best to just leak it?
            _threadLocalLogger = logger;
        }

        Poco::Logger* getLogger() const { return _logger; }

        Poco::Logger* getThreadLocalLogger() const { return _threadLocalLogger; }

    } Static;

    thread_local Poco::Logger* StaticHelper::_threadLocalLogger = nullptr;

    bool IsShutdown = false;

    /// Convert an unsigned number to ascii with 0 padding.
    template <int Width> void to_ascii_fixed(char* buf, std::size_t num)
    {
        buf[Width - 1] = '0' + num % 10; // Units.

        if (Width > 1)
        {
            num /= 10;
            buf[Width - 2] = '0' + num % 10; // Tens.
        }

        if (Width > 2)
        {
            num /= 10;
            buf[Width - 3] = '0' + num % 10; // Hundreds.
        }

        if (Width > 3)
        {
            num /= 10;
            buf[Width - 4] = '0' + num % 10; // Thousands.
        }

        if (Width > 4)
        {
            num /= 10;
            buf[Width - 5] = '0' + num % 10; // Ten-Thousands.
        }

        if (Width > 5)
        {
            num /= 10;
            buf[Width - 6] = '0' + num % 10; // Hundred-Thousands.
        }

        static_assert(Width >= 1 && Width <= 6, "Width is invalid.");
    }

    /// Copy a null-terminated string into another.
    /// Expects the destination to be large enough.
    /// Note: unlike strcpy, this returns the *new* out
    /// (destination) pointer, which saves a strlen call.
    char* strcopy(const char* in, char* out)
    {
        while (*in)
            *out++ = *in++;
        return out;
    }

    /// Convert unsigned long num to base-10 ascii in place.
    /// Returns the *end* position.
    char* to_ascii(char* buf, std::size_t num)
    {
        int i = 0;
        do
        {
            buf[i++] = '0' + num % 10;
            num /= 10;
        } while (num > 0);

        // Reverse.
        for (char *front = buf, *back = buf + i - 1; back > front; ++front, --back)
        {
            const char t = *front;
            *front = *back;
            *back = t;
        }

        return buf + i;
    }

    char* prefix(const timeval& tv, char* buffer, const char* level)
    {
#if defined(IOS) || defined(__FreeBSD__)
        // Don't bother with the "Source" which would be just "Mobile" always and non-informative as
        // there is just one process in the app anyway.
        char *pos = buffer;

        // Don't bother with the thread identifier either. We output the thread name which is much
        // more useful anyway.
#else
        // Note that snprintf is deemed signal-safe in most common implementations.
        char* pos = strcopy((Static.getInited() ? Static.getId().c_str() : "<shutdown>"), buffer);
        *pos++ = '-';

        // Thread ID.
        const auto osTid = Util::getThreadId();
#if defined(__linux__)
        // On Linux osTid is pid_t.
        if (osTid > 99999)
        {
            if (osTid > 999999)
                pos = to_ascii(pos, osTid);
            else
            {
                to_ascii_fixed<6>(pos, osTid);
                pos += 6;
            }
        }
        else
        {
            to_ascii_fixed<5>(pos, osTid);
            pos += 5;
        }
#else
        // On all other systems osTid is std::thread::id.
        std::stringstream ss;
        ss << osTid;
        pos = strcopy(ss.str().c_str(), pos);
#endif

        *pos++ = ' ';
#endif

        const time_t tv_sec = tv.tv_sec;
        struct tm tm;
        localtime_r(&tv_sec, &tm);

        // YYYY-MM-DD.
        to_ascii_fixed<4>(pos, tm.tm_year + 1900);
        pos[4] = '-';
        pos += 5;
        to_ascii_fixed<2>(pos, tm.tm_mon + 1);
        pos[2] = '-';
        pos += 3;
        to_ascii_fixed<2>(pos, tm.tm_mday);
        pos[2] = ' ';
        pos += 3;

        // HH:MM:SS.uS
        to_ascii_fixed<2>(pos, tm.tm_hour);
        pos[2] = ':';
        pos += 3;
        to_ascii_fixed<2>(pos, tm.tm_min);
        pos[2] = ':';
        pos += 3;
        to_ascii_fixed<2>(pos, tm.tm_sec);
        pos[2] = '.';
        pos += 3;
        to_ascii_fixed<6>(pos, tv.tv_usec);
        pos[6] = ' ';
        pos += 7;

        // Time zone differential
        const auto tz_wrote = std::strftime(pos, 10, "%z", &tm);
        pos[tz_wrote] = ' ';
        pos += tz_wrote + 1; // + Skip the space we added.

        // Thread name and log level
        pos[0] = '[';
        pos[1] = ' ';
        pos += 2;
        pos = strcopy(Util::getThreadName(), pos);
        pos[0] = ' ';
        pos[1] = ']';
        pos[2] = ' ';
        pos += 3;
        pos = strcopy(level, pos);
        pos[0] = ' ';
        pos[1] = ' ';
        pos[2] = '\0';

        return buffer;
    }

    void initialize(const std::string& name,
                    const std::string& logLevel,
                    const bool withColor,
                    const bool logToFile,
                    const std::map<std::string, std::string>& config)
    {
        Static.setName(name);
        std::ostringstream oss;
        oss << Static.getName();
#if !MOBILEAPP // Just one process in a mobile app, the pid is uninteresting.
        oss << '-'
            << std::setw(5) << std::setfill('0') << getpid();
#endif
        Static.setId(oss.str());

        // Configure the logger.
        AutoPtr<Channel> channel;

        if (logToFile)
        {
            channel = static_cast<Poco::Channel*>(new Poco::FileChannel("coolwsd.log"));
            for (const auto& pair : config)
            {
                channel->setProperty(pair.first, pair.second);
            }
        }
        else if (withColor)
        {
            channel = static_cast<Poco::Channel*>(new Log::ColorConsoleChannel());
        }
        else
        {
            channel = static_cast<Poco::Channel*>(new Log::BufferedConsoleChannel());
        }

        /**
         * Open the channel explicitly, instead of waiting for first log message
         * This is important especially for the kit process where opening the channel
         * after chroot can cause file creation inside the jail instead of outside
         * */
        channel->open();

        try
        {
            auto& logger = Poco::Logger::create(Static.getName(), channel, Poco::Message::PRIO_TRACE);
            Static.setLogger(&logger);
        }
        catch (ExistsException&)
        {
            auto& logger = Poco::Logger::get(Static.getName());
            Static.setLogger(&logger);
        }

        auto logger = Static.getLogger();

        const std::string level = logLevel.empty() ? std::string("trace") : logLevel;
        logger->setLevel(level);
        Static.setLevel(level);

        const std::time_t t = std::time(nullptr);
        struct tm tm;
        LOG_INF("Initializing " << name << ". Local time: "
                                << std::put_time(localtime_r(&t, &tm), "%a %F %T %z")
                                << ". Log level is [" << logger->getLevel() << ']');
    }

    Poco::Logger& logger()
    {
        Poco::Logger* pLogger = Static.getThreadLocalLogger();
        if (pLogger != nullptr)
            return *pLogger;

        pLogger = Static.getLogger();
        return pLogger ? *pLogger
                       : Poco::Logger::get(Static.getInited() ? Static.getName() : std::string());
    }

    void shutdown()
    {
#if !MOBILEAPP
        if (!Util::isKitInProcess())
            assert(ThreadLocalBufferCount <= 1 &&
                   "Unstopped threads may have unflushed buffered log entries");

        IsShutdown = true;

        Poco::Logger::shutdown();

        // Flush
        fflush(stdout);
        fflush(stderr);
#endif
    }

    void setThreadLocalLogLevel(const std::string& logLevel)
    {
        if (!Static.getLogger())
        {
            return;
        }

        // Use the same channel for all Poco loggers.
        auto channel = Static.getLogger()->getChannel();

        // The Poco loggers have to have names that are unique, but those aren't displayed anywhere.
        // So just use the name of the default logger for this process plus a counter.
        static int counter = 1;
        auto& logger = Poco::Logger::create(Static.getName() + "." + std::to_string(counter++),
                                            std::move(channel),
                                            Poco::Logger::parseLevel(logLevel));
        Static.setThreadLocalLogger(&logger);
    }

    const std::string& getLevel()
    {
        return Static.getLevel();
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
