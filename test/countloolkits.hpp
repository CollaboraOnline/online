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

#include <iostream>
#include <thread>

#include <cppunit/extensions/HelperMacros.h>

#include <Poco/DirectoryIterator.h>
#include <Poco/FileStream.h>
#include <Poco/StreamCopier.h>
#include <Poco/StringTokenizer.h>

#include <Common.hpp>

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
    std::cerr << "Waiting until loolkit processes are exactly " << expected << ". Loolkits: ";

    // This does not need to depend on any constant from Common.hpp.
    // The shorter the better (the quicker the test runs).
    const auto sleepMs = 50;

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
        std::this_thread::sleep_for(std::chrono::milliseconds(sleepMs));

        const auto newCount = getLoolKitProcessCount();
        if (count != newCount)
        {
            // Allow more time until the number settles.
            i = 0;
            count = newCount;
        }
    }

    std::cerr << std::endl;
    if (expected != count)
    {
        std::cerr << "Found " << count << " LoKit processes but was expecting " << expected << "." << std::endl;
    }

    return count;
}

// FIXME: we probably should make this extern
// and reuse it. As it stands now, it is per
// translation unit, which isn't desirable if
// (in the non-ideal event that) it's not 1,
// it will cause testNoExtraLoolKitsLeft to
// wait unnecessarily and fail.
static int InitialLoolKitCount = 1;
static std::chrono::steady_clock::time_point TestStartTime;

static void testCountHowManyLoolkits()
{
    TestStartTime = std::chrono::steady_clock::now();

    InitialLoolKitCount = countLoolKitProcesses(InitialLoolKitCount);
    CPPUNIT_ASSERT(InitialLoolKitCount > 0);

    TestStartTime = std::chrono::steady_clock::now();
}

static void testNoExtraLoolKitsLeft()
{
    const auto countNow = countLoolKitProcesses(InitialLoolKitCount);
    CPPUNIT_ASSERT_EQUAL(InitialLoolKitCount, countNow);

    const auto duration = (std::chrono::steady_clock::now() - TestStartTime);
    const auto durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();

    std::cout << " (" << durationMs << " ms)";
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
