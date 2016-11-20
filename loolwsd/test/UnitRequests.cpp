/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <iostream>

#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/URI.h>

#include "Log.hpp"
#include "Unit.hpp"
#include "UnitHTTP.hpp"
#include "helpers.hpp"

using namespace helpers;

// Inside the WSD process
class UnitRequests : public UnitWSD
{
    enum {
        PHASE_LOAD,
        PHASE_FILTER,
        PHASE_FILTERED
    } _phase;

    TestResult _testResult;
    std::unique_ptr<UnitWebSocket> _ws;
public:
    UnitRequests() :
        _phase(PHASE_LOAD)
    {
        std::cerr << "UnitRequests startup\n";
    }

    virtual bool filterHandleRequest(
        TestRequest type,
	    Poco::Net::HTTPServerRequest& request,
	    Poco::Net::HTTPServerResponse& /*response*/) override
    {
        if (_phase == PHASE_FILTER && type == UnitWSD::TestRequest::TEST_REQ_CLIENT)
        {
            std::string uri = request.getURI();
            // Get the embedded document URL: '/lool/docUrl/ws/'
            uri = uri.substr(uri.find("lool/") + std::string("lool/").size());
            uri = uri.substr(0, uri.find("/ws"));
            Poco::URI requestUri(uri);
            _testResult = TestResult::TEST_OK;
            // If this is a simple encoded string, it would be treated as
            // relative, otherwise non-relative.
            // We require this embedded url to be encoded as otherwise it would
            // be treated as a resource on the server due to the presence of
            // un-encoded '/'
            if (!requestUri.isRelative())
            {
                _testResult = TestResult::TEST_FAILED;
            }

            _phase = PHASE_FILTERED;
        }
        return false;
    }

    void loadDocument()
    {
        std::string docPath;
        std::string docURL;
        getDocumentPathAndURL("empty.odt", docPath, docURL);
        _ws = std::unique_ptr<UnitWebSocket>(new UnitWebSocket(docURL));
        assert(_ws.get());
    }

    virtual void invokeTest() override
    {
        switch(_phase)
        {
            case PHASE_LOAD:
                _phase = PHASE_FILTER;
                loadDocument();
                break;
            case PHASE_FILTER:
                break;
            case PHASE_FILTERED:
                exitTest(_testResult);
                break;
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitRequests();
}
