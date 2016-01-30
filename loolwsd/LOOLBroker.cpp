/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <sys/types.h>
#include <sys/wait.h>

#include <utime.h>
#include <ftw.h>
#include <unistd.h>
#include <dlfcn.h>

#include <atomic>
#include <mutex>
#include <cstring>
#include <cassert>
#include <iostream>
#include <fstream>
#include <deque>

#include <Poco/Types.h>
#include <Poco/Random.h>
#include <Poco/Path.h>
#include <Poco/File.h>
#include <Poco/ThreadLocal.h>
#include <Poco/Process.h>
#include <Poco/Thread.h>
#include <Poco/NamedMutex.h>

#include "Common.hpp"
#include "Capabilities.hpp"
#include "Util.hpp"

// First include the grist of the helper process - ideally
// we can avoid execve and share lots of memory here. We
// can't link to a non-PIC translation unit though, so
// include to share.
#define LOOLKIT_NO_MAIN 1
#include "LOOLKit.cpp"

#define LIB_SOFFICEAPP  "lib" "sofficeapp" ".so"
#define LIB_MERGED      "lib" "mergedlo" ".so"
#define LIB_SCLO        "lib" "sclo" ".so"
#define LIB_SWLO        "lib" "swlo" ".so"
#define LIB_SDLO        "lib" "sdlo" ".so"
#define JAILED_LOOLKIT_PATH    "/usr/bin/loolkit"

typedef int (LokHookPreInit)  ( const char *install_path, const char *user_profile_path );

using Poco::Path;
using Poco::File;
using Poco::ThreadLocal;
using Poco::Process;
using Poco::Thread;
using Poco::ProcessHandle;

const std::string FIFO_FILE = "/tmp/loolwsdfifo";
const std::string FIFO_BROKER = "/tmp/loolbroker.fifo";
const std::string BROKER_SUFIX = ".fifo";
const std::string BROKER_PREFIX = "/tmp/lokit";

static int readerChild = -1;
static int readerBroker = -1;

static std::atomic<unsigned> forkCounter;
static std::chrono::steady_clock::time_point lastMaintenanceTime = std::chrono::steady_clock::now();
static unsigned int childCounter = 0;
static signed numPreSpawnedChildren = 0;

static std::recursive_mutex forkMutex;
static std::map<std::string, Process::PID> _cacheURL;

namespace
{
    class ChildProcess
    {
    public:
        ChildProcess() :
            _pid(-1),
            _readPipe(-1),
            _writePipe(-1)
        {
        }

        ChildProcess(const Poco::Process::PID pid, const int readPipe, const int writePipe) :
            _pid(pid),
            _readPipe(readPipe),
            _writePipe(writePipe)
        {
        }

        ChildProcess(ChildProcess&& other) :
            _pid(other._pid),
            _readPipe(other._readPipe),
            _writePipe(other._writePipe)
        {
            other._pid = -1;
            other._readPipe = -1;
            other._writePipe = -1;
        }

        const ChildProcess& operator=(ChildProcess&& other)
        {
            _pid = other._pid;
            other._pid = -1;
            _readPipe = other._readPipe;
            other._readPipe = -1;
            _writePipe = other._writePipe;
            other._writePipe = -1;

            return *this;
        }

        ~ChildProcess()
        {
            close();
        }

        void close()
        {
            if (_pid != -1)
            {
                if (kill(_pid, SIGTERM) != 0 && kill(_pid, 0) != 0)
                    Log::warn("Cannot terminate lokit [" + std::to_string(_pid) + "]. Abandoning.");
               _pid = -1;
            }

            if (_readPipe != -1)
            {
                ::close(_readPipe);
                _readPipe = -1;
            }

            if (_writePipe != -1)
            {
                ::close(_writePipe);
                _writePipe = -1;
            }
        }

        void setUrl(const std::string& url) { _url = url; }
        const std::string& getUrl() const { return _url; }

        Poco::Process::PID getPid() const { return _pid; }
        int getReadPipe() const { return _readPipe; }
        int getWritePipe() const { return _writePipe; }

