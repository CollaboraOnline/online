/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#ifdef __linux
#include <sys/prctl.h>
#include <sys/syscall.h>
#endif
#include <unistd.h>

#include <atomic>
#include <cassert>
#include <cstring>
#include <ctime>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>

#include <Poco/AutoPtr.h>
#include <Poco/ConsoleChannel.h>
#include <Poco/DateTimeFormatter.h>
#include <Poco/FileChannel.h>
#include <Poco/FormattingChannel.h>
#include <Poco/PatternFormatter.h>
#include <Poco/Process.h>
#include <Poco/SplitterChannel.h>
#include <Poco/Timestamp.h>

#include "Log.hpp"
#include "Util.hpp"

namespace Log
{
    using namespace Poco;

    /// Helper to avoid destruction ordering issues.
    struct StaticNameHelper
    {
    private:
        Poco::Logger* _logger;
        std::string _name;
        std::string _id;
        std::atomic<bool> _inited;
    public:
        StaticNameHelper() :
            _logger(nullptr),
            _inited(true)
        {
        }
        ~StaticNameHelper()
        {
            _inited = false;
        }

        bool getInited() const { return _inited; }

        void setId(const std::string& id) { _id = id; }

        const std::string& getId() const { return _id; }

        void setName(const std::string& name) { _name = name; }

        const std::string& getName() const { return _name; }

        void setLogger(Poco::Logger* logger) { _logger = logger; };
        Poco::Logger* getLogger() { return _logger; }
    };
    static StaticNameHelper Source;
    bool IsShutdown = false;

    // We need a signal safe means of writing messages
    //   $ man 7 signal
    void signalLog(const char *message)
    {
        while (true)
        {
            const int length = std::strlen(message);
            const int written = write(STDERR_FILENO, message, length);
            if (written < 0)
            {
                if (errno == EINTR)
                    continue; // ignore.
                else
                    break;
            }

            message += written;
            if (message[0] == '\0')
                break;
        }
    }

    // We need a signal safe means of writing messages
    //   $ man 7 signal
    void signalLogNumber(std::size_t num)
    {
        int i;
        char buf[22];
        buf[21] = '\0';
        for (i = 20; i > 0 && num > 0; --i)
        {
            buf[i] = '0' + num % 10;
            num /= 10;
        }
        signalLog(buf + i + 1);
    }

    char* prefix(char* buffer, const std::size_t len, const char* level)
    {
        const char *threadName = Util::getThreadName();
        Poco::DateTime time;
#ifdef __linux
        const long osTid = Util::getThreadId();
        // Note that snprintf is deemed signal-safe in most common implementations.
        snprintf(buffer, len, "%s-%.05lu %.4u-%.2u-%.2u %.2u:%.2u:%.2u.%.6u [ %s ] %s  ",
                    (Source.getInited() ? Source.getId().c_str() : "<shutdown>"),
                    osTid,
                    time.year(), time.month(), time.day(),
                    time.hour(), time.minute(), time.second(),
                    time.millisecond() * 1000 + time.microsecond(),
                    threadName, level);
#elif defined IOS
        uint64_t osTid;
        pthread_threadid_np(nullptr, &osTid);
        snprintf(buffer, len, "%s-%#.05llx %.4u-%.2u-%.2u %.2u:%.2u:%.2u.%.6u [ %s ] %s  ",
                    (Source.getInited() ? Source.getId().c_str() : "<shutdown>"),
                    osTid,
                    time.year(), time.month(), time.day(),
                    time.hour(), time.minute(), time.second(),
                    time.millisecond() * 1000 + time.microsecond(),
                    threadName, level);
#endif
        return buffer;
    }

    void signalLogPrefix()
    {
        char buffer[1024];
        prefix(buffer, sizeof(buffer) - 1, "SIG");
        signalLog(buffer);
    }

    void initialize(const std::string& name,
                    const std::string& logLevel,
                    const bool withColor,
                    const bool logToFile,
                    const std::map<std::string, std::string>& config)
    {
        Source.setName(name);
        std::ostringstream oss;
        oss << Source.getName();
#if !MOBILEAPP // Just one process in a mobile app, the pid is uninteresting.
        oss << '-'
            << std::setw(5) << std::setfill('0') << getpid();
#endif
        Source.setId(oss.str());

        // Configure the logger.
        AutoPtr<Channel> channel;

        if (logToFile)
        {
            channel = static_cast<Poco::Channel*>(new FileChannel("loolwsd.log"));
            for (const auto& pair : config)
            {
                channel->setProperty(pair.first, pair.second);
            }
        }
        else if (withColor)
        {
            channel = static_cast<Poco::Channel*>(new Poco::ColorConsoleChannel());
            channel->setProperty("traceColor", "green");
            channel->setProperty("warningColor", "magenta");
        }
        else
            channel = static_cast<Poco::Channel*>(new Poco::ConsoleChannel());

        /**
         * Open the channel explicitly, instead of waiting for first log message
         * This is important especially for the kit process where opening the channel
         * after chroot can cause file creation inside the jail instead of outside
         * */
        channel->open();
        auto& logger = Poco::Logger::create(Source.getName(), channel, Poco::Message::PRIO_TRACE);
        Source.setLogger(&logger);

        logger.setLevel(logLevel.empty() ? std::string("trace") : logLevel);

        const std::time_t t = std::time(nullptr);
        oss.str("");
        oss.clear();

        oss << "Initializing " << name << ".";

        // TODO: replace with std::put_time when we move to gcc 5+.
        char buf[32];
        if (strftime(buf, sizeof(buf), "%a %F %T%z", std::localtime(&t)) > 0)
        {
            oss << " Local time: " << buf << ".";
        }

        oss <<  " Log level is [" << logger.getLevel() << "].";
        LOG_INF(oss.str());
    }

    Poco::Logger& logger()
    {
        Poco::Logger* pLogger = Source.getLogger();
        return pLogger ? *pLogger
                       : Poco::Logger::get(Source.getInited() ? Source.getName() : std::string());
    }

    void shutdown()
    {
#if !MOBILEAPP
        IsShutdown = true;

        Poco::Logger::shutdown();

        // Flush
        std::flush(std::cout);
        fflush(stdout);
        std::flush(std::cerr);
        fflush(stderr);
#endif
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
