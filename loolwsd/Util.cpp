/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <sys/poll.h>
#include <sys/prctl.h>

#include <cassert>
#include <cstdlib>
#include <cstring>
#include <iomanip>
#include <mutex>
#include <random>
#include <sstream>
#include <string>

#include <png.h>

#include <signal.h>

#include <Poco/ConsoleChannel.h>
#include <Poco/Exception.h>
#include <Poco/Format.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Process.h>
#include <Poco/Thread.h>
#include <Poco/Timestamp.h>
#include <Poco/Util/Application.h>

#include "Common.hpp"
#include "Util.hpp"
#include "Png.hpp"

// Callback functions for libpng

extern "C"
{
    static void user_write_status_fn(png_structp, png_uint_32, int)
    {
    }

    static void user_write_fn(png_structp png_ptr, png_bytep data, png_size_t length)
    {
        std::vector<char> *outputp = (std::vector<char> *) png_get_io_ptr(png_ptr);
        const size_t oldsize = outputp->size();
        outputp->resize(oldsize + length);
        std::memcpy(outputp->data() + oldsize, data, length);
    }

    static void user_flush_fn(png_structp)
    {
    }
}

volatile bool TerminationFlag = false;

namespace Util
{
namespace rng
{
    static std::random_device _rd;
    static std::mutex _rngMutex;

    // Create the prng with a random-device for seed.
    // If we don't have a hardware random-device, we will get the same seed.
    // In that case we are better off with an arbitrary, but changing, seed.
    static std::mt19937_64 _rng = std::mt19937_64(_rd.entropy()
                                                ? _rd()
                                                : (clock() + getpid()));

    // A new seed is used to shuffle the sequence.
    // N.B. Always reseed after getting forked!
    void reseed()
    {
        _rng.seed(_rd.entropy() ? _rd() : (clock() + getpid()));
    }

    // Returns a new random number.
    unsigned getNext()
    {
        std::unique_lock<std::mutex> lock(_rngMutex);
        return _rng();
    }
}
}

namespace Log
{
    static const Poco::Int64 epochStart = Poco::Timestamp().epochMicroseconds();
    static std::string SourceName;
    static std::string SourceId;

    std::string logPrefix()
    {
        Poco::Int64 usec = Poco::Timestamp().epochMicroseconds() - epochStart;

        const Poco::Int64 one_s = 1000000;
        const Poco::Int64 hours = usec / (one_s*60*60);
        usec %= (one_s*60*60);
        const Poco::Int64 minutes = usec / (one_s*60);
        usec %= (one_s*60);
        const Poco::Int64 seconds = usec / (one_s);
        usec %= (one_s);

        std::ostringstream stream;
        stream << Log::SourceId << '-' << std::setw(2) << std::setfill('0')
               << (Poco::Thread::current() ? Poco::Thread::current()->id() : 0) << ' '
               << std::setw(2) << hours << ':' << std::setw(2) << minutes << ':'
               << std::setw(2) << seconds << "." << std::setw(6) << usec
               << ' ';

        char buf[32]; // we really need only 16
        if (prctl(PR_GET_NAME, reinterpret_cast<unsigned long>(buf), 0, 0, 0) == 0)
            stream << '[' << std::setw(15) << std::setfill(' ') << std::left << buf << "] ";

        return stream.str();
    }


    void initialize(const std::string& name)
    {
        SourceName = name;
        std::ostringstream oss;
        oss << SourceName << '-'
            << std::setw(5) << std::setfill('0') << Poco::Process::id();
        SourceId = oss.str();

        auto channel = (isatty(fileno(stdout)) || std::getenv("LOOL_LOGCOLOR")
                     ? static_cast<Poco::Channel*>(new Poco::ColorConsoleChannel())
                     : static_cast<Poco::Channel*>(new Poco::ConsoleChannel()));
        auto& logger = Poco::Logger::create(SourceName, channel, Poco::Message::PRIO_INFORMATION);

        // Configure the logger.
        // TODO: This should come from a file.
        // See Poco::Logger::setLevel docs for values.
        // Try: error, information, debug
        char *loglevel = std::getenv("LOOL_LOGLEVEL");
        if (loglevel)
            logger.setLevel(std::string(loglevel));

        info("Initializing " + name);
        info("Log level is [" + std::to_string(logger.getLevel()) + "].");
    }

