/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_UTIL_HPP
#define INCLUDED_UTIL_HPP

#include <string>
#include <sstream>
#include <functional>
#include <memory>
#include <sys/poll.h>

#include <Poco/File.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Logger.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

// This is an odd mix of the EExitCodes enum in LibreOffice's desktop/source/inc/exithelper.h and
// then EX_SOFTWARE (= 70) from the (BSD origin) <sysexits.h>.

enum class LOOLExitCode
{
    LOOL_NO_ERROR = 0,
    /* pipe was detected - second office must terminate itself */
    LOOL_SECOND_OFFICE = 1,
    /* an uno exception was catched during startup */
    LOOL_FATAL_ERROR = 77, /* Only the low 8 bits are significant 333 % 256 = 77 */
    /* user force automatic restart after crash */
    LOOL_CRASH_WITH_RESTART = 79,
    /* the office restarts itself */
    LOOL_NORMAL_RESTART = 81,
    /* internal software error */
    LOOL_EXIT_SOFTWARE = 70
};

/// Flag to stop pump loops.
extern volatile bool TerminationFlag;

namespace Util
{
    namespace rng
    {
        void reseed();
        unsigned getNext();
    }

    /// Encode an integral ID into a string, with padding support.
    std::string encodeId(const unsigned number, const int padding = 5);
    /// Decode an integral ID from a string.
    unsigned decodeId(const std::string& str);

    /// Creates a randomly name directory within path and returns the name.
    std::string createRandomDir(const std::string& path);
    /// Creates a randomly name file within path and returns the name.
    std::string createRandomFile(const std::string& path);

    bool windowingAvailable();

    // Sadly, older libpng headers don't use const for the pixmap pointer parameter to
    // png_write_row(), so can't use const here for pixmap.
    bool encodeBufferToPNG(unsigned char* pixmap, int width, int height,
                           std::vector<char>& output, LibreOfficeKitTileMode mode);
    bool encodeSubBufferToPNG(unsigned char* pixmap, int startX, int startY, int width, int height,
                              int bufferWidth, int bufferHeight,
                              std::vector<char>& output, LibreOfficeKitTileMode mode);

    /// Call WebSocket::shutdown() ignoring Poco::IOException.
    void shutdownWebSocket(std::shared_ptr<Poco::Net::WebSocket> ws);

    ssize_t writeFIFO(int pipe, const char* buffer, ssize_t size);
    inline
    ssize_t writeFIFO(int pipe, const std::string& message)
    {
        return writeFIFO(pipe, message.c_str(), message.size());
    }

    ssize_t readFIFO(int pipe, char* buffer, ssize_t size);

    ssize_t readMessage(int pipe, char* buffer, ssize_t size);

    /// Safely remove a file or directory.
    /// Supresses exception when the file is already removed.
    /// This can happen when there is a race (unavoidable) or when
    /// we don't care to check before we remove (when no race exists).
    inline
    void removeFile(const std::string& path, const bool recursive = false)
    {
        try
        {
            Poco::File(path).remove(recursive);
        }
        catch (const std::exception&)
        {
            // Already removed or we don't care about failures.
        }
    }

    inline
    void removeFile(const Poco::Path& path, const bool recursive = false)
    {
        removeFile(path.toString(), recursive);
    }

    /// Make a temp copy of a file.
    /// Primarily used by tests to avoid tainting the originals.
    /// srcDir shouldn't end with '/' and srcFilename shouldn't contain '/'.
    /// Returns the created file path.
    inline
    std::string getTempFilePath(const std::string srcDir, const std::string& srcFilename)
    {
        const std::string srcPath = srcDir + '/' + srcFilename;

        std::string dstPath = std::tmpnam(nullptr);
        dstPath += '_' + srcFilename;

        Poco::File(srcPath).copyTo(dstPath);
        return dstPath;
    }

    /// Returns the name of the signal.
    std::string signalName(int signo);

    /// Trap signals to cleanup and exit the process gracefully.
    void setTerminationSignals();
    void setFatalSignals();

    /// Returns EXIT_SUCCESS or EXIT_FAILURE from <stdlib.h>
    int getChildStatus(const int code);
    /// Returns EXIT_SUCCESS or EXIT_FAILURE from <stdlib.h>
    int getSignalStatus(const int code);

    void requestTermination(const Poco::Process::PID& pid);

    void pollPipeForReading(pollfd& pollPipe, const std::string& targetPipeName , const int& targetPipe,
                            std::function<void(std::string& message)> handler);

    unsigned getMemoryUsage(Poco::Process::PID nPid);
};

//TODO: Move to own file.
namespace Log
{
    void initialize(const std::string& name);
    Poco::Logger& logger();

    void trace(const std::string& msg);
    void debug(const std::string& msg);
    void info(const std::string& msg);
    void warn(const std::string& msg, const bool append_errno = false);
    void error(const std::string& msg, const bool append_errno = true);

    /// The following is to write streaming logs.
    /// Log::info() << "Value: 0x" << std::hex << value
    ///             << ", pointer: " << this << Log::end;
    static const struct _end_marker
    {
        _end_marker()
        {
        }
    } end;

    class StreamLogger
    {
        public:
            StreamLogger(std::function<void(const std::string&)> func)
              : _func(func)
            {
            }

            StreamLogger(StreamLogger&& sl)
              : _stream(std::move(sl._stream.str()))
              , _func(std::move(sl._func))
            {
            }

            void flush() const
            {
                _func(_stream.str());
            }

            std::ostringstream _stream;

        private:
            std::function<void(const std::string&)> _func;
    };

    inline
    StreamLogger trace()
    {
        return StreamLogger([](const std::string& msg) { trace(msg);});
    }

    inline
    StreamLogger debug()
    {
        return StreamLogger([](const std::string& msg) { debug(msg);});
    }

    inline
    StreamLogger info()
    {
        return StreamLogger([](const std::string& msg) { info(msg);});
    }

    inline
    StreamLogger warn()
    {
        return StreamLogger([](const std::string& msg) { warn(msg);});
    }

    inline
    StreamLogger error()
    {
        return StreamLogger([](const std::string& msg) { error(msg);});
    }

    template <typename U>
    StreamLogger& operator <<(StreamLogger& lhs, const U& rhs)
    {
        lhs._stream << rhs;
        return lhs;
    }

    template <typename U>
    StreamLogger& operator <<(StreamLogger&& lhs, U&& rhs)
    {
        lhs._stream << rhs;
        return lhs;
    }

    inline
    void operator <<(StreamLogger& lhs, const _end_marker&)
    {
        (void)end;
        lhs.flush();
    }
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
