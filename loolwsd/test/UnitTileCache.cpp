/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <fstream>
#include <thread>

#include "Log.hpp"
#include "Unit.hpp"
#include "UnitHTTP.hpp"
#include "Util.hpp"
#include "helpers.hpp"

using namespace helpers;

class UnitTileCache: public UnitWSD
{
    enum {
        PHASE_LOAD,             // load the document
        PHASE_TILE,             // lookup tile method
    } _phase;
    std::unique_ptr<UnitWebSocket> _ws;
public:
    UnitTileCache() :
        _phase(PHASE_LOAD)
    {
    }

    virtual void lookupTile(int part, int width, int height, int tilePosX, int tilePosY,
                            int tileWidth, int tileHeight, std::unique_ptr<std::fstream>& cacheFile)
    {
        // Call base to fire events.
        UnitWSD::lookupTile(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight, cacheFile);

        // Fail the lookup to force subscription and rendering.
        cacheFile.reset();

        // FIXME: push through to the right place to exercise this.
        exitTest(TestResult::TEST_OK);
    }

    virtual void invokeTest()
    {
        switch (_phase)
        {
        case PHASE_LOAD:
        {
            _phase = PHASE_TILE;
            std::string docPath;
            std::string docURL;
            getDocumentPathAndURL("empty.odt", docPath, docURL);
            _ws = std::unique_ptr<UnitWebSocket>(new UnitWebSocket(docURL));
            assert(_ws.get());

            // FIXME: need to invoke the tile lookup ...
            exitTest(TestResult::TEST_OK);
            break;
        }
        case PHASE_TILE:
            break;
        }
    }

private:
    void clientThread()
    {
        std::thread t([&]()
            {
                try
                {
                }
                catch (const Poco::Exception& exc)
                {
                    exitTest(TestResult::TEST_FAILED);
                }
            });
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitTileCache();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
