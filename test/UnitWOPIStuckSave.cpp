/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "HttpRequest.hpp"
#include "lokassert.hpp"

#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <common/Message.hpp>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Util/LayeredConfiguration.h>

/// Test saving with simulated failing.
/// We modify the document and close.
/// The document must then be saved, but
/// the save notification is consumed in
/// the test and never reaches the DocBroker.
class UnitWOPIStuckSave : public WopiTestServer
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitModifiedStatus, WaitClose)
    _phase;

public:
    UnitWOPIStuckSave()
        : WopiTestServer("UnitWOPIStuckSave")
        , _phase(Phase::Load)
    {
        // We need more time to retry saving.
        setTimeout(std::chrono::seconds(200));
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        WopiTestServer::configure(config);

        // Small value to shorten the test run time.
        config.setUInt("per_document.limit_store_failures", 2);
        config.setBool("per_document.always_save_on_exit", true);
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOK_ASSERT_FAIL("Unexpected PutFile");

        return nullptr;
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);

        WSD_CMD("key type=input char=97 key=0");
        WSD_CMD("key type=up char=0 key=512");

        return true;
    }

    /// The document is modified. Save it.
    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("onDocumentModified: Doc (WaitModifiedStatus): [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);

        TRANSITION_STATE(_phase, Phase::WaitClose);

        LOG_TST("Closing the document, expecting saving, which will get 'stuck'");
        WSD_CMD("closedocument");

        return true;
    }

    bool onFilterLOKitMessage(const std::shared_ptr<Message>& message) override
    {
        LOG_TST("Filtering: [" << message->firstLine() << ']');

        constexpr char saveMsg[] = "save autosave=";
        constexpr char unoModifiedStatus[] = ".uno:ModifiedStatus";
        if (message->contains(saveMsg, sizeof(saveMsg) - 1))
        {
            LOG_TST("Dropping save message to simulate stuck save");
            return true; // Do not process the message further.
        }
        else if (message->contains(unoModifiedStatus, sizeof(unoModifiedStatus) - 1))
        {
            if (message->tokens().size() > 1)
            {
                StringVector stateTokens(StringVector::tokenize(message->tokens()[1], '='));
                if (stateTokens.size() == 2 && stateTokens.equals(0, ".uno:ModifiedStatus"))
                {
                    // Filter out all the ModifiedStatus=false messages.
                    // This will leave the doc modified.
                    return !stateTokens.equals(1, "true");
                }
            }
        }

        return false;
    }

    bool onDataLoss(const std::string& reason) override
    {
        LOK_ASSERT_STATE(_phase, Phase::WaitClose);
        passTest("Finished with the data-loss check: " + reason);
        return failed();
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                LOG_TST("Load: initWebsocket");
                initWebsocket("/wopi/files/0?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());
                break;
            }
            case Phase::WaitLoadStatus:
                break;
            case Phase::WaitModifiedStatus:
                break;
            case Phase::WaitClose:
                break;
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWOPIStuckSave(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
