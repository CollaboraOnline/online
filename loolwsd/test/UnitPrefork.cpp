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
#include <iostream>

#include "Util.hpp"
#include "Unit.hpp"

#include <Poco/Timestamp.h>
using Poco::Timestamp;

class UnitPrefork : public UnitWSD
{
    int _numStarted;
    const int _numToPrefork;
    Timestamp _startTime;
public:
    UnitPrefork()
        : _numStarted(0),
          _numToPrefork(20)
    {
    }
    virtual void preSpawnCount(int &numPrefork) override
    {
        numPrefork = _numToPrefork;
    }
    virtual void newChild() override
    {
        _numStarted++;
        if (_numStarted >= _numToPrefork + 1)
        {
            exitTest(TestResult::TEST_OK);

            Poco::Timestamp::TimeDiff elapsed = _startTime.elapsed();

            std::cout << "Launched " << _numStarted << " in "
                      << (1.0 * elapsed)/Poco::Timestamp::resolution() << std::endl;
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitPrefork();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
