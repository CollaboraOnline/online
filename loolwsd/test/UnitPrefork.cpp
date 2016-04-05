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

class UnitPrefork : public UnitHooks {
public:
    UnitPrefork()
    {
    }
    virtual void preSpawnCount(int &numPrefork)
    {
        numPrefork = 20;
        Log::error("Hello world");
    }
};

UnitHooks *unit_create(void)
{
    return new UnitPrefork();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
