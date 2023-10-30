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

#include <test/lokassert.hpp>
#include <cppunit/TestAssert.h>
#include <cstddef>

#include <wsd/FileServer.hpp>

#include <cppunit/extensions/HelperMacros.h>

/// File-Serve White-Box unit-tests.
class FileServeTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(FileServeTests);
    CPPUNIT_TEST(testUIDefaults);
    CPPUNIT_TEST(testCSSVars);
    CPPUNIT_TEST_SUITE_END();

    void testUIDefaults();
    void testCSSVars();
};

void FileServeTests::testUIDefaults()
{
    constexpr auto testname = __func__;

    std::string uiMode;
    std::string uiTheme;
    std::string savedUIState;

    LOK_ASSERT_EQUAL(
        std::string("{\"uiMode\":\"classic\"}"),
        FileServerRequestHandler::uiDefaultsToJSON("UIMode=classic;huh=bleh;", uiMode, uiTheme, savedUIState));
    LOK_ASSERT_EQUAL(std::string("classic"), uiMode);

    LOK_ASSERT_EQUAL(
        std::string("{\"spreadsheet\":{\"ShowSidebar\":false},\"text\":{\"ShowRuler\":true}}"),
        FileServerRequestHandler::uiDefaultsToJSON("TextRuler=true;SpreadsheetSidebar=false",
                                                   uiMode, uiTheme, savedUIState));
    LOK_ASSERT_EQUAL(std::string(""), uiMode);

    LOK_ASSERT_EQUAL(
        std::string("{\"presentation\":{\"ShowStatusbar\":false},\"spreadsheet\":{\"ShowSidebar\":"
                    "false},\"text\":{\"ShowRuler\":true},\"uiMode\":\"notebookbar\"}"),
        FileServerRequestHandler::uiDefaultsToJSON(
            ";;UIMode=notebookbar;;PresentationStatusbar=false;;TextRuler=true;;bah=ugh;;"
            "SpreadsheetSidebar=false",
            uiMode, uiTheme, savedUIState));

    LOK_ASSERT_EQUAL(std::string("{\"drawing\":{\"ShowStatusbar\":true},\"presentation\":{"
                                 "\"ShowStatusbar\":false},\"spreadsheet\":{\"ShowSidebar\":false},"
                                 "\"text\":{\"ShowRuler\":true},\"uiMode\":\"notebookbar\"}"),
                     FileServerRequestHandler::uiDefaultsToJSON(
                         ";;UIMode=notebookbar;;PresentationStatusbar=false;;TextRuler=true;;bah="
                         "ugh;;SpreadsheetSidebar=false;;DrawingStatusbar=true",
                         uiMode, uiTheme, savedUIState));

    LOK_ASSERT_EQUAL(std::string("notebookbar"), uiMode);
}

void FileServeTests::testCSSVars()
{
    constexpr auto testname = __func__;

    LOK_ASSERT_EQUAL(
        std::string("<style>:root {--co-somestyle-text:#123456;--co-somestyle-size:15px;}</style>"),
        FileServerRequestHandler::cssVarsToStyle(
            "--co-somestyle-text=#123456;--co-somestyle-size=15px;"));

    LOK_ASSERT_EQUAL(
        std::string("<style>:root {--co-somestyle-text:#123456;--co-somestyle-size:15px;}</style>"),
        FileServerRequestHandler::cssVarsToStyle(
            ";;--co-somestyle-text=#123456;;--co-somestyle-size=15px;;;"));

    LOK_ASSERT_EQUAL(
        std::string("<style>:root {--co-somestyle-text:#123456;--co-somestyle-size:15px;}</style>"),
        FileServerRequestHandler::cssVarsToStyle(
            "--co-somestyle-text=#123456;;--co-somestyle-size=15px;--co-sometext#324;;"));

    LOK_ASSERT_EQUAL(std::string("<style>:root {--co-somestyle-text:#123456;}</style>"),
                     FileServerRequestHandler::cssVarsToStyle(
                         "--co-somestyle-text=#123456;;--some-val=3453--some-other-val=4536;;"));
}

CPPUNIT_TEST_SUITE_REGISTRATION(FileServeTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
