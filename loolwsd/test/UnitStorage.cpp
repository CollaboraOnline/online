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
#include "UnitHTTP.hpp"

class UnitStorage : public UnitWSD
{
public:
    virtual bool createStorage(const std::string& /* jailRoot */,
                               const std::string& /* jailPath */,
                               const Poco::URI& /* uri */,
                               std::unique_ptr<StorageBase> & /* rStorage */)
    {
        // leave rStorage empty - fail to return anything
        return true;
    }
    virtual void invokeTest()
    {
        // FIXME: push through to the right place to exercise this.
        exitTest(TestResult::TEST_OK);
        UnitHTTPServerResponse response;
        UnitHTTPServerRequest request(response, std::string(CHILD_URI));
        UnitWSD::testHandleRequest(TestRequest::TEST_REQ_PRISONER,
                                   request, response);
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitStorage();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
