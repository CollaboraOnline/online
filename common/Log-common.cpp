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

#include <cstring>
#include <ctime>

#include "Log.hpp"
#include "StaticLogHelper.hpp"
#include "Util.hpp"

namespace Log
{
    extern StaticHelper Static;

    namespace
    {

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
#if defined(IOS) || defined(__FreeBSD__) || defined(_WIN32)
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
        Util::time_t_to_gmtime(t, tm);

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
} // namespace Log

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