    Poco::Logger& logger()
    {
        return Poco::Logger::get(SourceName);
    }

    void trace(const std::string& msg)
    {
        logger().trace(logPrefix() + msg);
    }

    void debug(const std::string& msg)
    {
        logger().debug(logPrefix() + msg);
    }

    void info(const std::string& msg)
    {
        logger().information(logPrefix() + msg);
    }

    void warn(const std::string& msg, const bool append_errno)
    {
        logger().warning(logPrefix() + msg +
                         (append_errno
                          ? (std::string(" (errno: ") + strerror(errno) + ").")
                          : std::string("")));
    }

    void error(const std::string& msg, const bool append_errno)
    {
        logger().error(logPrefix() + msg +
                       (append_errno
                        ? (std::string(" (errno: ") + strerror(errno) + ").")
                        : std::string("")));
    }
}

namespace Util
{
    std::string encodeId(const unsigned number, const int padding)
    {
        std::ostringstream oss;
        oss << std::hex << std::setw(padding) << std::setfill('0') << number;
        return oss.str();
    }

    unsigned decodeId(const std::string& str)
    {
        unsigned id = 0;
        std::stringstream ss;
        ss << std::hex << str;
        ss >> id;
        return id;
    }

    std::string createRandomDir(const std::string& path)
    {
        Poco::File(path).createDirectories();
        for (;;)
        {
            const auto name = Util::encodeId(rng::getNext());
            Poco::File dir(Poco::Path(path, name));
            if (dir.createDirectory())
            {
                return name;
            }
        }
    }

    std::string createRandomFile(const std::string& path)
    {
        Poco::File(path).createDirectories();
        for (;;)
        {
            const auto name = Util::encodeId(rng::getNext());
            Poco::File file(Poco::Path(path, name));
            if (file.createFile())
            {
                return name;
            }
        }
    }

    bool windowingAvailable()
    {
        return std::getenv("DISPLAY") != nullptr;
    }

    bool encodeBufferToPNG(unsigned char *pixmap, int width, int height, std::vector<char>& output, LibreOfficeKitTileMode mode)
    {

        return encodeSubBufferToPNG(pixmap, 0, 0, width, height, width, height, output, mode);
    }

    bool encodeSubBufferToPNG(unsigned char *pixmap, int startX, int startY, int width, int height,
                              int bufferWidth, int bufferHeight, std::vector<char>& output, LibreOfficeKitTileMode mode)
    {
        if (bufferWidth < width || bufferHeight < height)
            return false;

        png_structp png_ptr = png_create_write_struct(PNG_LIBPNG_VER_STRING, nullptr, nullptr, nullptr);

        png_infop info_ptr = png_create_info_struct(png_ptr);

        if (setjmp(png_jmpbuf(png_ptr)))
        {
            png_destroy_write_struct(&png_ptr, nullptr);
            return false;
        }

        png_set_IHDR(png_ptr, info_ptr, width, height, 8, PNG_COLOR_TYPE_RGB_ALPHA, PNG_INTERLACE_NONE, PNG_COMPRESSION_TYPE_DEFAULT, PNG_FILTER_TYPE_DEFAULT);

        png_set_write_fn(png_ptr, &output, user_write_fn, user_flush_fn);
        png_set_write_status_fn(png_ptr, user_write_status_fn);

        png_write_info(png_ptr, info_ptr);

        if (mode == LOK_TILEMODE_BGRA)
        {
            png_set_write_user_transform_fn (png_ptr, unpremultiply_data);
        }

        for (int y = 0; y < height; ++y)
        {
            size_t position = ((startY + y) * bufferWidth * 4) + (startX * 4);
            png_write_row(png_ptr, pixmap + position);
        }

        png_write_end(png_ptr, info_ptr);

        png_destroy_write_struct(&png_ptr, &info_ptr);

        return true;
    }

    void shutdownWebSocket(std::shared_ptr<Poco::Net::WebSocket> ws)
    {
        try
        {
            if (ws)
                ws->shutdown();
        }
        catch (const Poco::IOException& exc)
        {
            Log::warn("Util::shutdownWebSocket: IOException: " + exc.message());
        }
    }

