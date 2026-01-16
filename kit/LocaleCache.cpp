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
/*
 * Locale caching module.
 *
 * This module reads all available locale data at startup
 * (before sandboxing) and serves queries from cache afterward.
 */

#include "config.h"

#include <cstring>
#include <cstdlib>
#include <cstdio>
#include <string>
#include <unordered_map>
#include <vector>
#include <memory>

#include <dlfcn.h>
#include <dirent.h>
#include <fcntl.h>
#include <langinfo.h>
#include <locale.h>
#include <sys/stat.h>
#include <unistd.h>

#include <common/Log.hpp>

// The nl_langinfo items we might care about to cache
static const nl_item g_langinfo_items[] =
{
    CODESET, D_T_FMT, D_FMT, T_FMT, T_FMT_AMPM,
    AM_STR, PM_STR,
    DAY_1, DAY_2, DAY_3, DAY_4, DAY_5, DAY_6, DAY_7,
    ABDAY_1, ABDAY_2, ABDAY_3, ABDAY_4, ABDAY_5, ABDAY_6, ABDAY_7,
    MON_1, MON_2, MON_3, MON_4, MON_5, MON_6,
    MON_7, MON_8, MON_9, MON_10, MON_11, MON_12,
    ABMON_1, ABMON_2, ABMON_3, ABMON_4, ABMON_5, ABMON_6,
    ABMON_7, ABMON_8, ABMON_9, ABMON_10, ABMON_11, ABMON_12,
    ERA, ERA_D_FMT, ERA_D_T_FMT, ERA_T_FMT, ALT_DIGITS,
    RADIXCHAR, THOUSEP, YESEXPR, NOEXPR, CRNCYSTR
};
static constexpr size_t NUM_LANGINFO_ITEMS = sizeof(g_langinfo_items) / sizeof(g_langinfo_items[0]);

/* Cached data for a single locale */
struct LocaleData
{
    std::string name;
    std::unordered_map<nl_item, std::string> langinfo;
    struct lconv lconv_data;
    /* Storage for lconv string fields */
    std::string decimal_point, thousands_sep, grouping;
    std::string int_curr_symbol, currency_symbol, mon_decimal_point;
    std::string mon_thousands_sep, mon_grouping, positive_sign, negative_sign;

    void updateLconvPointers() {
        lconv_data.decimal_point = const_cast<char*>(decimal_point.c_str());
        lconv_data.thousands_sep = const_cast<char*>(thousands_sep.c_str());
        lconv_data.grouping = const_cast<char*>(grouping.c_str());
        lconv_data.int_curr_symbol = const_cast<char*>(int_curr_symbol.c_str());
        lconv_data.currency_symbol = const_cast<char*>(currency_symbol.c_str());
        lconv_data.mon_decimal_point = const_cast<char*>(mon_decimal_point.c_str());
        lconv_data.mon_thousands_sep = const_cast<char*>(mon_thousands_sep.c_str());
        lconv_data.mon_grouping = const_cast<char*>(mon_grouping.c_str());
        lconv_data.positive_sign = const_cast<char*>(positive_sign.c_str());
        lconv_data.negative_sign = const_cast<char*>(negative_sign.c_str());
    }
};

/* Real glibc function pointers */
static char* (*real_setlocale)(int, const char*) = nullptr;
static char* (*real_nl_langinfo)(nl_item) = nullptr;
static char* (*real_nl_langinfo_l)(nl_item, locale_t) = nullptr;
static struct lconv* (*real_localeconv)(void) = nullptr;
static locale_t (*real_newlocale)(int, const char*, locale_t) = nullptr;
static locale_t (*real_duplocale)(locale_t) = nullptr;
static locale_t (*real_uselocale)(locale_t) = nullptr;
static void (*real_freelocale)(locale_t) = nullptr;

// Global and thread local state
static std::unordered_map<std::string, std::unique_ptr<LocaleData>> LocaleCache;
static std::unordered_map<locale_t, std::string> LocaleHandleMap; /* Maps locale_t -> locale name */
static std::string CurrentLocale[LC_ALL + 1];
static thread_local std::string ThreadLocale; /* from uselocale */
static bool LocaleInterposeActive = false;

