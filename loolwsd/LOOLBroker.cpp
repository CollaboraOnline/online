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
#include <sys/capability.h>

#include <utime.h>
#include <ftw.h>
#include <unistd.h>
#include <dlfcn.h>

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

#include "Util.hpp"

// First include the grist of the helper process - ideally
// we can avoid execve and share lots of memory here. We
// can't link to a non-PIC translation unit though, so
// include to share.
#define LOOLKIT_NO_MAIN 1
#include "LOOLKit.cpp"

#define INTERVAL_PROBES 10
#define MAINTENANCE_INTERVAL 1

#define LIB_SOFFICEAPP  "lib" "sofficeapp" ".so"
#define LIB_SCLO        "lib" "sclo" ".so"
#define LIB_SWLO        "lib" "swlo" ".so"
#define LIB_SDLO        "lib" "sdlo" ".so"

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
static int timeoutCounter = 0;

static unsigned int forkCounter = 0;
static unsigned int childCounter = 0;

static std::mutex forkMutex;
static std::deque<Process::PID> _emptyURL;
static std::map<Process::PID, int> _childProcesses;
static std::map<std::string, Process::PID> _cacheURL;

Poco::NamedMutex _namedMutexLOOL("loolwsd");

namespace
{
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

    void dropCapability(
#ifdef __linux
                        cap_value_t capability
#endif
                        )
    {
#ifdef __linux
        cap_t caps;
        cap_value_t cap_list[] = { capability };

        caps = cap_get_proc();
        if (caps == nullptr)
        {
            Log::error("Error: cap_get_proc() failed.");
            exit(1);
        }

        if (cap_set_flag(caps, CAP_EFFECTIVE, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1 ||
            cap_set_flag(caps, CAP_PERMITTED, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1)
        {
            Log::error("Error: cap_set_flag() failed.");
            exit(1);
        }

        if (cap_set_proc(caps) == -1)
        {
            Log::error("Error: cap_set_proc() failed.");
            exit(1);
        }

        char *capText = cap_to_text(caps, nullptr);
        Log::info("Capabilities now: " + std::string(capText));
        cap_free(capText);

        cap_free(caps);
#endif
        // We assume that on non-Linux we don't need to be root to be able to hardlink to files we
        // don't own, so drop root.
        if (geteuid() == 0 && getuid() != 0)
        {
            // The program is setuid root. Not normal on Linux where we use setcap, but if this
            // needs to run on non-Linux Unixes, setuid root is what it will bneed to be to be able
            // to do chroot().
            if (setuid(getuid()) != 0)
            {
                Log::error("Error: setuid() failed.");
            }
        }
#if ENABLE_DEBUG
        if (geteuid() == 0 && getuid() == 0)
        {
#ifdef __linux
            // Argh, awful hack
            if (capability == CAP_FOWNER)
                return;
#endif

            // Running under sudo, probably because being debugged? Let's drop super-user rights.
            LOOLWSD::runningAsRoot = true;
            if (LOOLWSD::uid == 0)
            {
                struct passwd *nobody = getpwnam("nobody");
                if (nobody)
                    LOOLWSD::uid = nobody->pw_uid;
                else
                    LOOLWSD::uid = 65534;
            }
            if (setuid(LOOLWSD::uid) != 0)
            {
                Log::error("Error: setuid() failed.");
            }
        }
#endif
    }
}

class PipeRunnable: public Runnable
{
public:
    PipeRunnable()
    {
        _pStart = _pEnd = nullptr;
    }

    ssize_t getResponseLine(int nPipeReader, std::string& aLine)
    {
        ssize_t nBytes = -1;
        aLine.clear();

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

        return nBytes;
    }

    ssize_t sendMessage(int nPipeWriter, const std::string& aMessage)
    {
        ssize_t nBytes = -1;

        nBytes = Util::writeFIFO(nPipeWriter, aMessage.c_str(), aMessage.length());
        if ( nBytes < 0 )
            Log::error("Error writting to child pipe.");

        return nBytes;
    }

    ssize_t createThread(Process::PID nPID, const std::string& aTID)
    {
        std::string aResponse;
        std::string aMessage = "thread " + aTID + "\r\n";
        return sendMessage(_childProcesses[nPID], aMessage);
    }

    ssize_t updateURL(Process::PID nPID, const std::string& aURL)
    {
        std::string aMessage = "url " + aURL + "\r\n";
        return sendMessage(_childProcesses[nPID], aMessage);
    }

    Process::PID searchURL(const std::string& aURL)
    {
        ssize_t nBytes = -1;
        Process::PID nPID = 0;
        std::string aResponse;
        std::string aMessage = "search " + aURL + "\r\n";

        auto aIterator = _childProcesses.begin();
        for ( ; aIterator!=_childProcesses.end(); ++aIterator)
        {
            if ( !(aIterator->first > 0 && aIterator->second > 0) )
            {
                //Log::error("error iterator " + aIterator->second + " " + aMessage);
                continue;
            }

            nBytes = Util::writeFIFO(aIterator->second, aMessage.c_str(), aMessage.length());
            if ( nBytes < 0 )
            {
                Log::error("Error writting to child pipe: " + std::to_string(aIterator->first) + ".");
                break;
            }

            nBytes = getResponseLine(readerChild, aResponse);
            if ( nBytes < 0 )
            {
                Log::error("Error reading child response: " + std::to_string(aIterator->first) + ".");
                break;
            }

            //Log::trace("response: " << aResponse);
            StringTokenizer tokens(aResponse, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            if (tokens[1] == "ok")
            {
                nPID = aIterator->first;
            }
            else if (tokens[1] == "empty")
            {
                _emptyURL.push_back(aIterator->first);
            }
        }

        if ( aIterator != _childProcesses.end() )
        {
            _cacheURL.clear();
            _emptyURL.clear();
        }

        return (nBytes > 0 ? nPID : -1);
    }

    void handleInput(const std::string& aMessage)
    {
        Process::PID nPID;

        StringTokenizer tokens(aMessage, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        if (tokens[0] == "request" && tokens.count() == 3)
        {
            const std::string aTID = tokens[1];
            const std::string aURL = tokens[2];

            Log::info("Finding kit for URL [" + aURL + "] on thread [" + aTID + "].");

            // check cache
            const auto aIterURL = _cacheURL.find(aURL);
            if ( aIterURL != _cacheURL.end() )
            {
                Log::debug("Cache found URL [" + aURL + "] hosted on child [" + std::to_string(aIterURL->second) +
                           "]. Creating view for thread [" + aTID + "].");
                if (createThread(aIterURL->second, aTID) < 0)
                    Log::error("Cache: Error creating thread.");

                return;
            }

            // not found in cache, full search.
            nPID = searchURL(aURL);
            if ( nPID < 0)
                return;

            if ( nPID > 0 )
            {
                Log::debug("Search found URL [" + aURL + "] hosted by child [" + std::to_string(nPID) +
                           "]. Creating view for thread [" + aTID + "].");
                if (createThread(nPID, aTID) < 0)
                    Log::error("Search: Error creating thread.");
                else
                    _cacheURL[aURL] = nPID;

                return;
            }

            // not found, new URL session.
            if ( _emptyURL.size() > 0 )
            {
                const auto aItem = _emptyURL.front();
                Log::trace("No child found for URL [" + aURL + "].");
                if (updateURL(aItem, aURL) < 0)
                {
                    Log::error("New: Error update URL.");
                    return;
                }

                if (createThread(aItem, aTID) < 0)
                {
                    Log::error("New: Error creating thread.");
                    return;
                }
                _emptyURL.pop_front();
                _cacheURL[aURL] = aItem;
            }

            /*if (_emptyURL.size() == 0 )
            {
                Log::info("No available childs, fork new one");
                forkCounter++;
            }*/
        }
    }

    void run() override
    {
        std::string aMessage;
        char  aBuffer[1024*2];
        char* pStart;
        char* pEnd;

        struct pollfd aPoll;
        ssize_t nBytes = -1;

        aPoll.fd = readerBroker;
        aPoll.events = POLLIN;
        aPoll.revents = 0;

        pStart = aBuffer;
        pEnd   = aBuffer;

        static const std::string thread_name = "broker_pipe_reader";
#ifdef __linux
        if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(thread_name.c_str()), 0, 0, 0) != 0)
            Log::error("Cannot set thread name to " + thread_name + ".");
#endif
        Log::debug("Thread [" + thread_name + "] started.");

        while (true)
        {
            if ( pStart == pEnd )
            {
                (void)poll(&aPoll,1,-1);

                if (poll(&aPoll, 1, -1) < 0)
                {
                    Log::error("Failed to poll pipe [" + FIFO_FILE + "].");
                    continue;
                }
                else
                if (aPoll.revents & POLLIN)
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
                    Log::error("Broken pipe [" + FIFO_FILE + "] with broker.");
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

                    forkMutex.lock();
                    handleInput(aMessage);
                    aMessage.clear();
                    forkMutex.unlock();
                }
            }
        }

        Log::debug("Thread [" + thread_name + "] finished.");
    }

private:
    char* _pStart;
    char* _pEnd;
    char  _aBuffer[1024];
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
        Log::warn("Failed to load " + std::string(LIB_SOFFICEAPP) + " library.");
        return false;
    }

