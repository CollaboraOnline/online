/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "Log.hpp"
#include "Protocol.hpp"
#include "Unit.hpp"
#include "UnitHTTP.hpp"
#include "helpers.hpp"

using namespace helpers;

class UnitMinSocketBufferSize: public UnitWSD
{
    enum {
        PHASE_LOAD,             // load the document
        PHASE_REQUEST,          // Request tiles etc.
        PHASE_CHECK_RESPONSE    // Check if we got correct response
    } _phase;
    std::string _docURL, _docPath;
    std::unique_ptr<UnitWebSocket> _ws;
public:
    UnitMinSocketBufferSize() :
        _phase(PHASE_LOAD)
    {
    }

    virtual void invokeTest()
    {
        switch (_phase)
        {
        case PHASE_LOAD:
        {
            getDocumentPathAndURL("Example.odt", _docPath, _docURL);
            _ws = std::unique_ptr<UnitWebSocket>(new UnitWebSocket(_docURL));
            assert(_ws.get());

            _phase = PHASE_REQUEST;
            LOG_DBG("Document loaded successfully.");
            break;
        }
        case PHASE_REQUEST:
        {
            const std::string loadMsg = "load url=" + _docURL;
            const std::string tilecombineMsg = "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,11520,0,3840,7680,11520,0,3840,7680,11520,0,3840,7680,11520,0,3840,7680,11520 tileposy=0,0,0,0,3840,3840,3840,3840,7680,7680,7680,7680,11520,11520,11520,11520,15360,15360,15360,15360 tilewidth=3840 tileheight=3840";
            _ws->getLOOLWebSocket()->sendFrame(loadMsg.data(), loadMsg.size());
            _ws->getLOOLWebSocket()->sendFrame(tilecombineMsg.data(), tilecombineMsg.size());

            LOG_DBG("Tilecombine request sent");
            _phase = PHASE_CHECK_RESPONSE;
            break;
        }
        case PHASE_CHECK_RESPONSE:
            LOG_DBG("Checking if get back all the tiles");
            int nTiles = 20;
            bool success = true;
            while (nTiles--)
            {
                const auto tile = getResponseMessage(*_ws->getLOOLWebSocket(), "tile: part=0 width=256 height=256", "Waiting for tiles ...");
                const auto firstLine = LOOLProtocol::getFirstLine(tile);
                LOG_DBG("Tile received " << firstLine);
                if (!LOOLProtocol::matchPrefix("tile:", firstLine))
                {
                    success = false;
                }
            }

            exitTest(success ? TestResult::TEST_OK : TestResult::TEST_FAILED);
            break;
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitMinSocketBufferSize();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
