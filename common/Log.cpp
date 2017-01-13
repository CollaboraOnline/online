/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <sys/prctl.h>

#include <atomic>
#include <cassert>
#include <iomanip>
#include <sstream>
#include <string>

#include <sys/syscall.h>
#include <unistd.h>

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

    static void getPrefix(char *buffer, const char* level)
    {
        // FIXME: If running under systemd it is redundant to output timestamps, as those will be
        // attached to messages that the systemd journalling mechanism picks up anyway, won't they?

        std::string time = DateTimeFormatter::format(Poco::Timestamp(), "%H:%M:%s");

        char procName[32]; // we really need only 16
        if (prctl(PR_GET_NAME, reinterpret_cast<unsigned long>(procName), 0, 0, 0) != 0)
        {
            strncpy(procName, "<noid>", sizeof(procName) - 1);
        }

        const char* appName = (Source.inited ? Source.id.c_str() : "<shutdown>");
        assert(strlen(appName) + 32 + 28 < 1024 - 1);

        snprintf(buffer, 4095, "%s-%.04lu %s [ %s ] %s  ", appName,
                 syscall(SYS_gettid),
                 time.c_str(),
                 procName, level);
    }

    std::string prefix(const char* level)
    {
        char buffer[1024];
        getPrefix(buffer, level);
        return std::string(buffer);
    }

    void signalLogPrefix()
    {
        char buffer[1024];
        getPrefix(buffer, "SIG");
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

        info("Initializing " + name);
        info("Log level is [" + std::to_string(logger.getLevel()) + "].");
    }

    Poco::Logger& logger()
    {
        return Poco::Logger::get(Source.inited ? Source.name : std::string());
    }

    void trace(const std::string& msg)
    {
        logger().trace(prefix("TRC") + msg);
    }

    void debug(const std::string& msg)
    {
        logger().debug(prefix("DBG") + msg);
    }

    void info(const std::string& msg)
    {
        logger().information(prefix("INF") + msg);
    }

    void warn(const std::string& msg)
    {
        logger().warning(prefix("WRN") + msg);
    }

    void error(const std::string& msg)
    {
        logger().error(prefix("ERR") + msg);
    }

    void syserror(const std::string& msg)
    {
        logger().error(prefix("ERR") + msg + " (errno: " + std::string(std::strerror(errno)) + ")");
    }

    void fatal(const std::string& msg)
    {
        logger().fatal(prefix("FTL") + msg);
    }

    void sysfatal(const std::string& msg)
    {
        logger().fatal(prefix("FTL") + msg + " (errno: " + std::string(std::strerror(errno)) + ")");
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
