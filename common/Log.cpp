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

#include "Log.hpp"
#include "StaticLogHelper.hpp"
#include "Util.hpp"

#include <Poco/AutoPtr.h>
#include <Poco/FileChannel.h>
#include <Poco/Logger.h>
#include <Poco/Version.h>

#include <atomic>
#include <cassert>
#include <cstdint>
#include <cstring>
#include <ctime>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <unistd.h>
#include <unordered_map>

namespace
{
/// Tracks the number of thread-local buffers (for debugging purposes).
std::atomic_int32_t ThreadLocalBufferCount(0);

#ifndef NDEBUG
// In debug builds, we track the thread-ids to list the ones still running at exist.
thread_local std::int32_t OwnThreadIdIndex = 0;
std::int32_t ThreadIdArray[256];
std::atomic_int32_t NextThreadIdIndex(0);
#endif // !NDEBUG

/// Which log areas should be disabled
bool AreasDisabled[Log::AreaMax] = { false, };

} // namespace

/// Wrapper to expose protected 'log' and genericise
class GenericLogger : public Poco::Logger
{
public:
    GenericLogger(const std::string& name,
                  Poco::AutoPtr<Poco::Channel> chan, int lvl)
        : Poco::Logger(name, std::move(chan), lvl)
    {
    }

    static GenericLogger& create(const std::string& name,
                                 Poco::AutoPtr<Poco::Channel> chan, int lvl)
    {
        // Expect no thread contention creating
        // loggers and we can't access the internal mutex.
        if (find(name))
            throw Poco::ExistsException();
        auto* log = new GenericLogger(name, std::move(chan), lvl);
        add(log);
        return *log;
    }

    void doLog(Log::Level l, const std::string& text)
    {
        Poco::Message::Priority prio = Poco::Message::Priority::PRIO_TRACE;
#define MAP(l,p) case Log::Level::l: prio = Poco::Message::Priority::p;break
        switch (l) {
            MAP(FTL, PRIO_FATAL);
            MAP(CTL, PRIO_CRITICAL);
            MAP(ERR, PRIO_ERROR);
            MAP(WRN, PRIO_WARNING);
            MAP(NTC, PRIO_NOTICE);
            MAP(INF, PRIO_INFORMATION);
            MAP(DBG, PRIO_DEBUG);
            MAP(TRC, PRIO_TRACE);
        default:
            break;
#undef MAP
        }

        if (getLevel() < prio)
            return;
#if POCO_VERSION >= 0x010C0501
        Poco::Channel* channel = getChannel().get();
#else
        auto channel = getChannel();
#endif
        if (!channel)
            return;
        channel->log(Poco::Message(name(), text, prio));
    }

    static Log::Level mapToLevel(Poco::Message::Priority prio)
    {
#define MAP(l,p) case Poco::Message::Priority::p: return Log::Level::l;
        switch (prio) {
            MAP(FTL, PRIO_FATAL);
            MAP(CTL, PRIO_CRITICAL);
            MAP(ERR, PRIO_ERROR);
            MAP(WRN, PRIO_WARNING);
            MAP(NTC, PRIO_NOTICE);
            MAP(INF, PRIO_INFORMATION);
            MAP(DBG, PRIO_DEBUG);
            MAP(TRC, PRIO_TRACE);
        default:
            return Log::Level::TRC;
        }
#undef MAP
    }
};

namespace Log
{
    using namespace Poco;

    class ConsoleChannel : public Poco::Channel
    {
    public:
        static constexpr std::size_t BufferSize = 64 * 1024;

        void close() override { flush(); }

