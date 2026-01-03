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

#include <common/Log.hpp>
#include <common/Util.hpp>

#include <test/lokassert.hpp>

#include <cppunit/TestAssert.h>
#include <cppunit/extensions/HelperMacros.h>

using namespace std::literals;

/// Logging unit-tests.
class LoggingTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(LoggingTests);
    CPPUNIT_TEST(testGetTimeForLog);
    CPPUNIT_TEST(testIso8601Time);
    CPPUNIT_TEST(testClockAsString);
    CPPUNIT_TEST_SUITE_END();

    void testGetTimeForLog();
    void testIso8601Time();
    void testClockAsString();
};

void LoggingTests::testGetTimeForLog()
{
    constexpr std::string_view testname = __func__;

    // getTimeForLog returns the time in local timezone.
    // To get reliable tests across different timezones, we use GMT.
    const char* tz = ::getenv("TZ");
    const std::string timezoneName = (tz ? tz : "");
    ::setenv("TZ", "GMT", 1);
    tzset();

    const time_t t = 1760000000;
    const auto sys = std::chrono::system_clock::from_time_t(t);
    const auto now = Util::convertChronoClock<std::chrono::system_clock::time_point>(sys);

    LOK_ASSERT_EQUAL_STR("Thu Oct 09 08:53:20.000 2025 (0ms ago)", Util::getTimeForLog(now, now));

    // Past dates.
    LOK_ASSERT_EQUAL_STR("Thu Oct 09 08:53:19.631 2025 (369ms ago)",
                         Util::getTimeForLog(now, now - 369ms));

    LOK_ASSERT_EQUAL_STR("Thu Oct 09 08:53:14.631 2025 (5s 369ms ago)",
                         Util::getTimeForLog(now, now - 5s - 369ms));

    LOK_ASSERT_EQUAL_STR("Thu Oct 09 08:46:14.631 2025 (7m 5s 369ms ago)",
                         Util::getTimeForLog(now, now - 7min - 5s - 369ms));

    LOK_ASSERT_EQUAL_STR("Wed Oct 08 20:46:14.631 2025 (12h 7m 5s 369ms ago)",
                         Util::getTimeForLog(now, now - 12h - 7min - 5s - 369ms));

    // Future dates.
    LOK_ASSERT_EQUAL_STR("Thu Oct 09 08:53:20.369 2025 (369ms later)",
                         Util::getTimeForLog(now, now + 369ms));

    LOK_ASSERT_EQUAL_STR("Thu Oct 09 08:53:25.369 2025 (5s 369ms later)",
                         Util::getTimeForLog(now, now + 5s + 369ms));

    LOK_ASSERT_EQUAL_STR("Thu Oct 09 09:00:25.369 2025 (7m 5s 369ms later)",
                         Util::getTimeForLog(now, now + 7min + 5s + 369ms));

    LOK_ASSERT_EQUAL_STR("Thu Oct 09 21:00:25.369 2025 (12h 7m 5s 369ms later)",
                         Util::getTimeForLog(now, now + 12h + 7min + 5s + 369ms));

    ::setenv("TZ", timezoneName.data(), 1); // Restore the timeezone.
}

