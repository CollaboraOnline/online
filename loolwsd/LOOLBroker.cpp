/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <sys/wait.h>

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

typedef int (LokHookPreInit)  ( const char *install_path, const char *user_profile_path );

using Poco::ProcessHandle;

const std::string FIFO_LOOLWSD = "loolwsdfifo";
const std::string BROKER_SUFIX = ".fifo";
const std::string BROKER_PREFIX = "lokit";

static int readerChild = -1;
static int readerBroker = -1;

static std::string loolkitPath;
static std::atomic<unsigned> forkCounter;
static std::chrono::steady_clock::time_point lastMaintenanceTime = std::chrono::steady_clock::now();
static unsigned int childCounter = 0;
static signed numPreSpawnedChildren = 0;

static std::recursive_mutex forkMutex;

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

    /// Safely removes a child process.
    void removeChild(const Process::PID pid)
    {
        std::lock_guard<std::recursive_mutex> lock(forkMutex);
        const auto it = _childProcesses.find(pid);
        if (it != _childProcesses.end())
        {
            // Close the child resources.
            it->second->close();
            _childProcesses.erase(it);
        }
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

    /// Sync ChildProcess instances with its child.
    /// Returns the number of empty childs.
    size_t syncChilds()
    {
        std::lock_guard<std::recursive_mutex> lock(forkMutex);

        Log::trace("Synching Childs.");
        size_t empty_count = 0;
        for (auto it = _childProcesses.begin(); it != _childProcesses.end(); )
        {
            const auto aMessage = "query url \r\n";
            std::string aResponse;
            if (Util::writeFIFO(it->second->getWritePipe(), aMessage) < 0 ||
                getResponseLine(readerChild, aResponse) < 0)
            {
                auto log = Log::error();
                log << "Error querying child [" << std::to_string(it->second->getPid()) << "].";
                if (it->second->getUrl().empty())
                {
                    log << " Removing empty child." << Log::end;
                    it = _childProcesses.erase(it);
                }
                else
                {
                    ++it;
                }
                continue;
            }

            StringTokenizer tokens(aResponse, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            if (tokens.count() == 2 && tokens[0] == std::to_string(it->second->getPid()))
            {
                Log::debug("Child [" + std::to_string(it->second->getPid()) + "] hosts [" + tokens[1] + "].");
                if (tokens[1] == "empty")
                {
                    it->second->setUrl("");
                    ++empty_count;
                }
                else
                {
                    it->second->setUrl(tokens[1]);
                }
            }
            else
            {
                Log::error("Unexpected response from child [" + std::to_string(it->second->getPid()) +
                           "] to query: [" + tokens[1] + "].");
            }

            ++it;
        }

        return empty_count;
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
                    Log::debug("URL [" + aURL + "] is not hosted. Using empty child [" + std::to_string(child->getPid()) + "].");

                if (!createThread(child->getPid(), aTID, aURL))
                {
                    Log::error("Error creating thread [" + aTID + "] for URL [" + aURL + "].");
                }

                child->setUrl(aURL);
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
                    Log::error("Failed to poll pipe [" + FIFO_LOOLWSD + "].");
                    continue;
                }
                else
                if (aPoll.revents & (POLLIN | POLLPRI))
                {
                    nBytes = Util::readFIFO(readerBroker, aBuffer, sizeof(aBuffer));
                    if (nBytes < 0)
                    {
                        pStart = pEnd = nullptr;
                        Log::error("Error reading message from pipe [" + FIFO_LOOLWSD + "].");
                        continue;
                    }
                    pStart = aBuffer;
                    pEnd   = aBuffer + nBytes;
                }
                else
                if (aPoll.revents & (POLLERR | POLLHUP))
                {
                    Log::error("Broken pipe [" + FIFO_LOOLWSD + "] with wsd.");
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
                        syncChilds();
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
static bool globalPreinit(const std::string &loTemplate)
{
    void *handle;
    LokHookPreInit* preInit;

    std::string libSofficeapp = loTemplate + "/program/" LIB_SOFFICEAPP;
    std::string loadedLibrary;
    if (File(libSofficeapp).exists())
    {
        handle = dlopen(libSofficeapp.c_str(), RTLD_GLOBAL|RTLD_NOW);
        if (!handle)
        {
            Log::warn("Failed to load " + libSofficeapp + ": " + std::string(dlerror()));
            return false;
        }
        loadedLibrary = libSofficeapp;
    }
    else
    {
        std::string libMerged = loTemplate + "/program/" LIB_MERGED;
        if (File(libMerged).exists())
        {
            handle = dlopen(libMerged.c_str(), RTLD_GLOBAL|RTLD_NOW);
            if (!handle)
            {
                Log::warn("Failed to load " + libMerged + ": " + std::string(dlerror()));
                return false;
            }
            loadedLibrary = libMerged;
        }
        else
        {
            Log::warn("Neither " + libSofficeapp + " or " + libMerged + " exist.");
            return false;
        }
    }

    preInit = (LokHookPreInit *)dlsym(handle, "lok_preinit");
    if (!preInit)
    {
        Log::warn("Note: No lok_preinit hook in " + loadedLibrary);
        return false;
    }

    return preInit((loTemplate + "/program").c_str(), "file:///user") == 0;
}

static int createLibreOfficeKit(const bool sharePages,
                                const std::string& childRoot,
                                const std::string& sysTemplate,
                                const std::string& loTemplate,
                                const std::string& loSubPath)
{
    Poco::UInt64 childPID;
    int nFIFOWriter = -1;
    int nFlags = O_WRONLY | O_NONBLOCK;

    const Path pipePath = Path::forDirectory(childRoot + Path::separator() + FIFO_PATH);
    const std::string pipeKit = Path(pipePath, BROKER_PREFIX + std::to_string(childCounter++) + BROKER_SUFIX).toString();

    if (mkfifo(pipeKit.c_str(), 0666) < 0)
    {
        Log::error("Error: Failed to create pipe FIFO [" + pipeKit + "].");
        return -1;
    }

    if (sharePages)
    {
        Log::debug("Forking LibreOfficeKit.");

        Poco::UInt64 pid;
        if (!(pid = fork()))
        {
            // child
            lokit_main(childRoot, sysTemplate, loTemplate, loSubPath, pipeKit);
            _exit(Application::EXIT_OK);
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
        args.push_back("--childroot=" + childRoot);
        args.push_back("--systemplate=" + sysTemplate);
        args.push_back("--lotemplate=" + loTemplate);
        args.push_back("--losubpath=" + loSubPath);
        args.push_back("--pipe=" + pipeKit);
        args.push_back("--clientport=" + std::to_string(ClientPortNumber));

        Log::info("Launching LibreOfficeKit #" + std::to_string(childCounter) +
                  ": " + loolkitPath + " " +
                  Poco::cat(std::string(" "), args.begin(), args.end()));

        ProcessHandle procChild = Process::launch(loolkitPath, args);
        childPID = procChild.id();
        Log::info("Spawned kit [" + std::to_string(childPID) + "].");

        if (!Process::isRunning(procChild))
        {
            // This can happen if we fail to copy it, or bad chroot etc.
            Log::error("Error: loolkit [" + std::to_string(childPID) + "] was stillborn.");
            return -1;
        }
    }

    // open non-blocking to make sure that a broken lokit process will not
    // block the loolbroker forever
    {
        short nRetries = 5;
        std::mutex aFIFOMutex;
        std::condition_variable aFIFOCV;
        std::unique_lock<std::mutex> lock(aFIFOMutex);

        while(nRetries && nFIFOWriter < 0)
        {
            aFIFOCV.wait_for(
                lock,
                std::chrono::microseconds(80000),
                [&nFIFOWriter, &pipeKit, nFlags]
                {
                    return (nFIFOWriter = open(pipeKit.c_str(), nFlags)) >= 0;
                });

            if (nFIFOWriter < 0)
            {
                Log::debug("Retrying to establish pipe connection: " + std::to_string(nRetries));
            }

            --nRetries;
        }
    }

    if (nFIFOWriter < 0)
    {
        Log::error("Error: failed to open write pipe [" + pipeKit + "] with kit. Abandoning child.");
        ChildProcess(childPID, -1, -1);
        return -1;
    }

    if ((nFlags = fcntl(nFIFOWriter, F_GETFL, 0)) < 0)
    {
        Log::error("Error: failed to get pipe flags [" + pipeKit + "].");
        ChildProcess(childPID, -1, -1);
        return -1;
    }

    nFlags &= ~O_NONBLOCK;
    if (fcntl(nFIFOWriter, F_SETFL, nFlags) < 0)
    {
        Log::error("Error: failed to set pipe flags [" + pipeKit + "].");
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

    Util::setTerminationSignals();
    Util::setFatalSignals();

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

    loolkitPath = Poco::Path(argv[0]).parent().toString() + "loolkit";

    if (loSubPath.empty())
    {
        Log::error("Error: --losubpath is empty");
        exit(Application::EXIT_SOFTWARE);
    }

    if (sysTemplate.empty())
    {
        Log::error("Error: --systemplate is empty");
        exit(Application::EXIT_SOFTWARE);
    }

    if (loTemplate.empty())
    {
        Log::error("Error: --lotemplate is empty");
        exit(Application::EXIT_SOFTWARE);
    }

    if (childRoot.empty())
    {
        Log::error("Error: --childroot is empty");
        exit(Application::EXIT_SOFTWARE);
    }

    if (numPreSpawnedChildren < 1)
    {
        Log::error("Error: --numprespawns is 0");
        exit(Application::EXIT_SOFTWARE);
    }

    const Path pipePath = Path::forDirectory(childRoot + Path::separator() + FIFO_PATH);
    const std::string pipeLoolwsd = Path(pipePath, FIFO_LOOLWSD).toString();
    if ( (readerBroker = open(pipeLoolwsd.c_str(), O_RDONLY) ) < 0 )
    {
        Log::error("Error: failed to open pipe [" + pipeLoolwsd + "] read only. Exiting.");
        exit(Application::EXIT_SOFTWARE);
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

    int nFlags = O_RDONLY | O_NONBLOCK;
    const std::string pipeBroker = Path(pipePath, FIFO_BROKER).toString();
    if (mkfifo(pipeBroker.c_str(), 0666) == -1)
    {
        Log::error("Error: Failed to create pipe FIFO [" + FIFO_BROKER + "].");
        exit(Application::EXIT_SOFTWARE);
    }

    if ((readerChild = open(pipeBroker.c_str(), nFlags) ) < 0)
    {
        Log::error("Error: pipe opened for reading.");
        exit(Application::EXIT_SOFTWARE);
    }

    if ((nFlags = fcntl(readerChild, F_GETFL, 0)) < 0)
    {
        Log::error("Error: failed to get pipe flags [" + FIFO_BROKER + "].");
        exit(Application::EXIT_SOFTWARE);
    }

    nFlags &= ~O_NONBLOCK;
    if (fcntl(readerChild, F_SETFL, nFlags) < 0)
    {
        Log::error("Error: failed to set pipe flags [" + FIFO_BROKER + "].");
        exit(Application::EXIT_SOFTWARE);
    }

    // Initialize LoKit and hope we can fork and save memory by sharing pages.
    const bool sharePages = std::getenv("LOK_PREINIT") != nullptr
                          ? globalPreinit(loTemplate)
                          : std::getenv("LOK_FORK") != nullptr;

    if (!sharePages)
        Log::warn("Cannot fork, will spawn instead.");

    // We must have at least one child, more is created dynamically.
    if (createLibreOfficeKit(sharePages, childRoot, sysTemplate,
                             loTemplate, loSubPath) < 0)
    {
        Log::error("Error: failed to create children.");
        exit(Application::EXIT_SOFTWARE);
    }

    if (numPreSpawnedChildren > 1)
        forkCounter = numPreSpawnedChildren - 1;

    if (!sharePages)
    {
#ifdef __linux
        dropCapability(CAP_SYS_CHROOT);
        dropCapability(CAP_MKNOD);
        dropCapability(CAP_FOWNER);
#else
        dropCapability();
#endif
    }

    PipeRunnable pipeHandler;
    Poco::Thread aPipe;

    aPipe.start(pipeHandler);

    Log::info("loolbroker is ready.");

    int nChildExitCode = Application::EXIT_OK;
    unsigned timeoutCounter = 0;
    while (!TerminationFlag)
    {
        int status;
        const pid_t pid = waitpid(-1, &status, WUNTRACED | WNOHANG);
        if (pid > 0)
        {
            if (WIFEXITED(status))
            {
                nChildExitCode = Util::getChildStatus(WEXITSTATUS(status));
                Log::info() << "Child process [" << pid << "] exited with code: "
                            << WEXITSTATUS(status) << "." << Log::end;

                removeChild(pid);
            }
            else
            if (WIFSIGNALED(status))
            {
                nChildExitCode = Util::getSignalStatus(WTERMSIG(status));
                std::string fate = "died";
#ifdef WCOREDUMP
                if (WCOREDUMP(status))
                    fate = "core-dumped";
#endif
                Log::error() << "Child process [" << pid << "] " << fate
                             << " with " << Util::signalName(WTERMSIG(status))
                             << " signal: " << strsignal(WTERMSIG(status))
                             << Log::end;

                removeChild(pid);
            }
            else if (WIFSTOPPED(status))
            {
                Log::info() << "Child process [" << pid << "] stopped with "
                            << Util::signalName(WSTOPSIG(status))
                            << " signal: " << strsignal(WTERMSIG(status))
                            << Log::end;
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

            pipeHandler.syncChilds();
            timeoutCounter = 0;
        }
        else if (pid < 0)
        {
            Log::error("Error: waitpid failed.");
            // No child processes
            if (errno == ECHILD)
            {
                TerminationFlag = true;
                continue;
            }
        }

        if (forkCounter > 0 && nChildExitCode == Application::EXIT_OK)
        {
            std::lock_guard<std::recursive_mutex> lock(forkMutex);

            const signed empty = pipeHandler.syncChilds();
            const signed total = _childProcesses.size();

            // Figure out how many children we need. Always create at least as many
            // as configured pre-spawn or one more than requested (whichever is larger).
            signed spawn = std::max(static_cast<int>(forkCounter) + 1, numPreSpawnedChildren);
            Log::debug() << "Creating " << spawn << " childs. Current Total: "
                         << total << ", Empty: " << empty << Log::end;
            do
            {
                if (createLibreOfficeKit(sharePages, childRoot, sysTemplate,
                                         loTemplate, loSubPath) < 0)
                    Log::error("Error: fork failed.");
            }
            while (--spawn > 0);

            // We've done our best. If need more, retrying will bump the counter.
            forkCounter = 0;
        }

        if (timeoutCounter++ == INTERVAL_PROBES)
        {
            timeoutCounter = 0;
            nChildExitCode = Application::EXIT_OK;
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
    return Application::EXIT_OK;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
