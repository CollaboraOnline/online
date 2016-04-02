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
#include "IoUtil.hpp"
#include "Util.hpp"

// First include the grist of the helper process - ideally
// we can avoid execve and share lots of memory here. We
// can't link to a non-PIC translation unit though, so
// include to share.
#define LOOLKIT_NO_MAIN 1
#include "LOOLKit.cpp"

#define LIB_SOFFICEAPP  "lib" "sofficeapp" ".so"
#define LIB_MERGED      "lib" "mergedlo" ".so"

typedef int (LokHookPreInit)  (const char *install_path, const char *user_profile_path);

using Poco::ProcessHandle;

const std::string BROKER_SUFIX = ".fifo";
const std::string BROKER_PREFIX = "lokit";

static int readerChild = -1;
static int readerBroker = -1;

static std::string loolkitPath;
static std::atomic<unsigned> forkCounter;
static std::chrono::steady_clock::time_point lastMaintenanceTime = std::chrono::steady_clock::now();
static unsigned int childCounter = 0;
static int numPreSpawnedChildren = 1;

static std::mutex forkMutex;

namespace
{
    class ChildProcess
    {
    public:
        ChildProcess() :
            _pid(-1),
            _writePipe(-1)
        {
        }

        ChildProcess(const Poco::Process::PID pid, const int writePipe) :
            _pid(pid),
            _writePipe(writePipe)
        {
        }

        ChildProcess(ChildProcess&& other) :
            _pid(other._pid),
            _writePipe(other._writePipe)
        {
            other._pid = -1;
            other._writePipe = -1;
        }

        const ChildProcess& operator=(ChildProcess&& other)
        {
            _pid = other._pid;
            other._pid = -1;
            _writePipe = other._writePipe;
            other._writePipe = -1;

            return *this;
        }

        ~ChildProcess()
        {
            close(true);
        }

        void close(const bool rude)
        {
            if (_pid != -1)
            {
                if (kill(_pid, SIGINT) != 0 && rude && kill(_pid, 0) != 0)
                {
                    Log::error("Cannot terminate lokit [" + std::to_string(_pid) + "]. Abandoning.");
                }

                std::ostringstream message;
                message << "rmdoc" << " "
                        << _pid << " "
                        << "\r\n";
                IoUtil::writeFIFO(writerNotify, message.str());
               _pid = -1;
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
        int getWritePipe() const { return _writePipe; }

    private:
        std::string _url;
        Poco::Process::PID _pid;
        int _writePipe;
    };

    static std::map<Process::PID, std::shared_ptr<ChildProcess>> _childProcesses;
    static std::deque<std::shared_ptr<ChildProcess>> _newChildProcesses;

    /// Looks up a child hosting a URL, otherwise returns an empty one.
    /// If neither exist, then returns null.
    std::shared_ptr<ChildProcess> findChild(const std::string& url)
    {
        for (const auto& it : _childProcesses)
        {
            if (it.second->getUrl() == url)
            {
                return it.second;
            }
        }

        // Try an empty one.
        if (!_newChildProcesses.empty())
        {
            auto child = _newChildProcesses.front();
            _newChildProcesses.pop_front();
            return child;
        }

        return nullptr;
    }

    /// Removes a used child process. New ones can't be removed.
    void removeChild(const Process::PID pid, const bool rude)
    {
        const auto it = _childProcesses.find(pid);
        if (it != _childProcesses.end())
        {
            // Close the child resources.
            it->second->close(rude);
            _childProcesses.erase(it);
        }
    }
}

class PipeRunnable
{
public:
    PipeRunnable() :
        _childPipeReader("child_pipe_rd", readerChild)
    {
    }

