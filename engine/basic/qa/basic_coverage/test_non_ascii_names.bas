'
' This file is part of the LibreOffice project.
'
' This Source Code Form is subject to the terms of the Mozilla Public
' License, v. 2.0. If a copy of the MPL was not distributed with this
' file, You can obtain one at http://mozilla.org/MPL/2.0/.
'

Option Explicit

Function doUnitTest as String
  [Prüfung]
  doUnitTest = TestUtil.GetResult()
End Function

Function [Функция]([😁])
  [Функция] = [😁] & " and some text"
End Function

Function TestNonAsciiNative as Integer
    Dim [Абв] as Integer
    [Абв] = 5
    TestNonAsciiNative = [абв]
End Function

Sub [Prüfung]
  On Error GoTo errorHandler

  TestUtil.AssertEqual([Функция]("Smiley"), "Smiley and some text", "[Функция](""Smiley"")")

  ' tdf#148358 - compare Non-ASCII variable names case-insensitive
  TestUtil.AssertEqual(TestNonAsciiNative(), 5, "TestNonAsciiNative()")

  Exit Sub
errorHandler:
  TestUtil.ReportErrorHandler("Prüfung", Err, Error$, Erl)
End Sub
