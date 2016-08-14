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

#include <Poco/ConsoleChannel.h>
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

    static const Poco::Int64 epochStart = Poco::Timestamp().epochMicroseconds();
    /// Helper to avoid destruction ordering issues.
    struct StaticNames {
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
        while (true) {
            int length = strlen(message);
            int written = write (STDERR_FILENO, message, length);
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

    static void getPrefix(char *buffer)
    {
        Poco::Int64 usec = Poco::Timestamp().epochMicroseconds() - epochStart;

        const Poco::Int64 one_s = 1000000;
        const Poco::Int64 hours = usec / (one_s*60*60);
        usec %= (one_s*60*60);
        const Poco::Int64 minutes = usec / (one_s*60);
        usec %= (one_s*60);
        const Poco::Int64 seconds = usec / (one_s);
        usec %= (one_s);

        char procName[32]; // we really need only 16
        if (prctl(PR_GET_NAME, reinterpret_cast<unsigned long>(procName), 0, 0, 0) != 0)
            strncpy(procName, "<noid>", sizeof(procName) - 1);

        const char *appName = (Source.inited ? Source.id.c_str() : "<shutdown>");
        assert(strlen(appName) + 32 + 28 < 1024 - 1);

        snprintf(buffer, 4095, "%s-%.2d %.2d:%.2d:%.2d.%.6d [ %s ] ", appName,
                 (Poco::Thread::current() ? Poco::Thread::current()->id() : 0),
                 (int)hours, (int)minutes, (int)seconds, (int)usec,
                 procName);
    }

    std::string prefix()
    {
        char buffer[1024];
        getPrefix(buffer);
        return std::string(buffer);
    }

    void signalLogPrefix()
    {
        char buffer[1024];
        getPrefix(buffer);
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
        AutoPtr<Channel> channelConsole = (isatty(fileno(stderr)) || withColor
                            ? static_cast<Poco::Channel*>(new Poco::ColorConsoleChannel())
                            : static_cast<Poco::Channel*>(new Poco::ConsoleChannel()));

        AutoPtr<Channel> channel = channelConsole;
        if (logToFile)
        {
            AutoPtr<SplitterChannel> splitterChannel(new SplitterChannel());
            splitterChannel->addChannel(channelConsole);

            AutoPtr<FileChannel> rotatedFileChannel(new FileChannel("loolwsd.log"));
            for (const auto& pair : config)
            {
                rotatedFileChannel->setProperty(pair.first, pair.second);
            }

            splitterChannel->addChannel(rotatedFileChannel);
            channel = splitterChannel;
        }

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
        logger().trace(prefix() + msg);
    }

    void debug(const std::string& msg)
    {
        logger().debug(prefix() + msg);
    }

    void info(const std::string& msg)
    {
        logger().information(prefix() + msg);
    }

    void warn(const std::string& msg)
    {
        logger().warning(prefix() + msg);
    }

    void error(const std::string& msg)
    {
        logger().error(prefix() + msg);
    }

    void syserror(const std::string& msg)
    {
        logger().error(prefix() + msg + " (errno: " + std::string(std::strerror(errno)) + ")");
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
