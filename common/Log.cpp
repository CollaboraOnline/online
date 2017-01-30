/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>

#include <atomic>
#include <cassert>
#include <ctime>
#include <iomanip>
#include <sstream>
#include <string>

#include <Poco/ConsoleChannel.h>
#include <Poco/DateTimeFormatter.h>
#include <Poco/FileChannel.h>
#include <Poco/FormattingChannel.h>
#include <Poco/PatternFormatter.h>
#include <Poco/Process.h>
#include <Poco/SplitterChannel.h>
#include <Poco/Thread.h>
#include <Poco/Timestamp.h>

#include "Log.hpp"

static char LogPrefix[256] = { '\0' };

namespace Log
{
    using namespace Poco;

    /// Helper to avoid destruction ordering issues.
    struct StaticNames
    {
        std::atomic<bool> inited;
        std::string name;
        std::string id;
        StaticNames() :
            inited(true)
        {
        }
        ~StaticNames()
        {
            inited = false;
        }
    };
    static StaticNames Source;

    // We need a signal safe means of writing messages
    //   $ man 7 signal
    void signalLog(const char *message)
    {
        while (true)
        {
            const int length = strlen(message);
            const int written = write (STDERR_FILENO, message, length);
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

    char* prefix(char* buffer, const char* level, const long osTid)
    {
        char procName[32];
        if (prctl(PR_GET_NAME, reinterpret_cast<unsigned long>(procName), 0, 0, 0) != 0)
        {
            strncpy(procName, "<noid>", sizeof(procName) - 1);
        }

        Poco::DateTime time;
        snprintf(buffer, 1023, "%s-%.05lu %.2u:%.2u:%.2u.%.6u [ %s ] %s  ",
                    (Source.inited ? Source.id.c_str() : "<shutdown>"),
                    osTid,
                    time.hour(), time.minute(), time.second(),
                    time.millisecond() * 1000 + time.microsecond(),
                    procName, level);
        return buffer;
    }

    void signalLogPrefix()
    {
        char buffer[1024];
        prefix(buffer, "SIG", syscall(SYS_gettid));
        signalLog(buffer);
    }

    void initialize(const std::string& name,
                    const std::string& logLevel,
                    const bool withColor,
                    const bool logToFile,
                    std::map<std::string, std::string> config)
    {
        Source.name = name;
        std::ostringstream oss;
        oss << Source.name << '-'
            << std::setw(5) << std::setfill('0') << Poco::Process::id();
        Source.id = oss.str();
        assert (sizeof (LogPrefix) > strlen(oss.str().c_str()) + 1);
        strncpy(LogPrefix, oss.str().c_str(), sizeof(LogPrefix));

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
            channel = static_cast<Poco::Channel*>(new Poco::ColorConsoleChannel());
        else
            channel = static_cast<Poco::Channel*>(new Poco::ConsoleChannel());

        auto& logger = Poco::Logger::create(Source.name, channel, Poco::Message::PRIO_TRACE);

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
        info(oss.str());
    }

    Poco::Logger& logger()
    {
        return Poco::Logger::get(Source.inited ? Source.name : std::string());
    }

    void trace(const std::string& msg)
    {
        LOG_TRC(msg);
    }

    void debug(const std::string& msg)
    {
        LOG_DBG(msg);
    }

    void info(const std::string& msg)
    {
        LOG_INF(msg);
    }

    void warn(const std::string& msg)
    {
        LOG_WRN(msg);
    }

    void error(const std::string& msg)
    {
        LOG_ERR(msg);
    }

    void syserror(const std::string& msg)
    {
        LOG_SYS(msg);
    }

    void fatal(const std::string& msg)
    {
        LOG_FTL(msg);
    }

    void sysfatal(const std::string& msg)
    {
        LOG_SFL(msg);
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
