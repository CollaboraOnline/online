/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * A great place for testing out of bound data, as found by
 * UnitFuzz.
 */

#include <config.h>

#include <Common.hpp>
#include <Protocol.hpp>
#include <LOOLWebSocket.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <Util.hpp>

#include <Poco/Timestamp.h>
#include <Poco/Net/HTTPServerRequest.h>

class UnitOOB : public UnitWSD
{
public:
    UnitOOB()
    {
    }

    virtual void invokeTest() override
    {
        UnitHTTPServerResponse response;
        UnitHTTPServerRequest request(response, "nonsense URI");

        // ensure we handle invalid URIs without asserting.
        testHandleRequest(TestRequest::Prisoner, request, response);
        exitTest(TestResult::Ok);
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitOOB();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
