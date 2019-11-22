/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "ProofKey.hpp"
#include "LOOLWSD.hpp"

#include <cassert>
#include <chrono>
#include <cstdlib>
#include <memory>

#include <Poco/Base64Decoder.h>
#include <Poco/Base64Encoder.h>
#include <Poco/BinaryWriter.h>
#include <Poco/Crypto/RSADigestEngine.h>
#include <Poco/Crypto/RSAKey.h>
#include <Poco/Dynamic/Var.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/LineEndingConverter.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/NetException.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Timestamp.h>
#include <Poco/URI.h>
#include <Poco/Util/Application.h>

#include <Log.hpp>
#include <Util.hpp>

namespace{

class Proof {
public:
    Proof();
    VecOfStringPairs GetProofHeaders(const std::string& access_token, const std::string& uri) const;
    const VecOfStringPairs& GetProofKeyAttributes() const { return m_aAttribs; }
private:
    static std::string ProofKeyPath();

    // Returns .Net tick (=100ns) count since 0001-01-01 00:00:00 Z
    // See https://docs.microsoft.com/en-us/dotnet/api/system.datetime.ticks
    static int64_t DotNetTicks(const std::chrono::system_clock::time_point& utc);
    // Returns string of bytes to sign and base64-encode
    // See http://www.wictorwilen.se/sharepoint-2013-building-your-own-wopi-client-part-2
    static std::string GetProof(const std::string& access_token, const std::string& uri, int64_t ticks);
    // Signs string of bytes and returns base64-encoded string
    std::string SignProof(const std::string& proof) const;

    const std::unique_ptr<const Poco::Crypto::RSAKey> m_pKey;
    VecOfStringPairs m_aAttribs;
};

Proof::Proof()
    : m_pKey([]() -> Poco::Crypto::RSAKey* {
        try
        {
            return new Poco::Crypto::RSAKey("", ProofKeyPath());
        }
        catch (const Poco::Exception& e)
        {
            LOG_ERR("Could not open proof RSA key: " << e.displayText());
        }
        catch (const std::exception& e)
        {
            LOG_ERR("Could not open proof RSA key: " << e.what());
        }
        catch (...)
        {
            LOG_ERR("Could not open proof RSA key: unknown exception");
        }
        return nullptr;
    }())
{
    if (m_pKey)
    {
        {
            // TODO: This is definitely not correct at the moment. The proof key must be
            // base64-encoded blob in "unmanaged Microsoft Cryptographic API (CAPI)" format
            // (as .Net's RSACryptoServiceProvider::ExportScpBlob returns).
            std::ostringstream oss;
            Poco::OutputLineEndingConverter lineEndingConv(oss, "");
            m_pKey->save(&lineEndingConv);
            std::string sKey = oss.str();
            const std::string sBegin = "-----BEGIN RSA PUBLIC KEY-----";
            const std::string sEnd = "-----END RSA PUBLIC KEY-----";
            auto pos = sKey.find(sBegin);
            if (pos != std::string::npos)
                sKey = sKey.substr(pos + sBegin.length());
            pos = sKey.find(sEnd);
            if (pos != std::string::npos)
                sKey = sKey.substr(0, pos);
            m_aAttribs.emplace_back("value", sKey);
        }
        {
            std::ostringstream oss;
            // The signature generated contains CRLF line endings.
            // Use a line ending converter to remove these CRLF
            Poco::OutputLineEndingConverter lineEndingConv(oss, "");
            Poco::Base64Encoder encoder(lineEndingConv);
            const auto m = m_pKey->modulus();
            encoder << std::string(m.begin(), m.end());
            encoder.close();
            m_aAttribs.emplace_back("modulus", oss.str());
        }
        {
            std::ostringstream oss;
            // The signature generated contains CRLF line endings.
            // Use a line ending converter to remove these CRLF
            Poco::OutputLineEndingConverter lineEndingConv(oss, "");
            Poco::Base64Encoder encoder(lineEndingConv);
            const auto e = m_pKey->encryptionExponent();
            encoder << std::string(e.begin(), e.end());
            encoder.close();
            m_aAttribs.emplace_back("exponent", oss.str());
        }
    }
}

std::string Proof::ProofKeyPath()
{
    const std::string keyPath = LOOLWSD_CONFIGDIR "/proof_key";
    if (!Poco::File(keyPath).exists())
    {
        std::string msg = "Could not find " + keyPath +
            "\nNo proof-key will be present in discovery."
            "\nGenerate an RSA key using this command line:"
            "\n    ssh-keygen -t rsa -N \"\" -f \"" + keyPath + "\"";
        fprintf(stderr, "%s\n", msg.c_str());
        LOG_WRN(msg);
    }

    return keyPath;
}

int64_t Proof::DotNetTicks(const std::chrono::system_clock::time_point& utc)
{
    // Get time point for Unix epoch; unfortunately from_time_t isn't constexpr
    const auto aUnxEpoch(std::chrono::system_clock::from_time_t(0));
    const auto duration_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(utc - aUnxEpoch);
    return duration_ns.count() / 100 + 621355968000000000;
}

std::string Proof::GetProof(const std::string& access_token, const std::string& uri, int64_t ticks)
{
    std::string decoded_access_token;
    Poco::URI::decode(access_token, decoded_access_token);
    assert(decoded_access_token.size() <= static_cast<size_t>(std::numeric_limits<int32_t>::max()));
    assert(uri.size() <= static_cast<size_t>(std::numeric_limits<int32_t>::max()));
    const size_t size = 4 + decoded_access_token.size() + 4 + uri.size() + 4 + 8;
    Poco::Buffer<char> buffer(size); // allocate enough size
    buffer.resize(0); // start from empty buffer
    Poco::MemoryBinaryWriter writer(buffer, Poco::BinaryWriter::NETWORK_BYTE_ORDER);
    writer << static_cast<int32_t>(decoded_access_token.size())
           << decoded_access_token
           << static_cast<int32_t>(uri.size())
           << uri
           << int32_t(8)
           << ticks;
    assert(buffer.size() == size);
    return std::string(buffer.begin(), buffer.end());
}

std::string Proof::SignProof(const std::string& proof) const
{
    assert(m_pKey);
    std::ostringstream ostr;
    static Poco::Crypto::RSADigestEngine digestEngine(*m_pKey, "SHA256");
    digestEngine.update(proof.c_str(), proof.length());
    Poco::Crypto::DigestEngine::Digest digest = digestEngine.signature();
    // The signature generated contains CRLF line endings.
    // Use a line ending converter to remove these CRLF
    Poco::OutputLineEndingConverter lineEndingConv(ostr, "");
    Poco::Base64Encoder encoder(lineEndingConv);
    encoder << std::string(digest.begin(), digest.end());
    encoder.close();
    return ostr.str();
}

VecOfStringPairs Proof::GetProofHeaders(const std::string& access_token, const std::string& uri) const
{
    VecOfStringPairs vec;
    if (m_pKey)
    {
        int64_t ticks = DotNetTicks(std::chrono::system_clock::now());
        vec.emplace_back("X-WOPI-TimeStamp", std::to_string(ticks));
        vec.emplace_back("X-WOPI-Proof", SignProof(GetProof(access_token, uri, ticks)));
    }
    return vec;
}

const Proof& GetProof()
{
    static const Proof proof;
    return proof;
}

}

VecOfStringPairs GetProofHeaders(const std::string& access_token, const std::string& uri)
{
    return GetProof().GetProofHeaders(access_token, uri);
}

const VecOfStringPairs& GetProofKeyAttributes()
{
    return GetProof().GetProofKeyAttributes();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
