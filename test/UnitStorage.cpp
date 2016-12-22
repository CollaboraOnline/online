/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <iostream>

#include "Exceptions.hpp"
#include "Log.hpp"
#include "Unit.hpp"
#include "UnitHTTP.hpp"
#include "helpers.hpp"

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

    virtual bool filterLoad(const std::string &/* sessionId */,
                            const std::string &/* jailId */,
                            bool &/* result */)
    {
        if (_phase == Phase::Filter)
        {
            _phase = Phase::Reload;
            LOG_INF("Throwing low disk space exception.");
            throw StorageSpaceLowException("test: low disk space");
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

    virtual void invokeTest()
    {
        switch (_phase)
        {
        case Phase::Load:
            _phase = Phase::Filter;
            loadDocument();
            break;
        case Phase::Filter:
            break;
        case Phase::Reload:
            loadDocument();
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
