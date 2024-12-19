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
#include <memory>
#include <unordered_map>

/// Responsible for annonymizing names and URLs.
/// The anonymized version is always the same for
/// a given value, provided the salt is identical.
/// Each anonymized entry has a leading counter, which
/// is incremented when the entry is first created.
/// This counter is *not* unique. It's purpose is
/// to disambiguate potential collissions. When
/// an entry is removed and then re-created, it
/// will have a different prefix counter.
class Anonymizer
{
    Anonymizer(const std::uint64_t salt)
        : _salt(salt)
    {
    }

public:
    static constexpr std::uint64_t DefaultSalt = 82589933;

    /// Used for anonymizing URLs
    static void initialize(bool anonymize, const std::uint64_t salt)
    {
        _instance.reset();
        if (anonymize)
        {
            _instance.reset(new Anonymizer(salt));
        }
    }

    /// Returns true iff anonimization is enabled.
    static bool enabled() { return !!_instance; }

    /// Sets the anonymized version of a given plain-text string.
    /// After this, 'anonymize(plain)' will return 'anonymized'.
    static void mapAnonymized(const std::string& plain, const std::string& anonymized)
    {
        if (_instance)
        {
            _instance->map(plain, anonymized);
        }
    }

    /// Sets the anonymized version of a given plain-text string.
    /// After this, 'anonymize(plain)' will return 'anonymized'.
    void map(const std::string& plain, const std::string& anonymized)
    {
        if (plain.empty() || anonymized.empty())
            return;

        if (plain != anonymized)
            LOG_TRC("Anonymizing [" << plain << "] -> [" << anonymized << ']');

        std::unique_lock<std::mutex> lock(_mutex);

        _map[plain] = anonymized;
    }

    /// Anonymize a sensitive string to avoid leaking it.
    /// Called on strings to be logged or exposed.
    std::string_view lookup(const std::string& text) const
    {
        std::unique_lock<std::mutex> lock(_mutex);

        const auto it = _map.find(text);
        if (it != _map.end())
        {
            if (text != it->second)
                LOG_TRC("Found anonymized [" << text << "] -> [" << it->second << ']');
            return it->second;
        }

        return std::string_view();
    }

    /// Anonymize a sensitive string to avoid leaking it.
    /// Called on strings to be logged or exposed.
    static std::string anonymize(const std::string& text)
    {
        return _instance ? _instance->anonymizeImpl(text) : text;
    }

    /// Anonymize a sensitive string to avoid leaking it.
    /// Called on strings to be logged or exposed.
    std::string anonymizeImpl(const std::string& text)
    {
        const std::string_view anonymized = lookup(text);
        if (!anonymized.empty())
        {
            return std::string(anonymized);
        }

        // Modified 64-bit FNV-1a to add salting.
        // For the algorithm and the magic numbers, see http://isthe.com/chongo/tech/comp/fnv/
        std::uint64_t hash = 0xCBF29CE484222325LL;
        hash ^= _salt;
        hash *= 0x100000001b3ULL;
        for (const char c : text)
        {
            hash ^= static_cast<std::uint64_t>(c);
            hash *= 0x100000001b3ULL;
        }

        hash ^= _salt;
        hash *= 0x100000001b3ULL;

        // Generate the anonymized string. The '#' is to hint that it's anonymized.
        // Prepend with count to make it unique within a single process instance,
        // in case we get collisions (which we will, eventually). N.B.: Identical
        // strings likely to have different prefixes when logged in WSD process vs. Kit.
        std::string res = '#' + Util::encodeId(_prefix++, 0) + '#' + Util::encodeId(hash, 0) + '#';
        map(text, res);
        return res;
    }

    /// Clears the shared state of mapAnonymized() / anonymize().
    static void clear()
    {
        if (_instance)
        {
            _instance->_map.clear();
        }
    }

    /// Anonymize the basename of filenames only, preserving the path and extension.
    static std::string anonymizeUrl(const std::string& url)
    {
        std::string base;
        std::string filename;
        std::string ext;
        std::string params;
        std::tie(base, filename, ext, params) = Util::splitUrl(url);

        return base + anonymize(filename) + ext + params;
    }

private:
    /// The only instance of the Anonymizer per process.
    static inline std::unique_ptr<Anonymizer> _instance;

    /// The prefix counter.
    std::atomic<unsigned> _prefix;

    /// The salt used to hash.
    const std::uint64_t _salt;

    /// The mutex protecting the map.
    mutable std::mutex _mutex;

    /// The map of plain to annonymized strings.
    std::unordered_map<std::string, std::string> _map;
};