// Initialize function pointers
static void initRealFunctions()
{
    if (!real_setlocale) {
        real_setlocale = reinterpret_cast<char*(*)(int, const char*)>(dlsym(RTLD_NEXT, "setlocale"));
        real_nl_langinfo = reinterpret_cast<char*(*)(nl_item)>(dlsym(RTLD_NEXT, "nl_langinfo"));
        real_nl_langinfo_l = reinterpret_cast<char*(*)(nl_item, locale_t)>(dlsym(RTLD_NEXT, "nl_langinfo_l"));
        real_localeconv = reinterpret_cast<struct lconv*(*)(void)>(dlsym(RTLD_NEXT, "localeconv"));
        real_newlocale = reinterpret_cast<locale_t(*)(int, const char*, locale_t)>(dlsym(RTLD_NEXT, "newlocale"));
        real_duplocale = reinterpret_cast<locale_t(*)(locale_t)>(dlsym(RTLD_NEXT, "duplocale"));
        real_uselocale = reinterpret_cast<locale_t(*)(locale_t)>(dlsym(RTLD_NEXT, "uselocale"));
        real_freelocale = reinterpret_cast<void(*)(locale_t)>(dlsym(RTLD_NEXT, "freelocale"));
    }
}

// Cache data for a specific locale
static void cacheLocale(const std::string& localeName)
{
    initRealFunctions();

    /* Save current locale */
    char* savedLocale = real_setlocale(LC_ALL, nullptr);
    std::string saved = savedLocale ? savedLocale : "C";

    /* Try to set the requested locale */
    char* result = real_setlocale(LC_ALL, localeName.c_str());
    if (!result)
        return; /* Locale not available */

    auto data = std::make_unique<LocaleData>();
    data->name = localeName;

    /* Cache all nl_langinfo items */
    for (size_t i = 0; i < NUM_LANGINFO_ITEMS; i++)
    {
        char* val = real_nl_langinfo(g_langinfo_items[i]);
        data->langinfo[g_langinfo_items[i]] = val ? val : "";
    }

    /* Cache lconv */
    struct lconv* lc = real_localeconv();
    if (lc)
    {
        data->lconv_data = *lc;
        data->decimal_point = lc->decimal_point ? lc->decimal_point : "";
        data->thousands_sep = lc->thousands_sep ? lc->thousands_sep : "";
        data->grouping = lc->grouping ? lc->grouping : "";
        data->int_curr_symbol = lc->int_curr_symbol ? lc->int_curr_symbol : "";
        data->currency_symbol = lc->currency_symbol ? lc->currency_symbol : "";
        data->mon_decimal_point = lc->mon_decimal_point ? lc->mon_decimal_point : "";
        data->mon_thousands_sep = lc->mon_thousands_sep ? lc->mon_thousands_sep : "";
        data->mon_grouping = lc->mon_grouping ? lc->mon_grouping : "";
        data->positive_sign = lc->positive_sign ? lc->positive_sign : "";
        data->negative_sign = lc->negative_sign ? lc->negative_sign : "";
        data->updateLconvPointers();
    }

    LocaleCache[localeName] = std::move(data);

    /* Restore original locale */
    real_setlocale(LC_ALL, saved.c_str());
}

/* Scan /usr/lib/locale for available locales */
static void scanLocaleDirectory(const char* path)
{
    DIR* dir = opendir(path);
    if (!dir) return;

    struct dirent* ent;
    while ((ent = readdir(dir)) != nullptr) {
        if (ent->d_name[0] == '.') continue;

        std::string name = ent->d_name;
        // Skip locale-archive file
        if (name == "locale-archive") continue;

        // Check if it's a directory (locale folder)
        std::string fullPath = std::string(path) + "/" + name;
        struct stat st;
        if (stat(fullPath.c_str(), &st) == 0 && S_ISDIR(st.st_mode))
            cacheLocale(name);
    }
    closedir(dir);
}

// Scan /usr/share/i18n/locales for locale definitions
static void scanI18nLocales(const char* path)
{
    DIR* dir = opendir(path);
    if (!dir) return;

    struct dirent* ent;
    while ((ent = readdir(dir)) != nullptr) {
        if (ent->d_name[0] == '.') continue;

        std::string name = ent->d_name;
        // Skip special files
        if (name == "POSIX" || name == "i18n") continue;

        // Cache common encodings
        cacheLocale(name);
        cacheLocale(name + ".UTF-8");
        cacheLocale(name + ".utf8");
    }
    closedir(dir);
}

