/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <map>
#include <set>
#include <unordered_set>
#include <string>
#include <utility>

#include <signal.h>

#include <Poco/Path.h>
#include <Poco/Util/AbstractConfiguration.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Util/ServerApplication.h>

#include "Util.hpp"
#include "FileUtil.hpp"
#include "RequestDetails.hpp"
#include "WebSocketHandler.hpp"

class ChildProcess;
class TraceFileWriter;
class DocumentBroker;
class ClipboardCache;

std::shared_ptr<ChildProcess> getNewChild_Blocks(unsigned mobileAppDocId = 0);

// A WSProcess object in the WSD process represents a descendant process, either the direct child
// process FORKIT or a grandchild KIT process, with which the WSD process communicates through a
// WebSocket.
class WSProcess
{
public:
    /// @param pid is the process ID.
    /// @param socket is the underlying Sockeet to the process.
    WSProcess(const std::string& name,
              const pid_t pid,
              const std::shared_ptr<StreamSocket>& socket,
              std::shared_ptr<WebSocketHandler> handler) :

        _name(name),
        _pid(pid),
        _ws(std::move(handler)),
        _socket(socket)
    {
        LOG_INF(_name << " ctor [" << _pid << "].");
    }


    WSProcess(WSProcess&& other) = delete;

    const WSProcess& operator=(WSProcess&& other) = delete;

    virtual ~WSProcess()
    {
        LOG_DBG('~' << _name << " dtor [" << _pid << "].");

        if (_pid <= 0)
            return;

        terminate();

        // No need for the socket anymore.
        _ws.reset();
        _socket.reset();
    }

    /// Let the child close a nice way.
    void close()
    {
        if (_pid < 0)
            return;

        try
        {
            LOG_DBG("Closing ChildProcess [" << _pid << "].");

            // Request the child to exit
            if (isAlive())
            {
                LOG_DBG("Stopping ChildProcess [" << _pid << "] by sending 'exit' command.");
                sendTextFrame("exit");
            }

            // Shutdown the socket.
            if (_ws)
                _ws->shutdown();
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Error while closing child process: " << ex.what());
        }

        _pid = -1; // Detach from child.
    }

    /// Kill or abandon the child.
    void terminate()
    {
        if (_pid < 0)
            return;

#if !MOBILEAPP
        if (::kill(_pid, 0) == 0)
        {
            LOG_INF("Killing child [" << _pid << "].");
            if (!SigUtil::killChild(_pid))
            {
                LOG_ERR("Cannot terminate lokit [" << _pid << "]. Abandoning.");
            }
        }
#else
        // What to do? Throw some unique exception that the outermost call in the thread catches and
        // exits from the thread?
#endif
        _pid = -1;
    }

    pid_t getPid() const { return _pid; }

    /// Send a text payload to the child-process WS.
    virtual bool sendTextFrame(const std::string& data)
    {
        try
        {
            if (_ws)
            {
                LOG_TRC("Send to " << _name << " message: [" << LOOLProtocol::getAbbreviatedMessage(data) << "].");
                _ws->sendMessage(data);
                return true;
            }
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Failed to send " << _name << " [" << _pid << "] data [" <<
                    LOOLProtocol::getAbbreviatedMessage(data) << "] due to: " << exc.what());
            throw;
        }

        LOG_WRN("No socket to " << _name << " to send [" << LOOLProtocol::getAbbreviatedMessage(data) << ']');
        return false;
    }

    /// Check whether this child is alive and socket not in error.
    /// Note: zombies will show as alive, and sockets have waiting
    /// time after the other end-point closes. So this isn't accurate.
    virtual bool isAlive() const
    {
#if !MOBILEAPP
        try
        {
            return _pid > 1 && _ws && ::kill(_pid, 0) == 0;
        }
        catch (const std::exception&)
        {
        }

        return false;
#else
        return _pid > 1;
#endif
    }

protected:
    std::shared_ptr<WebSocketHandler> getWSHandler() const { return _ws; }
    std::shared_ptr<Socket> getSocket() const { return _socket; };

private:
    std::string _name;
    pid_t _pid;
    std::shared_ptr<WebSocketHandler> _ws;
    std::shared_ptr<Socket> _socket;
};

#if !MOBILEAPP

class ForKitProcWSHandler: public WebSocketHandler
{
public:

    ForKitProcWSHandler(const std::weak_ptr<StreamSocket>& socket, const Poco::Net::HTTPRequest& request)
    : WebSocketHandler(socket, request)
    {
    }

    virtual void handleMessage(const std::vector<char> &data) override;
};

class ForKitProcess : public WSProcess
{
public:
    ForKitProcess(int pid, std::shared_ptr<StreamSocket>& socket, const Poco::Net::HTTPRequest &request)
        : WSProcess("ForKit", pid, socket, std::make_shared<ForKitProcWSHandler>(socket, request))
    {
        socket->setHandler(getWSHandler());
    }
};

#endif

/// The Server class which is responsible for all
/// external interactions.
class LOOLWSD : public Poco::Util::ServerApplication
{
public:
    LOOLWSD();
    ~LOOLWSD();

    // An Application is a singleton anyway,
    // so just keep these as statics.
    static std::atomic<uint64_t> NextConnectionId;
    static unsigned int NumPreSpawnedChildren;
#if !MOBILEAPP
    static bool NoCapsForKit;
    static bool NoSeccomp;
    static bool AdminEnabled;
#if ENABLE_DEBUG
    static bool SingleKit;
#endif
    static std::shared_ptr<ForKitProcess> ForKitProc;
    static std::atomic<int> ForKitProcId;
#endif
#ifdef FUZZER
    static bool DummyLOK;
    static std::string FuzzFileName;
#endif
    static std::string UserInterface;
    static std::string ConfigFile;
    static std::string ConfigDir;
    static std::string SysTemplate;
    static std::string LoTemplate;
    static std::string ChildRoot;
    static std::string ServerName;
    static std::string FileServerRoot;
    static std::string WelcomeFilesRoot; ///< From where we should serve the release notes (or otherwise useful content) that is shown on first install or version update.
    static std::string ServiceRoot; ///< There are installations that need prefixing every page with some path.
    static std::string LOKitVersion;
    static FILE *EventTraceFile;
    static std::string LogLevel;
    static bool AnonymizeUserData;
    static bool CheckLoolUser;
    static bool CleanupOnly;
    static bool IsProxyPrefixEnabled;
    static std::atomic<unsigned> NumConnections;
    static std::unique_ptr<TraceFileWriter> TraceDumper;
#if !MOBILEAPP
    static std::unique_ptr<ClipboardCache> SavedClipboards;
#endif
    static std::unordered_set<std::string> EditFileExtensions;
    static std::unordered_set<std::string> ViewWithCommentsFileExtensions;
    static unsigned MaxConnections;
    static unsigned MaxDocuments;
    static std::string OverrideWatermark;
    static std::set<const Poco::Util::AbstractConfiguration*> PluginConfigurations;
    static std::chrono::steady_clock::time_point StartTime;
#if MOBILEAPP
#ifndef IOS
    /// This is used to be able to wait until the lokit main thread has finished (and it is safe to load a new document).
    static std::mutex lokit_main_mutex;
#endif
#endif

    /// For testing only [!]
    static int getClientPortNumber();
    /// For testing only [!]
    static std::vector<int> getKitPids();
    /// For testing only [!] DocumentBrokers are mostly single-threaded with their own thread
    static std::vector<std::shared_ptr<DocumentBroker>> getBrokersTestOnly();

    static std::string GetConnectionId()
    {
        return Util::encodeId(NextConnectionId++, 3);
    }

    static bool isSSLEnabled()
    {
#if ENABLE_SSL
        return !Util::isFuzzing() && LOOLWSD::SSLEnabled.get();
#else
        return false;
#endif
    }

    static bool isSSLTermination()
    {
#if ENABLE_SSL
        return !Util::isFuzzing() && LOOLWSD::SSLTermination.get();
#else
        return false;
#endif
    }

    /// Return true if extension is marked as view action in discovery.xml.
    static bool IsViewFileExtension(const std::string& extension)
    {
#if MOBILEAPP
        (void) extension;
        return false; // mark everything editable on mobile
#else
        std::string lowerCaseExtension = extension;
        std::transform(lowerCaseExtension.begin(), lowerCaseExtension.end(), lowerCaseExtension.begin(), ::tolower);
        return EditFileExtensions.find(lowerCaseExtension) == EditFileExtensions.end();
#endif
    }