        /// Write the given buffer to stderr directly.
        static inline std::size_t writeRaw(const char* data, std::size_t count)
        {
#if WASMAPP
            // In WASM, stdout works best.
            constexpr int LOG_FILE_FD = STDOUT_FILENO;
#else
            // By default, write to stderr.
            constexpr int LOG_FILE_FD = STDERR_FILENO;
#endif

            const char *ptr = data;
            while (count > 0)
            {
                ssize_t wrote;
                while ((wrote = ::write(LOG_FILE_FD, ptr, count)) < 0 && errno == EINTR)
                {
                }

                if (wrote < 0)
                {
                    break;
                }

                ptr += wrote;
                count -= wrote;
            }
            return ptr - data;
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

    void preFork() { flush(); }

    void postFork()
    {
        /// after forking we can end up with threads that
        /// logged in the parent confusing our counting.
        ThreadLocalBufferCount = 0;
#ifndef NDEBUG
        NextThreadIdIndex = 0;
        memset(ThreadIdArray, 0, sizeof(ThreadIdArray));
#endif // !NDEBUG
    }

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
#ifndef NDEBUG
                OwnThreadIdIndex = NextThreadIdIndex++;
                ThreadIdArray[OwnThreadIdIndex] = Util::getThreadId();
#endif // !NDEBUG
            }

            ~ThreadLocalBuffer()
            {
                flush();
                --ThreadLocalBufferCount;
#ifndef NDEBUG
                ThreadIdArray[OwnThreadIdIndex] = 0;
#endif // !NDEBUG
            }

            std::size_t size() const { return _size; }
            std::size_t available() const { return BufferSize - _size; }

            /// Flush internal buffers, if any.
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

        private:
            char _buffer[BufferSize];
            std::size_t _size;
            std::int64_t _oldest_time_us; ///< The timestamp of the oldest buffered entry.
        };

    protected:
        inline std::size_t size() const { return _tlb.size(); }
        inline std::size_t available() const { return _tlb.available(); }

        inline void buffer(const char* data, std::size_t size) { _tlb.buffer(data, size); }

        inline void buffer(const std::string_view string) { buffer(string.data(), string.size()); }

    public:
        ~BufferedConsoleChannel() { flush(); }

        void close() override { flush(); }

        /// Flush buffers, if any.
        static inline void flush() { _tlb.flush(); }

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

    extern StaticHelper Static;
    extern StaticUIHelper StaticUILog;

    namespace
    {

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

#if defined(__linux__)
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
#endif
    } // namespace

    char* prefix(const std::chrono::time_point<std::chrono::system_clock>& tp, char* buffer,
                 const std::string_view level)
    {
#if defined(IOS) || defined(__FreeBSD__)
        // Don't bother with the "Source" which would be just "Mobile" always (or whatever the app
        // process is called depending on platform and configuration) and non-informative as there
        // is just one process in the app anyway.

        // FIXME: Not sure why FreeBSD is here, too. Surely on FreeBSD COOL runs just like on Linux,
        // as a set of separate processes, so it would be useful to see from which process a log
        // line is?

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

        auto t = std::chrono::system_clock::to_time_t(tp);
        std::tm tm;
        Util::time_t_to_localtime(t, tm);

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
        auto microseconds = std::chrono::duration_cast<std::chrono::microseconds>(tp.time_since_epoch());
        auto fractional_seconds = microseconds.count() % 1000000;
        to_ascii_fixed<6>(pos, fractional_seconds);
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
        memcpy(pos, level.data(), level.size());
        pos += 3;
        pos[0] = ' ';
        pos[1] = ' ';
        pos[2] = '\0';

        return buffer;
    }

    void initialize(const std::string& name,
                    const std::string& logLevel,
                    const bool withColor,
                    const bool logToFile,
                    const std::map<std::string, std::string>& config,
                    const bool logToFileUICmd,
                    const std::map<std::string, std::string>& configUICmd)
    {
        Static.setName(name);
        std::ostringstream oss;
        oss << Static.getName();
        if constexpr (!Util::isMobileApp())
            oss << '-' << std::setw(5) << std::setfill('0') << Util::getProcessId();
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
            const auto it = config.find("flush");
            if (it == config.end() || Util::toLower(it->second) != "false")
            {
                // Buffered logging, reduces number of write(2) syscalls.
                channel = static_cast<Poco::Channel*>(new Log::BufferedConsoleChannel());
            }
            else
            {
                // Unbuffered logging, directly writes each entry (to stderr).
                channel = static_cast<Poco::Channel*>(new Log::ConsoleChannel());
            }
        }

