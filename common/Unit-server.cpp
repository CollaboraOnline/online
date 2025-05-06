/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "Unit.hpp"

// A "server" COOL is always running on a Unixish OS, so we can
// include this unconditionally.
#include <dlfcn.h>

#include "Log.hpp"
#include "Util.hpp"
#include <test/testlog.hpp>

UnitBase** UnitBase::linkAndCreateUnit([[maybe_unused]] UnitType type,
                                       [[maybe_unused]] const std::string& unitLibPath)
{
#if ENABLE_DEBUG
    DlHandle = dlopen(unitLibPath.c_str(), RTLD_GLOBAL|RTLD_NOW);
    if (!DlHandle)
    {
        LOG_ERR("Failed to load unit-test lib " << dlerror());
        return nullptr;
    }

    // avoid std:string de-allocation during failure / exit.
    UnitLibPath = strdup(unitLibPath.c_str());
    TST_LOG_NAME("UnitBase", "Opened unit-test lib " << UnitLibPath);

    const char *symbol = nullptr;
    switch (type)
    {
        case UnitType::Wsd:
        {
            // Try the multi-test version first.
            CreateUnitHooksFunctionMulti* createHooksMulti =
                reinterpret_cast<CreateUnitHooksFunctionMulti*>(
                    dlsym(DlHandle, "unit_create_wsd_multi"));
            if (createHooksMulti)
            {
                UnitBase** hooks = createHooksMulti();
                if (hooks)
                {
                    std::ostringstream oss;
                    oss << "Loaded UnitTest [" << unitLibPath << "] with: ";
                    for (int i = 0; hooks[i] != nullptr; ++i)
                    {
                        if (i)
                            oss << ", ";
                        oss << hooks[i]->getTestname();
                    }

                    LOG_INF(oss.str());
                    return hooks;
                }
            }

            // Fallback.
            symbol = "unit_create_wsd";
            break;
        }
        case UnitType::Kit:
            symbol = "unit_create_kit";
            break;
        case UnitType::Tool:
            symbol = "unit_create_tool";
            break;
    }

    // Internal consistency sanity check.
    selfTest();

    CreateUnitHooksFunction* createHooks =
        reinterpret_cast<CreateUnitHooksFunction*>(dlsym(DlHandle, symbol));

    if (!createHooks)
    {
        LOG_ERR("No " << symbol << " symbol in " << unitLibPath);
        return nullptr;
    }
    TST_LOG_NAME("UnitBase", "Hooked symbol " << symbol << " from unit-test lib " << UnitLibPath);

    UnitBase* hooks = createHooks();
    if (hooks)
        return new UnitBase* [2] { hooks, nullptr };

    LOG_ERR("No wsd unit-tests found in " << unitLibPath);
#endif // ENABLE_DEBUG

    return nullptr;
}

void UnitBase::closeUnit()
{
  if (DlHandle)
        dlclose(DlHandle);
    DlHandle = nullptr;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
