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

#pragma once

#include <common/Log.hpp>
#include <common/Util.hpp>

#include <atomic>
#include <mutex>
#include <string>
#include <string_view>
#include <unordered_map>

extern std::unordered_map<std::string, std::string> AnonymizedStrings;
extern std::mutex AnonymizedMutex;

/// Responsible for annonymizing names and URLs.
/// The anonymized version is always the same for
/// a given value, provided the salt is identical.
class Anonymizer
{
public:
    /// Sets the anonymized version of a given plain-text string.
    /// After this, 'anonymize(plain)' will return 'anonymized'.
    static void mapAnonymized(const std::string& plain, const std::string& anonymized)
    {
        if (plain.empty() || anonymized.empty())
            return;

        if (plain != anonymized)
            LOG_TRC("Anonymizing [" << plain << "] -> [" << anonymized << "].");

        std::unique_lock<std::mutex> lock(AnonymizedMutex);

        AnonymizedStrings[plain] = anonymized;
    }

    /// Anonymize a sensitive string to avoid leaking it.
    /// Called on strings to be logged or exposed.
    static std::string anonymize(const std::string& text, const std::uint64_t anonymizationSalt)
    {
        {
            std::unique_lock<std::mutex> lock(AnonymizedMutex);

            const auto it = AnonymizedStrings.find(text);
            if (it != AnonymizedStrings.end())
            {
                if (text != it->second)
                    LOG_TRC("Found anonymized [" << text << "] -> [" << it->second << "].");
                return it->second;
            }
        }

        // Modified 64-bit FNV-1a to add salting.
        // For the algorithm and the magic numbers, see http://isthe.com/chongo/tech/comp/fnv/
        std::uint64_t hash = 0xCBF29CE484222325LL;
        hash ^= anonymizationSalt;
        hash *= 0x100000001b3ULL;
        for (const char c : text)
        {
            hash ^= static_cast<std::uint64_t>(c);
            hash *= 0x100000001b3ULL;
        }

        hash ^= anonymizationSalt;
        hash *= 0x100000001b3ULL;

        // Generate the anonymized string. The '#' is to hint that it's anonymized.
        // Prepend with count to make it unique within a single process instance,
        // in case we get collisions (which we will, eventually). N.B.: Identical
        // strings likely to have different prefixes when logged in WSD process vs. Kit.
        static std::atomic<unsigned> AnonymizationCounter(0);
        std::string res =
            '#' + Util::encodeId(AnonymizationCounter++, 0) + '#' + Util::encodeId(hash, 0) + '#';
        mapAnonymized(text, res);
        return res;
    }

    /// Clears the shared state of mapAnonymized() / anonymize().
    static void clearAnonymized() { AnonymizedStrings.clear(); }

    /// Anonymize the basename of filenames only, preserving the path and extension.
    static std::string anonymizeUrl(const std::string& url, const std::uint64_t anonymizationSalt)
    {
        std::string base;
        std::string filename;
        std::string ext;
        std::string params;
        std::tie(base, filename, ext, params) = Util::splitUrl(url);

        return base + anonymize(filename, anonymizationSalt) + ext + params;
    }
};