        /**
         * Open the channel explicitly, instead of waiting for first log message
         * This is important especially for the kit process where opening the channel
         * after chroot can cause file creation inside the jail instead of outside
         * */
        channel->open();

        try
        {
            auto& logger = GenericLogger::create(Static.getName(), std::move(channel), Poco::Message::PRIO_TRACE);
            Static.setLogger(&logger);
        }
        catch (ExistsException&)
        {
            auto* logger = static_cast<GenericLogger*>(&Poco::Logger::get(Static.getName()));
            Static.setLogger(logger);
        }

        auto* logger = Static.getLogger();

        const std::string level = logLevel.empty() ? std::string("trace") : logLevel;
        logger->setLevel(level);
        Static.setLevel(level);

        const std::time_t t = std::time(nullptr);
        struct tm tm;
        LOG_INF("Initializing " << name << ". Local time: "
                                << std::put_time(Util::time_t_to_localtime(t, tm), "%a %F %T %z")
                                << ". Log level is [" << logger->getLevel() << ']');

        StaticUILog.setName(name+"_ui");
        AutoPtr<Channel> channelUILog;
        if (logToFileUICmd)
        {
            channelUILog = static_cast<Poco::Channel*>(new Poco::FileChannel("coolwsd-ui-cmd.log"));
            for (const auto& pair : configUICmd)
            {
                channelUILog->setProperty(pair.first, pair.second);
            }

            channelUILog->open();
            try
            {
                auto& loggerUILog = GenericLogger::create(StaticUILog.getName(), std::move(channelUILog), Poco::Message::PRIO_TRACE);
                StaticUILog.setLogger(&loggerUILog);
            }
            catch (ExistsException&)
            {
                auto* loggerUILog =
                    static_cast<GenericLogger*>(&Poco::Logger::get(StaticUILog.getName()));
                StaticUILog.setLogger(loggerUILog);
            }
        }
    }

    namespace
    {

    GenericLogger& logger()
    {
        GenericLogger* logger = Static.getThreadLocalLogger();
        if (logger != nullptr)
            return *logger;

        logger = Static.getLogger();
        return logger ? *logger
            : *static_cast<GenericLogger *>(
                &GenericLogger::get(Static.getInited() ? Static.getName() : std::string()));
    }

    GenericLogger& loggerUI()
    {
        GenericLogger* logger = StaticUILog.getThreadLocalLogger();
        if (logger != nullptr)
            return *logger;

        logger = StaticUILog.getLogger();
        return logger ? *logger
            : *static_cast<GenericLogger *>(
                &GenericLogger::get(StaticUILog.getInited() ? StaticUILog.getName() : std::string()));
    }

    } // namespace

    bool isLogUIEnabled()
    {
        return (StaticUILog.getThreadLocalLogger() != nullptr) ||
               (StaticUILog.getLogger() != nullptr);
    }

    void logUI(Level l, const std::string &text)
    {
        if (isLogUIEnabled())
            Log::loggerUI().doLog(l, text);
    }

    bool isLogUIMerged()
    {
        return StaticUILog.getMergeCmd();
    }

    bool isLogUITimeEnd()
    {
        return StaticUILog.getLogTimeEndOfMergedCmd();
    }

    void setUILogMergeInfo(bool mergeCmd, bool logTimeEndOfMergedCmd)
    {
        StaticUILog.setLogMergeInfo(mergeCmd, logTimeEndOfMergedCmd);
    }

    bool isEnabled(Level l, Area a)
    {
        if (IsShutdown)
            return false;

        Log::Level logLevel = GenericLogger::mapToLevel(
            static_cast<Poco::Message::Priority>(logger().getLevel()));

        if (logLevel < static_cast<int>(l))
            return false;

        bool disabled = AreasDisabled[static_cast<size_t>(a)];

        // Areas shouldn't disable warnings & errors
        assert(!disabled || logLevel > static_cast<int>(Level::WRN));

        return !disabled;
    }

    void shutdown()
    {
        if constexpr (Util::isMobileApp())
            return;
        if (!Util::isKitInProcess())
        {
#ifndef NDEBUG
            OwnThreadIdIndex = NextThreadIdIndex++;
            ThreadIdArray[OwnThreadIdIndex] = Util::getThreadId();
            const auto currentThreadId = Util::getThreadId();
            for (int i = 0; i < NextThreadIdIndex; ++i)
            {
                if (ThreadIdArray[i] && ThreadIdArray[i] != currentThreadId)
                {
                    LOG_ERR(">>> Thread " << ThreadIdArray[i]
                                          << " is still running while shutting down logging");
                }
            }

            // Flush before we assert (no assertion in non-debug builds).
            flush();
            ::fflush(nullptr); // Flush all open output streams.
#endif // !NDEBUG

            assert(ThreadLocalBufferCount <= 1 &&
                   "Unstopped threads may have unflushed buffered log entries");
        }

        // continue logging shutdown on mobile
        IsShutdown = !Util::isMobileApp();

        Poco::Logger::shutdown();

        flush();

        ::fflush(nullptr); // Flush all open output streams.
    }

    void flush() { BufferedConsoleChannel::flush(); }

    void setThreadLocalLogLevel(const std::string& logLevel)
    {
        if (!Static.getLogger())
        {
            return;
        }

        if constexpr (Util::isFuzzing())
        {
            // loggingleveloverride tries to increase log level, ignore.
            return;
        }

        // Use the same channel for all Poco loggers.
        auto channel = Static.getLogger()->getChannel();

        // The Poco loggers have to have names that are unique, but those aren't displayed anywhere.
        // So just use the name of the default logger for this process plus a counter.
        static int counter = 1;
        auto& logger = GenericLogger::create(Static.getName() + "." + std::to_string(counter++),
                                             std::move(channel),
                                             Poco::Logger::parseLevel(logLevel));

        Static.setThreadLocalLogger(&logger);
    }

    const std::string& getLevelName()
    {
        return Static.getLevel();
    }

    Level getLevel()
    {
        return GenericLogger::mapToLevel(
            static_cast<Poco::Message::Priority>(
                Log::logger().getLevel()));
    }

    void setLevel(const std::string &l)
    {
        Log::logger().setLevel(l);
        // Update our public flags in the array now ...
    }

    /// Set disabled areas
    void setDisabledAreas(const std::string &areaStr)
    {
        if (areaStr != "")
            LOG_INF("Setting disabled log areas to [" << areaStr << "]");
        StringVector areas = StringVector::tokenize(areaStr, ',');
        std::vector<bool> enabled(Log::AreaMax, true);
        for (size_t t = 0; t < areas.size(); ++t)
        {
            for (size_t i = 0; i < Log::AreaMax; ++i)
            {
                if (areas.equals(t, nameShort(static_cast<Log::Area>(i))))
                {
                    enabled[i] = false;
                    break;
                }
            }
        }
        for (size_t i = 0; i < Log::AreaMax; ++i)
            AreasDisabled[i] = !enabled[i];
    }

    void log(Level l, const std::string &text)
    {
        Log::logger().doLog(l, text);
    }

    static const std::string levelList[] = { "none",        "fatal",   "critical",
                                             "error",       "warning", "notice",
                                             "information", "debug",   "trace" };

    const std::string& getLogLevelName(const std::string& channel)
    {
        const int wsdLogLevel = GenericLogger::get(channel).getLevel();
        return levelList[wsdLogLevel];
    }

    void setLogLevelByName(const std::string &channel,
                           const std::string &level)
    {
        if constexpr (Util::isFuzzing())
        {
            // update-log-levels tries to increase log level, ignore.
            return;
        }

        // FIXME: seems redundant do we need that ?
        std::string lvl = level;

        // Get the list of channels..
        std::vector<std::string> nameList;
        GenericLogger::names(nameList);

        if (std::find(std::begin(levelList), std::end(levelList), level) == std::end(levelList))
            lvl = "debug";

        GenericLogger::get(channel).setLevel(lvl);
    }

} // namespace Log

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