    bool createSession(const std::shared_ptr<ChildProcess>& child, const std::string& session, const std::string& url)
    {
        const std::string message = "session " + session + " " + url + "\n";
        const auto childPid = std::to_string(child->getPid());
        const auto childPipe = child->getWritePipe();
        if (IoUtil::writeFIFO(childPipe, message) < 0)
        {
            Log::error("Error sending session message to child [" + childPid + "].");
            return false;
        }

        while (true)
        {
            std::string response;
            if (_childPipeReader.readLine(response, [](){ return TerminationFlag; }) <= 0)
            {
                Log::error("Error reading response to session message from child [" + childPid + "].");
                return false;
            }

            Log::debug("Got message from child ! '" + response + "'");

            StringTokenizer tokens(response, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            if (tokens.count() > 0 && tokens[0] != childPid)
            {
                // Not a response from the child in question.
                continue;
            }

            return (tokens.count() == 2 && tokens[1] == "ok");
        }
    }

    void handleInput(const std::string& message)
    {
        Log::info("Broker command: [" + message + "].");

        StringTokenizer tokens(message, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

        std::lock_guard<std::mutex> lock(forkMutex);

        if (tokens[0] == "request" && tokens.count() == 3)
        {
            const std::string session = tokens[1];
            const std::string url = tokens[2];

            Log::debug("Finding kit for URL [" + url + "] on session [" + session +
                       "] in " + std::to_string(_childProcesses.size()) + " childs.");

            const auto child = findChild(url);
            if (child)
            {
                const auto childPid = std::to_string(child->getPid());
                const auto isEmptyChild = child->getUrl().empty();
                if (isEmptyChild)
                {
                    Log::debug("URL [" + url + "] is not hosted. Using empty child [" + childPid + "].");
                }
                else
                {
                    Log::debug("Found URL [" + url + "] hosted on child [" + childPid + "].");
                }

                if (createSession(child, session, url))
                {
                    child->setUrl(url);
                    _childProcesses[child->getPid()] = child;
                    Log::debug("Child [" + childPid + "] now hosts [" + url + "] for session [" + session + "].");
                }
                else
                {
                    Log::error("Error creating session [" + session + "] for URL [" + url + "] on child [" + childPid + "].");
                }
            }
            else
            {
                Log::info("No children available. Creating more.");
            }

            ++forkCounter;
        }
        else if (tokens[0] == "kill" && tokens.count() == 2)
        {
            Process::PID nPid = static_cast<Process::PID>(std::stoi(tokens[1]));
            removeChild(nPid, true);
        }
    }

    bool waitForResponse()
    {
        std::string response;
        if (_childPipeReader.readLine(response, [](){ return TerminationFlag; }) <= 0)
            Log::error("Error reading response to benchmark message from child");
        else
            Log::debug("got response '" + response + "'");
        return response == "started";
    }

private:
    IoUtil::PipeReader _childPipeReader;
};

/// Initializes LibreOfficeKit for cross-fork re-use.
static bool globalPreinit(const std::string &loTemplate)
{
    const std::string libSofficeapp = loTemplate + "/program/" LIB_SOFFICEAPP;

    std::string loadedLibrary;
    void *handle;
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

    LokHookPreInit* preInit = (LokHookPreInit *)dlsym(handle, "lok_preinit");
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
                                const std::string& loSubPath,
                                bool doBenchmark)
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

            lokit_main(childRoot, sysTemplate, loTemplate, loSubPath, pipeKit, doBenchmark);
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
        ChildProcess(childPID, -1);
        return -1;
    }

    int flags;
    if ((flags = fcntl(fifoWriter, F_GETFL, 0)) < 0)
    {
        Log::error("Error: failed to get pipe flags [" + pipeKit + "].");
        ChildProcess(childPID, -1);
        return -1;
    }

    flags &= ~O_NONBLOCK;
    if (fcntl(fifoWriter, F_SETFL, flags) < 0)
    {
        Log::error("Error: failed to set pipe flags [" + pipeKit + "].");
        ChildProcess(childPID, -1);
        return -1;
    }

    Log::info() << "Adding Kit #" << childCounter << ", PID: " << childPID << Log::end;

