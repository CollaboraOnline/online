/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <sys/wait.h>

#include <cstdlib>
#include <cstring>

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
static int numPreSpawnedChildren = 0;

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
                if (kill(_pid, SIGINT) != 0 && kill(_pid, 0) != 0)
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
      : _start(nullptr),
        _end(nullptr)
    {
    }

    ssize_t getResponseLine(int pipeReader, std::string& response)
    {
        ssize_t bytes = -1;
        response.clear();

        try
        {
            while (true)
            {
                if (_start == _end)
                {
                    bytes = Util::readMessage(pipeReader, _buffer, sizeof(_buffer));
                    if ( bytes < 0 )
                    {
                        _start = _end = nullptr;
                        break;
                    }

                    _start = _buffer;
                    _end = _buffer + bytes;
                }

                if ( _start != _end )
                {
                    char byteChar = *_start++;
                    while (_start != _end && byteChar != '\r' && byteChar != '\n')
                    {
                        response += byteChar;
                        byteChar = *_start++;
                    }

                    if (byteChar == '\r' && *_start == '\n')
                    {
                        _start++;
                        break;
                    }
                }
            }
        }
        catch (const std::exception& exc)
        {
            Log::error() << "Exception while reading from pipe ["
                         << pipeReader << "]: " << exc.what() << Log::end;
            return -1;
        }

        return bytes;
    }

    bool createThread(const Process::PID pid, const std::string& session, const std::string& url)
    {
        const std::string message = "thread " + session + " " + url + "\r\n";
        if (Util::writeFIFO(getChildPipe(pid), message) < 0)
        {
            Log::error("Error sending thread message to child [" + std::to_string(pid) + "].");
            return false;
        }

        std::string response;
        if (getResponseLine(readerChild, response) < 0)
        {
            Log::error("Error reading response to thread message from child [" + std::to_string(pid) + "].");
            return false;
        }

        StringTokenizer tokens(response, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        if (tokens.count() > 1 && tokens[1] == "ok")
        {
            Util::writeFIFO(writerNotify, "document " + std::to_string(pid) + " "  + url + " \r\n");
        }
        return (tokens.count() == 2 && tokens[0] == std::to_string(pid) && tokens[1] == "ok");
    }

    /// Sync ChildProcess instances with its child.
    /// Returns the number of empty children.
    size_t syncChildren()
    {
        std::lock_guard<std::recursive_mutex> lock(forkMutex);

        Log::trace("Synching children.");
        size_t empty_count = 0;
        for (auto it = _childProcesses.begin(); it != _childProcesses.end(); )
        {
            const auto message = "query url \r\n";
            std::string response;
            if (Util::writeFIFO(it->second->getWritePipe(), message) < 0 ||
                getResponseLine(readerChild, response) < 0)
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

            StringTokenizer tokens(response, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
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

        Log::trace("Synching children done.");

        return empty_count;
    }

    void handleInput(const std::string& message)
    {
        std::lock_guard<std::recursive_mutex> lock(forkMutex);

        StringTokenizer tokens(message, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        if (tokens[0] == "request" && tokens.count() == 3)
        {
            const std::string session = tokens[1];
            const std::string url = tokens[2];

            Log::debug("Finding kit for URL [" + url + "] on thread [" + session + "].");

            const auto child = findChild(url);
            if (child)
            {
                if (child->getUrl() == url)
                    Log::debug("Found URL [" + url + "] hosted on child [" + std::to_string(child->getPid()) + "].");
                else
                    Log::debug("URL [" + url + "] is not hosted. Using empty child [" + std::to_string(child->getPid()) + "].");

                if (!createThread(child->getPid(), session, url))
                {
                    Log::error("Error creating thread [" + session + "] for URL [" + url + "].");
                }

                child->setUrl(url);
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
        struct pollfd pollPipeBroker;

        pollPipeBroker.fd = readerBroker;
        pollPipeBroker.events = POLLIN;
        pollPipeBroker.revents = 0;

        static const std::string thread_name = "brk_pipe_reader";

        if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(thread_name.c_str()), 0, 0, 0) != 0)
            Log::error("Cannot set thread name to " + thread_name + ".");

        Log::debug("Thread [" + thread_name + "] started.");

        Util::pollPipeForReading(pollPipeBroker, FIFO_LOOLWSD, readerBroker,
                                 [this](std::string& message) {return handleInput(message); } );

        Log::debug("Thread [" + thread_name + "] finished.");
    }

private:
    char* _start;
    char* _end;
    char  _buffer[READ_BUFFER_SIZE];
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
    Process::PID childPID;
    int fifoWriter = -1;

    const Path pipePath = Path::forDirectory(childRoot + Path::separator() + FIFO_PATH);
    const std::string pipeKit = Path(pipePath, BROKER_PREFIX + std::to_string(childCounter++) + BROKER_SUFIX).toString();

    if (mkfifo(pipeKit.c_str(), 0666) < 0 && errno != EEXIST)
    {
        Log::error("Error: Failed to create pipe FIFO [" + pipeKit + "].");
        return -1;
    }

    if (sharePages)
    {
        Log::debug("Forking LibreOfficeKit.");

        Process::PID pid;
        if (!(pid = fork()))
        {
            // child
            if (std::getenv("SLEEPKITFORDEBUGGER"))
            {
                std::cerr << "Sleeping " << std::getenv("SLEEPKITFORDEBUGGER")
                          << " seconds to give you time to attach debugger to process "
                          << Process::id() << std::endl;
                Thread::sleep(std::stoul(std::getenv("SLEEPKITFORDEBUGGER")) * 1000);
            }

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
        int retries = 5;
        // Note that the use of a condition variable and mutex here is totally pointless as far as I
        // see. There is no code that would notify the condition variable.
        std::mutex fifoMutex;
        std::condition_variable fifoCV;
        std::unique_lock<std::mutex> lock(fifoMutex);

        if (std::getenv("SLEEPKITFORDEBUGGER"))
            retries = std::numeric_limits<int>::max();

        while(retries && fifoWriter < 0)
        {
            fifoCV.wait_for(
                lock,
                std::chrono::microseconds(80000),
                [&fifoWriter, &pipeKit]
                {
                    return (fifoWriter = open(pipeKit.c_str(), O_WRONLY | O_NONBLOCK)) >= 0;
                });

            if (fifoWriter < 0)
            {
                Log::debug("Retrying to establish pipe connection: " + std::to_string(retries));
            }

            --retries;
        }
    }

    if (fifoWriter < 0)
    {
        Log::error("Error: failed to open write pipe [" + pipeKit + "] with kit. Abandoning child.");
        // This is an elaborate way to send a SIGINT to childPID: Construct and immediately destroy
        // a ChildProcess object for it.
        ChildProcess(childPID, -1, -1);
        return -1;
    }

    int flags;
    if ((flags = fcntl(fifoWriter, F_GETFL, 0)) < 0)
    {
        Log::error("Error: failed to get pipe flags [" + pipeKit + "].");
        ChildProcess(childPID, -1, -1);
        return -1;
    }

    flags &= ~O_NONBLOCK;
    if (fcntl(fifoWriter, F_SETFL, flags) < 0)
    {
        Log::error("Error: failed to set pipe flags [" + pipeKit + "].");
        ChildProcess(childPID, -1, -1);
        return -1;
    }

    Log::info() << "Adding Kit #" << childCounter << ", PID: " << childPID << Log::end;

    _childProcesses[childPID] = std::make_shared<ChildProcess>(childPID, -1, fifoWriter);
    return childPID;
}

static bool waitForTerminationChild(const Process::PID pid, int count = CHILD_TIMEOUT_SECS)
{
    while (count-- > 0)
    {
        int status;
        waitpid(pid, &status, WUNTRACED | WNOHANG);
        if (WIFEXITED(status) || WIFSIGNALED(status))
        {
            Log::info("Child " + std::to_string(pid) + " terminated.");
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
                  << " seconds to give you time to attach debugger to process "
                  << Process::id() << std::endl;
        Thread::sleep(std::stoul(std::getenv("SLEEPFORDEBUGGER")) * 1000);
    }

    // Initialization
    Log::initialize("brk");

    Util::setTerminationSignals();
    Util::setFatalSignals();

    std::string childRoot;
    std::string loSubPath;
    std::string sysTemplate;
    std::string loTemplate;

    for (int i = 0; i < argc; ++i)
    {
        char *cmd = argv[i];
        char *eq;
        if (std::strstr(cmd, "--losubpath=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            loSubPath = std::string(eq+1);
        }
        else if (std::strstr(cmd, "--systemplate=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            sysTemplate = std::string(eq+1);
        }
        else if (std::strstr(cmd, "--lotemplate=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            loTemplate = std::string(eq+1);
        }
        else if (std::strstr(cmd, "--childroot=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            childRoot = std::string(eq+1);
        }
        else if (std::strstr(cmd, "--numprespawns=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            numPreSpawnedChildren = std::stoi(std::string(eq+1));
        }
        else if (std::strstr(cmd, "--clientport=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            ClientPortNumber = std::stoll(std::string(eq+1));
        }
    }

    loolkitPath = Poco::Path(argv[0]).parent().toString() + "loolkit";

    if (loSubPath.empty())
    {
        Log::error("Error: --losubpath is empty");
        std::exit(Application::EXIT_SOFTWARE);
    }

    if (sysTemplate.empty())
    {
        Log::error("Error: --systemplate is empty");
        std::exit(Application::EXIT_SOFTWARE);
    }

    if (loTemplate.empty())
    {
        Log::error("Error: --lotemplate is empty");
        std::exit(Application::EXIT_SOFTWARE);
    }

    if (childRoot.empty())
    {
        Log::error("Error: --childroot is empty");
        std::exit(Application::EXIT_SOFTWARE);
    }

    if (numPreSpawnedChildren < 1)
    {
        Log::error("Error: --numprespawns is 0");
        std::exit(Application::EXIT_SOFTWARE);
    }

    const Path pipePath = Path::forDirectory(childRoot + Path::separator() + FIFO_PATH);
    const std::string pipeLoolwsd = Path(pipePath, FIFO_LOOLWSD).toString();
    if ( (readerBroker = open(pipeLoolwsd.c_str(), O_RDONLY) ) < 0 )
    {
        Log::error("Error: failed to open pipe [" + pipeLoolwsd + "] read only. Exiting.");
        std::exit(Application::EXIT_SOFTWARE);
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

    int pipeFlags = O_RDONLY | O_NONBLOCK;
    const std::string pipeBroker = Path(pipePath, FIFO_BROKER).toString();
    if (mkfifo(pipeBroker.c_str(), 0666) < 0 && errno != EEXIST)
    {
        Log::error("Error: Failed to create pipe FIFO [" + FIFO_BROKER + "].");
        std::exit(Application::EXIT_SOFTWARE);
    }

    if ((readerChild = open(pipeBroker.c_str(), pipeFlags) ) < 0)
    {
        Log::error("Error: pipe opened for reading.");
        std::exit(Application::EXIT_SOFTWARE);
    }

    if ((pipeFlags = fcntl(readerChild, F_GETFL, 0)) < 0)
    {
        Log::error("Error: failed to get pipe flags [" + FIFO_BROKER + "].");
        std::exit(Application::EXIT_SOFTWARE);
    }

    pipeFlags &= ~O_NONBLOCK;
    if (fcntl(readerChild, F_SETFL, pipeFlags) < 0)
    {
        Log::error("Error: failed to set pipe flags [" + FIFO_BROKER + "].");
        std::exit(Application::EXIT_SOFTWARE);
    }

    // Open notify pipe
    const std::string pipeNotify = Path(pipePath, FIFO_NOTIFY).toString();
    if ((writerNotify = open(pipeNotify.c_str(), O_WRONLY) ) < 0)
    {
        Log::error("Error: pipe opened for writing.");
        exit(Application::EXIT_SOFTWARE);
    }

    // Initialize LoKit and hope we can fork and save memory by sharing pages.
    const bool sharePages = std::getenv("LOK_NO_PREINIT") == nullptr
                          ? globalPreinit(loTemplate)
                          : std::getenv("LOK_FORK") != nullptr;

    if (!sharePages)
        Log::warn("Cannot fork, will spawn instead.");
    else
        Log::info("Preinit stage OK.");

    // We must have at least one child, more is created dynamically.
    if (createLibreOfficeKit(sharePages, childRoot, sysTemplate,
                             loTemplate, loSubPath) < 0)
    {
        Log::error("Error: failed to create children.");
        std::exit(Application::EXIT_SOFTWARE);
    }

    if (numPreSpawnedChildren > 1)
        forkCounter = numPreSpawnedChildren - 1;

    if (!sharePages)
    {
        dropCapability(CAP_SYS_CHROOT);
        dropCapability(CAP_MKNOD);
        dropCapability(CAP_FOWNER);
    }

    PipeRunnable pipeHandler;
    Poco::Thread pipeThread;

    pipeThread.start(pipeHandler);

    Log::info("loolbroker is ready.");

    int childExitCode = EXIT_SUCCESS;
    unsigned timeoutCounter = 0;
    while (!TerminationFlag)
    {
        int status;
        const pid_t pid = waitpid(-1, &status, WUNTRACED | WNOHANG);
        if (pid > 0)
        {
            if (WIFEXITED(status))
            {
                childExitCode = Util::getChildStatus(WEXITSTATUS(status));
                Log::info() << "Child process [" << pid << "] exited with code: "
                            << WEXITSTATUS(status) << "." << Log::end;

                removeChild(pid);
            }
            else
            if (WIFSIGNALED(status))
            {
                childExitCode = Util::getSignalStatus(WTERMSIG(status));
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

            if (WIFEXITED(status) || WIFSIGNALED(status))
            {
                // TODO. recovery files
                const Path childPath = Path::forDirectory(childRoot + Path::separator() + std::to_string(pid));
                Log::info("Removing jail [" + childPath.toString() + "].");
                Util::removeFile(childPath, true);
            }

            pipeHandler.syncChildren();
            timeoutCounter = 0;
        }
        else if (pid < 0)
        {
            Log::error("Error: waitpid failed.");
            // No child processes
            if (errno == ECHILD)
            {
                if (childExitCode == EXIT_SUCCESS)
                {
                    Log::warn("Warn: last child exited successfully, fork new one.");
                    ++forkCounter;
                }
                else
                {
                    Log::error("Error: last child exited with error code.");
                    TerminationFlag = true;
                    continue;
                }
            }
        }

        if (forkCounter > 0 && childExitCode == EXIT_SUCCESS)
        {
            std::lock_guard<std::recursive_mutex> lock(forkMutex);

            const int empty = pipeHandler.syncChildren();
            const int total = _childProcesses.size();

            // Figure out how many children we need. Always create at least as many
            // as configured pre-spawn or one more than requested (whichever is larger).
            int spawn = std::max(static_cast<int>(forkCounter) + 1, numPreSpawnedChildren);
            Log::debug() << "Creating " << spawn << (spawn == 1 ? "child" : "children") << ". Current total: "
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
            childExitCode = EXIT_SUCCESS;
            sleep(MAINTENANCE_INTERVAL);
        }
    }

    // Terminate child processes
    for (auto& it : _childProcesses)
    {
        Log::info("Requesting child process " + std::to_string(it.first) + " to terminate.");
        Util::requestTermination(it.first);
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

    pipeThread.join();
    close(writerNotify);
    close(readerChild);
    close(readerBroker);

    Log::info("Process [loolbroker] finished.");
    return Application::EXIT_OK;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
