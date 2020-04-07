/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <test/lokassert.hpp>

#include <ProofKey.hpp>
#include <Util.hpp>

/// Delta unit-tests.
class WopiProofTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(WopiProofTests);

    CPPUNIT_TEST(testProof);

    CPPUNIT_TEST_SUITE_END();

    void testProof();
};

void WopiProofTests::testProof()
{
    LOK_ASSERT(1 > 0);
}

CPPUNIT_TEST_SUITE_REGISTRATION(WopiProofTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
