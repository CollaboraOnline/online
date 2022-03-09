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

        config.setBool("per_document.always_save_on_exit", true);
    }

    void assertGetFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        // Note: the expected contents for each scenario
        // is the result of the *previous* phase!
        std::string expectedContents;
        switch (_scenario)
        {
            case Scenario::Disconnect:
                expectedContents = OriginalDocContent;
                break;
            case Scenario::SaveDiscard:
                expectedContents = ModifiedOriginalDocContent; // Disconnect will clobber.
                break;
            case Scenario::CloseDiscard:
            case Scenario::SaveOverwrite:
                LOK_ASSERT_EQUAL_MESSAGE("Unexpected contents in storage",
                                         std::string(ConflictingDocContent), getFileContent());
                setFileContent(OriginalDocContent); // Reset to test overwriting.
                expectedContents = OriginalDocContent;
                break;
            case Scenario::VerifyOverwrite:
                expectedContents = ModifiedOriginalDocContent;
                break;
        }

        LOK_ASSERT_EQUAL_MESSAGE("Unexpected contents in storage", expectedContents,
                                 getFileContent());
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        switch (_scenario)
        {
            case Scenario::Disconnect:
                LOG_TST("Clobbered in the disconnect scenario");
                break;
            case Scenario::SaveDiscard:
            case Scenario::CloseDiscard:
            case Scenario::VerifyOverwrite:
                LOK_ASSERT_FAIL("Unexpectedly overwritting the document in storage");
                break;
            case Scenario::SaveOverwrite:
                LOK_ASSERT_EQUAL_MESSAGE("Unexpected contents in storage",
                                         std::string(ModifiedOriginalDocContent), getFileContent());
                LOG_TST("Closing the document to verify its contents after reloading");
                WSD_CMD("closedocument");
                break;
        }

        return nullptr;
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWOPISaveOnExit(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
