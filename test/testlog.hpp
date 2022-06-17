/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <Log.hpp>

namespace helpers
{
inline std::chrono::steady_clock::time_point& getTestStartTime()
{
    static auto TestStartTime = std::chrono::steady_clock::now();

    return TestStartTime;
}

inline void resetTestStartTime() { getTestStartTime() = std::chrono::steady_clock::now(); }

inline std::chrono::milliseconds timeSinceTestStartMs()
{
    return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now()
                                                                 - getTestStartTime());
}

} // namespace helpers

//FIXME: use LOG_ macros and unify with the existing logging system.
// Oh dear std::cerr and/or its re-direction is not
// necessarily thread safe on Linux
// This is the canonical test log function.
inline void writeTestLog(const char* const p)
{
    fputs(p, stderr);
    fflush(stderr);
}

inline void writeTestLog(const std::string& s) { writeTestLog(s.c_str()); }

#ifdef TST_LOG_REDIRECT
void tstLog(const std::ostringstream& stream);
#else
inline void tstLog(const std::ostringstream& stream) { writeTestLog(stream.str()); }
#endif

#define TST_LOG_NAME_BEGIN(OSS, NAME, X, FLUSH)                                                    \
    do                                                                                             \
    {                                                                                              \
        char b_[1024];                                                                             \
        OSS << Log::prefix<sizeof(b_) - 1>(b_, "TST") << NAME << " [" << __func__ << "] (+"        \
            << helpers::timeSinceTestStartMs() << "): " << std::boolalpha << X;                    \
        if (FLUSH)                                                                                 \
            tstLog(OSS);                                                                           \
    } while (false)

#define TST_LOG_BEGIN(X)                                                                           \
    do                                                                                             \
    {                                                                                              \
        std::ostringstream oss;                                                                    \
        TST_LOG_NAME_BEGIN(oss, testname, X, true);                                                \
    } while (false)

#define TST_LOG_APPEND(X)                                                                          \
    do                                                                                             \
    {                                                                                              \
        std::ostringstream str;                                                                    \
        str << X;                                                                                  \
        tstLog(str);                                                                               \
    } while (false)

#define TST_LOG_END_X(OSS)                                                                         \
    do                                                                                             \
    {                                                                                              \
        LOG_END(OSS) "\n";                                                                         \
        tstLog(OSS);                                                                               \
    } while (false)

#define TST_LOG_END                                                                                \
    do                                                                                             \
    {                                                                                              \
        std::ostringstream oss_log_end;                                                            \
        TST_LOG_END_X(oss_log_end);                                                                \
    } while (false)

#define TST_LOG_NAME(NAME, X)                                                                      \
    do                                                                                             \
    {                                                                                              \
        std::ostringstream oss_log_name;                                                           \
        TST_LOG_NAME_BEGIN(oss_log_name, NAME, X, false);                                          \
        TST_LOG_END_X(oss_log_name);                                                               \
    } while (false)

/// Used by the "old-style" tests. FIXME: Unify.
#define TST_LOG(X) TST_LOG_NAME(testname, X)

/// Used by the "new-style" tests. FIXME: Unify.
#define LOG_TST(X) TST_LOG(X)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
