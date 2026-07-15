'
' This file is part of the LibreOffice project.
'
' This Source Code Form is subject to the terms of the Mozilla Public
' License, v. 2.0. If a copy of the MPL was not distributed with this
' file, You can obtain one at http://mozilla.org/MPL/2.0/.
'

Option VBASupport 1
Option Explicit

Function doUnitTest() As String
    TestUtil.TestInit
    verify_testMid
    doUnitTest = TestUtil.GetResult()
End Function

Sub verify_testMid()
    On Error GoTo errorHandler

    TestUtil.AssertEqual(Mid("Mid Function Demo", 1, 3),  "Mid",           "Mid(""Mid Function Demo"", 1, 3)")
    TestUtil.AssertEqual(Mid("Mid Function Demo", 14, 4), "Demo",          "Mid(""Mid Function Demo"", 14, 4)")
    TestUtil.AssertEqual(Mid("Mid Function Demo", 5),     "Function Demo", "Mid(""Mid Function Demo"", 5)")

    ' tdf#141474 keyword names need to match that of VBA
    TestUtil.AssertEqual(Mid(start:=6, string:="LibreOffice" ),            "Office", "Mid() with 2 keyword names" )
    TestUtil.AssertEqual(Mid(length:=5, start:=1, string:="LibreOffice" ), "Libre",  "Mid() with 3 keyword names" )

    Exit Sub
errorHandler:
    TestUtil.ReportErrorHandler("verify_testMid", Err, Error$, Erl)
End Sub
