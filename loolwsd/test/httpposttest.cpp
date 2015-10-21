/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <cppunit/extensions/HelperMacros.h>

class HTTPPostTest : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(HTTPPostTest);
    CPPUNIT_TEST(testConvertTo);
    CPPUNIT_TEST_SUITE_END();

    void testConvertTo();
};

void HTTPPostTest::testConvertTo()
{
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPPostTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
