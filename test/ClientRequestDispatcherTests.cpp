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

#include <wsd/ContentType.hpp>

#include <test/lokassert.hpp>
#include <test/testlog.hpp>

#include <cppunit/TestAssert.h>
#include <cppunit/extensions/HelperMacros.h>

#include <string>

/// Unit tests for ContentType utilities (used by ClientRequestDispatcher).
class ClientRequestDispatcherTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(ClientRequestDispatcherTests);

    CPPUNIT_TEST(testGetContentType_Writer);
    CPPUNIT_TEST(testGetContentType_Calc);
    CPPUNIT_TEST(testGetContentType_Impress);
    CPPUNIT_TEST(testGetContentType_Draw);
    CPPUNIT_TEST(testGetContentType_MSOffice);
    CPPUNIT_TEST(testGetContentType_OOXML);
    CPPUNIT_TEST(testGetContentType_Images);
    CPPUNIT_TEST(testGetContentType_Other);
    CPPUNIT_TEST(testGetContentType_Unknown);
    CPPUNIT_TEST(testGetContentType_PathWithDirs);
    CPPUNIT_TEST(testGetContentType_CaseExtension);

    CPPUNIT_TEST(testIsSpreadsheet_Calc);
    CPPUNIT_TEST(testIsSpreadsheet_Excel);
    CPPUNIT_TEST(testIsSpreadsheet_OOXML);
    CPPUNIT_TEST(testIsSpreadsheet_NotSpreadsheet);

    CPPUNIT_TEST_SUITE_END();

    void testGetContentType_Writer()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT_EQUAL_STR("application/vnd.oasis.opendocument.text",
                             ContentType::fromFileName("test.odt"));
        LOK_ASSERT_EQUAL_STR("application/vnd.oasis.opendocument.text-flat-xml",
                             ContentType::fromFileName("test.fodt"));
        LOK_ASSERT_EQUAL_STR("application/vnd.sun.xml.writer",
                             ContentType::fromFileName("test.sxw"));
    }

    void testGetContentType_Calc()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT_EQUAL_STR("application/vnd.oasis.opendocument.spreadsheet",
                             ContentType::fromFileName("test.ods"));
        LOK_ASSERT_EQUAL_STR("application/vnd.oasis.opendocument.spreadsheet-flat-xml",
                             ContentType::fromFileName("test.fods"));
        LOK_ASSERT_EQUAL_STR("application/vnd.sun.xml.calc",
                             ContentType::fromFileName("test.sxc"));
    }

    void testGetContentType_Impress()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT_EQUAL_STR("application/vnd.oasis.opendocument.presentation",
                             ContentType::fromFileName("test.odp"));
        LOK_ASSERT_EQUAL_STR("application/vnd.oasis.opendocument.presentation-flat-xml",
                             ContentType::fromFileName("test.fodp"));
        LOK_ASSERT_EQUAL_STR("application/vnd.sun.xml.impress",
                             ContentType::fromFileName("test.sxi"));
    }

    void testGetContentType_Draw()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT_EQUAL_STR("application/vnd.oasis.opendocument.graphics",
                             ContentType::fromFileName("test.odg"));
        LOK_ASSERT_EQUAL_STR("application/vnd.oasis.opendocument.graphics-flat-xml",
                             ContentType::fromFileName("test.fodg"));
    }

    void testGetContentType_MSOffice()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT_EQUAL_STR("application/msword",
                             ContentType::fromFileName("test.doc"));
        LOK_ASSERT_EQUAL_STR("application/msword",
                             ContentType::fromFileName("test.dot"));
        LOK_ASSERT_EQUAL_STR("application/vnd.ms-excel",
                             ContentType::fromFileName("test.xls"));
        LOK_ASSERT_EQUAL_STR("application/vnd.ms-powerpoint",
                             ContentType::fromFileName("test.ppt"));
    }

    void testGetContentType_OOXML()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT_EQUAL_STR(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ContentType::fromFileName("test.docx"));
        LOK_ASSERT_EQUAL_STR(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ContentType::fromFileName("test.xlsx"));
        LOK_ASSERT_EQUAL_STR(
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ContentType::fromFileName("test.pptx"));
        LOK_ASSERT_EQUAL_STR("application/vnd.ms-excel.sheet.macroEnabled.12",
                             ContentType::fromFileName("test.xlsm"));
        LOK_ASSERT_EQUAL_STR("application/vnd.ms-excel.sheet.binary.macroEnabled.12",
                             ContentType::fromFileName("test.xlsb"));
    }

    void testGetContentType_Images()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT_EQUAL_STR("image/svg+xml", ContentType::fromFileName("drawing.svg"));
        LOK_ASSERT_EQUAL_STR("image/png", ContentType::fromFileName("photo.png"));
        LOK_ASSERT_EQUAL_STR("image/jpeg", ContentType::fromFileName("photo.jpeg"));
        LOK_ASSERT_EQUAL_STR("image/jpg", ContentType::fromFileName("photo.jpg"));
        LOK_ASSERT_EQUAL_STR("image/bmp", ContentType::fromFileName("photo.bmp"));
        LOK_ASSERT_EQUAL_STR("image/gif", ContentType::fromFileName("photo.gif"));
        LOK_ASSERT_EQUAL_STR("image/tiff", ContentType::fromFileName("photo.tiff"));
    }

    void testGetContentType_Other()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT_EQUAL_STR("application/pdf", ContentType::fromFileName("document.pdf"));
        LOK_ASSERT_EQUAL_STR("text/rtf", ContentType::fromFileName("document.rtf"));
        LOK_ASSERT_EQUAL_STR("text/plain", ContentType::fromFileName("readme.txt"));
        LOK_ASSERT_EQUAL_STR("text/csv", ContentType::fromFileName("data.csv"));
        LOK_ASSERT_EQUAL_STR("text/tab-separated-values", ContentType::fromFileName("data.tsv"));
    }

    void testGetContentType_Unknown()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT_EQUAL_STR("application/octet-stream", ContentType::fromFileName("file.xyz"));
        LOK_ASSERT_EQUAL_STR("application/octet-stream", ContentType::fromFileName("noextension"));
        LOK_ASSERT_EQUAL_STR("application/octet-stream", ContentType::fromFileName(""));
    }

    void testGetContentType_PathWithDirs()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT_EQUAL_STR("application/vnd.oasis.opendocument.text",
                             ContentType::fromFileName("/path/to/test.odt"));
        LOK_ASSERT_EQUAL_STR(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ContentType::fromFileName("/some/dir/budget.xlsx"));
    }

    void testGetContentType_CaseExtension()
    {
        constexpr std::string_view testname = __func__;
        // Poco::Path::getExtension() preserves case; the map uses lowercase keys.
        // Uppercase extensions should fall through to octet-stream.
        LOK_ASSERT_EQUAL_STR("application/octet-stream",
                             ContentType::fromFileName("test.ODT"));
    }

    void testIsSpreadsheet_Calc()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT(ContentType::isSpreadsheet("budget.ods"));
    }

    void testIsSpreadsheet_Excel()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT(ContentType::isSpreadsheet("budget.xls"));
    }

    void testIsSpreadsheet_OOXML()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT(ContentType::isSpreadsheet("budget.xlsx"));
    }

    void testIsSpreadsheet_NotSpreadsheet()
    {
        constexpr std::string_view testname = __func__;
        LOK_ASSERT(!ContentType::isSpreadsheet("document.odt"));
        LOK_ASSERT(!ContentType::isSpreadsheet("slides.pptx"));
        LOK_ASSERT(!ContentType::isSpreadsheet("drawing.odg"));
        LOK_ASSERT(!ContentType::isSpreadsheet("photo.png"));
        LOK_ASSERT(!ContentType::isSpreadsheet("unknown.xyz"));

        // xlsm and xlsb have different content types not in the isSpreadsheet check
        LOK_ASSERT(!ContentType::isSpreadsheet("macro.xlsm"));
    }
};

CPPUNIT_TEST_SUITE_REGISTRATION(ClientRequestDispatcherTests);

/* vim:set shiftwidth=4 expandtab: */
