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

#include <algorithm>
#include <atomic>
#include <chrono>
#include <map>
#include <set>
#include <string>

#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/Util/AbstractConfiguration.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Util/ServerApplication.h>

#include "Util.hpp"

class ChildProcess;
class TraceFileWriter;
class DocumentBroker;

std::shared_ptr<ChildProcess> getNewChild_Blocks(
#ifdef MOBILEAPP
                                                 const std::string& uri
#endif
                                                 );

/// The Server class which is responsible for all
/// external interactions.
class LOOLWSD : public Poco::Util::ServerApplication
{
public:
    LOOLWSD();
    ~LOOLWSD();

    // An Application is a singleton anyway,
    // so just keep these as statics.
    static std::atomic<unsigned> NextConnectionId;
    static unsigned int NumPreSpawnedChildren;
    static bool NoCapsForKit;
    static bool NoSeccomp;
    static bool AdminEnabled;
    static std::atomic<int> ForKitWritePipe;
    static std::atomic<int> ForKitProcId;
    static bool DummyLOK;
    static std::string FuzzFileName;
    static std::string Cache;
    static std::string ConfigFile;
    static std::string ConfigDir;
    static std::string SysTemplate;
    static std::string LoTemplate;
    static std::string ChildRoot;
    static std::string ServerName;
    static std::string FileServerRoot;
    static std::string ServiceRoot; ///< There are installations that need prefixing every page with some path.
    static std::string LOKitVersion;
    static std::string LogLevel;
    static bool AnonymizeFilenames;
    static bool AnonymizeUsernames;
    static std::atomic<unsigned> NumConnections;
    static bool TileCachePersistent;
    static std::unique_ptr<TraceFileWriter> TraceDumper;
    static std::set<std::string> EditFileExtensions;
    static unsigned MaxConnections;
    static unsigned MaxDocuments;
    static std::string OverrideWatermark;
    static std::set<const Poco::Util::AbstractConfiguration*> PluginConfigurations;
    static std::chrono::time_point<std::chrono::system_clock> StartTime;

    static std::vector<int> getKitPids();

    static std::string GetConnectionId()
    {
        return Util::encodeId(NextConnectionId++, 3);
    }

    static bool isSSLEnabled()
    {
        return LOOLWSD::SSLEnabled.get();
    }

    static bool isSSLTermination()
    {
        return LOOLWSD::SSLTermination.get();
    }

    /// Return true iff extension is marked as view action in discovery.xml.
    static bool IsViewFileExtension(const std::string& extension)
    {
        std::string lowerCaseExtension = extension;
        std::transform(lowerCaseExtension.begin(), lowerCaseExtension.end(), lowerCaseExtension.begin(), ::tolower);
        return EditFileExtensions.find(lowerCaseExtension) == EditFileExtensions.end();
    }

    /// Returns the value of the specified application configuration,
    /// of the default, if one doesn't exist.
    template<typename T>
    static
    T getConfigValue(const std::string& name, const T def)
    {
        return getConfigValue(Application::instance().config(), name, def);
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

    /// Checks forkit (and respawns), rebalances
    /// child kit processes and cleans up DocBrokers.
    static void doHousekeeping();

    /// Close document with @docKey and a @message
    static void closeDocument(const std::string& docKey, const std::string& message);

    /// Autosave a given document
    static void autoSave(const std::string& docKey);

    /// Anonymize the basename of filenames, preserving the path and extension.
    static std::string anonymizeUrl(const std::string& url)
    {
        return AnonymizeFilenames ? Util::anonymizeUrl(url) : url;
    }

    /// Anonymize user names and IDs.
    /// Will use the Obfuscated User ID if one is provied via WOPI.
    static std::string anonymizeUsername(const std::string& username)
    {
        return AnonymizeUsernames ? Util::anonymize(username) : username;
    }

    int innerMain();

protected:
    void initialize(Poco::Util::Application& self) override;
    void defineOptions(Poco::Util::OptionSet& options) override;
    void handleOption(const std::string& name, const std::string& value) override;
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
        void operator()(double& value) { value = _config.getDouble(_name); }
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
        catch (const std::exception&)
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
        std::string path = config().getString(property);
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

#ifdef MOBILEAPP
public:
    static int prisonerServerSocketFD;
#endif
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
