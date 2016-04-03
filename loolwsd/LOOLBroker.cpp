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

static std::string loolkitPath;
static std::atomic<unsigned> forkCounter;
static std::chrono::steady_clock::time_point lastMaintenanceTime = std::chrono::steady_clock::now();
static unsigned int childCounter = 0;
static int numPreSpawnedChildren = 0;

static std::mutex forkMutex;

namespace
{
    class ChildProcess
    {
    public:
        ChildProcess() :
            _pid(-1)
        {
        }

        ChildProcess(const Poco::Process::PID pid, std::shared_ptr<DialogSocket> dialog) :
            _pid(pid),
            _dialog(dialog)
        {
        }

        ChildProcess(ChildProcess&& other) :
            _pid(other._pid),
            _dialog(other._dialog)
        {
            other._pid = -1;
        }

        const ChildProcess& operator=(ChildProcess&& other)
        {
            _pid = other._pid;
            other._pid = -1;
            _dialog = other._dialog;

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

            if (_dialog)
            {
                _dialog->shutdown();
            }
        }

        void setUrl(const std::string& url) { _url = url; }
        const std::string& getUrl() const { return _url; }

        Poco::Process::PID getPid() const { return _pid; }
        std::shared_ptr<DialogSocket> getSocket() const { return _dialog; }

    private:
        std::string _url;
        Poco::Process::PID _pid;
        std::shared_ptr<DialogSocket> _dialog;
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

class CommandRunnable: public Runnable
{
public:
    CommandRunnable(const std::shared_ptr<DialogSocket>& dlgWsd) :
        _dlgWsd(dlgWsd)
    {
    }

    ~CommandRunnable()
    {
        _dlgWsd->shutdown();
    }

    bool createSession(const std::shared_ptr<ChildProcess>& child, const std::string& session, const std::string& url)
    {
        const std::string message = "session " + session + " " + url;
        const auto childPid = std::to_string(child->getPid());
        const auto childSocket = child->getSocket();
        const Poco::Timespan waitTime(POLL_TIMEOUT_MS * 1000);
        bool retVal = false;

        try
        {
            if (childSocket)
            {
                childSocket->sendMessage(message);
                std::string response;

                if (childSocket->poll(waitTime, Socket::SELECT_READ))
                {
                    childSocket->receiveMessage(response);
                    StringTokenizer tokens(response, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
                    retVal = (tokens[0] == "ok");
                }
            }
        }
        catch (const Exception& exc)
        {
            Log::error() << "PipeRunnable::createSession: Exception: " << exc.displayText()
                         << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                         << Log::end;
        }

        return retVal;
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

    void run() override
    {
        static const std::string thread_name = "brk_cmd_reader";
        const Poco::Timespan waitTime(POLL_TIMEOUT_MS * 1000);

        if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(thread_name.c_str()), 0, 0, 0) != 0)
            Log::error("Cannot set thread name to " + thread_name + ".");

        Log::debug("Thread [" + thread_name + "] started.");

        try
        {
            while (!TerminationFlag)
            {
                if (_dlgWsd->poll(waitTime, Socket::SELECT_READ))
                {
                    std::string message;
                    _dlgWsd->receiveMessage(message);
                    handleInput(message);
                }
            }
            _dlgWsd->shutdown();
        }
        catch (const Exception& exc)
        {
            Log::error() << "CommandRunnable::run: Exception: " << exc.displayText()
                         << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                         << Log::end;
        }

        Log::debug("Thread [" + thread_name + "] finished.");
    }

private:
    std::shared_ptr<DialogSocket> _dlgWsd;
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

            lokit_main(childRoot, sysTemplate, loTemplate, loSubPath);
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

    ServerSocket srvCommand(COMMAND_PORT_NUMBER);
    std::shared_ptr<DialogSocket> dialog;
    const Poco::Timespan waitTime(POLL_TIMEOUT_MS * 1000);

    if (srvCommand.poll(waitTime, Socket::SELECT_READ))
    {
        dialog = std::make_shared<DialogSocket>(srvCommand.acceptConnection());
    }
    else
    {
        Log::error("Error: failed to socket connection with kit. Abandoning child.");
        ChildProcess(childPID, nullptr);
        return -1;
    }

    Log::info() << "Adding Kit #" << childCounter << ", PID: " << childPID << Log::end;

    _newChildProcesses.emplace_back(std::make_shared<ChildProcess>(childPID, dialog));
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

    assert(!loSubPath.empty());
    assert(!sysTemplate.empty());
    assert(!loTemplate.empty());
    assert(!childRoot.empty());
    assert(numPreSpawnedChildren >= 1);

    std::shared_ptr<DialogSocket> dlgWsd = std::make_shared<DialogSocket>();
    const Poco::Timespan waitTime(POLL_TIMEOUT_MS * 1000);

    try
    {
        dlgWsd->connect(SocketAddress("localhost", COMMAND_PORT_NUMBER), waitTime);
    }
    catch (const Exception& exc)
    {
        Log::error() << "LOOLBroker::main: Exception: " << exc.displayText()
                     << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                     << Log::end;
        std::exit(Application::EXIT_SOFTWARE);
    }

    if (!std::getenv("LD_BIND_NOW"))
        Log::info("Note: LD_BIND_NOW is not set.");

    if (!std::getenv("LOK_VIEW_CALLBACK"))
        Log::info("Note: LOK_VIEW_CALLBACK is not set.");

    // Open notify pipe
    const Path pipePath = Path::forDirectory(childRoot + Path::separator() + FIFO_PATH);
    const std::string pipeNotify = Path(pipePath, FIFO_NOTIFY).toString();
    if ((writerNotify = open(pipeNotify.c_str(), O_WRONLY) ) < 0)
    {
        Log::error("Error: failed to open notify pipe [" + FIFO_NOTIFY + "] for writing.");
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

    CommandRunnable commandHandler(dlgWsd);
    Poco::Thread commandThread;

    commandThread.start(commandHandler);

    Log::info("loolbroker is ready.");

    int childExitCode = EXIT_SUCCESS;
    unsigned timeoutCounter = 0;
    while (!TerminationFlag)
    {
        int status;
        const pid_t pid = waitpid(-1, &status, WUNTRACED | WNOHANG);
        if (pid > 0)
        {
            std::lock_guard<std::mutex> lock(forkMutex);
            if (WIFEXITED(status))
            {
                childExitCode = Util::getChildStatus(WEXITSTATUS(status));
                Log::info() << "Child process [" << pid << "] exited with code: "
                            << WEXITSTATUS(status) << "." << Log::end;

                removeChild(pid, false);
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

            timeoutCounter = 0;
        }
        else if (pid < 0)
        {
            // No child processes
            if (errno == ECHILD)
            {
                if (childExitCode == EXIT_SUCCESS)
                {
                    Log::info("Last child exited successfully, fork new one.");
                    ++forkCounter;
                }
                else
                {
                    Log::error("Error: last child exited with error code. Terminating.");
                    TerminationFlag = true; //FIXME: Why?
                    continue;
                }
            }
            else
            {
                Log::error("waitpid failed.");
            }
        }

        if (forkCounter > 0 && childExitCode == EXIT_SUCCESS)
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
                                             loTemplate, loSubPath) < 0)
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

        if (timeoutCounter++ == INTERVAL_PROBES)
        {
            timeoutCounter = 0;
            childExitCode = EXIT_SUCCESS;
            sleep(MAINTENANCE_INTERVAL);
        }
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

    commandThread.join();
    close(writerNotify);

    Log::info("Process [loolbroker] finished.");
    return Application::EXIT_OK;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
