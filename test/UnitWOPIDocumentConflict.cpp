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
    using WOPIUploadConflictCommon::Phase;
    using WOPIUploadConflictCommon::Scenario;

    using WOPIUploadConflictCommon::ConflictingDocContent;
    using WOPIUploadConflictCommon::ModifiedOriginalDocContent;
    using WOPIUploadConflictCommon::OriginalDocContent;

public:
    UnitWOPIDocumentConflict()
        : WOPIUploadConflictCommon("UnitWOPIDocumentConflict", OriginalDocContent)
    {
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWOPIDocumentConflict(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
