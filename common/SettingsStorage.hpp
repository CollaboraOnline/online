/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
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

#include <string>
#include <vector>
#include <functional>
#include <Poco/Path.h>

namespace Desktop
{
    struct FileResult
    {
        std::string fileName;
        std::string mimeType;
        std::string content;
    };

    Poco::Path getConfigPath();
    std::string getDataDir();

    void uploadSettings(const std::string& payload);

    FileResult fetchSettingsFile(const std::string& relPath);

    std::string fetchSettingsConfig();

    void syncSettings(const std::function<void(const std::vector<char>&)>& sendFileCallback);

    void processIntegratorAdminFile(const std::string& payload);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
