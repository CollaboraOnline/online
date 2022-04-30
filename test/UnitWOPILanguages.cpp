/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "Unit.hpp"
#include "lokassert.hpp"
#include <WopiTestServer.hpp>
#include <Log.hpp>

class UnitWopiLanguages : public WopiTestServer
{
    STATE_ENUM(Phase, Load, Save, Done) _phase;

    int _loaded_count;

public:
    UnitWopiLanguages()
        : WopiTestServer("UnitWopiLanguages", "hello.odt")
        , _phase(Phase::Load)
        , _loaded_count(0)
    {
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded #" << ++_loaded_count << ": [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::Save);

        if (_loaded_count == 1)
        {
            LOG_TST("Loading second view (Hungarian)");
            WSD_CMD_BY_CONNECTION_INDEX(1, "load url=" + getWopiSrc() + " lang=hu");
        }
        else if (_loaded_count == 2)
        {
            // Save using the second view (Hungarian).
            WSD_CMD_BY_CONNECTION_INDEX(1, "save dontTerminateEdit=0 dontSaveIfUnmodified=0");
        }

        return true;
    }

    bool onDocumentSaved(const std::string& message, bool success, const std::string& result) override
    {
        if (success || result == "unmodified")
        {
            passTest("Document saved successfully: " + message);
        }
        else
        {
            failTest("Failed to save the document (Core is out-of-date or it has a regression: " +
                     message);
        }

        return true;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                // Always transition before issuing commands.
                TRANSITION_STATE(_phase, Phase::Save);

                LOG_TST("Creating first connection");
                initWebsocket("/wopi/files/0?access_token=anything");

                LOG_TST("Creating second connection");
                addWebSocket();

                LOG_TST("Loading first view (English)");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc() + " lang=en");
                break;
            }
            case Phase::Save:
            {
            }
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWopiLanguages(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
