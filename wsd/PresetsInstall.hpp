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

#include <net/Socket.hpp>
#include <functional>
#include <memory>
#include <string>

struct CacheQuery;
class ClientSession;

class PresetsInstallTask : public std::enable_shared_from_this<PresetsInstallTask>
{
private:
    std::set<std::string> _installingPresets;
    std::string _configId;
    std::string _presetsPath;
    std::vector<std::function<void(bool)>> _installFinishedCBs;
    SocketPoll& _poll;
    int _idCount;
    bool _reportedStatus;
    bool _overallSuccess;

    void asyncInstall(const std::string& uri, const std::string& stamp,
                      const std::string& fileName,
                      const std::shared_ptr<ClientSession>& session);

    void installPresetStarted(const std::string& id);

    void installPresetFinished(const std::string& id, bool presetResult);

    void completed();

    void addGroup(Poco::JSON::Object::Ptr settings, const std::string& groupName,
                  std::vector<CacheQuery>& queries);

public:
    PresetsInstallTask(SocketPoll& poll, const std::string& configId,
                       const std::string& presetsPath,
                       const std::function<void(bool)>& installFinishedCB);

    bool empty() const
    {
        return _installingPresets.empty();
    }

    void appendCallback(const std::function<void(bool)>& installFinishedCB)
    {
        _installFinishedCBs.emplace_back(installFinishedCB);
    }

    void install(const Poco::JSON::Object::Ptr& settings,
                 const std::shared_ptr<ClientSession>& session);
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
