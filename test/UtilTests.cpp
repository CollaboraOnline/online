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

#include <test/lokassert.hpp>

#include <Util.hpp>

#include <cppunit/extensions/HelperMacros.h>

/// Util unit-tests.
class UtilTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(UtilTests);

    CPPUNIT_TEST(testStringifyHexLine);

    CPPUNIT_TEST_SUITE_END();

    void testStringifyHexLine();
};

void UtilTests::testStringifyHexLine()
{
    constexpr auto testname = __func__;

    std::string test("hello here\ntest");
    std::string result1("68 65 6C 6C 6F 20 68 65  72 65 0A 74 65 73 74"
                        "                                                       "
                        "| hello here.test                 ");
    std::string result2("68 65 72 65 0A 74  | here.t");
    LOK_ASSERT_EQUAL(result1, Util::stringifyHexLine(test, 0));
    LOK_ASSERT_EQUAL(result2, Util::stringifyHexLine(test, 6, 6));
}

CPPUNIT_TEST_SUITE_REGISTRATION(UtilTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
