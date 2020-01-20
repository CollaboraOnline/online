/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <memory>
#include <string>

#include <Poco/URI.h>
#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <Util.hpp>
#include <helpers.hpp>

class LOOLWebSocket;

/// TIFF load testcase.
class UnitTiffLoad : public UnitWSD
{
public:
    UnitTiffLoad();

    void invokeTest() override;
};

UnitTiffLoad::UnitTiffLoad() {}

void UnitTiffLoad::invokeTest()
{
    const char testname[] = "UnitTiffLoad";

    // Load a document which has a TIFF image in it.
    std::string documentPath;
    std::string documentURL;
    helpers::getDocumentPathAndURL("tiff.odt", documentPath, documentURL, testname);
    std::shared_ptr<LOOLWebSocket> socket = helpers::loadDocAndGetSocket(
        Poco::URI(helpers::getTestServerURI()), documentURL, testname);

    // Select the image.
    helpers::sendTextFrame(socket, "uno .uno:JumpToNextFrame", testname);
    helpers::sendTextFrame(socket, "rendershapeselection mimetype=image/svg+xml", testname);

    // Make sure we can get an SVG representation of the image; this failed as the TIFF import was
    // broken.
    const std::string content
        = helpers::assertResponseString(socket, "shapeselectioncontent:", testname);
    LOK_ASSERT(Util::startsWith(content, "shapeselectioncontent:\n"));

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitTiffLoad(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
