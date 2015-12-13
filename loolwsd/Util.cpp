/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <sys/poll.h>

#include <cstdlib>
#include <cstring>
#include <iomanip>
#include <sstream>
#include <string>
#include <cassert>

#include <png.h>

#include <signal.h>

#include <Poco/Exception.h>
#include <Poco/Format.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Process.h>
#include <Poco/Timestamp.h>
#include <Poco/Thread.h>
#include <Poco/Util/Application.h>

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
        size_t oldsize = outputp->size();
        outputp->resize(oldsize + length);
        memcpy(outputp->data() + oldsize, data, length);
    }

    static void user_flush_fn(png_structp)
    {
    }
}

namespace Util
{
    static const Poco::Int64 epochStart = Poco::Timestamp().epochMicroseconds();

    std::string logPrefix()
    {
        Poco::Int64 usec = Poco::Timestamp().epochMicroseconds() - epochStart;

        const Poco::Int64 one_s = 1000000;
        Poco::Int64 hours = usec / (one_s*60*60);
        usec %= (one_s*60*60);
        Poco::Int64 minutes = usec / (one_s*60);
        usec %= (one_s*60);
        Poco::Int64 seconds = usec / (one_s);
        usec %= (one_s);

        std::ostringstream stream;
        stream << Poco::Process::id() << "," << std::setw(2) << std::setfill('0') << (Poco::Thread::current() ? Poco::Thread::current()->id() : 0) << "," <<
            std::setw(2) << hours << ":" << std::setw(2) << minutes << ":" << std::setw(2) << seconds << "." << std::setw(6) << usec << ",";

        return stream.str();
    }

    bool windowingAvailable()
    {
#ifdef __linux
        return std::getenv("DISPLAY") != NULL;
#endif

        return false;
    }

    bool encodePNGAndAppendToBuffer(unsigned char *pixmap, int width, int height, std::vector<char>& output, LibreOfficeKitTileMode mode)
    {
        png_structp png_ptr = png_create_write_struct(PNG_LIBPNG_VER_STRING, NULL, NULL, NULL);

        png_infop info_ptr = png_create_info_struct(png_ptr);

        if (setjmp(png_jmpbuf(png_ptr)))
        {
            png_destroy_write_struct(&png_ptr, NULL);
            return false;
        }

        png_set_IHDR(png_ptr, info_ptr, width, height, 8, PNG_COLOR_TYPE_RGB_ALPHA, PNG_INTERLACE_NONE, PNG_COMPRESSION_TYPE_DEFAULT, PNG_FILTER_TYPE_DEFAULT);

        png_set_write_fn(png_ptr, &output, user_write_fn, user_flush_fn);
        png_set_write_status_fn(png_ptr, user_write_status_fn);

        png_write_info(png_ptr, info_ptr);

        switch (mode)
        {
        case LOK_TILEMODE_RGBA:
            break;
        case LOK_TILEMODE_BGRA:
            png_set_write_user_transform_fn (png_ptr, unpremultiply_data);
            break;
        default:
            assert(false);
        }

        for (int y = 0; y < height; ++y)
            png_write_row(png_ptr, pixmap + y * width * 4);

        png_write_end(png_ptr, info_ptr);

        png_destroy_write_struct(&png_ptr, &info_ptr);

        return true;
    }

    void shutdownWebSocket(Poco::Net::WebSocket& ws)
    {
        try
        {
            ws.shutdown();
        }
        catch (Poco::IOException& exc)
        {
            Poco::Util::Application::instance().logger().error(logPrefix() + "IOException: " + exc.message());
        }
    }

    std::string signalName(int signo)
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

    ssize_t writeFIFO(int nPipe, const char* pBuffer, ssize_t nSize)
    {
        ssize_t nBytes = -1;
        ssize_t nCount = 0;

        while(true)
        {
            nBytes = write(nPipe, pBuffer + nCount, nSize - nCount);
            if (nBytes < 0)
            {
                if (errno == EINTR || errno == EAGAIN)
                    continue;

                nCount = -1;
                break;
            }
            else if ( nCount + nBytes < nSize )
            {
                nCount += nBytes;
            }
            else
            {
                nCount = nBytes;
                break;
            }
        }

        return nCount;
    }

    ssize_t readFIFO(int nPipe, char* pBuffer, ssize_t nSize)
    {
        ssize_t nBytes;
        do
        {
            nBytes = read(nPipe, pBuffer, nSize);
        }
        while ( nBytes < 0 && errno == EINTR );

        return nBytes;
    }

    ssize_t readMessage(int nPipe, char* pBuffer, ssize_t nSize)
    {
        ssize_t nBytes = -1;
        struct pollfd aPoll;

        aPoll.fd = nPipe;
        aPoll.events = POLLIN;
        aPoll.revents = 0;

        int nPoll = poll(&aPoll, 1, 3000);
        if ( nPoll < 0 )
            goto ErrorPoll;

        if ( nPoll == 0 )
            errno = ETIME;

        if( (aPoll.revents & POLLIN) != 0 )
            nBytes = readFIFO(nPipe, pBuffer, nSize);

    ErrorPoll:
        return nBytes;
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