    private:
        std::string _url;
        Poco::Process::PID _pid;
        int _readPipe;
        int _writePipe;
    };

    static std::map<Process::PID, std::shared_ptr<ChildProcess>> _childProcesses;

    /// Safely looks up a child hosting a URL.
    std::shared_ptr<ChildProcess> findChild(const std::string& url)
    {
        std::lock_guard<std::recursive_mutex> lock(forkMutex);

        std::shared_ptr<ChildProcess> child;
        for (const auto& it : _childProcesses)
        {
            if (it.second->getUrl() == url)
            {
                return it.second;
            }

            if (it.second->getUrl().empty())
                child = it.second;
        }

        return child;
    }

    /// Safely looks up the pipe descriptor
    /// of a child. Returns -1 on error.
    int getChildPipe(const Process::PID pid)
    {
        std::lock_guard<std::recursive_mutex> lock(forkMutex);
        const auto it = _childProcesses.find(pid);
        return (it != _childProcesses.end() ? it->second->getWritePipe() : -1);
    }

    /// Safely removes a child process and
    /// invalidates the URL cache.
    void removeChild(const Process::PID pid)
    {
        std::lock_guard<std::recursive_mutex> lock(forkMutex);
        const auto it = _childProcesses.find(pid);
        if (it != _childProcesses.end())
        {
            // Close the child.
            it->second->close();
            _childProcesses.erase(it);
            ++forkCounter;
        }
    }

    ThreadLocal<std::string> sourceForLinkOrCopy;
    ThreadLocal<Path> destinationForLinkOrCopy;

    int linkOrCopyFunction(const char *fpath,
                           const struct stat* /*sb*/,
                           int typeflag,
                           struct FTW* /*ftwbuf*/)
    {
        if (strcmp(fpath, sourceForLinkOrCopy->c_str()) == 0)
            return 0;

        assert(fpath[strlen(sourceForLinkOrCopy->c_str())] == '/');
        const char *relativeOldPath = fpath + strlen(sourceForLinkOrCopy->c_str()) + 1;

#ifdef __APPLE__
        if (strcmp(relativeOldPath, "PkgInfo") == 0)
            return 0;
#endif

        Path newPath(*destinationForLinkOrCopy, Path(relativeOldPath));

        switch (typeflag)
        {
        case FTW_F:
            File(newPath.parent()).createDirectories();
            if (link(fpath, newPath.toString().c_str()) == -1)
            {
                Log::error("Error: link(\"" + std::string(fpath) + "\",\"" + newPath.toString() +
                           "\") failed. Exiting.");
                exit(1);
            }
            break;
        case FTW_DP:
            {
                struct stat st;
                if (stat(fpath, &st) == -1)
                {
                    Log::error("Error: stat(\"" + std::string(fpath) + "\") failed.");
                    return 1;
                }
                File(newPath).createDirectories();
                struct utimbuf ut;
                ut.actime = st.st_atime;
                ut.modtime = st.st_mtime;
                if (utime(newPath.toString().c_str(), &ut) == -1)
                {
                    Log::error("Error: utime(\"" + newPath.toString() + "\", &ut) failed.");
                    return 1;
                }
            }
            break;
        case FTW_DNR:
            Log::error("Cannot read directory '" + std::string(fpath) + "'");
            return 1;
        case FTW_NS:
            Log::error("nftw: stat failed for '" + std::string(fpath) + "'");
            return 1;
        case FTW_SLN:
            Log::error("nftw: symlink to nonexistent file: '" + std::string(fpath) + "', ignored.");
            break;
        default:
            assert(false);
        }
        return 0;
    }

    void linkOrCopy(const std::string& source, const Path& destination)
    {
        *sourceForLinkOrCopy = source;
        if (sourceForLinkOrCopy->back() == '/')
            sourceForLinkOrCopy->pop_back();
        *destinationForLinkOrCopy = destination;
        if (nftw(source.c_str(), linkOrCopyFunction, 10, FTW_DEPTH) == -1)
            Log::error("linkOrCopy: nftw() failed for '" + source + "'");
    }
}

