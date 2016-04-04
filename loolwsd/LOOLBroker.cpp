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

const std::string BROKER_SUFIX = ".fifo";
const std::string BROKER_PREFIX = "lokit";

static int ReaderBroker = -1;

static std::string LoolkitPath;
static std::atomic<unsigned> ForkCounter;
static unsigned int ChildCounter = 0;
static int NumPreSpawnedChildren = 1;

class ChildDispatcher
{
public:
    ChildDispatcher() :
        _wsdPipeReader("wsd_pipe_rd", ReaderBroker)
    {
    }

    /// Polls WSD commands and dispatches them to the appropriate child.
    bool pollAndDispatch()
    {
        return _wsdPipeReader.processOnce([this](std::string& message) { handleInput(message); return true; },
                                          []() { return TerminationFlag; });
    }

private:
    void handleInput(const std::string& message)
    {
        Log::info("Broker command: [" + message + "].");

        StringTokenizer tokens(message, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

        if (tokens[0] == "spawn" && tokens.count() == 2)
        {
            const auto count = std::stoi(tokens[1]);
            Log::info("Spawning " + tokens[1] + " childs per request.");
            ForkCounter = count;
        }
    }

private:
    IoUtil::PipeReader _wsdPipeReader;
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
                                const std::string& loSubPath)
{
    Process::PID childPID;

    const Path pipePath = Path::forDirectory(childRoot + Path::separator() + FIFO_PATH);
    const std::string pipeKit = Path(pipePath, BROKER_PREFIX + std::to_string(ChildCounter++) + BROKER_SUFIX).toString();

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

        Log::info("Launching LibreOfficeKit #" + std::to_string(ChildCounter) +
                  ": " + LoolkitPath + " " +
                  Poco::cat(std::string(" "), args.begin(), args.end()));

        Poco::ProcessHandle procChild = Process::launch(LoolkitPath, args);
        childPID = procChild.id();
        Log::info("Spawned kit [" + std::to_string(childPID) + "].");

        if (!Process::isRunning(procChild))
        {
            // This can happen if we fail to copy it, or bad chroot etc.
            Log::error("Error: loolkit [" + std::to_string(childPID) + "] was stillborn.");
            return -1;
        }
    }

    Log::info() << "Created Kit #" << ChildCounter << ", PID: " << childPID << Log::end;
    return childPID;
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
}

void setupPipes(const std::string &childRoot)
{
    const Path pipePath = Path::forDirectory(childRoot + Path::separator() + FIFO_PATH);
    const std::string pipeLoolwsd = Path(pipePath, FIFO_LOOLWSD).toString();
    if ( (ReaderBroker = open(pipeLoolwsd.c_str(), O_RDONLY) ) < 0 )
    {
        Log::error("Error: failed to open pipe [" + pipeLoolwsd + "] read only. Exiting.");
        std::exit(Application::EXIT_SOFTWARE);
    }

    // Open notify pipe
    const std::string pipeNotify = Path(pipePath, FIFO_ADMIN_NOTIFY).toString();
    if ((WriterNotify = open(pipeNotify.c_str(), O_WRONLY) ) < 0)
    {
        Log::error("Error: failed to open notify pipe [" + FIFO_ADMIN_NOTIFY + "] for writing.");
        exit(Application::EXIT_SOFTWARE);
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
            NumPreSpawnedChildren = std::stoi(std::string(eq+1));
        }
        else if (std::strstr(cmd, "--clientport=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            ClientPortNumber = std::stoll(std::string(eq+1));
        }
    }

    LoolkitPath = Poco::Path(argv[0]).parent().toString() + "loolkit";

    if (loSubPath.empty() || sysTemplate.empty() ||
        loTemplate.empty() || childRoot.empty() ||
        NumPreSpawnedChildren < 1)
    {
        printArgumentHelp();
        return 1;
    }

    if (!std::getenv("LD_BIND_NOW"))
        Log::info("Note: LD_BIND_NOW is not set.");

    if (!std::getenv("LOK_VIEW_CALLBACK"))
        Log::info("Note: LOK_VIEW_CALLBACK is not set.");

    setupPipes(childRoot);

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

    if (NumPreSpawnedChildren > 1)
        ForkCounter = NumPreSpawnedChildren - 1;

    if (!sharePages)
    {
        dropCapability(CAP_SYS_CHROOT);
        dropCapability(CAP_MKNOD);
        dropCapability(CAP_FOWNER);
    }

    ChildDispatcher childDispatcher;
    Log::info("loolbroker is ready.");

    Poco::Timestamp startTime;

    while (!TerminationFlag)
    {
        if (!childDispatcher.pollAndDispatch())
        {
            Log::info("Child dispatcher flagged for termination.");
            break;
        }

        if (ForkCounter > 0)
        {
            // Figure out how many children we need. Always create at least as many
            // as configured pre-spawn or one more than requested (whichever is larger).
            int spawn = ForkCounter;
            Log::info() << "Creating " << spawn << " new child." << Log::end;
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

            // If we need to spawn more, retry later.
            ForkCounter = (newInstances > ForkCounter ? 0 : ForkCounter - newInstances);
        }
    }

    close(WriterNotify);
    close(ReaderBroker);

    Log::info("Process [loolbroker] finished.");
    return Application::EXIT_OK;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
