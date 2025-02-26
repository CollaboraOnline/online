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

#pragma once

#include <Poco/Util/XMLConfiguration.h>
#include <string>
#include <fstream>
#include <chrono>

class LogUiCmd
{
public:
    void createTmpFile(const std::string& docId);
    void logUiCmdLine(int userId, const std::string& line);
    void saveLogFile();
    std::chrono::steady_clock::time_point getKitStartTimeSec();

private:
    std::fstream _fileStreamUICommands;
    std::set<int> _usersLogged;
    std::string _kitStartTimeStr;
    std::string _docId;
    std::chrono::steady_clock::time_point _kitStartTimeSec;
};
