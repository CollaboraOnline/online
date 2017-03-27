/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOOLWSD_HPP
#define INCLUDED_LOOLWSD_HPP

#include <atomic>
#include <map>
#include <string>

#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Util/ServerApplication.h>

#include "Util.hpp"

class ChildProcess;
class TraceFileWriter;

std::shared_ptr<ChildProcess> getNewChild_Blocks();

/// The Server class which is responsible for all
/// external interactions.
class LOOLWSD : public Poco::Util::ServerApplication
{
public:
    LOOLWSD();
    ~LOOLWSD();

    // An Application is a singleton anyway,
    // so just keep these as statics.
    static std::atomic<unsigned> NextSessionId;
    static unsigned int NumPreSpawnedChildren;
    static bool NoCapsForKit;
    static std::atomic<int> ForKitWritePipe;
    static std::atomic<int> ForKitProcId;
    static bool DummyLOK;
    static std::string FuzzFileName;
    static std::string Cache;
    static std::string ConfigFile;
    static std::string SysTemplate;
    static std::string LoTemplate;
    static std::string ChildRoot;
    static std::string ServerName;
    static std::string FileServerRoot;
    static std::string LOKitVersion;
    static std::atomic<unsigned> NumConnections;
    static std::unique_ptr<TraceFileWriter> TraceDumper;

    /// Flag to shutdown the server.
    std::atomic<bool> ShutdownFlag;

    bool isShuttingDown()
    {
        return ShutdownFlag;
    }

    bool handleShutdownRequest();

    static std::string GenSessionId()
    {
        return Util::encodeId(++NextSessionId, 4);
    }

    static bool isSSLEnabled()
    {
        return LOOLWSD::SSLEnabled.get();
    }

    static bool isSSLTermination()
    {
        return LOOLWSD::SSLTermination.get();
    }

    /// Trace a new session and take a snapshot of the file.
    static void dumpNewSessionTrace(const std::string& id, const std::string& sessionId, const std::string& uri, const std::string& path);

    /// Trace the end of a session.
    static void dumpEndSessionTrace(const std::string& id, const std::string& sessionId, const std::string& uri);

    static void dumpEventTrace(const std::string& id, const std::string& sessionId, const std::string& data);

    static void dumpIncomingTrace(const std::string& id, const std::string& sessionId, const std::string& data);

    static void dumpOutgoingTrace(const std::string& id, const std::string& sessionId, const std::string& data);

    /// Waits on Forkit and reaps if it dies, then restores.
    /// Return true if wait succeeds.
    static bool checkAndRestoreForKit();

    /// Creates a new instance of Forkit.
    /// Return true when successfull.
    static bool createForKit();

    static void triggerChildAndDocHousekeeping();

protected:
    void initialize(Poco::Util::Application& self) override;
    void defineOptions(Poco::Util::OptionSet& options) override;
    void handleOption(const std::string& name, const std::string& value) override;
    int innerMain();
    int main(const std::vector<std::string>& args) override;

    /// Handle various global static destructors.
    void cleanup();

private:
    static Util::RuntimeConstant<bool> SSLEnabled;
    static Util::RuntimeConstant<bool> SSLTermination;

    void initializeSSL();
    void displayHelp();

    class ConfigValueGetter
    {
        Poco::Util::LayeredConfiguration& _config;
        const std::string& _name;

    public:
        ConfigValueGetter(Poco::Util::LayeredConfiguration& config,
                          const std::string& name)
            : _config(config)
            , _name(name)
        {
        }

        void operator()(int& value) { value = _config.getInt(_name); }
        void operator()(unsigned int& value) { value = _config.getUInt(_name); }
        void operator()(bool& value) { value = _config.getBool(_name); }
        void operator()(std::string& value) { value = _config.getString(_name); }
    };

    template <typename T>
    static bool getSafeConfig(Poco::Util::LayeredConfiguration& config,
                              const std::string& name, T& value)
    {
        try
        {
            ConfigValueGetter(config, name)(value);
            return true;
        }
        catch (const Poco::SyntaxException&)
        {
        }

        return false;
    }

    template<typename T>
    static
    T getConfigValue(Poco::Util::LayeredConfiguration& config,
                     const std::string& name, const T def)
    {
        T value = def;
        if (getSafeConfig(config, name, value) ||
            getSafeConfig(config, name + "[@default]", value))
        {
            return value;
        }

        return def;
    }

    /// Reads and processes path entries with the given property
    /// from the configuration.
    /// Converts relative paths to absolute.
    std::string getPathFromConfig(const std::string& property) const
    {
        auto path = config().getString(property);
        if (path.empty() && config().hasProperty(property + "[@default]"))
        {
            // Use the default value if empty and a default provided.
            path = config().getString(property + "[@default]");
        }

        // Reconstruct absolute path if relative.
        if (!Poco::Path(path).isAbsolute() &&
            config().hasProperty(property + "[@relative]") &&
            config().getBool(property + "[@relative]"))
        {
            path = Poco::Path(Application::instance().commandPath()).parent().append(path).toString();
        }

        return path;
    }

private:
    /// Settings passed from the command-line to override those in the config file.
    std::map<std::string, std::string> _overrideSettings;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
