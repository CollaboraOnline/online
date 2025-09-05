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
#include <wsd/Platform-unix.hpp>
#include <wsd/Ssl-config.hpp>
#include <wsd/RemoteConfig.hpp>
#include <wsd/SpecialBrokers.hpp>

#endif