    _newChildProcesses.emplace_back(std::make_shared<ChildProcess>(childPID, fifoWriter));
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

static void printArgumentHelp()
{
    std::cout << "Usage: loolbroker [OPTION]..." << std::endl;
    std::cout << "  Single threaded process broker that spawns lok instances" << std::endl;
    std::cout << "  note: running this standalone is not possible, it is spawned by the loolwsd" << std::endl;
    std::cout << "        and is controlled via a pipe." << std::endl;
    std::cout << "" << std::endl;
    std::cout << "  Some parameters are required and passed on to the lok instance:" << std::endl;
    std::cout << "  --losubpath=<path>        path to chroot for child to live inside." << std::endl;
    std::cout << "  --childroot=<path>        path to chroot for child to live inside." << std::endl;
    std::cout << "  --systemplate=<path>      path of system template to pre-populate chroot with." << std::endl;
    std::cout << "  --lotemplate=<path>       path of libreoffice template to pre-populate chroot with." << std::endl;
    std::cout << "  --pipe=<path>             path of loolwsd pipe to connect to on startup." << std::endl;
    std::cout << "  --losubpath=<path>        path to libreoffice install" << std::endl;
    std::cout << "" << std::endl;
    std::cout << "  Some paramaters are optional:" << std::endl;
    std::cout << "  --numprespawns=<number>   pre-fork at least <number> processes [1]" << std::endl;
    std::cout << "  --benchmark               pre-fork processes, and print statistics before exiting" << std::endl;
}

void setupPipes(const std::string &childRoot, bool doBenchmark)
{
    const Path pipePath = Path::forDirectory(childRoot + Path::separator() + FIFO_PATH);
    if (!doBenchmark)
    {
        const std::string pipeLoolwsd = Path(pipePath, FIFO_LOOLWSD).toString();
        if ( (readerBroker = open(pipeLoolwsd.c_str(), O_RDONLY) ) < 0 )
        {
            Log::error("Error: failed to open pipe [" + pipeLoolwsd + "] read only. Exiting.");
            std::exit(Application::EXIT_SOFTWARE);
        }
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

    if (!doBenchmark)
    {
        // Open notify pipe
        const std::string pipeNotify = Path(pipePath, FIFO_NOTIFY).toString();
        if ((writerNotify = open(pipeNotify.c_str(), O_WRONLY) ) < 0)
        {
            Log::error("Error: failed to open notify pipe [" + FIFO_NOTIFY + "] for writing.");
            exit(Application::EXIT_SOFTWARE);
        }
    }
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
    bool doBenchmark = false;

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
        else if (std::strstr(cmd, "--benchmark"))
            doBenchmark = true;
    }

    loolkitPath = Poco::Path(argv[0]).parent().toString() + "loolkit";

    if (loSubPath.empty() || sysTemplate.empty() ||
        loTemplate.empty() || childRoot.empty() ||
        numPreSpawnedChildren < 1)
    {
        printArgumentHelp();
        return 1;
    }

    if (!std::getenv("LD_BIND_NOW"))
        Log::info("Note: LD_BIND_NOW is not set.");

    if (!std::getenv("LOK_VIEW_CALLBACK"))
        Log::info("Note: LOK_VIEW_CALLBACK is not set.");

    setupPipes(childRoot, doBenchmark);

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
                             loTemplate, loSubPath, doBenchmark) < 0)
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
    Log::info("loolbroker is ready.");

    Poco::Timestamp startTime;
    IoUtil::PipeReader pipeReader(FIFO_LOOLWSD, readerBroker);

