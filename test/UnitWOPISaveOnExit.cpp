/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "WOPIUploadConflictCommon.hpp"

#include <string>
#include <memory>

#include <Poco/Net/HTTPRequest.h>

#include "Util.hpp"
#include "Log.hpp"
#include "Unit.hpp"
#include "UnitHTTP.hpp"
#include "helpers.hpp"
#include "lokassert.hpp"

class UnitWOPISaveOnExit : public WOPIUploadConflictCommon
{
    using Base = WOPIUploadConflictCommon;

    using Base::Phase;
    using Base::Scenario;

    using Base::ConflictingDocContent;
    using Base::ModifiedOriginalDocContent;
    using Base::OriginalDocContent;

public:
    UnitWOPISaveOnExit()
        : Base("UnitWOPISaveOnExit", OriginalDocContent)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        Base::configure(config);

        // Small value to shorten the test run time.
        config.setUInt("per_document.limit_store_failures", 2);
        config.setBool("per_document.always_save_on_exit", true);
    }

    void assertGetFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        assertGetFileCount();
    }


    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        assertPutFileCount();

        switch (_scenario)
        {
            case Scenario::Disconnect:
                LOG_TST("Clobbered in the disconnect scenario");
                break;
            case Scenario::SaveDiscard:
            case Scenario::CloseDiscard:
            case Scenario::VerifyOverwrite:
                break;
            case Scenario::SaveOverwrite:
                LOK_ASSERT_EQUAL_MESSAGE("Unexpected contents in storage",
                                         std::string(ConflictingDocContent), getFileContent());
                LOG_TST("Closing the document to verify its contents after reloading");
                WSD_CMD("closedocument");
                break;
        }

        return nullptr;
    }

    void onDocBrokerCreate(const std::string& docKey) override
    {
        Base::onDocBrokerCreate(docKey);

        // When overwriting, we will do so twice.
        // Once to find out that we have a conflict and another time to force it.
        if (_scenario == Scenario::SaveOverwrite)
        {
            setExpectedPutFile(2);
        }
        else
        {
            // With always_save_on_exit, we expect exactly one PutFile per document.
            if (_scenario == Scenario::VerifyOverwrite)
            {
                //FIXME: this uncovers a bug with unmodified files!
                setExpectedPutFile(0);
            }
            else
            {
                setExpectedPutFile(1);
            }
        }
    }

    void onDocBrokerDestroy(const std::string& docKey) override
    {
        LOG_TST("Testing " << toString(_scenario) << " with dockey [" << docKey << "] closed.");
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        std::string expectedContents;
        switch (_scenario)
        {
            case Scenario::Disconnect:
                expectedContents = ModifiedOriginalDocContent; //TODO: save-as in this case.
                break;
            case Scenario::SaveDiscard:
                expectedContents = ConflictingDocContent;
                break;
            case Scenario::CloseDiscard:
                expectedContents = ConflictingDocContent;
                break;
            case Scenario::SaveOverwrite:
                expectedContents = ModifiedOriginalDocContent;
                break;
            case Scenario::VerifyOverwrite:
                expectedContents = OriginalDocContent;
                break;
        }

        LOK_ASSERT_EQUAL_MESSAGE("Unexpected contents in storage", expectedContents,
                                 getFileContent());

        Base::onDocBrokerDestroy(docKey);
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWOPISaveOnExit(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
