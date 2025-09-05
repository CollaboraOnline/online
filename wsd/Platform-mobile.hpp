#pragma once

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