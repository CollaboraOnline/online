/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_COUNTLOOLKITPROCESSES_HPP
#define INCLUDED_COUNTLOOLKITPROCESSES_HPP

#include <Poco/DirectoryIterator.h>
#include <Poco/StringTokenizer.h>

/// Counts the number of LoolKit process instances without wiating.
static int getLoolKitProcessCount()
{
    int result = 0;
    for (auto i = Poco::DirectoryIterator(std::string("/proc")); i != Poco::DirectoryIterator(); ++i)
    {
        try
        {
            Poco::Path procEntry = i.path();
            const std::string& fileName = procEntry.getFileName();
            int pid;
            std::size_t endPos = 0;
            try
            {
                pid = std::stoi(fileName, &endPos);
            }
            catch (const std::invalid_argument&)
            {
                pid = 0;
            }
            if (pid > 1 && endPos == fileName.length())
            {
                Poco::FileInputStream stat(procEntry.toString() + "/stat");
                std::string statString;
                Poco::StreamCopier::copyToString(stat, statString);
                Poco::StringTokenizer tokens(statString, " ");
                if (tokens.count() > 3 && tokens[1] == "(loolkit)")
                {
                    switch (tokens[2].c_str()[0])
                    {
                        // Dead marker for old and new kernels.
                    case 'x':
                    case 'X':
                        // Don't ignore zombies.
                        break;
                    default:
                        ++result;
                        break;
                    }
                    // std::cout << "Process:" << pid << ", '" << tokens[1] << "'" << " state: " << tokens[2] << std::endl;
                }
            }
        }
        catch (const std::exception& ex)
        {
            // 'File not found' is common here, since there is a race
            // between iterating the /proc directory and opening files,
            // the process in question might have been gone.
            //std::cerr << "Error while iterating processes: " << ex.what() << std::endl;
        }
    }

    return result;
}

static int countLoolKitProcesses(const int expected)
{
    std::cerr << "Waiting to have " << expected << " loolkit processes. Loolkits: ";

    // We have to wait at least for the time the call docBroker->autoSave(forceSave,
    // COMMAND_TIMEOUT_MS)) in ClientRequestHandler:::handleGetRequest() can take to wait for
    // information about a successful auto-save. In the HTTPWSTest::testConnectNoLoad() there is
    // nothing to auto-save, so it waits in vain.

    // This does not need to depend on any constant from Common.hpp.
    // The shorter the better (the quicker the test runs).
    const auto sleepMs = 100;

    // This has to cause waiting for at least COMMAND_TIMEOUT_MS. Add one second for safety.
    const size_t repeat = ((COMMAND_TIMEOUT_MS + 1000) / sleepMs);
    auto count = getLoolKitProcessCount();
    for (size_t i = 0; i < repeat; ++i)
    {
        std::cerr << count << ' ';
        if (count == expected)
        {
            break;
        }

        // Give polls in the lool processes time to time out etc
        Poco::Thread::sleep(sleepMs);

        count = getLoolKitProcessCount();
    }

    std::cerr << std::endl;
    if (expected != count)
    {
        std::cerr << "Found " << count << " LoKit processes but was expecting " << expected << "." << std::endl;
    }

    return count;
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
