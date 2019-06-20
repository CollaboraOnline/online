/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Test various copy/paste pieces ...

#include <config.h>

#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <wsd/LOOLWSD.hpp>

#include <test.hpp>

// Inside the WSD process
class UnitCopyPaste : public UnitWSD
{
public:
    UnitCopyPaste() {}

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);
        // force HTTPS - to test harder
        config.setBool("ssl.enable", true);
    }

    void invokeTest() override
    {
        std::string testname = "copypaste";

        // Load a doc with the cursor saved at a top row.
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("empty.ods", documentPath, documentURL, testname);

        std::shared_ptr<LOOLWebSocket> socket =
            helpers::loadDocAndGetSocket(Poco::URI(helpers::getTestServerURI()), documentURL, testname);
    }
};


// Inside the forkit & kit processes
class UnitKitCopyPaste : public UnitKit
{
public:
    UnitKitCopyPaste()
    {
    }

    bool filterKitMessage(WebSocketHandler *, std::string &message) override
    {
        std::cerr << "kit message " << message << "\n";
        return false;
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitCopyPaste();
}

UnitBase *unit_create_kit(void)
{
    return new UnitKitCopyPaste();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