class PipeRunnable: public Runnable
{
public:
    PipeRunnable()
      : _pStart(nullptr),
        _pEnd(nullptr)
    {
    }

    ssize_t getResponseLine(int nPipeReader, std::string& aLine)
    {
        ssize_t nBytes = -1;
        aLine.clear();

        try
        {
            while (true)
            {
                if ( _pStart == _pEnd )
                {
                    nBytes = Util::readMessage(nPipeReader, _aBuffer, sizeof(_aBuffer));
                    if ( nBytes < 0 )
                    {
                        _pStart = _pEnd = nullptr;
                        break;
                    }

                    _pStart = _aBuffer;
                    _pEnd   = _aBuffer + nBytes;
                }

                if ( _pStart != _pEnd )
                {
                    char aChar = *_pStart++;
                    while (_pStart != _pEnd && aChar != '\r' && aChar != '\n')
                    {
                        aLine += aChar;
                        aChar  = *_pStart++;
                    }

                    if ( aChar == '\r' && *_pStart == '\n')
                    {
                        _pStart++;
                        break;
                    }
                }
            }
        }
        catch (const std::exception& exc)
        {
            Log::error() << "Exception while reading from pipe ["
                         << nPipeReader << "]: " << exc.what() << Log::end;
            return -1;
        }

        return nBytes;
    }

