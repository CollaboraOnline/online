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

    CPPUNIT_TEST(testCapiBlob);
    CPPUNIT_TEST(testProof);

    CPPUNIT_TEST_SUITE_END();

    void testCapiBlob();

    void testProof();
};


void WopiProofTests::testCapiBlob()
{
    // Known-good sample strings from https://github.com/microsoft/Office-Online-Test-Tools-and-Documentation
    std::vector<unsigned char> modulus = Proof::Base64ToBytes("0HOWUPFFgmSYHbLZZzdWO/HUOr8YNfx5NAl7GUytooHZ7B9QxQKTJpj0NIJ4XEskQW8e4dLzRrPbNOOJ+KpWHttXz8HoQXkkZV/gYNxaNHJ8/pRXGMZzfVM5vchhx/2C7ULPTrpBsSpmfWQ6ShaVoQzfThFUd0MsBvIN7HVtqzPx9jbSV04wAqyNjcro7F3iu9w7AEsMejHbFlWoN+J05dP5ixryF7+2U5RVmjMt7/dYUdCoiXvCMt2CaVr0XEG6udHU4iDKVKZjmUBc7cTWRzhqEL7lZ1yQfylp38Nd2xxVJ0sSU7OkC1bBDlePcYGaF3JjJgsmp/H5BNnlW9gSxQ==");
    std::vector<unsigned char> exponent = Proof::Base64ToBytes("AQAB");

    std::vector<unsigned char> capiBlob = Proof::RSA2CapiBlob(modulus, exponent);

    std::string capiEncoded = Proof::BytesToBase64(capiBlob);
    LOK_ASSERT_EQUAL(capiEncoded, std::string("BgIAAACkAABSU0ExAAgAAAEAAQDFEthb5dkE+fGnJgsmY3IXmoFxj1cOwVYLpLNTEksnVRzbXcPfaSl/kFxn5b4QajhH1sTtXECZY6ZUyiDi1NG5ukFc9Fppgt0ywnuJqNBRWPfvLTOaVZRTtr8X8hqL+dPldOI3qFUW2zF6DEsAO9y74l3s6MqNjawCME5X0jb28TOrbXXsDfIGLEN3VBFO3wyhlRZKOmR9ZiqxQbpOz0Ltgv3HYci9OVN9c8YYV5T+fHI0Wtxg4F9lJHlB6MHPV9seVqr4ieM027NG89LhHm9BJEtceII09JgmkwLFUB/s2YGirUwZewk0efw1GL861PE7Vjdn2bIdmGSCRfFQlnPQ"));
}

void WopiProofTests::testProof()
{
    LOK_ASSERT(1 > 0);
}

CPPUNIT_TEST_SUITE_REGISTRATION(WopiProofTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