    std::string signalName(const int signo)
    {
        switch (signo)
        {
#define CASE(x) case SIG##x: return #x
            CASE(HUP);
            CASE(INT);
            CASE(QUIT);
            CASE(ILL);
            CASE(ABRT);
            CASE(FPE);
            CASE(KILL);
            CASE(SEGV);
            CASE(PIPE);
            CASE(ALRM);
            CASE(TERM);
            CASE(USR1);
            CASE(USR2);
            CASE(CHLD);
            CASE(CONT);
            CASE(STOP);
            CASE(TSTP);
            CASE(TTIN);
            CASE(TTOU);
            CASE(BUS);
#ifdef SIGPOLL
            CASE(POLL);
#endif
            CASE(PROF);
            CASE(SYS);
            CASE(TRAP);
            CASE(URG);
            CASE(VTALRM);
            CASE(XCPU);
            CASE(XFSZ);
#ifdef SIGEMT
            CASE(EMT);
#endif
#ifdef SIGSTKFLT
            CASE(STKFLT);
#endif
#if defined(SIGIO) && SIGIO != SIGPOLL
            CASE(IO);
#endif
#ifdef SIGPWR
            CASE(PWR);
#endif
#ifdef SIGLOST
            CASE(LOST);
#endif
            CASE(WINCH);
#if defined(SIGINFO) && SIGINFO != SIGPWR
            CASE(INFO);
#endif
#undef CASE
        default:
            return std::to_string(signo);
        }
    }

    ssize_t writeFIFO(int pipe, const char* buffer, ssize_t size)
    {
        ssize_t bytes = -1;
        ssize_t count = 0;

        while(true)
        {
            bytes = write(pipe, buffer + count, size - count);
            if (bytes < 0)
            {
                if (errno == EINTR || errno == EAGAIN)
                    continue;

                count = -1;
                break;
            }
            else if (count + bytes < size)
            {
                count += bytes;
            }
            else
            {
                count += bytes;
                break;
            }
        }

        return count;
    }

    ssize_t readFIFO(int pipe, char* buffer, ssize_t size)
    {
        ssize_t bytes;
        do
        {
            bytes = read(pipe, buffer, size);
        }
        while (bytes < 0 && errno == EINTR);

        return bytes;
    }

    ssize_t readMessage(int pipe, char* buffer, ssize_t size)
    {
        struct pollfd pollPipe;

        pollPipe.fd = pipe;
        pollPipe.events = POLLIN;
        pollPipe.revents = 0;

        const int nPoll = poll(&pollPipe, 1, CHILD_TIMEOUT_SECS * 1000);
        if ( nPoll < 0 )
            return -1;

        if ( nPoll == 0 )
            errno = ETIME;

        if( (pollPipe.revents & POLLIN) != 0 )
            return readFIFO(pipe, buffer, size);

        return -1;
    }

    static
    void handleTerminationSignal(const int signal)
    {
        if (!TerminationFlag)
        {
            // Poco::Log takes a lock that isn't recursive.
            // If we are signaled while having that lock,
            // logging again will deadlock on it.
            TerminationFlag = true;

            Log::info() << "Termination signal received: "
                        << Util::signalName(signal) << " "
                        << strsignal(signal) << Log::end;
        }
    }

    void setTerminationSignals()
    {
        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = handleTerminationSignal;

        sigaction(SIGTERM, &action, nullptr);
        sigaction(SIGINT, &action, nullptr);
        sigaction(SIGQUIT, &action, nullptr);
        sigaction(SIGHUP, &action, nullptr);
    }

    static
    void handleFatalSignal(const int signal)
    {
        Log::error() << "Fatal signal received: "
                     << Util::signalName(signal) << " "
                     << strsignal(signal) << Log::end;

        if (std::getenv("LOOL_DEBUG"))
        {
            Log::error() << "\nFatal signal! Attach debugger with:\n"
                         << "sudo gdb --pid=" << Poco::Process::id() << "\n or \n"
                         << "sudo gdb --q --n --ex 'thread apply all backtrace full' --batch --pid="
                         << Poco::Process::id() << "\n" << Log::end;
            sleep(30);
        }

        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = SIG_DFL;

        sigaction(signal, &action, NULL);
        // let default handler process the signal
        kill(Poco::Process::id(), signal);
    }