    bool createThread(const Process::PID nPID, const std::string& aTID, const std::string& aURL)
    {
        const std::string aMessage = "thread " + aTID + " " + aURL + "\r\n";
        if (Util::writeFIFO(getChildPipe(nPID), aMessage) < 0)
        {
            Log::error("Error sending thread message to child [" + std::to_string(nPID) + "].");
            return false;
        }

        std::string aResponse;
        if (getResponseLine(readerChild, aResponse) < 0)
        {
            Log::error("Error reading response to thread message from child [" + std::to_string(nPID) + "].");
            return false;
        }

        StringTokenizer tokens(aResponse, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        return (tokens.count() == 2 && tokens[0] == std::to_string(nPID) && tokens[1] == "ok");
    }

    void verifyChilds()
    {
        std::lock_guard<std::recursive_mutex> lock(forkMutex);

        // Sanitize cache.
        Log::trace("Verifying Childs.");
        for (auto& it : _childProcesses)
        {
            const auto aMessage = "query url \r\n";
            if (Util::writeFIFO(it.second->getWritePipe(), aMessage) < 0)
            {
                Log::error("Error sending query message to child [" + std::to_string(it.second->getPid()) + "]. Clearing cache.");
                _cacheURL.clear();
                break;
            }

            std::string aResponse;
            if (getResponseLine(readerChild, aResponse) < 0)
            {
                Log::error("Error reading response to thread message from child [" + std::to_string(it.second->getPid()) + "]. Clearing cache.");
                _cacheURL.clear();
                break;
            }

            StringTokenizer tokens(aResponse, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            if (tokens.count() != 2 || tokens[0] != std::to_string(it.second->getPid()) || tokens[1] != "ok")
            {
                Log::debug() << "Removed expired Kit [" << it.second->getPid() << "] hosts URL [" << it.second->getUrl() << "]." << Log::end;
                //it = _cacheURL.erase(it);
                continue;
            }
        }
    }

    void handleInput(const std::string& aMessage)
    {
        std::lock_guard<std::recursive_mutex> lock(forkMutex);

        StringTokenizer tokens(aMessage, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        if (tokens[0] == "request" && tokens.count() == 3)
        {
            const std::string aTID = tokens[1];
            const std::string aURL = tokens[2];

            Log::debug("Finding kit for URL [" + aURL + "] on thread [" + aTID + "].");

            const auto child = findChild(aURL);
            if (child)
            {
                if (child->getUrl() == aURL)
                    Log::debug("Found URL [" + aURL + "] hosted on child [" + std::to_string(child->getPid()) + "].");
                else
                    Log::debug("URL [" + aURL + "] is not hosted. Using empty child[" + std::to_string(child->getPid()) + "].");

                if (!createThread(child->getPid(), aTID, aURL))
                {
                    Log::error("Cache: Error creating thread [" + aTID + "] for URL [" + aURL + "].");
                }
            }
            else
            {
                Log::info("No children available. Creating more.");
                ++forkCounter;
            }
        }
    }

    void run() override
    {
        std::string aMessage;
        char  aBuffer[READ_BUFFER_SIZE];
        char* pStart;
        char* pEnd;

        struct pollfd aPoll;
        ssize_t nBytes = -1;

        aPoll.fd = readerBroker;
        aPoll.events = POLLIN;
        aPoll.revents = 0;

        pStart = aBuffer;
        pEnd   = aBuffer;

        static const std::string thread_name = "brk_pipe_reader";
#ifdef __linux
        if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(thread_name.c_str()), 0, 0, 0) != 0)
            Log::error("Cannot set thread name to " + thread_name + ".");
#endif
        Log::debug("Thread [" + thread_name + "] started.");

        while (!TerminationFlag)
        {
            if ( pStart == pEnd )
            {
                if (poll(&aPoll, 1, POLL_TIMEOUT_MS) < 0)
                {
                    Log::error("Failed to poll pipe [" + FIFO_FILE + "].");
                    continue;
                }
                else
                if (aPoll.revents & (POLLIN | POLLPRI))
                {
                    nBytes = Util::readFIFO(readerBroker, aBuffer, sizeof(aBuffer));
                    if (nBytes < 0)
                    {
                        pStart = pEnd = nullptr;
                        Log::error("Error reading message from pipe [" + FIFO_FILE + "].");
                        continue;
                    }
                    pStart = aBuffer;
                    pEnd   = aBuffer + nBytes;
                }
                else
                if (aPoll.revents & (POLLERR | POLLHUP))
                {
                    Log::error("Broken pipe [" + FIFO_FILE + "] with wsd.");
                    break;
                }
            }

            if ( pStart != pEnd )
            {
                char aChar = *pStart++;
                while (pStart != pEnd && aChar != '\r' && aChar != '\n')
                {
                    aMessage += aChar;
                    aChar = *pStart++;
                }

                if ( aChar == '\r' && *pStart == '\n')
                {
                    pStart++;

                    Log::trace("BrokerFromMaster: " + aMessage);
                    if (aMessage == "eof")
                        break;

                    const auto duration = (std::chrono::steady_clock::now() - lastMaintenanceTime);
                    if (duration >= std::chrono::seconds(10))
                    {
                        verifyChilds();
                        lastMaintenanceTime = std::chrono::steady_clock::now();
                    }

                    handleInput(aMessage);
                    aMessage.clear();
                }
            }
        }

        Log::debug("Thread [" + thread_name + "] finished.");
    }

private:
    char* _pStart;
    char* _pEnd;
    char  _aBuffer[READ_BUFFER_SIZE];
};

/// Initializes LibreOfficeKit for cross-fork re-use.
static bool globalPreinit(const std::string &loSubPath)
{
    void *handle;
    LokHookPreInit* preInit;

    std::string fname = "/" + loSubPath + "/program/" LIB_SOFFICEAPP;
    handle = dlopen(fname.c_str(), RTLD_GLOBAL|RTLD_NOW);
    if (!handle)
    {
        Log::warn("Failed to load " + std::string(LIB_SOFFICEAPP) + " library. Trying " + std::string(LIB_MERGED));
        fname = "/" + loSubPath + "/program/" LIB_MERGED;
        handle = dlopen(fname.c_str(), RTLD_GLOBAL|RTLD_NOW);
        if (!handle)
        {
            Log::warn("Failed to load " + std::string(LIB_MERGED) + " library.");
            return false;
        }
    }

    preInit = (LokHookPreInit *)dlsym(handle, "lok_preinit");
    if (!preInit)
    {
        Log::warn("Note: No lok_preinit hook in " + std::string(LIB_SOFFICEAPP) +
                  " library. Cannot fork, will execv instead.");
        return false;
    }

    return preInit(("/" + loSubPath + "/program").c_str(), "file:///user") == 0;
}

static int createLibreOfficeKit(const bool sharePages,
                                const std::string& loSubPath,
                                const std::string& jailId)
{
    Poco::UInt64 childPID;
    int nFIFOWriter = -1;

    const std::string pipe = BROKER_PREFIX + std::to_string(childCounter++) + BROKER_SUFIX;

    if (mkfifo(pipe.c_str(), 0666) < 0)
    {
        Log::error("Error: mkfifo failed.");
        return -1;
    }

    if (sharePages)
    {
        Log::debug("Forking LibreOfficeKit.");

        Poco::UInt64 pid;
        if (!(pid = fork()))
        {
            // child
            lokit_main(loSubPath, jailId, pipe);
            _exit(0);
        }
        else
        {
            // parent
            childPID = pid; // (somehow - switch the hash to use real pids or ?) ...
            Log::info("Forked kit [" + std::to_string(childPID) + "].");
        }
    }
    else
    {
        Process::Args args;
        args.push_back("--losubpath=" + loSubPath);
        args.push_back("--jailid=" + jailId);
        args.push_back("--pipe=" + pipe);
        args.push_back("--clientport=" + std::to_string(ClientPortNumber));

        Log::info("Launching LibreOfficeKit #" + std::to_string(childCounter) +
                  ": " + JAILED_LOOLKIT_PATH + " " +
                  Poco::cat(std::string(" "), args.begin(), args.end()));

        ProcessHandle procChild = Process::launch(JAILED_LOOLKIT_PATH, args);
        childPID = procChild.id();
        Log::info("Spawned kit [" + std::to_string(childPID) + "].");

        if (!Process::isRunning(procChild))
        {
            // This can happen if we fail to copy it, or bad chroot etc.
            Log::error("Error: loolkit [" + std::to_string(childPID) + "] was stillborn.");
            return -1;
        }
    }

    if ( (nFIFOWriter = open(pipe.c_str(), O_WRONLY)) < 0 )
    {
        Log::error("Error: failed to open write pipe [" + pipe + "] with kit. Abandoning child.");
        ChildProcess(childPID, -1, -1);
        return -1;
    }

    Log::info() << "Adding Kit #" << childCounter << ", PID: " << childPID << Log::end;

    _childProcesses[childPID] = std::make_shared<ChildProcess>(childPID, -1, nFIFOWriter);
    return childPID;
}

static bool waitForTerminationChild(const Process::PID aPID, signed count = CHILD_TIMEOUT_SECS)
{
    while (count-- > 0)
    {
        int status;
        waitpid(aPID, &status, WUNTRACED | WNOHANG);
        if (WIFEXITED(status) || WIFSIGNALED(status))
        {
            Log::info("Child " + std::to_string(aPID) + " terminated.");
            return true;
        }

        sleep(MAINTENANCE_INTERVAL);
    }

    return false;
}

// Broker process
int main(int argc, char** argv)
{
    if (std::getenv("SLEEPFORDEBUGGER"))
    {
        std::cerr << "Sleeping " << std::getenv("SLEEPFORDEBUGGER")
                  << " seconds to attach debugger to process "
                  << Process::id() << std::endl;
        Thread::sleep(std::stoul(std::getenv("SLEEPFORDEBUGGER")) * 1000);
    }

    // Initialization
    Log::initialize("brk");

    Util::setSignals(false);

    std::string childRoot;
    std::string jailId;
    std::string loSubPath;
    std::string sysTemplate;
    std::string loTemplate;

    for (int i = 0; i < argc; ++i)
    {
        char *cmd = argv[i];
        char *eq  = nullptr;
        if (strstr(cmd, "--losubpath=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                loSubPath = std::string(++eq);
        }
        else if (strstr(cmd, "--systemplate=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                sysTemplate = std::string(++eq);
        }
        else if (strstr(cmd, "--lotemplate=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                loTemplate = std::string(++eq);
        }
        else if (strstr(cmd, "--childroot=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                childRoot = std::string(++eq);
        }
        else if (strstr(cmd, "--jailid=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                jailId = std::string(++eq);
        }
        else if (strstr(cmd, "--numprespawns=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                numPreSpawnedChildren = std::stoi(std::string(++eq));
        }
        else if (strstr(cmd, "--clientport=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                ClientPortNumber = std::stoll(std::string(++eq));
        }
    }

    if (loSubPath.empty())
    {
        Log::error("Error: --losubpath is empty");
        exit(-1);
    }

    if (sysTemplate.empty())
    {
        Log::error("Error: --losubpath is empty");
        exit(-1);
    }

    if (loTemplate.empty())
    {
        Log::error("Error: --lotemplate is empty");
        exit(-1);
    }

    if (childRoot.empty())
    {
        Log::error("Error: --childroot is empty");
        exit(-1);
    }

    if (numPreSpawnedChildren < 1)
    {
        Log::error("Error: --numprespawns is 0");
        exit(-1);
    }

    if ( (readerBroker = open(FIFO_FILE.c_str(), O_RDONLY) ) < 0 )
    {
        Log::error("Error: failed to open pipe [" + FIFO_FILE + "] read only. Exiting.");
        exit(-1);
    }

    try
    {
        Poco::Environment::get("LD_BIND_NOW");
    }
    catch (const Poco::NotFoundException& exc)
    {
        Log::warn("Note: LD_BIND_NOW is not set.");
    }

    try
    {
        Poco::Environment::get("LOK_VIEW_CALLBACK");
    }
    catch (const Poco::NotFoundException& exc)
    {
        Log::warn("Note: LOK_VIEW_CALLBACK is not set.");
    }

    // The loolkit binary must be in our directory.
    const std::string loolkitPath = Poco::Path(argv[0]).parent().toString() + "loolkit";
    if (!File(loolkitPath).exists())
    {
        Log::error("Error: loolkit does not exists at [" + loolkitPath + "].");
        exit(-1);
    }

    const Path jailPath = Path::forDirectory(childRoot + Path::separator() + jailId);
    Log::info("Jail path: " + jailPath.toString());

    File(jailPath).createDirectories();

    Path jailLOInstallation(jailPath, loSubPath);
    jailLOInstallation.makeDirectory();
    File(jailLOInstallation).createDirectory();

    // Copy (link) LO installation and other necessary files into it from the template.
    linkOrCopy(sysTemplate, jailPath);
    linkOrCopy(loTemplate, jailLOInstallation);

    // It is necessary to deploy loolkit process to chroot jail.
    File(loolkitPath).copyTo(Path(jailPath, JAILED_LOOLKIT_PATH).toString());

    // We need this because sometimes the hostname is not resolved
    const std::vector<std::string> networkFiles = {"/etc/host.conf", "/etc/hosts", "/etc/nsswitch.conf", "/etc/resolv.conf"};
    for (const auto& filename : networkFiles)
    {
       const File networkFile(filename);
       if (networkFile.exists())
       {
           networkFile.copyTo(Path(jailPath, "/etc").toString());
       }
    }

#ifdef __linux
    // Create the urandom and random devices
    File(Path(jailPath, "/dev")).createDirectory();
    if (mknod((jailPath.toString() + "/dev/random").c_str(),
              S_IFCHR | S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH,
              makedev(1, 8)) != 0)
    {
        Log::error("Error: mknod(" + jailPath.toString() + "/dev/random) failed.");

    }
    if (mknod((jailPath.toString() + "/dev/urandom").c_str(),
              S_IFCHR | S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH,
              makedev(1, 9)) != 0)
    {
        Log::error("Error: mknod(" + jailPath.toString() + "/dev/urandom) failed.");
    }
#endif

    Log::info("loolbroker -> chroot(\"" + jailPath.toString() + "\")");
    if (chroot(jailPath.toString().c_str()) == -1)
    {
        Log::error("Error: chroot(\"" + jailPath.toString() + "\") failed.");
        exit(-1);
    }

    if (chdir("/") == -1)
    {
        Log::error("Error: chdir(\"/\") in jail failed.");
        exit(-1);
    }

#ifdef __linux
    dropCapability(CAP_SYS_CHROOT);
    dropCapability(CAP_MKNOD);
    dropCapability(CAP_FOWNER);
#else
    dropCapability();
#endif

    if (mkfifo(FIFO_BROKER.c_str(), 0666) == -1)
    {
        Log::error("Error: Failed to create pipe FIFO [" + FIFO_BROKER + "].");
        exit(-1);
    }

    // Initialize LoKit and hope we can fork and save memory by sharing pages.
    const bool sharePages = globalPreinit(loSubPath);

    // We must have at least one child, more is created dynamically.
    if (createLibreOfficeKit(sharePages, loSubPath, jailId) < 0)
    {
        Log::error("Error: failed to create children.");
        exit(-1);
    }

    if (numPreSpawnedChildren > 1)
        forkCounter = numPreSpawnedChildren - 1;

    if ( (readerChild = open(FIFO_BROKER.c_str(), O_RDONLY) ) < 0 )
    {
        Log::error("Error: pipe opened for reading.");
        exit(-1);
    }

    PipeRunnable pipeHandler;
    Poco::Thread aPipe;

    aPipe.start(pipeHandler);

    Log::info("loolbroker is ready.");

    unsigned timeoutCounter = 0;
    while (!TerminationFlag)
    {
        if (forkCounter > 0)
        {
            std::lock_guard<std::recursive_mutex> lock(forkMutex);

            pipeHandler.verifyChilds();

            // Figure out how many children we need.
            const signed total = _childProcesses.size();
            const signed used = _cacheURL.size();
            const signed extra = total - used;
            signed spawn = std::min(static_cast<int>(forkCounter), numPreSpawnedChildren);
            Log::debug() << "Spawning " << spawn << " children. Current Total: " << total
                         << ", used: " << used << ", extra: " << extra << Log::end;
            do
            {
                if (createLibreOfficeKit(sharePages, loSubPath, jailId) < 0)
                    Log::error("Error: fork failed.");
            }
            while (--spawn > 0);

            // We've done our best. If need more, retrying will bump the counter.
            forkCounter = 0;
        }

        int status;
        const pid_t pid = waitpid(-1, &status, WUNTRACED | WNOHANG);
        if (pid > 0)
        {
            if (WIFEXITED(status))
            {
                Log::info() << "Child process [" << pid << "] exited with code: "
                            << WEXITSTATUS(status) << "." << Log::end;

                removeChild(pid);
            }
            else
            if (WIFSIGNALED(status))
            {
                std::string fate = "died";
#ifdef WCOREDUMP
                if (WCOREDUMP(status))
                    fate = "core-dumped";
#endif
                Log::error() << "Child process [" << pid << "] " << fate
                             << " with " << Util::signalName(WTERMSIG(status))
                             << " signal. " << Log::end;

                removeChild(pid);
            }
            else if (WIFSTOPPED(status))
            {
                Log::info() << "Child process [" << pid << "] stopped with "
                            << Util::signalName(WSTOPSIG(status))
                            << " signal. " << Log::end;
            }
            else if (WIFCONTINUED(status))
            {
                Log::info() << "Child process [" << pid << "] resumed with SIGCONT."
                            << Log::end;
            }
            else
            {
                Log::warn() << "Unknown status returned by waitpid: "
                            << std::hex << status << "." << Log::end;
            }
        }
        else if (pid < 0)
            Log::error("Error: waitpid failed.");

        if (timeoutCounter++ == INTERVAL_PROBES)
        {
            timeoutCounter = 0;
            sleep(MAINTENANCE_INTERVAL);
        }
    }

    // Terminate child processes
    for (auto& it : _childProcesses)
    {
        Log::info("Requesting child process " + std::to_string(it.first) + " to terminate.");
        Process::requestTermination(it.first);
    }

    // Wait and kill child processes
    for (auto& it : _childProcesses)
    {
        if (!waitForTerminationChild(it.first))
        {
            Log::info("Forcing child process " + std::to_string(it.first) + " to terminate.");
            Process::kill(it.first);
        }
    }

    _childProcesses.clear();

    aPipe.join();
    close(readerChild);
    close(readerBroker);

    Log::info("Process [loolbroker] finished.");
    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
