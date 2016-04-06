/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
#ifndef LOOL_UNIT_HPP
#define LOOL_UNIT_HPP

#include <string>

class UnitHooks;

#define CREATE_UNIT_HOOKS_SYMBOL "unit_create"
typedef UnitHooks *(CreateUnitHooksFunction)();
extern "C" { UnitHooks *unit_create(void); }

/// Derive your unit test / hooks from me.
class UnitHooks
{
    void *_dlHandle;
    bool _setRetValue;
    int  _retValue;
    static UnitHooks *_global;

    void setHandle(void *dlHandle) { _dlHandle = dlHandle; }
    static UnitHooks *linkAndCreateUnit(const std::string &unitLibPath);
protected:
    enum TestResult { TEST_FAILED, TEST_OK, TEST_TIMED_OUT };
    /// Encourages loolwsd to exit with this value (unless hooked)
    void exitTest(TestResult result);
public:
             UnitHooks();
    virtual ~UnitHooks();
	static UnitHooks &get() { return *_global; }
    /// Load unit test hook shared library from this path
    static bool init(const std::string &unitLibPath);

    /// Tweak the count of pre-spawned kits.
	virtual void preSpawnCount(int & /* numPrefork */) {}
    /// Tweak the return value from LOOLWSD.
	virtual void returnValue(int & /* retValue */);
    /// When a new child kit process reports
    virtual void newChild() {}
    /// If the test times out
    virtual void timeout();
};

#endif // LOOL_UNIT_HPP

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
