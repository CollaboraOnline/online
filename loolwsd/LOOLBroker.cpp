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
                std::cout << Util::logPrefix() +
                                                       "link(\"" + fpath + "\",\"" + newPath.toString() + "\") failed: " +
                                                       strerror(errno) << std::endl;
                exit(1);
            }
            break;
        case FTW_DP:
            {
                struct stat st;
                if (stat(fpath, &st) == -1)
                {
                    std::cout << Util::logPrefix() +
                                                           "stat(\"" + fpath + "\") failed: " +
                                                           strerror(errno) << std::endl;
                    return 1;
                }
                File(newPath).createDirectories();
                struct utimbuf ut;
                ut.actime = st.st_atime;
                ut.modtime = st.st_mtime;
                if (utime(newPath.toString().c_str(), &ut) == -1)
                {
                    std::cout << Util::logPrefix() +
                                                           "utime(\"" + newPath.toString() + "\", &ut) failed: " +
                                                           strerror(errno) << std::endl;
                    return 1;
                }
            }
            break;
        case FTW_DNR:
            std::cout <<Util::logPrefix() +
                                                   "Cannot read directory '" + fpath + "'" << std::endl;
            return 1;
        case FTW_NS:
            std::cout <<Util::logPrefix() +
                                                   "nftw: stat failed for '" + fpath + "'" << std::endl;
            return 1;
        case FTW_SLN:
            std::cout <<Util::logPrefix() +
                                                         "nftw: symlink to nonexistent file: '" + fpath + "', ignored" << std::endl;
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
            std::cout << Util::logPrefix() +
                                                   "linkOrCopy: nftw() failed for '" + source + "'" << std::endl;
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
        if (caps == NULL)
        {
            std::cout << Util::logPrefix() + "cap_get_proc() failed: " + strerror(errno) << std::endl;
            exit(1);
        }

        if (cap_set_flag(caps, CAP_EFFECTIVE, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1 ||
            cap_set_flag(caps, CAP_PERMITTED, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1)
        {
            std::cout << Util::logPrefix() +  "cap_set_flag() failed: " + strerror(errno) << std::endl;
            exit(1);
        }

        if (cap_set_proc(caps) == -1)
        {
            std::cout << Util::logPrefix() << std::string("cap_set_proc() failed: ") + strerror(errno) << std::endl;
            exit(1);
        }

        char *capText = cap_to_text(caps, NULL);
        std::cout << Util::logPrefix() + "Capabilities now: " + capText << std::endl;
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
                std::cout << Util::logPrefix() << std::string("setuid() failed: ") + strerror(errno) << std::endl;
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
                Log::error(std::string("setuid() failed: ") + strerror(errno));
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
                    _pStart = _pEnd = NULL;
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
            std::cout << Util::logPrefix() << "Error writting child: " << strerror(errno) << std::endl;

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
        std::string aResponse;
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
                //std::cout << Util::logPrefix() << "error iterator " << aIterator->second << " " << aMessage << std::endl;
                continue;
            }

            nBytes = Util::writeFIFO(aIterator->second, aMessage.c_str(), aMessage.length());
            if ( nBytes < 0 )
            {
                std::cout << Util::logPrefix() << "Error writting child: " << aIterator->first << " " << strerror(errno) << std::endl;
                break;
            }

            nBytes = getResponseLine(readerChild, aResponse);
            if ( nBytes < 0 )
            {
                std::cout << Util::logPrefix() << "Error reading child: " << aIterator->first << " " << strerror(errno) << std::endl;
                break;
            }

            //std::cout << Util::logPrefix() << "response: " << aResponse << std::endl;
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
            std::string aTID = tokens[1];
            std::string aURL = tokens[2];

            // check cache
            auto aIterURL = _cacheURL.find(aURL);
            if ( aIterURL != _cacheURL.end() )
            {
                std::cout << Util::logPrefix() << "Cache Found: " << aIterURL->first << std::endl;
                if (createThread(aIterURL->second, aTID) < 0)
                    std::cout << Util::logPrefix() << "Cache: Error creating thread: " << strerror(errno) << std::endl;

                return;
            }

            // not found in cache, full search.
            nPID = searchURL(aURL);
            if ( nPID < 0)
                return;

            if ( nPID > 0 )
            {
                std::cout << Util::logPrefix() << "Search Found: " << nPID << std::endl;
                if (createThread(nPID, aTID) < 0)
                    std::cout << Util::logPrefix() << "Search: Error creating thread: " << strerror(errno) << std::endl;
                else
                    _cacheURL[aURL] = nPID;

                return;
            }

            // not found, new URL session.
            if ( _emptyURL.size() > 0 )
            {
                auto aItem = _emptyURL.front();
                std::cout << Util::logPrefix() << "Not Found: " << aItem << std::endl;
                if (updateURL(aItem, aURL) < 0)
                {
                    std::cout << Util::logPrefix() << "New: Error update URL: " << strerror(errno) << std::endl;
                    return;
                }

                if (createThread(aItem, aTID) < 0)
                {
                    std::cout << Util::logPrefix() << "New: Error creating thread: " << strerror(errno) << std::endl;
                    return;
                }
                _emptyURL.pop_front();
                _cacheURL[aURL] = aItem;
            }

            /*if (_emptyURL.size() == 0 )
            {
                std::cout << Util::logPrefix() << "No available childs, fork new one" << std::endl;
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

#ifdef __linux
        if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>("pipe_reader"), 0, 0, 0) != 0)
            std::cout << Util::logPrefix() << "Cannot set thread name :" << strerror(errno) << std::endl;
#endif

        while (true)
        {
            if ( pStart == pEnd )
            {
                (void)poll(&aPoll,1,-1);

                if( (aPoll.revents & POLLIN) != 0 )
                {
                    nBytes = Util::readFIFO(readerBroker, aBuffer, sizeof(aBuffer));
                    if (nBytes < 0)
                    {
                        pStart = pEnd = NULL;
                        std::cout << Util::logPrefix() << "Error reading message :" << strerror(errno) << std::endl;
                        continue;
                    }
                    pStart = aBuffer;
                    pEnd   = aBuffer + nBytes;
                    std::cout << Util::logPrefix() << "Broker readFIFO [" << std::string(pStart, nBytes) << "]" << std::endl;
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
        std::cout << Util::logPrefix() << " Failed to load library :" << LIB_SOFFICEAPP << std::endl;
        return false;
    }

    preInit = (LokHookPreInit *)dlsym(handle, "lok_preinit");
    if (!preInit)
    {
        std::cout << Util::logPrefix() << " Failed to find lok_preinit hook in library :" << LIB_SOFFICEAPP << std::endl;
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
        Poco::UInt64 pid;

        std::cout << Util::logPrefix() + "Forking LibreOfficeKit" << std::endl;

        if (!(pid = fork()))
        { // child
            run_lok_main(loSubPath, childID, "");
            _exit(0);
        }
        else
        { // parent
            child = pid; // (somehow - switch the hash to use real pids or ?) ...
        }
    }
    else
    {
        Process::Args args;
        std::string executable = "loolkit";
        std::string pipe = BROKER_PREFIX + std::to_string(childCounter++) + BROKER_SUFIX;

        if (mkfifo(pipe.c_str(), 0666) < 0)
        {
            std::cout << Util::logPrefix() << "mkfifo :" << strerror(errno) << std::endl;
            return -1;
        }

        args.push_back("--losubpath=" + loSubPath);
        args.push_back("--child=" + std::to_string(childID));
        args.push_back("--pipe=" + pipe);

        std::cout << Util::logPrefix() + "Launching LibreOfficeKit: " + executable + " " + Poco::cat(std::string(" "), args.begin(), args.end()) << std::endl;

        ProcessHandle procChild = Process::launch(executable, args);
        child = procChild.id();
        std::cout << Util::logPrefix() << "Launched kit process: " << child << std::endl;

        if ( ( nFIFOWriter = open(pipe.c_str(), O_WRONLY) ) < 0 )
        {
            std::cout << Util::logPrefix() << "open: " << strerror(errno) << std::endl;
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

    std::cout << Util::logPrefix() << "starting " << nLOKits << " LoKit instaces."
              << " Shared: " << sharePages << ", loSubPath: " << loSubPath
              << ", child: " << child << std::endl;
    for (int nCntr = nLOKits; nCntr; nCntr--)
    {
        if ( (pId = createLibreOfficeKit(sharePages, loSubPath, child)) < 0)
        {
            std::cout << Util::logPrefix() << "startupLibreOfficeKit: " << strerror(errno) << std::endl;
            break;
        }
    }

    return pId;
}

// Broker process
int main(int argc, char** argv)
{
    // Initialization
    std::string childRoot;
    std::string loSubPath;
    std::string sysTemplate;
    std::string loTemplate;
    int _numPreSpawnedChildren = 0;

    Log::initialize("brk");

    for (int i = 0; i < argc; ++i)
    {
        char *cmd = argv[i];
        char *eq  = NULL;
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
        std::cout << Util::logPrefix() << "--losubpath is empty" << std::endl;
        exit(-1);
    }

    if (sysTemplate.empty())
    {
        std::cout << Util::logPrefix() << "--systemplate is empty" << std::endl;
        exit(-1);
    }

    if (loTemplate.empty())
    {
        std::cout << Util::logPrefix() << "--lotemplate is empty" << std::endl;
        exit(-1);
    }

    if (childRoot.empty())
    {
        std::cout << Util::logPrefix() << "--childroot is empty" << std::endl;
        exit(-1);
    }

    if ( !_numPreSpawnedChildren )
    {
        std::cout << Util::logPrefix() << "--numprespawns is 0" << std::endl;
        exit(-1);
    }

    if ( (readerBroker = open(FIFO_FILE.c_str(), O_RDONLY) ) < 0 )
    {
        std::cout << Util::logPrefix() << "pipe error: " << strerror(errno) << std::endl;
        exit(-1);
    }

    try
    {
        Poco::Environment::get("LD_BIND_NOW");
    }
    catch (const Poco::NotFoundException& ex)
    {
        Log::error(std::string("Exception: ") + ex.what());
    }

    try
    {
        Poco::Environment::get("LOK_VIEW_CALLBACK");
    }
    catch (const Poco::NotFoundException& ex)
    {
        Log::error(std::string("Exception: ") + ex.what());
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
        std::cout << Util::logPrefix() << "loolkit does not exists" << std::endl;
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
        std::cout << Util::logPrefix() +
            "mknod(" + jailPath.toString() + "/dev/random) failed: " +
            strerror(errno) << std::endl;

    }
    if (mknod((jailPath.toString() + "/dev/urandom").c_str(),
              S_IFCHR | S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH,
              makedev(1, 9)) != 0)
    {
        std::cout << Util::logPrefix() +
            "mknod(" + jailPath.toString() + "/dev/urandom) failed: " +
            strerror(errno) << std::endl;
    }
#endif

    std::cout << Util::logPrefix() << "loolbroker -> chroot(\"" + jailPath.toString() + "\")" << std::endl;
    if (chroot(jailPath.toString().c_str()) == -1)
    {
        std::cout << Util::logPrefix() << "chroot(\"" + jailPath.toString() + "\") failed: " + strerror(errno) << std::endl;
        exit(-1);
    }

    if (chdir("/") == -1)
    {
        std::cout << Util::logPrefix() << std::string("chdir(\"/\") in jail failed: ") + strerror(errno) << std::endl;
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
        std::cout << Util::logPrefix() << "Fail to create pipe FIFO " << strerror(errno) << std::endl;
        exit(-1);
    }

    bool sharePages = globalPreinit(loSubPath);

    if ( startupLibreOfficeKit(sharePages, _numPreSpawnedChildren, loSubPath, _childId) < 0 )
    {
        std::cout << Util::logPrefix() << "fail to create childs: " << strerror(errno) << std::endl;
        exit(-1);
    }

    if ( (readerChild = open(FIFO_BROKER.c_str(), O_RDONLY) ) < 0 )
    {
        std::cout << Util::logPrefix() << "pipe opened for reading: " << strerror(errno) << std::endl;
        exit(-1);
    }

    PipeRunnable pipeHandler;
    Poco::Thread aPipe;

    aPipe.start(pipeHandler);

    std::cout << Util::logPrefix() << "loolwsd ready!" << std::endl;

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
                    forkMutex.lock();
                    std::cout << Util::logPrefix() << "One of our known child processes died :" << std::to_string(pid)  << std::endl;
                    _childProcesses.erase(pid);
                    _cacheURL.clear();
                    _emptyURL.clear();
                    forkMutex.unlock();
                }

                if ( WCOREDUMP(status) )
                    std::cout << Util::logPrefix() << "The child produced a core dump." << std::endl;

                if ( WIFSTOPPED(status) )
                    std::cout << Util::logPrefix() << "The child process was stopped by delivery of a signal." << std::endl;

                if ( WSTOPSIG(status) )
                    std::cout << Util::logPrefix() << "The child process was stopped." << std::endl;

                if ( WIFCONTINUED(status) )
                    std::cout << Util::logPrefix() << "The child process was resumed." << std::endl;
            }
            else
            {
                std::cout << Util::logPrefix() << "None of our known child processes died :" << std::to_string(pid) << std::endl;
            }
        }
        else if (pid < 0)
            std::cout << Util::logPrefix() << "Child error: " << strerror(errno) << std::endl;

        if ( forkCounter > 0 )
        {
            forkMutex.lock();
            forkCounter -= 1;

            if (createLibreOfficeKit(sharePages, loSubPath, _childId) < 0 )
                std::cout << Util::logPrefix() << "fork falied: " << strerror(errno) << std::endl;

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
        std::cout << Util::logPrefix() + "Requesting child process " + std::to_string(i.first) + " to terminate" << std::endl;
        Process::requestTermination(i.first);
    }

    std::cout << Util::logPrefix() << "loolbroker finished OK!" << std::endl;
    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
