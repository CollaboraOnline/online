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

#include <common/Uri.hpp>

#include <test/lokassert.hpp>

#include <cppunit/TestAssert.h>
#include <cppunit/extensions/HelperMacros.h>

/// Uri unit-tests.
class UriTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(UriTests);
    CPPUNIT_TEST(testEncode);
    CPPUNIT_TEST_SUITE_END();

    void testEncode();
};

void UriTests::testEncode()
{
    constexpr std::string_view testname = __func__;

    LOK_ASSERT(Uri::needsEncoding("www.example.com") == false);
    LOK_ASSERT(Uri::needsEncoding("www.example.com/file") == true);

    LOK_ASSERT_EQUAL(std::string("www.example.com%2Ffile"), Uri("www.example.com/file").encoded());
    LOK_ASSERT_EQUAL(std::string("www.example.com%2Ffile"), Uri::encode("www.example.com/file"));

    LOK_ASSERT_EQUAL(std::string("www.example.com/file"), Uri("www.example.com%2Ffile").decoded());
    LOK_ASSERT_EQUAL(std::string("www.example.com/file"), Uri::decode("www.example.com%2Ffile"));
}

CPPUNIT_TEST_SUITE_REGISTRATION(UriTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