    /// Return true if extension is marked as view_comment action in discovery.xml.
    static bool IsViewWithCommentsFileExtension(const std::string& extension)
    {
#if MOBILEAPP
        (void) extension;
        return false; // mark everything editable on mobile
#else
        std::string lowerCaseExtension = extension;
        std::transform(lowerCaseExtension.begin(), lowerCaseExtension.end(), lowerCaseExtension.begin(), ::tolower);
        return ViewWithCommentsFileExtensions.find(lowerCaseExtension) != ViewWithCommentsFileExtensions.end();
#endif
    }

    /// Returns the value of the specified application configuration,
    /// or the default, if one doesn't exist.
    template<typename T>
    static
    T getConfigValue(const std::string& name, const T def)
    {
        if (Util::isFuzzing())
        {
            return def;
        }

        return getConfigValue(Application::instance().config(), name, def);
    }

    /// Reads and processes path entries with the given property
    /// from the configuration.
    /// Converts relative paths to absolute.
    static
    std::string getPathFromConfig(const std::string& name)
    {
        return getPathFromConfig(Application::instance().config(), name);
    }

    /// Reads and processes path entries with the given property
    /// from the configuration. If value is empty then it reads from fallback
    /// Converts relative paths to absolute.
    static
    std::string getPathFromConfigWithFallback(const std::string& name, const std::string& fallbackName)
    {
        std::string value;
        // the expected path might not exist, in which case Poco throws an exception
        try
        {
            value = LOOLWSD::getPathFromConfig(name);
        }
        catch (...)
        {
        }
        if (value.empty())
            return LOOLWSD::getPathFromConfig(fallbackName);
        return value;
    }

    /// Returns true if and only if the property with the given key exists.
    static
    bool hasProperty(const std::string& key)
    {
        return Application::instance().config().hasProperty(key);
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
    /// Return true when successful.
    static bool createForKit();

    /// Sends a message to ForKit through PrisonerPoll.
    static void sendMessageToForKit(const std::string& message);

    /// Checks forkit (and respawns), rebalances
    /// child kit processes and cleans up DocBrokers.
    static void doHousekeeping();

    static void checkDiskSpaceAndWarnClients(const bool cacheLastCheck);

    static void checkSessionLimitsAndWarnClients();

    /// Close document with @docKey and a @message
    static void closeDocument(const std::string& docKey, const std::string& message);

    /// Autosave a given document (currently only called from Admin).
    static void autoSave(const std::string& docKey);

    /// Sets the log level of current kits.
    static void setLogLevelsOfKits(const std::string& level);

    /// Anonymize the basename of filenames, preserving the path and extension.
    static std::string anonymizeUrl(const std::string& url)
    {
        return FileUtil::anonymizeUrl(url);
    }

    /// Anonymize user names and IDs.
    /// Will use the Obfuscated User ID if one is provided via WOPI.
    static std::string anonymizeUsername(const std::string& username)
    {
        return FileUtil::anonymizeUsername(username);
    }

    /// get correct server URL with protocol + port number for this running server
    static std::string getServerURL();

    int innerMain();

protected:
    void initialize(Poco::Util::Application& self) override;
    void defineOptions(Poco::Util::OptionSet& options) override;
    void handleOption(const std::string& name, const std::string& value) override;
    int main(const std::vector<std::string>& args) override;

    /// Handle various global static destructors.
    static void cleanup();

private:
#if ENABLE_SSL
    static Util::RuntimeConstant<bool> SSLEnabled;
    static Util::RuntimeConstant<bool> SSLTermination;
#endif

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
        void operator()(uint64_t& value) { value = _config.getUInt64(_name); }
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
        catch (...)
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
    static
    std::string getPathFromConfig(Poco::Util::LayeredConfiguration& config, const std::string& property)
    {
        std::string path = config.getString(property);
        if (path.empty() && config.hasProperty(property + "[@default]"))
        {
            // Use the default value if empty and a default provided.
            path = config.getString(property + "[@default]");
        }

        // Reconstruct absolute path if relative.
        if (!Poco::Path(path).isAbsolute() &&
            config.hasProperty(property + "[@relative]") &&
            config.getBool(property + "[@relative]"))
        {
            path = Poco::Path(Application::instance().commandPath()).parent().append(path).toString();
        }

        return path;
    }

private:
    /// Settings passed from the command-line to override those in the config file.
    std::map<std::string, std::string> _overrideSettings;

#if MOBILEAPP
public:
    static int prisonerServerSocketFD;
#endif
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
