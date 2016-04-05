/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <dlfcn.h>
#include <ftw.h>
#include <cassert>
#include "Util.hpp"
#include "Unit.hpp"

UnitHooks *UnitHooks::_global = nullptr;

UnitHooks *UnitHooks::linkAndCreateUnit(const std::string &unitLibPath)
{
    void *dlHandle = dlopen(unitLibPath.c_str(), RTLD_GLOBAL|RTLD_NOW);
    if (!dlHandle)
    {
        Log::error("Failed to load " + unitLibPath + ": " + std::string(dlerror()));
        return NULL;
    }

    CreateUnitHooksFunction* createHooks;
    createHooks = (CreateUnitHooksFunction *)dlsym(dlHandle, CREATE_UNIT_HOOKS_SYMBOL);
    if (!createHooks)
    {
        Log::error("No " CREATE_UNIT_HOOKS_SYMBOL " symbol in " + unitLibPath);
        return NULL;
    }
    UnitHooks *pHooks = createHooks();

    if (pHooks)
        pHooks->setHandle(dlHandle);

    return pHooks;
}

bool UnitHooks::init(const std::string &unitLibPath)
{
    if (!unitLibPath.empty())
        _global = linkAndCreateUnit(unitLibPath);
    else
        _global = new UnitHooks();

    return _global != NULL;
}

UnitHooks::UnitHooks()
    : _dlHandle(NULL)
{
}

UnitHooks::~UnitHooks()
{
    if (_dlHandle)
        dlclose(_dlHandle);
    _dlHandle = NULL;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
