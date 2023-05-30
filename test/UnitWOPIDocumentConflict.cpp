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
#include "UnitHTTP.hpp"
#include "helpers.hpp"
#include "lokassert.hpp"

class UnitWOPIDocumentConflict : public WOPIUploadConflictCommon
{
    using Base = WOPIUploadConflictCommon;

    using Base::Phase;
    using Base::Scenario;

    using Base::ConflictingDocContent;
    using Base::ModifiedOriginalDocContent;
    using Base::OriginalDocContent;

public:
    UnitWOPIDocumentConflict()
        : Base("UnitWOPIDocumentConflict", OriginalDocContent)
    {
    }

    std::unique_ptr<http::Response>
    assertGetFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        assertGetFileCount();

        return nullptr; // Success.
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
            case Scenario::SaveDiscard:
            case Scenario::CloseDiscard:
            case Scenario::VerifyOverwrite:
                LOK_ASSERT_FAIL("Unexpectedly overwritting the document in storage");
                break;
            case Scenario::SaveOverwrite:
                LOG_TST("Closing the document to verify its contents after reloading");
                WSD_CMD("closedocument");
                break;
        }

        return nullptr;
    }

    void onDocBrokerDestroy(const std::string& docKey) override
    {
        LOG_TST("Testing " << toString(_scenario) << " with dockey [" << docKey << "] closed.");
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        std::string expectedContents;
        switch (_scenario)
        {
            case Scenario::Disconnect:
                expectedContents = ConflictingDocContent; //TODO: save-as in this case.
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

UnitBase* unit_create_wsd(void) { return new UnitWOPIDocumentConflict(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
