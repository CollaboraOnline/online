/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <iostream>

#include <Exceptions.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>

using namespace helpers;

class UnitStorage : public UnitWSD
{
    enum class Phase {
        Load,             // load the document
        Filter,           // throw filter exception
        Reload,           // re-load the document
    } _phase;
    std::unique_ptr<UnitWebSocket> _ws;
public:
    UnitStorage() :
        _phase(Phase::Load)
    {
    }

    bool filterCheckDiskSpace(const std::string & /* path */,
                              bool &newResult) override
    {
        newResult = _phase != Phase::Filter;
        return true;
    }

    void loadDocument(bool bExpectFailure)
    {
        std::string docPath;
        std::string docURL;
        getDocumentPathAndURL("empty.odt", docPath, docURL, "unitStorage ");
        _ws = std::unique_ptr<UnitWebSocket>(new UnitWebSocket(docURL));
        assert(_ws.get());
        int flags = 0, len;;
        char reply[4096];
        while ((len = _ws->getLOOLWebSocket()->receiveFrame(reply, sizeof(reply) - 1, flags)) > 0)
        {
            reply[len] = '\0';
            if (bExpectFailure &&
                !strcmp(reply, "error: cmd=internal kind=diskfull"))
            {
                LOG_TRC("Got expected load failure error");
                _phase = Phase::Reload;
                break;
            }
            else if (!bExpectFailure &&
                     !strncmp(reply, "status: ", sizeof("status: ") - 1))
            {
                LOG_TRC("Load completed as expected");
                break;
            }
            else
                std::cerr << "reply '" << reply << "'\n";
        }
    }

    void invokeTest() override
    {
        LOG_TRC("invokeTest: " << (int)_phase);
        switch (_phase)
        {
        case Phase::Load:
            _phase = Phase::Filter;
            loadDocument(true);
            break;
        case Phase::Filter:
            break;
        case Phase::Reload:
            loadDocument(false);
            _ws.reset();
            exitTest(TestResult::Ok);
            break;
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitStorage();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
