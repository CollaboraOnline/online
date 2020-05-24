/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <memory>
#include <ostream>
#include <set>
#include <string>

#include <Poco/Exception.h>
#include <Poco/RegularExpression.h>
#include <Poco/URI.h>
#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <helpers.hpp>

class LOOLWebSocket;

namespace
{
void testStateChanged(const std::string& filename, std::set<std::string>& commands)
{
    const auto testname = "stateChanged_" + filename + ' ';

    Poco::RegularExpression reUno("\\.[a-zA-Z]*\\:[a-zA-Z]*\\=");

    std::shared_ptr<LOOLWebSocket> socket = helpers::loadDocAndGetSocket(filename, Poco::URI(helpers::getTestServerURI()), testname);
    helpers::SocketProcessor(testname, socket,
        [&](const std::string& msg)
        {
            Poco::RegularExpression::MatchVec matches;
            if (reUno.match(msg, 0, matches) > 0 && matches.size() == 1)
            {
                commands.erase(msg.substr(matches[0].offset, matches[0].length));
            }

            return !commands.empty();
        });

    if (!commands.empty())
    {
        std::ostringstream ostr;
        ostr << filename << " : Missing Uno Commands: " << std::endl;
        for (auto & itUno : commands)
        {
            ostr << itUno << std::endl;
        }

        LOK_ASSERT_FAIL(ostr.str());
    }
}
}

/// Test suite for UNO commands.
class UnitUNOCommand : public UnitWSD
{
    TestResult testStateUnoCommandWriter();
    TestResult testStateUnoCommandCalc();
    TestResult testStateUnoCommandImpress();

public:
    void invokeTest() override;
};

UnitBase::TestResult UnitUNOCommand::testStateUnoCommandWriter()
{
    std::set<std::string> writerCommands
    {
        ".uno:BackColor=",
        ".uno:BackgroundColor=",
        ".uno:Bold=",
        ".uno:CenterPara=",
        ".uno:CharBackColor=",
        ".uno:CharBackgroundExt=",
        ".uno:CharFontName=",
        ".uno:Color=",
        ".uno:DefaultBullet=",
        ".uno:DefaultNumbering=",
        ".uno:FontColor=",
        ".uno:FontHeight=",
        ".uno:Italic=",
        ".uno:JustifyPara=",
        ".uno:OutlineFont=",
        ".uno:LeftPara=",
        ".uno:RightPara=",
        ".uno:Shadowed=",
        ".uno:SubScript=",
        ".uno:SuperScript=",
        ".uno:Strikeout=",
        ".uno:StyleApply=",
        ".uno:Underline=",
        ".uno:ModifiedStatus=",
        ".uno:Undo=",
        ".uno:Redo=",
        ".uno:Cut=",
        ".uno:Copy=",
        ".uno:Paste=",
        ".uno:SelectAll=",
        ".uno:InsertAnnotation=",
        ".uno:InsertRowsBefore=",
        ".uno:InsertRowsAfter=",
        ".uno:InsertColumnsBefore=",
        ".uno:InsertColumnsAfter=",
        ".uno:DeleteRows=",
        ".uno:DeleteColumns=",
        ".uno:DeleteTable=",
        ".uno:SelectTable=",
        ".uno:EntireRow=",
        ".uno:EntireColumn=",
        ".uno:EntireCell=",
        ".uno:InsertMode=",
        ".uno:StateTableCell=",
        ".uno:StatePageNumber=",
        ".uno:StateWordCount=",
        ".uno:SelectionMode=",
        ".uno:NumberFormatCurrency=",
        ".uno:NumberFormatPercent=",
        ".uno:NumberFormatDate="
    };

    try
    {
        testStateChanged("empty.odt", writerCommands);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitUNOCommand::testStateUnoCommandCalc()
{
    std::set<std::string> calcCommands
    {
        ".uno:BackgroundColor=",
        ".uno:Bold=",
        ".uno:CenterPara=",
        ".uno:CharBackColor=",
        ".uno:CharFontName=",
        ".uno:Color=",
        ".uno:FontHeight=",
        ".uno:Italic=",
        ".uno:JustifyPara=",
        ".uno:OutlineFont=",
        ".uno:LeftPara=",
        ".uno:RightPara=",
        ".uno:Shadowed=",
        ".uno:SubScript=",
        ".uno:SuperScript=",
        ".uno:Strikeout=",
        ".uno:StyleApply=",
        ".uno:Underline=",
        ".uno:ModifiedStatus=",
        ".uno:Undo=",
        ".uno:Redo=",
        ".uno:Cut=",
        ".uno:Copy=",
        ".uno:Paste=",
        ".uno:SelectAll=",
        ".uno:InsertAnnotation=",
        ".uno:InsertRowsBefore=",
        ".uno:InsertRowsAfter=",
        ".uno:InsertColumnsBefore=",
        ".uno:InsertColumnsAfter=",
        ".uno:DeleteRows=",
        ".uno:DeleteColumns=",
        ".uno:StatusDocPos=",
        ".uno:RowColSelCount=",
        ".uno:StatusPageStyle=",
        ".uno:InsertMode=",
        ".uno:StatusSelectionMode=",
        ".uno:StateTableCell=",
        ".uno:StatusBarFunc=",
        ".uno:WrapText=",
        ".uno:ToggleMergeCells=",
        ".uno:NumberFormatCurrency=",
        ".uno:NumberFormatPercent=",
        ".uno:NumberFormatDate="
    };

    try
    {
        testStateChanged("empty.ods", calcCommands);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitUNOCommand::testStateUnoCommandImpress()
{
    std::set<std::string> impressCommands
    {
        ".uno:Bold=",
        ".uno:CenterPara=",
        ".uno:CharBackColor=",
        ".uno:CharFontName=",
        ".uno:Color=",
        ".uno:DefaultBullet=",
        ".uno:DefaultNumbering=",
        ".uno:FontHeight=",
        ".uno:Italic=",
        ".uno:JustifyPara=",
        ".uno:OutlineFont=",
        ".uno:LeftPara=",
        ".uno:RightPara=",
        ".uno:Shadowed=",
        ".uno:SubScript=",
        ".uno:SuperScript=",
        ".uno:Strikeout=",
        ".uno:StyleApply=",
        ".uno:Underline=",
        ".uno:ModifiedStatus=",
        ".uno:Undo=",
        ".uno:Redo=",
        ".uno:InsertPage=",
        ".uno:DeletePage=",
        ".uno:DuplicatePage=",
        ".uno:Cut=",
        ".uno:Copy=",
        ".uno:Paste=",
        ".uno:SelectAll=",
        ".uno:InsertAnnotation=",
        ".uno:InsertRowsBefore=",
        ".uno:InsertRowsAfter=",
        ".uno:InsertColumnsBefore=",
        ".uno:InsertColumnsAfter=",
        ".uno:DeleteRows=",
        ".uno:DeleteColumns=",
        ".uno:SelectTable=",
        ".uno:EntireRow=",
        ".uno:EntireColumn=",
        ".uno:AssignLayout=",
        ".uno:PageStatus=",
        ".uno:LayoutStatus=",
        ".uno:Context=",
        ".uno:InsertSymbol=",
    };

    try
    {
        testStateChanged("empty.odp", impressCommands);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

void UnitUNOCommand::invokeTest()
{
    UnitBase::TestResult result = testStateUnoCommandWriter();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testStateUnoCommandCalc();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testStateUnoCommandImpress();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitUNOCommand(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
