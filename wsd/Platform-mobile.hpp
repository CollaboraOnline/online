#pragma once

//  This file's purpose is to reduce clutter in other files
//  by isolating conditional mobile-related includes.

#if MOBILEAPP

#include <Kit.hpp>
#ifdef IOS
#include "ios.h"
#elif defined(GTKAPP)
#include "gtk.hpp"
#elif defined(__ANDROID__)
#include "androidapp.hpp"
#elif WASMAPP
#include "wasmapp.hpp"
#endif

#endif // MOBILEAPP