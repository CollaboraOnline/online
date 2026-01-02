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

#include "HostUtil.hpp"

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

    std::vector<std::pair<std::string, std::string>> aliasesToExpected;

    aliasesToExpected.push_back(std::pair{"test2.local", "test2\\.local"});
    aliasesToExpected.push_back(std::pair{"https://test3.local", "test3\\.local"});
    aliasesToExpected.push_back(std::pair{"https://test4.local:8080", "test4\\.local"});
    aliasesToExpected.push_back(std::pair{"https://test5.local:8080/", "test5\\.local"});
    aliasesToExpected.push_back(std::pair{"https://test6.local:8080/path", "test6\\.local"});
    aliasesToExpected.push_back(std::pair{"test7.local/path", "test7\\.local"});

    aliasesToExpected.push_back(std::pair{"test", "test"}); // invalid hostname, interpret as regex
    aliasesToExpected.push_back(std::pair{"test[1-3]", "test[1-3]"});
    aliasesToExpected.push_back(std::pair{"test[0-9].local", "test[0-9].local"});
    aliasesToExpected.push_back(std::pair{"test[0-9]+.local", "test[0-9]+.local"});
    aliasesToExpected.push_back(std::pair{"test[0-9.local", ""}); // invalid regex

    for (const auto &[alias, expected]: aliasesToExpected) {
        const auto result = HostUtil::parseAlias(alias);

        LOK_ASSERT_EQUAL(expected, result);
    }
}

CPPUNIT_TEST_SUITE_REGISTRATION(HostUtilTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
