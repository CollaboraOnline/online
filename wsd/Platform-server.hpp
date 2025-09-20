#pragma once

//  This file's purpose is to reduce clutter in other files
//  by isolating conditional unix-related includes.

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
#include <wsd/RemoteConfig.hpp>
#include <wsd/SpecialBrokers.hpp>

#ifdef __linux__
#include <common/security.h>
#include <sys/inotify.h>
#endif // __linux__

#if ENABLE_SSL
#include <Poco/Net/SSLManager.h>
#include <SslSocket.hpp>
#endif // ENABLE_SSL

#endif // !MOBILEAPP