/* Environment variable names for each category */
static const char* g_lc_env_names[] = {
    "LC_CTYPE", "LC_NUMERIC", "LC_TIME", "LC_COLLATE", "LC_MONETARY",
    "LC_MESSAGES",
#ifdef LC_PAPER
    "LC_PAPER",
#endif
#ifdef LC_NAME
    "LC_NAME",
#endif
#ifdef LC_ADDRESS
    "LC_ADDRESS",
#endif
#ifdef LC_TELEPHONE
    "LC_TELEPHONE",
#endif
#ifdef LC_MEASUREMENT
    "LC_MEASUREMENT",
#endif
#ifdef LC_IDENTIFICATION
    "LC_IDENTIFICATION",
#endif
};

/* Get locale from environment following glibc precedence:
 * 1. LC_ALL (overrides all)
 * 2. LC_xxx for specific category
 * 3. LANG (fallback)
 * 4. "C" (default)
 */
static std::string getLocaleFromEnv(int category) {
    /* LC_ALL overrides everything */
    const char* env = getenv("LC_ALL");
    if (env && *env) return env;

    /* Try category-specific variable */
    if (category >= 0 && category < (int)(sizeof(g_lc_env_names)/sizeof(g_lc_env_names[0]))) {
        env = getenv(g_lc_env_names[category]);
        if (env && *env) return env;
    }

    /* Fall back to LANG */
    env = getenv("LANG");
    if (env && *env) return env;

    /* Default to C locale */
    return "C";
}

/* Lookup locale in cache, with fallback handling */
static LocaleData* lookupLocale(const std::string& name) {
    /* Exact match */
    auto it = LocaleCache.find(name);
    if (it != LocaleCache.end()) {
        return it->second.get();
    }

    /* Try without encoding suffix */
    size_t dot = name.find('.');
    if (dot != std::string::npos) {
        std::string base = name.substr(0, dot);
        it = LocaleCache.find(base);
        if (it != LocaleCache.end()) {
            return it->second.get();
        }
        /* Try with UTF-8 */
        it = LocaleCache.find(base + ".UTF-8");
        if (it != LocaleCache.end()) {
            return it->second.get();
        }
    }

    /* Fallback to C locale */
    it = LocaleCache.find("C");
    if (it != LocaleCache.end()) {
        return it->second.get();
    }

    return nullptr;
}

/* ============== Public C API ============== */