    void setFatalSignals()
    {
        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = handleFatalSignal;

        sigaction(SIGSEGV, &action, NULL);
        sigaction(SIGBUS, &action, NULL);
        sigaction(SIGABRT, &action, NULL);
        sigaction(SIGILL, &action, NULL);
        sigaction(SIGFPE, &action, NULL);
    }

    int getChildStatus(const int code)
    {
        int retVal;

        switch (static_cast<const LOOLExitCode>(code))
        {
            case LOOLExitCode::LOOL_SECOND_OFFICE:
            case LOOLExitCode::LOOL_FATAL_ERROR:
            case LOOLExitCode::LOOL_CRASH_WITH_RESTART:
            case LOOLExitCode::LOOL_NORMAL_RESTART:
            case LOOLExitCode::LOOL_EXIT_SOFTWARE:
                retVal = EXIT_FAILURE;
            break;

            case LOOLExitCode::LOOL_NO_ERROR:
                retVal = EXIT_SUCCESS;
            break;

            // Why are other non-zero exit codes interpreted as success?
            default:
                retVal = EXIT_SUCCESS;
            break;
        }

        return retVal;
    }

    int getSignalStatus(const int code)
    {
        int retVal;

        switch (code)
        {
            case SIGSEGV:
            case SIGBUS:
            case SIGABRT:
            case SIGILL:
            case SIGFPE:
            case SIGTERM:
            case SIGINT:
            case SIGQUIT:
            case SIGHUP:
                retVal = EXIT_FAILURE;
            break;

            // Why are other signals treated as success? Will this function ever be called when a
            // child was *not* terminated by a signal?
            default:
                retVal = EXIT_SUCCESS;
            break;
        }

        return retVal;
    }

    void requestTermination(const Poco::Process::PID& pid)
    {
        try
        {
            Poco::Process::requestTermination(pid);
        }
        catch(const Poco::Exception& exc)
        {
            Log::warn("Util::requestTermination: Exception: " + exc.message());
        }
    }

    void pollPipeForReading(pollfd& pollPipe, const std::string& targetPipeName , const int& targetPipe,
                            std::function<void(std::string& message)> handler)
    {
        std::string message;
        char buffer[READ_BUFFER_SIZE];
        char* start = buffer;
        char* end = buffer;
        ssize_t bytes = -1;

        while (!TerminationFlag)
        {
            if (start == end)
            {
                if (poll(&pollPipe, 1, POLL_TIMEOUT_MS) < 0)
                {
                    Log::error("Failed to poll pipe [" + targetPipeName + "].");
                    continue;
                }
                else if (pollPipe.revents & (POLLIN | POLLPRI))
                {
                    bytes = Util::readFIFO(targetPipe, buffer, sizeof(buffer));
                    if (bytes < 0)
                    {
                        start = end = nullptr;
                        Log::error("Error reading message from pipe [" + targetPipeName + "].");
                        continue;
                    }
                    start = buffer;
                    end = buffer + bytes;
                }
                else if (pollPipe.revents & (POLLERR | POLLHUP))
                {
                    Log::error("Broken pipe [" + targetPipeName + "] with wsd.");
                    break;
                }
            }

            if (start != end)
            {
                char byteChar = *start++;
                while (start != end && byteChar != '\r' && byteChar != '\n')
                {
                    message += byteChar;
                    byteChar = *start++;
                }

                if (byteChar == '\r' && *start == '\n')
                {
                    start++;
                    Log::debug(targetPipeName + " recv: " + message);
                    if (message == "eof")
                        break;

                    handler(message);
                    message.clear();
                }
            }
        }
    }

    unsigned getMemoryUsage(Poco::Process::PID nPid)
    {
        //TODO: Instead of RSS, return PSS
        std::string sResponse;
        const auto cmd = "ps o rss= -p " + std::to_string(nPid);
        FILE* fp = popen(cmd.c_str(), "r");
        if (fp == nullptr)
        {
            return 0;
        }

        char cmdBuffer[1024];
        while (fgets(cmdBuffer, sizeof(cmdBuffer) - 1, fp) != nullptr)
        {
            sResponse += cmdBuffer;
        }
        pclose(fp);

        unsigned nMem = 0;
        try
        {
            nMem = std::stoi(sResponse);
        }
        catch(std::exception& e)
        {
            Log::warn() << "Trying to find memory of invalid/dead PID" << Log::end;
        }

        return nMem;
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
