#pragma once

#ifdef __linux__

#if !MOBILEAPP
#include <common/security.h>
#include <sys/inotify.h>
#endif // !MOBILEAPP

#endif // __linux__