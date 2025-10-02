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

#if !MOBILEAPP

#include <cerrno>
#include <stdexcept>
#include <unordered_map>

#include "Admin.hpp"
#include "Auth.hpp"
#include "CacheUtil.hpp"
#include "FileServer.hpp"
#include "UserMessages.hpp"
#include <wopi/CheckFileInfo.hpp>
#include <wopi/StorageConnectionManager.hpp>
#include <net/HttpHelper.hpp>
#include <sys/wait.h>

#include <common/JailUtil.hpp>
#include <common/Watchdog.hpp>
#include <wsd/PlatformUnix.hpp>
#include <wsd/SslConfig.hpp>
#include <wsd/RemoteConfig.hpp>
#include <wsd/SpecialBrokers.hpp>

#endif
