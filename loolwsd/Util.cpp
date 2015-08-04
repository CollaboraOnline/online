/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <cstdlib>
#include <cstring>
#include <string>

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

    std::string logPrefix()
    {
        Poco::Timestamp timestamp;
        Poco::Int64 now = timestamp.epochMicroseconds();
        return std::to_string(Poco::Process::id()) + "," + (Poco::Thread::current() ? std::to_string(Poco::Thread::current()->id()) : "0") + "," + std::to_string(now / 1000) + ",";
    }

    bool windowingAvailable()
    {
#ifdef __linux
        return std::getenv("DISPLAY") != NULL;
#endif

        return false;
    }

    bool encodePNGAndAppendToBuffer(unsigned char *pixmap, int width, int height, std::vector<char>& output)
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

        for (int y = 0; y < height; ++y)
            png_write_row(png_ptr, pixmap + y * width * 4);

        png_write_end(png_ptr, info_ptr);

        png_destroy_write_struct(&png_ptr, NULL);

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
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