    while (!TerminationFlag)
    {
        if (!pipeReader.processOnce([&pipeHandler](std::string& message) { pipeHandler.handleInput(message); return true; },
                                    []() { return TerminationFlag; }))
        {
            Log::info("Reading pipe [" + pipeReader.getName() + "] flagged for termination.");
            break;
        }

        int status;
        const pid_t pid = waitpid(-1, &status, WUNTRACED | WNOHANG);
        if (pid > 0)
        {
            std::lock_guard<std::mutex> lock(forkMutex);
            if (WIFEXITED(status))
            {
                Log::info() << "Child process [" << pid << "] exited with code: "
                            << WEXITSTATUS(status) << "." << Log::end;

                removeChild(pid, false);
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
                             << " signal: " << strsignal(WTERMSIG(status))
                             << Log::end;

                removeChild(pid, false);
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
        }
        else if (pid < 0)
        {
            // No child processes
            if (errno == ECHILD)
            {
                ++forkCounter;
            }
            else
            {
                Log::error("waitpid failed.");
            }
        }

        if (forkCounter > 0)
        {
            std::lock_guard<std::mutex> lock(forkMutex);

            const auto childCount = _childProcesses.size();
            const int newChildCount = _newChildProcesses.size();

            // Figure out how many children we need. Always create at least as many
            // as configured pre-spawn or one more than requested (whichever is larger).
            int spawn = std::max(static_cast<int>(forkCounter) + 1, numPreSpawnedChildren);
            if (spawn > newChildCount)
            {
                spawn -= newChildCount;
                Log::info() << "Creating " << spawn << " new child. Current total: "
                            << childCount << " + " << newChildCount << " (new) = "
                            << (childCount + newChildCount) << "." << Log::end;
                size_t newInstances = 0;
                do
                {
                    if (createLibreOfficeKit(sharePages, childRoot, sysTemplate,
                                             loTemplate, loSubPath, doBenchmark) < 0)
                    {
                        Log::error("Error: fork failed.");
                    }
                    else
                    {
                        ++newInstances;
                    }
                }
                while (--spawn > 0);

                // We've done our best. If need more, retrying will bump the counter.
                forkCounter = (newInstances > forkCounter ? 0 : forkCounter - newInstances);
            }
            else
            {
                Log::info() << "Requested " << spawn << " new child. Current total: "
                            << childCount << " + " << newChildCount << " (new) = "
                            << (childCount + newChildCount) << ". Will not spawn yet." << Log::end;
                forkCounter = 0;
            }
        }

        if (doBenchmark)
            break;
    }

    if (doBenchmark)
    {
        Log::info("loolbroker benchmark - waiting for kits.");

        int numSpawned = 0;
        while (numSpawned < numPreSpawnedChildren)
        {
            if (pipeHandler.waitForResponse())
                numSpawned++;
            Log::info("got children " + std::to_string(numSpawned));
        }

        Poco::Timestamp::TimeDiff elapsed = startTime.elapsed();

        std::cerr << "Time to launch " << numPreSpawnedChildren << " children: " << (1.0 * elapsed)/Poco::Timestamp::resolution() << std::endl;
        Log::info("loolbroker benchmark complete.");

        TerminationFlag = true;
    }

    // Terminate child processes.
    for (auto& it : _childProcesses)
    {
        Log::info("Requesting child process " + std::to_string(it.first) + " to terminate.");
        Util::requestTermination(it.first);
    }

    for (auto& it : _newChildProcesses)
    {
        Log::info("Requesting child process " + std::to_string(it->getPid()) + " to terminate.");
        Util::requestTermination(it->getPid());
    }

    // Wait and kill child processes.
    for (auto& it : _childProcesses)
    {
        if (!waitForTerminationChild(it.first))
        {
            Log::info("Forcing child process " + std::to_string(it.first) + " to terminate.");
            Process::kill(it.first);
        }
    }

    for (auto& it : _newChildProcesses)
    {
        if (!waitForTerminationChild(it->getPid()))
        {
            Log::info("Forcing child process " + std::to_string(it->getPid()) + " to terminate.");
            Process::kill(it->getPid());
        }
    }

    _childProcesses.clear();
    _newChildProcesses.clear();

    close(writerNotify);
    close(readerChild);
    close(readerBroker);

    Log::info("Process [loolbroker] finished.");
    return Application::EXIT_OK;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