void LoggingTests::testIso8601Time()
{
    constexpr std::string_view testname = __func__;

    std::ostringstream oss;

    std::chrono::system_clock::time_point t(
        std::chrono::duration_cast<std::chrono::system_clock::duration>(
            std::chrono::nanoseconds(1567444337874777375)));
    LOK_ASSERT_EQUAL_STR("2019-09-02T17:12:17.874777Z", Util::getIso8601FracformatTime(t));

    t = std::chrono::system_clock::time_point(std::chrono::system_clock::duration::zero());
    LOK_ASSERT_EQUAL_STR("1970-01-01T00:00:00.000000Z", Util::getIso8601FracformatTime(t));

    t = Util::iso8601ToTimestamp("1970-01-01T00:00:00.000000Z", "LastModifiedTime");
    oss << t.time_since_epoch().count();
    LOK_ASSERT_EQUAL_STR("0", oss.str());
    LOK_ASSERT_EQUAL_STR("1970-01-01T00:00:00.000000Z", Util::time_point_to_iso8601(t));

    oss.str(std::string());
    t = Util::iso8601ToTimestamp("2019-09-02T17:12:17.874777Z", "LastModifiedTime");
    oss << t.time_since_epoch().count();
    if (std::is_same_v<std::chrono::system_clock::period, std::nano>)
        LOK_ASSERT_EQUAL_STR("1567444337874777000", oss.str());
    else
        LOK_ASSERT_EQUAL_STR("1567444337874777", oss.str());
    LOK_ASSERT_EQUAL_STR("2019-09-02T17:12:17.874777Z", Util::time_point_to_iso8601(t));

    oss.str(std::string());
    t = Util::iso8601ToTimestamp("2019-10-24T14:31:28.063730Z", "LastModifiedTime");
    oss << t.time_since_epoch().count();
    if (std::is_same_v<std::chrono::system_clock::period, std::nano>)
        LOK_ASSERT_EQUAL_STR("1571927488063730000", oss.str());
    else
        LOK_ASSERT_EQUAL_STR("1571927488063730", oss.str());
    LOK_ASSERT_EQUAL_STR("2019-10-24T14:31:28.063730Z", Util::time_point_to_iso8601(t));

    t = Util::iso8601ToTimestamp("2020-02-20T20:02:20.100000Z", "LastModifiedTime");
    LOK_ASSERT_EQUAL_STR("2020-02-20T20:02:20.100000Z", Util::time_point_to_iso8601(t));

    t = std::chrono::system_clock::time_point();
    LOK_ASSERT_EQUAL_STR("Thu, 01 Jan 1970 00:00:00", Util::getHttpTime(t));

    t = std::chrono::system_clock::time_point(
        std::chrono::duration_cast<std::chrono::system_clock::duration>(
            std::chrono::nanoseconds(1569592993495336798)));
    LOK_ASSERT_EQUAL_STR("Fri, 27 Sep 2019 14:03:13", Util::getHttpTime(t));

    t = Util::iso8601ToTimestamp("2020-09-22T21:45:12.583000Z", "LastModifiedTime");
    LOK_ASSERT_EQUAL_STR("2020-09-22T21:45:12.583000Z", Util::time_point_to_iso8601(t));

    t = Util::iso8601ToTimestamp("2020-09-22T21:45:12.583Z", "LastModifiedTime");
    LOK_ASSERT_EQUAL_STR("2020-09-22T21:45:12.583000Z", Util::time_point_to_iso8601(t));

    for (int i = 0; i < 100; ++i)
    {
        t = std::chrono::system_clock::now();
        const uint64_t t_in_micros = (t.time_since_epoch().count() / 1000) * 1000;

        const std::string s = Util::getIso8601FracformatTime(t);
        t = Util::iso8601ToTimestamp(s, "LastModifiedTime");

        std::string t_in_micros_str = std::to_string(t_in_micros);
        std::string time_since_epoch_str = std::to_string(t.time_since_epoch().count());
        if (!std::is_same_v<std::chrono::system_clock::period, std::nano>)
        {
            // If the system clock has nanoseconds precision, the last 3 digits
            // of these strings may not match. For example,
            // 1567444337874777000
            // 1567444337874777123
            t_in_micros_str.resize(t_in_micros_str.length() - 3);
            time_since_epoch_str.resize(time_since_epoch_str.length() - 3);
        }

        LOK_ASSERT_EQUAL(t_in_micros_str, time_since_epoch_str);

        // Allow a small delay to get a different timestamp on next iteration.
        sleep(0);
    }
}

void LoggingTests::testClockAsString()
{
    // This test depends on locale and timezone.
    // It is only here to test changes to these functions,
    // but the tests can't be run elsewhere.
    // I left them here to avoid recreating them when needed.
#if 0
    constexpr std::string_view testname = __func__;

    const auto steady_tp = std::chrono::steady_clock::time_point(
        std::chrono::steady_clock::duration(std::chrono::nanoseconds(295708311764285)));
    LOK_ASSERT_EQUAL_STR("Sat Feb 12 18:58.889 2022",
                     Util::getSteadyClockAsString(steady_tp));

    const auto sys_tp = std::chrono::system_clock::time_point(
        std::chrono::system_clock::duration(std::chrono::nanoseconds(1644764467739980124)));
    LOK_ASSERT_EQUAL_STR("Sat Feb 12 18:58.889 2022",
                     Util::getSystemClockAsString(sys_tp));
#endif
}

CPPUNIT_TEST_SUITE_REGISTRATION(LoggingTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