    preInit = (LokHookPreInit *)dlsym(handle, "lok_preinit");
    if (!preInit)
    {
        Log::warn("Failed to find lok_preinit hook in " + std::string(LIB_SOFFICEAPP) + " library.");
        return false;
    }

    return preInit(("/" + loSubPath + "/program").c_str(), "file:///user") == 0;
}

static int createLibreOfficeKit(bool sharePages, std::string loSubPath, Poco::UInt64 childID)
{
    Poco::UInt64 child;
    int nFIFOWriter = -1;

    if (sharePages)
    {
        Log::debug("Forking LibreOfficeKit.");

        Poco::UInt64 pid;
        if (!(pid = fork()))
        {
            // child
            run_lok_main(loSubPath, childID, "");
            _exit(0);
        }
        else
        {
            // parent
            child = pid; // (somehow - switch the hash to use real pids or ?) ...
        }
    }
    else
    {
        Process::Args args;
        const std::string executable = "loolkit";
        const std::string pipe = BROKER_PREFIX + std::to_string(childCounter++) + BROKER_SUFIX;

        if (mkfifo(pipe.c_str(), 0666) < 0)
        {
            Log::error("Error: mkfifo failed.");
            return -1;
        }

        args.push_back("--losubpath=" + loSubPath);
        args.push_back("--child=" + std::to_string(childID));
        args.push_back("--pipe=" + pipe);

        Log::info("Launching LibreOfficeKit: " + executable + " " +
                  Poco::cat(std::string(" "), args.begin(), args.end()));

        ProcessHandle procChild = Process::launch(executable, args);
        child = procChild.id();
        Log::info("Launched kit process: " + std::to_string(child));

        if ( ( nFIFOWriter = open(pipe.c_str(), O_WRONLY) ) < 0 )
        {
            Log::error("Error: failed to open pipe [" + pipe + "] write only.");
            return -1;
        }
    }

    _childProcesses[child] = nFIFOWriter;
    return child;
}

