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
static
int getLoolKitProcessCount()
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
                    case 'x':
                    case 'X': // Kinds of dead-ness.
                    case 'Z': // zombies
                        break; // ignore
                    default:
                        result++;
                        break;
                    }
                    // std::cout << "Process:" << pid << ", '" << tokens[1] << "'" << " state: " << tokens[2] << std::endl;
                }
            }
        }
        catch (const Poco::Exception&)
        {
        }
    }

    return result;
}

static
int countLoolKitProcesses(const int expected)
{
    std::cerr << "Waiting to have " << expected << " loolkit processes. Loolkits: ";

    // Retry for about 3 seconds.
    const auto sleepMs = static_cast<int>(POLL_TIMEOUT_MS / 3);
    const size_t repeat = (3000 / sleepMs) + 1;
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
