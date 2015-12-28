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

#include <Poco/File.h>
#include <Poco/Path.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Logger.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

namespace Util
{
    namespace rng
    {
       unsigned getNext();
    }

    /// Encode an integral ID into a string, with padding support.
    std::string encodeId(const unsigned number, const int padding = 5);

    bool windowingAvailable();

    // Sadly, older libpng headers don't use const for the pixmap pointer parameter to
    // png_write_row(), so can't use const here for pixmap.
    bool encodePNGAndAppendToBuffer(unsigned char *pixmap, int width, int height, std::vector<char>& output, LibreOfficeKitTileMode mode);

    // Call WebSocket::shutdown() ignoring Poco::IOException
    void shutdownWebSocket(Poco::Net::WebSocket& ws);

    std::string signalName(int signo);

    ssize_t writeFIFO(int nPipe, const char* pBuffer, ssize_t nSize);

    ssize_t readFIFO(int nPipe, char* pBuffer, ssize_t nSize);

    ssize_t readMessage(int nPipe, char* pBuffer, ssize_t nSize);

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
            // Already removed, nothing more to do.
        }
    }

    inline
    void removeFile(const Poco::Path& path, const bool recursive = false)
    {
        removeFile(path.toString(), recursive);
    }
};

//TODO: Move to own file.
namespace Log
{
    void initialize(const std::string& name);
    Poco::Logger& logger();

    void trace(const std::string& msg);
    void debug(const std::string& msg);
    void info(const std::string& msg);
    void warn(const std::string& msg);
    void error(const std::string& msg);

    // The following is to write streaming logs.
    // Log::info() << "Value: 0x" << std::hex << value
    //             << ", pointer: " << this << Log::end;

    static const struct _end_marker
    {
    } end;

    class StreamLogger
    {
        public:
            StreamLogger(std::function<void(const std::string&)> func)
              : _func(func)
            {
            }

            StreamLogger(StreamLogger&& sl)
              : Stream(std::move(sl.Stream.str()))
              , _func(std::move(sl._func))
            {
            }

            void flush() const
            {
                _func(Stream.str());
            }

            std::ostringstream Stream;

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
        lhs.Stream << rhs;
        return lhs;
    }

    template <typename U>
    StreamLogger& operator <<(StreamLogger&& lhs, U&& rhs)
    {
        lhs.Stream << rhs;
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
