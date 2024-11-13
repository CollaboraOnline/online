/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>
#include <kit/LogUI.hpp>
#include <Log.hpp>

void LogUiCmd::logUiCmdLine(int userId, std::string line)
{
    _fileStreamUICommands.write(line.c_str(), line.length());
    _fileStreamUICommands.write("\n", 1);
    _usersLogged.insert(userId);
}

void LogUiCmd::saveLogFile()
{
    std::string timeLog = "log-start-time: " + _kitStartTimeStr + " user-count:" + std::to_string(_usersLogged.size());
    Log::logUI(Log::WRN, timeLog.c_str());
    _fileStreamUICommands.seekg(0, std::ios::beg);
    std::string line;
    while (std::getline(_fileStreamUICommands, line))
    {
        if (line.size()>0)
            Log::logUI(Log::WRN, line);
    }
    _fileStreamUICommands.close();
    timeLog = "log-end-time: ";
    timeLog.append(Util::getTimeNow("%Y-%m-%d %T"));
    Log::logUI(Log::WRN, timeLog.c_str());
}

void LogUiCmd::createTmpFile()
{
    const std::string tempFile = "/tmp/kit-ui-cmd.log";
    _fileStreamUICommands.open(tempFile, std::fstream::in | std::fstream::out | std::fstream::trunc);
    _kitStartTimeSec = std::chrono::steady_clock::now();
    _kitStartTimeStr = Util::getTimeNow("%Y-%m-%d %T");
}

std::chrono::steady_clock::time_point LogUiCmd::getKitStartTimeSec()
{
    return _kitStartTimeSec;
}
