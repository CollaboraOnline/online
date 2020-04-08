/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// WOPI proof management
#ifndef INCLUDED_PROOFKEY_HPP
#define INCLUDED_PROOFKEY_HPP

#include <string>
#include <utility>
#include <vector>
#include <chrono>
#include <memory>

typedef std::vector<std::pair<std::string, std::string>> VecOfStringPairs;

namespace Poco {
    namespace Crypto {
        class RSAKey;
    }
}

class WopiProofTests;

class Proof {
    friend class WopiProofTests;
    void initialize();
    enum Type { CreateKey };
    Proof(Type);
public:
    Proof();
    VecOfStringPairs GetProofHeaders(const std::string& access_token, const std::string& uri) const;
    const VecOfStringPairs& GetProofKeyAttributes() const { return m_aAttribs; }
private:
    static std::string ProofKeyPath();

    static std::string BytesToBase64(const std::vector<unsigned char>& bytes);
    static std::vector<unsigned char> Base64ToBytes(const std::string &str);

    // modulus and exponent are big-endian vectors
    static std::vector<unsigned char> RSA2CapiBlob(const std::vector<unsigned char>& modulus,
                                                   const std::vector<unsigned char>& exponent);

    // Returns .Net tick (=100ns) count since 0001-01-01 00:00:00 Z
    // See https://docs.microsoft.com/en-us/dotnet/api/system.datetime.ticks
    static int64_t DotNetTicks(const std::chrono::system_clock::time_point& utc);
    // Returns bytes to sign and base64-encode
    // See http://www.wictorwilen.se/sharepoint-2013-building-your-own-wopi-client-part-2
    static std::vector<unsigned char> GetProof(const std::string& access_token,
                                               const std::string& uri, int64_t ticks);
    // Signs bytes and returns base64-encoded string
    std::string SignProof(const std::vector<unsigned char>& proof) const;

    std::unique_ptr<const Poco::Crypto::RSAKey> m_pKey;
    VecOfStringPairs m_aAttribs;
};


// Returns pairs <header_name, header_value> to add to request
// The headers returned are X-WOPI-TimeStamp, X-WOPI-Proof
// If no proof key, returns empty vector
// Both parameters are utf-8-encoded strings
// access_token must not be URI-encoded
VecOfStringPairs GetProofHeaders(const std::string& access_token, const std::string& uri);

// Returns pairs <attribute, value> to set in proof-key element in discovery xml.
// If no proof key, returns empty vector
const VecOfStringPairs& GetProofKeyAttributes();

#endif // INCLUDED_PROOFKEY_HPP

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