extern "C" {

void PreloadLocaleCache(void)
{
    initRealFunctions();

    /* Always cache C and POSIX locales */
    cacheLocale("C");
    cacheLocale("POSIX");

    /* Cache the current locale */
    char* current = real_setlocale(LC_ALL, nullptr);
    if (current && strcmp(current, "C") != 0 && strcmp(current, "POSIX") != 0)
        cacheLocale(current);

    /* Cache locales from environment variables */
    const char* envVars[] = { "LC_ALL", "LANG", "LANGUAGE",
        "LC_CTYPE", "LC_NUMERIC", "LC_TIME", "LC_COLLATE",
        "LC_MONETARY", "LC_MESSAGES", nullptr };
    for (int i = 0; envVars[i]; i++)
    {
        const char* val = getenv(envVars[i]);
        if (val && *val && strcmp(val, "C") != 0 && strcmp(val, "POSIX") != 0)
        {
            // LANGUAGE can contain colon-separated list
            if (strcmp(envVars[i], "LANGUAGE") == 0)
            {
                std::string langs = val;
                size_t pos = 0, end;
                while ((end = langs.find(':', pos)) != std::string::npos)
                {
                    std::string lang = langs.substr(pos, end - pos);
                    if (!lang.empty()) cacheLocale(lang);
                    pos = end + 1;
                }
                if (pos < langs.size())
                    cacheLocale(langs.substr(pos));
            }
            else
                cacheLocale(val);
        }
    }

    // Scan system looking for locale directories
    scanLocaleDirectory("/usr/lib/locale");
    scanI18nLocales("/usr/share/i18n/locales");

    /* Initialize current locale state */
    for (int i = 0; i <= LC_ALL; i++)
    {
        char* loc = real_setlocale(i, nullptr);
        CurrentLocale[i] = loc ? loc : "C";
    }

    fprintf(stderr, "locale_cache_init: cached %zu locales\n", LocaleCache.size());

    // switch our own implementation on
    LocaleInterposeActive = true;
}

// ============== Interposed Functions ==============

char* setlocale(int category, const char* locale)
{
    initRealFunctions();
    if (!LocaleInterposeActive)
        return real_setlocale(category, locale);

    // Query current locale
    if (!locale)
    {
        int idx = (category >= 0 && category <= LC_ALL) ? category : LC_ALL;
        static thread_local std::string result;
        result = CurrentLocale[idx];
        return const_cast<char*>(result.c_str());
    }

    // Setting locale
    std::string newLocale = locale;
    if (newLocale.empty())
    {
        /* Use environment - follow glibc precedence */
        newLocale = getLocaleFromEnv(category);
    }

    // Check if we have this locale cached
    LocaleData* data = lookupLocale(newLocale);
    if (data)
    {
        if (category == LC_ALL)
        {
            for (int i = 0; i < LC_ALL; i++)
                CurrentLocale[i] = data->name;
        }
        CurrentLocale[category] = data->name;
        return const_cast<char*>(data->name.c_str());
    }

    LOG_WRN("Missing locale " << locale << " cat " << category);
    return nullptr; // Locale not available
}

char* nl_langinfo(nl_item item)
{
    initRealFunctions();
    if (!LocaleInterposeActive)
        return real_nl_langinfo(item);

    LocaleData* data = lookupLocale(CurrentLocale[LC_ALL]);
    if (data)
    {
        auto it = data->langinfo.find(item);
        if (it != data->langinfo.end())
            return const_cast<char*>(it->second.c_str());
    }
    static char empty[] = "";
    return empty;
}

struct lconv* localeconv(void)
{
    initRealFunctions();

    if (!LocaleInterposeActive)
        return real_localeconv();

    LocaleData* data = lookupLocale(CurrentLocale[LC_ALL]);
    if (data)
        return &data->lconv_data;

    // fallback to C
    data = lookupLocale("C");
    if (data)
        return &data->lconv_data;
    else
        return nullptr;
}

char* nl_langinfo_l(nl_item item, locale_t loc)
{
    initRealFunctions();
    if (!LocaleInterposeActive)
        return real_nl_langinfo_l(item, loc);

    /* Handle special locale_t values */
    if (loc == LC_GLOBAL_LOCALE)
        return nl_langinfo(item);

    /* Look up the locale name from our handle map */
    auto it = LocaleHandleMap.find(loc);
    if (it != LocaleHandleMap.end()) {
        LocaleData* data = lookupLocale(it->second);
        if (data) {
            auto langit = data->langinfo.find(item);
            if (langit != data->langinfo.end()) {
                return const_cast<char*>(langit->second.c_str());
            }
        }
    }

    static char empty[] = "";
    return empty;
}

locale_t newlocale(int category_mask, const char* locale, locale_t base)
{
    initRealFunctions();
    if (!LocaleInterposeActive)
        return real_newlocale(category_mask, locale, base);

    // FIXME: allocate new here.
    locale_t result = real_newlocale(category_mask, locale, base);

    if (result && locale)
    {
        /* Track the locale_t handle -> locale name mapping */
        std::string localeName = locale;
        if (localeName.empty()) {
            // Empty string means use environment - use LC_CTYPE as default category
            localeName = getLocaleFromEnv(LC_CTYPE);
        }
        LocaleHandleMap[result] = localeName;
    }

    return result;
}

locale_t duplocale(locale_t loc)
{
    initRealFunctions();
    if (!LocaleInterposeActive)
        return real_duplocale(loc);

    locale_t result = real_duplocale(loc);

    if (result) {
        // Copy the locale name mapping
        auto it = LocaleHandleMap.find(loc);
        if (it != LocaleHandleMap.end())
            LocaleHandleMap[result] = it->second;
    }

    return result;
}

locale_t uselocale(locale_t newloc)
{
    initRealFunctions();
    if (!LocaleInterposeActive)
        return real_uselocale(newloc);

    if (newloc && newloc != LC_GLOBAL_LOCALE)
    {
        auto it = LocaleHandleMap.find(newloc);
        if (it != LocaleHandleMap.end())
            ThreadLocale = it->second;
    }

    return ThreadLocale;
}

void freelocale(locale_t loc)
{
    initRealFunctions();
    if (!LocaleInterposeActive)
        real_freelocale(loc);
    else
        LocaleHandleMap.erase(loc);
}

} /* extern "C" */
