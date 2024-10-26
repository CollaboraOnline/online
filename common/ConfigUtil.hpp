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

// Configuration related utilities.
// Placed here to reduce avoid polluting
// Util.hpp with the config headers.
// This is designed to be used from both wsd and kit.

#pragma once

#include <Poco/Path.h>
#include <Poco/Util/Application.h>
#include <Poco/Util/LayeredConfiguration.h>

#include <Util.hpp>

#include <string>
#include <map>

namespace ConfigUtil
{
/// A logical constant that is allowed to initialize
/// exactly once and checks usage before initialization.
template <typename T> class RuntimeConstant
{
    T _value;
    std::atomic<bool> _initialized;

public:
    RuntimeConstant()
        : _value()
        , _initialized(false)
    {
    }

    /// Use a compile-time const instead.
    RuntimeConstant(const T& value) = delete;

    const T& get()
    {
        assert(_initialized);

        // Don't incur a high cost in release builds.
#if ENABLE_DEBUG
        if (_initialized)
        {
            return _value;
        }

        throw std::runtime_error("RuntimeConstant instance read before being initialized.");
#else // ENABLE_DEBUG
        return _value;
#endif // !ENABLE_DEBUG
    }

    void set(const T& value)
    {
        assert(!_initialized);

        _initialized = true;
        _value = value;
    }
};

#if ENABLE_SSL
extern RuntimeConstant<bool> SslEnabled;
extern RuntimeConstant<bool> SslTermination;
#endif

/// Initialize the config from an XML string.
void initialize(const std::string& xml);

/// Initialize the config given a pointer to a long-lived pointer.
void initialize(const Poco::Util::AbstractConfiguration* config);

/// Check if the config has been initialized
bool isInitialized();

/// Extract all entries as key-value pairs. We use map to have the entries sorted.
std::map<std::string, std::string> extractAll(const Poco::Util::AbstractConfiguration* config);

/// Returns the value of an entry as string or @def if it is not found.
std::string getString(const std::string& key, const std::string& def);

/// Returns true if and only if the property with the given key exists.
bool has(const std::string& key);

/// Returns the value of an entry as string or @def if it is not found.
bool getBool(const std::string& key, const bool def);

/// Returns the value of an entry as int or @def if it is not found.
int getInt(const std::string& key, const int def);

/// Return true if SSL is enabled in the config and no fuzzing is enabled.
inline bool isSslEnabled()
{
#if defined(ENABLE_SSL) && ENABLE_SSL
#if ENABLE_DEBUG
    // Unit-tests enable/disable SSL at will.
    return !Util::isFuzzing() && getBool("ssl.enable", true);
#else
    return !Util::isFuzzing() && SslEnabled.get();
#endif
#else
    return false;
#endif
}

/// Returns true if SSL Termination is enabled in the config and no fuzzing is enabled.
inline bool isSSLTermination()
{
#if defined(ENABLE_SSL) && ENABLE_SSL
    return !Util::isFuzzing() && SslTermination.get();
#else
    return false;
#endif
}

/// Return true if build is support key enabled (ENABLE_SUPPORT_KEY is defined)
bool isSupportKeyEnabled();

class ConfigValueGetter
{
    Poco::Util::LayeredConfiguration& _config;
    const std::string& _name;

public:
    ConfigValueGetter(Poco::Util::LayeredConfiguration& config, const std::string& name)
        : _config(config)
        , _name(name)
    {
    }

    void operator()(int& value) { value = _config.getInt(_name); }
    void operator()(unsigned int& value) { value = _config.getUInt(_name); }
    void operator()(uint64_t& value) { value = _config.getUInt64(_name); }
    void operator()(bool& value) { value = _config.getBool(_name); }
    void operator()(std::string& value) { value = _config.getString(_name); }
    void operator()(double& value) { value = _config.getDouble(_name); }
};

template <typename T>
static bool getSafeConfig(Poco::Util::LayeredConfiguration& config, const std::string& name,
                          T& value)
{
    try
    {
        ConfigValueGetter(config, name)(value);
        return true;
    }
    catch (...)
    {
    }

    return false;
}

template <typename T>
static T getConfigValue(Poco::Util::LayeredConfiguration& config, const std::string& name,
                        const T def)
{
    T value = def;
    if (getSafeConfig(config, name, value) || getSafeConfig(config, name + "[@default]", value))
    {
        return value;
    }

    return def;
}

/// Reads and processes path entries with the given property
/// from the configuration.
/// Converts relative paths to absolute.
static std::string getPathFromConfig(Poco::Util::LayeredConfiguration& config,
                                     const std::string& property)
{
    std::string path = config.getString(property);
    if (path.empty() && config.hasProperty(property + "[@default]"))
    {
        // Use the default value if empty and a default provided.
        path = config.getString(property + "[@default]");
    }

    // Reconstruct absolute path if relative.
    if (!Poco::Path(path).isAbsolute() && config.hasProperty(property + "[@relative]") &&
        config.getBool(property + "[@relative]"))
    {
        path = Poco::Path(Poco::Util::Application::instance().commandPath())
                   .parent()
                   .append(path)
                   .toString();
    }

    return path;
}

/// Returns the value of the specified application configuration,
/// or the default, if one doesn't exist.
template <typename T> static T getConfigValue(const std::string& name, const T def)
{
    if (Util::isFuzzing())
    {
        return def;
    }

    return getConfigValue(Poco::Util::Application::instance().config(), name, def);
}

/// Returns the value of the specified application configuration,
/// or the default, if one doesn't exist.
template <typename T> static T getConfigValueNonZero(const std::string& name, const T def)
{
    static_assert(std::is_integral<T>::value, "Meaningless on non-integral types");

    if (Util::isFuzzing())
    {
        return def;
    }

    const T res = getConfigValue(Poco::Util::Application::instance().config(), name, def);
    return res <= T(0) ? T(0) : res;
}

/// Reads and processes path entries with the given property
/// from the configuration.
/// Converts relative paths to absolute.
inline std::string getPathFromConfig(const std::string& name)
{
    return getPathFromConfig(Poco::Util::Application::instance().config(), name);
}

/// Reads and processes path entries with the given property
/// from the configuration. If value is empty then it reads from fallback
/// Converts relative paths to absolute.
inline std::string getPathFromConfigWithFallback(const std::string& name,
                                                 const std::string& fallbackName)
{
    std::string value;
    // the expected path might not exist, in which case Poco throws an exception
    try
    {
        value = getPathFromConfig(name);
    }
    catch (...)
    {
    }
    if (value.empty())
        return getPathFromConfig(fallbackName);
    return value;
}

/// Returns true if and only if the property with the given key exists.
inline bool hasProperty(const std::string& key)
{
    return Poco::Util::Application::instance().config().hasProperty(key);
}

} // namespace ConfigUtil
