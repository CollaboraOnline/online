/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Uses known-good sample data from:
 *   https://github.com/microsoft/Office-Online-Test-Tools-and-Documentation
 */

#include <config.h>

#include <test/lokassert.hpp>

#include <ProofKey.hpp>
#include <Poco/Crypto/RSAKey.h>
#include <Poco/Crypto/DigestEngine.h>
#include <Util.hpp>

#include <openssl/bn.h>
#include <openssl/pem.h>
#include <openssl/buffer.h>
#include <openssl/opensslv.h>

/// Delta unit-tests.
class WopiProofTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(WopiProofTests);

    CPPUNIT_TEST(testCapiBlob);
    CPPUNIT_TEST(testExistingProof);
    CPPUNIT_TEST(testOurProof);

    CPPUNIT_TEST_SUITE_END();

    void testCapiBlob();
    void testExistingProof();
    void testOurProof();

    BIGNUM *Base64ToNum(const std::string &str)
    {
        std::vector<unsigned char> vec = Proof::Base64ToBytes(str);
        return BN_bin2bn(&vec[0], vec.size(), nullptr);
    }

    void verifySignature(const std::string &access,
                         const std::string &uri,
                         int64_t ticks,
                         const std::string &discoveryModulus,
                         const std::string &discoveryExponent,
                         const std::string &msgProof);
};

void WopiProofTests::testCapiBlob()
{
    std::vector<unsigned char> modulus = Proof::Base64ToBytes("0HOWUPFFgmSYHbLZZzdWO/HUOr8YNfx5NAl7GUytooHZ7B9QxQKTJpj0NIJ4XEskQW8e4dLzRrPbNOOJ+KpWHttXz8HoQXkkZV/gYNxaNHJ8/pRXGMZzfVM5vchhx/2C7ULPTrpBsSpmfWQ6ShaVoQzfThFUd0MsBvIN7HVtqzPx9jbSV04wAqyNjcro7F3iu9w7AEsMejHbFlWoN+J05dP5ixryF7+2U5RVmjMt7/dYUdCoiXvCMt2CaVr0XEG6udHU4iDKVKZjmUBc7cTWRzhqEL7lZ1yQfylp38Nd2xxVJ0sSU7OkC1bBDlePcYGaF3JjJgsmp/H5BNnlW9gSxQ==");
    std::vector<unsigned char> exponent = Proof::Base64ToBytes("AQAB");

    std::vector<unsigned char> capiBlob = Proof::RSA2CapiBlob(modulus, exponent);

    std::string capiEncoded = Proof::BytesToBase64(capiBlob);
    LOK_ASSERT_EQUAL(capiEncoded, std::string("BgIAAACkAABSU0ExAAgAAAEAAQDFEthb5dkE+fGnJgsmY3IXmoFxj1cOwVYLpLNTEksnVRzbXcPfaSl/kFxn5b4QajhH1sTtXECZY6ZUyiDi1NG5ukFc9Fppgt0ywnuJqNBRWPfvLTOaVZRTtr8X8hqL+dPldOI3qFUW2zF6DEsAO9y74l3s6MqNjawCME5X0jb28TOrbXXsDfIGLEN3VBFO3wyhlRZKOmR9ZiqxQbpOz0Ltgv3HYci9OVN9c8YYV5T+fHI0Wtxg4F9lJHlB6MHPV9seVqr4ieM027NG89LhHm9BJEtceII09JgmkwLFUB/s2YGirUwZewk0efw1GL861PE7Vjdn2bIdmGSCRfFQlnPQ"));
}

void WopiProofTests::verifySignature(const std::string &access,
                                     const std::string &uri,
                                     int64_t ticks,
                                     const std::string &discoveryModulus,
                                     const std::string &discoveryExponent,
                                     const std::string &msgProofStr)
{
#if OPENSSL_VERSION_NUMBER > 0x10100000L
    std::vector<unsigned char> proof = Proof::GetProof(access, uri, ticks);

    BIGNUM *modulus = Base64ToNum(discoveryModulus);
    BIGNUM *exponent = Base64ToNum(discoveryExponent);

    RSA *rsa = RSA_new();
    LOK_ASSERT(rsa != nullptr);
    LOK_ASSERT_EQUAL(1, RSA_set0_key(rsa, modulus, exponent, nullptr));

    std::vector<unsigned char> msgProof = Proof::Base64ToBytes(msgProofStr);

    Poco::Crypto::DigestEngine digestEngine("SHA256");
    digestEngine.update(proof.data(), proof.size());
    std::vector<unsigned char> digest = digestEngine.digest();

    LOK_ASSERT_EQUAL(1, RSA_verify(digestEngine.nid(),
                                   &digest[0], digest.size(),
                                   &msgProof[0], msgProof.size(),
                                   rsa));

    RSA_free(rsa);
#else
    (void)access; (void)uri; (void)ticks;
    (void)discoveryModulus; (void)discoveryExponent;
    (void)msgProofStr;
    std::cerr << "OpenSSL too old to verify keys easily " << OPENSSL_VERSION_TEXT << " needs to be 1.1.0 at least\n";
#endif
}

