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

#include <HostUtil.hpp>

#include <test/lokassert.hpp>

#include <cppunit/extensions/HelperMacros.h>

/// HostUtilTests unit-tests.
class HostUtilTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(HostUtilTests);

    CPPUNIT_TEST(testParseAlias);

    CPPUNIT_TEST_SUITE_END();

    void testParseAlias();
};

void HostUtilTests::testParseAlias()
{
    constexpr std::string_view testname = __func__;

    LOK_ASSERT_EQUAL_STR("test2\\.local", HostUtil::parseAlias("test2.local"));
    LOK_ASSERT_EQUAL_STR("test3\\.local", HostUtil::parseAlias("https://test3.local"));
    LOK_ASSERT_EQUAL_STR("test4\\.local", HostUtil::parseAlias("https://test4.local:8080"));
    LOK_ASSERT_EQUAL_STR("test5\\.local", HostUtil::parseAlias("https://test5.local:8080/"));
    LOK_ASSERT_EQUAL_STR("test6\\.local", HostUtil::parseAlias("https://test6.local:8080/path"));
    LOK_ASSERT_EQUAL_STR("test7\\.local", HostUtil::parseAlias("test7.local/path"));

    LOK_ASSERT_EQUAL_STR("test", HostUtil::parseAlias("test")); // invalid hostname, interpret as regex
    LOK_ASSERT_EQUAL_STR("test[1-3]", HostUtil::parseAlias("test[1-3]"));
    LOK_ASSERT_EQUAL_STR("test[0-9].local", HostUtil::parseAlias("test[0-9].local"));
    LOK_ASSERT_EQUAL_STR("test[0-9]+.local", HostUtil::parseAlias("test[0-9]+.local"));
    LOK_ASSERT_EQUAL_STR("", HostUtil::parseAlias("test[0-9.local")); // invalid regex

    LOK_ASSERT_EQUAL_STR("https://aliasname[0-9]{1}:443", HostUtil::parseAlias("https://aliasname[0-9]{1}:443"));
}

CPPUNIT_TEST_SUITE_REGISTRATION(HostUtilTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