static int startupLibreOfficeKit(bool sharePages, int nLOKits,
                                  std::string loSubPath, Poco::UInt64 child)
{
    Process::PID pId = -1;

    Log::info() << "Starting " << nLOKits << " LoKit instaces."
                << " Shared: " << (sharePages ? "true" : "false")
                << ", loSubPath: " << loSubPath
                << ", child: " << child << Log::end;
    for (int nCntr = nLOKits; nCntr; nCntr--)
    {
        if ( (pId = createLibreOfficeKit(sharePages, loSubPath, child)) < 0)
        {
            Log::error("Error: failed to create LibreOfficeKit.");
            break;
        }
    }

    return pId;
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

    std::string childRoot;
    std::string loSubPath;
    std::string sysTemplate;
    std::string loTemplate;
    int _numPreSpawnedChildren = 0;

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
        else if (strstr(cmd, "--numprespawns=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                _numPreSpawnedChildren = std::stoi(std::string(++eq));
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

    if ( !_numPreSpawnedChildren )
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
        Log::error(std::string("Exception: ") + exc.what());
    }

    try
    {
        Poco::Environment::get("LOK_VIEW_CALLBACK");
    }
    catch (const Poco::NotFoundException& exc)
    {
        Log::error(std::string("Exception: ") + exc.what());
    }

    const Poco::UInt64 _childId = Util::rng::getNext();

    Path jailPath = Path::forDirectory(childRoot + Path::separator() + std::to_string(_childId));
    File(jailPath).createDirectories();

    Path jailLOInstallation(jailPath, loSubPath);
    jailLOInstallation.makeDirectory();
    File(jailLOInstallation).createDirectory();

    // Copy (link) LO installation and other necessary files into it from the template

    linkOrCopy(sysTemplate, jailPath);
    linkOrCopy(loTemplate, jailLOInstallation);

    // It is necessary to deploy loolkit process to chroot jail.
    if (!File("loolkit").exists())
    {
        Log::error("loolkit does not exists");
        exit(-1);
    }
    File("loolkit").copyTo(Path(jailPath, "/usr/bin").toString());

    // We need this because sometimes the hostname is not resolved
    std::vector<std::string> networkFiles = {"/etc/host.conf", "/etc/hosts", "/etc/nsswitch.conf", "/etc/resolv.conf"};
    for (std::vector<std::string>::iterator it = networkFiles.begin(); it != networkFiles.end(); ++it)
    {
       File networkFile(*it);
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

    bool sharePages = globalPreinit(loSubPath);

    if ( startupLibreOfficeKit(sharePages, _numPreSpawnedChildren, loSubPath, _childId) < 0 )
    {
        Log::error("Error: failed to create children.");
        exit(-1);
    }

    if ( (readerChild = open(FIFO_BROKER.c_str(), O_RDONLY) ) < 0 )
    {
        Log::error("Error: pipe opened for reading.");
        exit(-1);
    }

    PipeRunnable pipeHandler;
    Poco::Thread aPipe;

    aPipe.start(pipeHandler);

    Log::info("loolbroker ready!");

    while (_childProcesses.size() > 0)
    {
        int status;
        pid_t pid = waitpid(-1, &status, WUNTRACED | WNOHANG);
        if (pid > 0)
        {
            if ( _childProcesses.find(pid) != _childProcesses.end() )
            {
                if ((WIFEXITED(status) || WIFSIGNALED(status) || WTERMSIG(status) ) )
                {
                    Log::error("Child [" + std::to_string(pid) + "] processes died.");
                    forkMutex.lock();
                    _childProcesses.erase(pid);
                    _cacheURL.clear();
                    _emptyURL.clear();
                    forkMutex.unlock();
                }

                if ( WCOREDUMP(status) )
                    Log::error("Child [" + std::to_string(pid) + "] produced a core dump.");

                if ( WIFSTOPPED(status) )
                    Log::error("Child [" + std::to_string(pid) + "] process was stopped by delivery of a signal.");

                if ( WSTOPSIG(status) )
                    Log::error("Child [" + std::to_string(pid) + "] process was stopped.");

                if ( WIFCONTINUED(status) )
                    Log::error("Child [" + std::to_string(pid) + "] process was resumed.");
            }
            else
            {
                Log::error("None of our known child processes died. PID: " + std::to_string(pid));
            }
        }
        else if (pid < 0)
            Log::error("Error: Child error.");

        if ( forkCounter > 0 )
        {
            forkMutex.lock();
            forkCounter -= 1;

            if (createLibreOfficeKit(sharePages, loSubPath, _childId) < 0 )
                Log::error("Error: fork falied.");

            forkMutex.unlock();
        }

        ++timeoutCounter;
        if (timeoutCounter == INTERVAL_PROBES)
        {
            timeoutCounter = 0;
            sleep(MAINTENANCE_INTERVAL);
        }
    }

    // Terminate child processes
    for (auto i : _childProcesses)
    {
        Log::info("Requesting child process " + std::to_string(i.first) + " to terminate.");
        Process::requestTermination(i.first);
    }

    Log::info("loolbroker finished OK!");
    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