void WopiProofTests::testExistingProof()
{
    verifySignature(
        "yZhdN1qgywcOQWhyEMVpB6NE3pvBksvcLXsrFKXNtBeDTPW%2fu62g2t%2fOCWSlb3jUGaz1zc%2fzOzbNgAredLdhQI1Q7sPPqUv2owO78olmN74DV%2fv52OZIkBG%2b8jqjwmUobcjXVIC1BG9g%2fynMN0itZklL2x27Z2imCF6xELcQUuGdkoXBj%2bI%2bTlKM", // access token
        "https://contoso.com/wopi/files/vHxYyRGM8VfmSGwGYDBMIQPzuE+sSC6kw+zWZw2Nyg?access_token=yZhdN1qgywcOQWhyEMVpB6NE3pvBksvcLXsrFKXNtBeDTPW%2fu62g2t%2fOCWSlb3jUGaz1zc%2fzOzbNgAredLdhQI1Q7sPPqUv2owO78olmN74DV%2fv52OZIkBG%2b8jqjwmUobcjXVIC1BG9g%2fynMN0itZklL2x27Z2imCF6xELcQUuGdkoXBj%2bI%2bTlKM", // uri
        INT64_C(635655897610773532), // ticks
        "0HOWUPFFgmSYHbLZZzdWO/HUOr8YNfx5NAl7GUytooHZ7B9QxQKTJpj0NIJ4XEskQW8e4dLzRrPbNOOJ+KpWHttXz8HoQXkkZV/gYNxaNHJ8/pRXGMZzfVM5vchhx/2C7ULPTrpBsSpmfWQ6ShaVoQzfThFUd0MsBvIN7HVtqzPx9jbSV04wAqyNjcro7F3iu9w7AEsMejHbFlWoN+J05dP5ixryF7+2U5RVmjMt7/dYUdCoiXvCMt2CaVr0XEG6udHU4iDKVKZjmUBc7cTWRzhqEL7lZ1yQfylp38Nd2xxVJ0sSU7OkC1bBDlePcYGaF3JjJgsmp/H5BNnlW9gSxQ==", // modulus
        "AQAB", // exponent
        "IflL8OWCOCmws5qnDD5kYMraMGI3o+T+hojoDREbjZSkxbbx7XIS1Av85lohPKjyksocpeVwqEYm9nVWfnq05uhDNGp2MsNyhPO9unZ6w25Rjs1hDFM0dmvYx8wlQBNZ/CFPaz3inCMaaP4PtU85YepaDccAjNc1gikdy3kSMeG1XZuaDixHvMKzF/60DMfLMBIu5xP4Nt8i8Gi2oZs4REuxi6yxOv2vQJQ5+8Wu2Olm8qZvT4FEIQT9oZAXebn/CxyvyQv+RVpoU2gb4BreXAdfKthWF67GpJyhr+ibEVDoIIolUvviycyEtjsaEBpOf6Ne/OLRNu98un7WNDzMTQ=="); // message proof
}

void WopiProofTests::testOurProof()
{
    Proof gen(Proof::Type::CreateKey);

    const VecOfStringPairs& discovery = gen.GetProofKeyAttributes();
    int len = discovery.size();
    LOK_ASSERT_EQUAL(6, len);
    LOK_ASSERT_EQUAL(discovery[0].first, std::string("value"));
    LOK_ASSERT_EQUAL(discovery[1].first, std::string("modulus"));
    const std::string modulus = discovery[1].second;
    LOK_ASSERT_EQUAL(discovery[2].first, std::string("exponent"));
    const std::string exponent = discovery[2].second;
    LOK_ASSERT_EQUAL(discovery[3].first, std::string("oldvalue"));
    LOK_ASSERT_EQUAL(discovery[4].first, std::string("oldmodulus"));
    const std::string oldmodulus = discovery[4].second;
    LOK_ASSERT_EQUAL(discovery[5].first, std::string("oldexponent"));
    const std::string oldexponent = discovery[5].second;

    std::string access_token = "!££$%£^$-!---~@@{}OP";
    std::string uri = "https://user@short.com:12345/blah?query_string=foo";
    VecOfStringPairs pairs = gen.GetProofHeaders(access_token, uri);
    len = pairs.size();
    LOK_ASSERT_EQUAL(3, len);
    LOK_ASSERT_EQUAL(pairs[0].first, std::string("X-WOPI-TimeStamp"));
    std::string timestamp = pairs[0].second;
    LOK_ASSERT_EQUAL(pairs[1].first, std::string("X-WOPI-Proof"));
    std::string proof = pairs[1].second;
    LOK_ASSERT_EQUAL(pairs[2].first, std::string("X-WOPI-ProofOld"));
    std::string proofOld = pairs[2].second;

    int64_t ticks = std::stoll(timestamp.c_str(), nullptr, 10);
    verifySignature(access_token, uri, ticks, modulus, exponent, proof);
    verifySignature(access_token, uri, ticks, modulus, exponent, proofOld);

    // tdf#134041: test another data

    access_token = "~!@#$%^&*()_+`1234567890-=";
    uri = "https://user2@short.com:12345/blah?query_string=bar";
    pairs = gen.GetProofHeaders(access_token, uri);
    len = pairs.size();
    LOK_ASSERT_EQUAL(3, len);
    LOK_ASSERT_EQUAL(pairs[0].first, std::string("X-WOPI-TimeStamp"));
    timestamp = pairs[0].second;
    LOK_ASSERT_EQUAL(pairs[1].first, std::string("X-WOPI-Proof"));
    proof = pairs[1].second;
    LOK_ASSERT_EQUAL(pairs[2].first, std::string("X-WOPI-ProofOld"));
    proofOld = pairs[2].second;

    ticks = std::stoll(timestamp.c_str(), nullptr, 10);
    verifySignature(access_token, uri, ticks, modulus, exponent, proof);
    verifySignature(access_token, uri, ticks, modulus, exponent, proofOld);
}

CPPUNIT_TEST_SUITE_REGISTRATION(WopiProofTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
