#!/usr/bin/env python3
# -*- tab-width: 4; indent-tabs-mode: nil; py-indent-offset: 4 -*-
#
# Copyright the Collabora Online contributors.
#
# SPDX-License-Identifier: MPL-2.0
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

from lxml import etree
import os
import sys

def usageAndExit():
    message = """usage: {program} logfile_path

Reads the logfile and make a statisctics about what commands was undo-ed most times and other UI related commands.
And how many times  was a command like that was undoed. It will also chart these statistics into a file located at /test/data/updated-chart.fods

    {program} /path/to/logfile

"""
    print(message.format(program=sys.argv[0]))
    exit(1)

class Document:
    def __init__(self, users, activeUsers):
        self.users = users
        self.activeUsers = activeUsers
    users = 0
    activeUsers = 0

class User:
    edited = False
    undoChgStack = []       # list of commands that made changes
    lastCmd = ""

class FileLine:
    def __init__(self, kit, lineString):
        self.kit = kit
        self.lineString = lineString
    kit = 0
    lineString = ""

def reorderLogFile(oldFilename):
    newFileName = oldFilename + ".reordered"
    f = open(oldFilename, 'r')

    fileLines = []
    kitStartLine = {}
    kitEndLine = {}
    i = 0

    for line in f:
        numbKit = line.find("kit=")
        if numbKit >= 0:
            endOfKit = line[numbKit:].find(" ")
            if endOfKit >= 0:
                endOfKit += numbKit
                kit = int(line[numbKit+4:endOfKit],16)
            else:
                kit = int(line[numbKit+4:],16)

            fileLines.append(FileLine(kit,line))

            if kit not in kitStartLine:
                kitStartLine[kit] = i
            kitEndLine[kit] = i
            i += 1

    fOut = open(newFileName, "w")

    for kit in kitEndLine.keys():
        for i in range(kitStartLine[kit], kitEndLine[kit]+1):
            if fileLines[i].kit == kit:
                fOut.write(fileLines[i].lineString)

    fOut.close()
    f.close()

    return newFileName

def createCommandTransitionMatrix(commandTransitions):
    currentCommands = set()
    previousCommands = set()
    currentFreq = {}
    previousFreq = {}

    for current, previous, count in commandTransitions:
        if current.strip():
            currentCommands.add(current)
            currentFreq[current] = currentFreq.get(current, 0) + count
        if previous.strip():
            previousCommands.add(previous)
            previousFreq[previous] = previousFreq.get(previous, 0) + count

    sortedCurrent = sorted(currentCommands,
                          key=lambda x: currentFreq.get(x, 0),
                          reverse=True)

    sortedPrevious = sorted(previousCommands,
                           key=lambda x: previousFreq.get(x, 0),
                           reverse=True)

    matrix = {cmd: {prev: 0 for prev in sortedPrevious} for cmd in sortedCurrent}

    for current, previous, count in commandTransitions:
        if current.strip() and previous.strip():
            matrix[current][previous] = count

    result = []

    header = sortedPrevious[:]
    header.insert(0, "")
    result.append(header)

    for cmd in sortedCurrent:
        row = [cmd]
        for prevCmd in sortedPrevious:
            row.append(matrix[cmd][prevCmd])
        result.append(row)

    return result


def addSheetWithData(templateFile, outputFile, dataSets, NSMAP):
    def parseTemplate(file):
        tree = etree.parse(file)
        root = tree.getroot()
        spreadsheet = root.find(f".//office:spreadsheet", namespaces=NSMAP)
        template = root.find(f".//table:table[@table:name='Sheet1']", namespaces=NSMAP)
        if template is None:
            raise ValueError("Sheet1 not found in the template")
        return tree, root, spreadsheet, template

    def addXAxisTitle(sheet, sheetName, title):
        chart = sheet.find(".//office:chart", namespaces=NSMAP)
        if chart is None:
            print(f"Could not find chart for sheet '{sheetName}'")

        plotArea = chart.find(".//chart:plot-area", namespaces=NSMAP)
        if plotArea is None:
            raise ValueError(f"Could not find plot-area in the chart for sheet '{sheetName}'")

        xAxis = plotArea.find(".//chart:axis[@chart:dimension='x']", namespaces=NSMAP)
        if xAxis is None:
            raise ValueError(f"Could not find X-axis in the chart for sheet '{sheetName}")

        titleElement = etree.SubElement(xAxis, f"{{{NSMAP['chart']}}}title")
        titleElementText = etree.SubElement(titleElement, f"{{{NSMAP['text']}}}p")
        titleElementText.text = title

    def calculateHeatMapColour(value, maxValue):
        if maxValue == 0:
            return (255, 255, 255)

        normalizedValue = value / maxValue

        red = int(255 * normalizedValue)
        green = int(255 * (1 - normalizedValue))
        blue = 0

        return (red, green, blue)

    def rgbToHex(rgb):
        return "#{:02x}{:02x}{:02x}".format(*rgb)

    def createHeatMapStyle(root, styleCounter, colourHex):
        autoStyles = root.find(".//office:automatic-styles", namespaces=NSMAP)
        if autoStyles is None:
            raise ValueError("Could not find automatic styles section")

        existingStyle = None
        for style in autoStyles.findall(f"{{{NSMAP['style']}}}style"):
            styleProps = style.find(f"{{{NSMAP['style']}}}table-cell-properties")
            if styleProps is not None and styleProps.get(f"{{{NSMAP['fo']}}}background-color") == colourHex:
                existingStyle = style.get(f"{{{NSMAP['style']}}}name")
                break

        if existingStyle:
            return existingStyle

        styleName = f"hm{styleCounter}"
        style = etree.SubElement(autoStyles, f"{{{NSMAP['style']}}}style")
        style.set(f"{{{NSMAP['style']}}}name", styleName)
        style.set(f"{{{NSMAP['style']}}}family", "table-cell")
        style.set(f"{{{NSMAP['style']}}}parent-style-name", "Default")

        props = etree.SubElement(style, f"{{{NSMAP['style']}}}table-cell-properties")
        props.set(f"{{{NSMAP['fo']}}}background-color", colourHex)

        return styleName

    def createRow(sheet, rowData, styleCounter=None, maxValue=None):
        row = etree.SubElement(sheet, f"{{{NSMAP['table']}}}table-row")
        for cellValue in rowData:
            cell = etree.SubElement(row, f"{{{NSMAP['table']}}}table-cell")
            cell.set(f"{{{NSMAP['office']}}}value-type", "float" if isinstance(cellValue, (int, float)) else "string")
            if isinstance(cellValue, (int, float)):
                cell.set(f"{{{NSMAP['office']}}}value", str(cellValue))
                if styleCounter is not None and maxValue is not None:
                    colorRgb = calculateHeatMapColour(cellValue, maxValue)
                    colorHex = rgbToHex(colorRgb)
                    styleName = createHeatMapStyle(sheet.getroottree().getroot(), next(styleCounter), colorHex)
                    cell.set(f"{{{NSMAP['table']}}}style-name", styleName)
            else:
                cell.set(f"{{{NSMAP['table']}}}style-name", "ce1")
            textP = etree.SubElement(cell, f"{{{NSMAP['text']}}}p")
            textP.text = str(cellValue)
        return row


    def copyTableStructure(root, sourceSheetName, newSheetName):
        sourceSheet = root.find(f".//table:table[@table:name='{sourceSheetName}']", namespaces=NSMAP)
        if sourceSheet is None:
            raise ValueError(f"Source table '{sourceSheetName}' not found in the source tree.")

        newTable = etree.fromstring(etree.tostring(sourceSheet))
        newTable.set(f"{{{NSMAP['table']}}}name", newSheetName)

        spreadsheet = root.find(".//office:spreadsheet", namespaces=NSMAP)
        spreadsheet.append(newTable)

    def duplicateAndPrepareSheet(root, template, sheetName, data, title, heatMap):
        copyTableStructure(root, "Sheet1", sheetName)
        newSheet = tree.find(f".//table:table[@table:name='{sheetName}']", namespaces=NSMAP)
        if newSheet is None:
            raise ValueError(f"Failed to find newly copied sheet '{sheetName}' in the target tree.")

        # Remove existing rows
        for row in newSheet.findall("table:table-row", namespaces=NSMAP):
            newSheet.remove(row)

        if title is not None:
            addXAxisTitle(newSheet, sheetName, title)

        columnCount = len(data[0])
        column = etree.SubElement(newSheet, f"{{{NSMAP['table']}}}table-column")
        column.set(f"{{{NSMAP['table']}}}style-name", "co1")
        column.set(f"{{{NSMAP['table']}}}number-columns-repeated", str(columnCount))

        if heatMap:
            maxValue = max(
                cell for row in data[1:]
                for cell in row[1:]
                if isinstance(cell, (int, float))
            )
            styleCounter = iter(range(1, len(data) * len(data[0]) + 1))
            print(maxValue)
            for rowData in data:
                createRow(newSheet, rowData, styleCounter, maxValue)
        else:
            for rowData in data:
                createRow(newSheet, rowData)
        return newSheet

    tree, root, spreadsheet, template = parseTemplate(templateFile)

    for sheetName, data in dataSets.items():
        duplicateAndPrepareSheet(root, template, sheetName, data[0], data[1], data[2])

    # Remove template sheet
    spreadsheet.remove(template)
    with open(outputFile, "wb") as f:
        f.write(etree.tostring(tree, pretty_print=True, xml_declaration=True, encoding="UTF-8"))

    print(f"\nFile '{outputFile}' successfully created with {len(dataSets)} sheets.")

def chartStatistics(inputFile, NSMAP):
        SHEET_CHART_MAPPING = { # Add sheet name and none, if you wish to not chart  the data in that sheet
            "Total_Users_Per_Document": "bar",
            "Total_Viewers_Per_Doc": "bar",
            "Total_Editors_Per_Doc": "bar",
            "Editor-Viewer_Per_Doc": "bar",
            "Convert_Thumbnail_Viewer_Edit": "bar",
            "Undo_Command": "bar",
            "Sub_Command_Transitions": "bar",
            "Command_Transitions": "none",
        }

        def parseInput(file):
            tree = etree.parse(file)
            root = tree.getroot()
            return tree, root

        def getSheetChartType(sheetName):
            return SHEET_CHART_MAPPING.get(sheetName, "bar")

        def getColumnLetter(columnNumber):
            result = ""
            columnNumber = int(columnNumber)
            while columnNumber > 0:
                columnNumber -= 1
                remainder = columnNumber % 26
                result = chr(65 + remainder) + result
                columnNumber = columnNumber // 26
            return result

        def updateChartReferences(root, sheetName, numRows, numCols, chartType):
            # Find table/sheet by name
            table = root.find(f".//table:table[@table:name='{sheetName}']", namespaces=NSMAP)
            if table is None:
                raise ValueError(f"Could not find table for sheet '{sheetName}'")

            firstRow = table.find("table:table-row", namespaces=NSMAP)
            firstCell = firstRow.find("table:table-cell", namespaces=NSMAP)

            categoriesRange = f"{sheetName}.A2:A{numRows + 1}"
            firstValue = None
            if firstRow is not None and firstCell is not None:
                firstValue = firstCell.find(".//text:p", namespaces=NSMAP)

            if firstValue is not None and firstValue.text:
                categoriesRange = None
                numCols += 1

            endColumn = getColumnLetter(numCols + 1)
            dataRange = f"{sheetName}.A1:{endColumn}{numRows + 1}"

            chart = table.find(".//office:chart", namespaces=NSMAP)
            if chart is None:
                raise ValueError(f"Could not find chart for sheet '{sheetName}'")

            plotArea = chart.find(".//chart:plot-area", namespaces=NSMAP)
            if plotArea is None:
                raise ValueError(f"Could not find plot-area in the chart for sheet '{sheetName}'")

            plotArea.set(f"{{{NSMAP['table']}}}cell-range-address", dataRange)
            plotArea.set(f"{{{NSMAP['chart']}}}data-source-has-labels", "row")
            plotArea.set(f"{{{NSMAP['chart']}}}class", f"chart:{chartType}")

            categoriesAxis = plotArea.find(".//chart:axis[@chart:dimension='x']", namespaces=NSMAP)
            if categoriesAxis is not None:
                categories = categoriesAxis.find(".//chart:categories", namespaces=NSMAP)
                if categoriesRange is not None:
                    categories.set(f"{{{NSMAP['table']}}}cell-range-address", categoriesRange)
                else:
                    categoriesAxis.remove(categories)

            # Remove old series and add new series
            oldSeries = plotArea.findall(".//chart:series", namespaces=NSMAP)
            for series in oldSeries:
                series.getparent().remove(series)

            # If there's no categories range (column A is part of the data), column A is included in series
            skipColA = 0 if categoriesRange is None else 1

            for cols in range(0, numCols):
                col = getColumnLetter(cols + 1 + skipColA)
                seriesRange = f"{sheetName}.{col}2:{sheetName}.{col}{numRows + 1}"
                labelsRange = f"{sheetName}.{col}1:{sheetName}.{col}1"

                # Create new series element
                series = etree.SubElement(plotArea, f"{{{NSMAP['chart']}}}series")
                series.set(f"{{{NSMAP['chart']}}}style-name", f"ch{str((cols % 10) + 11)}") # The XML file has different colour bars ranging from ch11-ch20
                series.set(f"{{{NSMAP['chart']}}}values-cell-range-address", seriesRange)
                series.set(f"{{{NSMAP['chart']}}}label-cell-address", labelsRange)
                series.set(f"{{{NSMAP['chart']}}}class", f"chart:{chartType}")

                # Add data-point element to series
                dataPoint = etree.SubElement(series, f"{{{NSMAP['chart']}}}data-point")
                dataPoint.set(f"{{{NSMAP['chart']}}}repeated", str(numRows))

        def removeDrawFrameForSheet(root, sheetName, NSMAP):
            sheet = root.find(f".//table:table[@table:name='{sheetName}']", namespaces=NSMAP)
            for drawFrame in sheet.findall(".//draw:frame", namespaces=NSMAP):
                drawFrame.getparent().remove(drawFrame)

        def processSheets(root):
            for sheet in root.findall(".//table:table", namespaces=NSMAP):
                sheetName = sheet.get(f"{{{NSMAP['table']}}}name")
                if sheetName is None:
                    raise ValueError(f"Sheet '{sheetName}' has no name, Skipping.")

                chartType = getSheetChartType(sheetName)
                if chartType == "none":
                    removeDrawFrameForSheet(root, sheetName, NSMAP)
                    continue

                rows = sheet.findall("table:table-row", namespaces=NSMAP)

                # Skip empty sheets
                if not rows:
                    print(f"No rows found in sheet '{sheetName}', Skipping.")
                    continue

                firstRowCells = rows[0].findall("table:table-cell", namespaces=NSMAP)
                numRows = len(rows) - 1
                numCols = len(firstRowCells) - 1

                updateChartReferences(root, sheetName, numRows, numCols, chartType)


        tree, root = parseInput(inputFile)
        processSheets(root)

        # Write updated tree to output file
        with open(inputFile, "wb") as f:
            f.write(etree.tostring(tree, pretty_print=True, xml_declaration=True, encoding="UTF-8"))

        print(f"File '{inputFile}' successfully created!")

if __name__ == "__main__":

    if len(sys.argv) != 2:
        usageAndExit()

    documents = []
    users = {}

    # dict of (command - count of undo)
    undoedCommands = {}
    totalUndoedCommands = {}

    # dict of (current and previous command - count)
    currentCommandPreviousCommand = {}

    # dict of (total users - documents)
    totalUsersPerDoc = {}

    # dict of (total viewers - documents)
    totalViewersPerDoc = {}

    # dict of (total editors - documents)
    totalEditorsPerDoc = {}

    # dict of (edtitors and viewers - documents)
    passiveActivePerDoc = {}

    documentCategories = {
        "Convert/Thumbnail": 0,
        "Viewer-Only": 0,
        "Edit": 0,
    }

    # Check if the file has kit order problem, and fix it
    newFileName = reorderLogFile(sys.argv[1])

    # Process all Document related, and undo related calculations
    f = open(newFileName, 'r')
    for line in f:
        if line.startswith("log-start-time:"):
            pass
        elif line.startswith("log-end-time:"):
            active = 0
            for user in users.values():
                if user.edited:
                    active += 1
            documents.append(Document(len(users), active))
            users = {}
        else:
            numbUser = line.find("user=")
            numbrep = line.find("rep=")
            cmdStart = line[numbrep:].find(" ")+numbrep+1

            userId = int(line[numbUser+5:numbrep])
            repeat = int(line[numbrep+4:cmdStart])
            lineCmd = line[cmdStart:]

            if userId not in users:
                users[userId] = User()

            if lineCmd.startswith("cmd:"):
                key = f"{lineCmd[4:-1]}|{users[userId].lastCmd}"
                currentCommandPreviousCommand[key] = currentCommandPreviousCommand.get(key, 0) + 1

                users[userId].lastCmd = lineCmd[4:-1]
                if lineCmd.startswith("cmd:textinput") or lineCmd.startswith("cmd:removetextcontext"):
                    users[userId].edited = True

            elif lineCmd.startswith("undo-count-change:"):
                if lineCmd[18] == "+":
                    users[userId].undoChgStack.append([repeat, users[userId].lastCmd])
                else: #"-"
                    toDelete = repeat
                    while toDelete > 0:
                        deleted = 0
                        stackLen = len(users[userId].undoChgStack) - 1
                        cmd = users[userId].undoChgStack[stackLen][1]
                        if users[userId].undoChgStack[stackLen][0] > toDelete:
                            users[userId].undoChgStack[stackLen][0] -= toDelete
                            deleted = toDelete
                            toDelete = 0
                        else:
                            deleted = users[userId].undoChgStack[stackLen][0]
                            toDelete -= users[userId].undoChgStack[stackLen][0]
                            users[userId].undoChgStack.pop()

                        actValue = 0
                        if cmd in undoedCommands:
                            actValue = undoedCommands[cmd]

                        actValue += deleted
                        undoedCommands[cmd] = actValue

    # re-check undoed commands, how many times they are used, to calculate how many % of it undoed.
    for cmd in undoedCommands.keys():
        totalUndoedCommands[cmd] = 0

    actIndex=-1
    f = open(newFileName, 'r')
    for line in f:
        if line.startswith("kit="):
            numbrep = line.find("rep=")
            cmdStart = line[numbrep:].find(" ")+numbrep+1
            repeat = int(line[numbrep+4:cmdStart])
            lineCmd = line[cmdStart:]
            if lineCmd.startswith("cmd:"):
                cmd = lineCmd[4:-1]
                if cmd in totalUndoedCommands.keys():
                    totalUndoedCommands[cmd] += repeat

    documentsOpened = len(documents)
    documentsEdited = 0
    totalUsers = 0
    totalUsersWhenDocEdited = 0
    totalActiveUsers = 0
    usersPerDocMin = documents[0].users
    usersPerDocMax = 0
    usersActivePerDocMin = documents[0].users
    usersActivePerDocMax = 0
    usersPassivePerDocMin = documents[0].users
    usersPassivePerDocMax = 0

    for actDoc in documents:
        if actDoc.activeUsers > 0:
            documentsEdited += 1
            totalUsersWhenDocEdited += actDoc.users
            documentCategories["Edit"] += 1
        else:
            if actDoc.users - actDoc.activeUsers > 0:
                documentCategories["Viewer-Only"] += 1
            else:
                documentCategories["Convert/Thumbnail"] += 1
        totalUsers += actDoc.users
        totalActiveUsers += actDoc.activeUsers
        if usersPerDocMin > actDoc.users:
            usersPerDocMin = actDoc.users
        if usersPerDocMax < actDoc.users:
            usersPerDocMax = actDoc.users
        if usersActivePerDocMin > actDoc.activeUsers:
            usersActivePerDocMin = actDoc.activeUsers
        if usersActivePerDocMax < actDoc.activeUsers:
            usersActivePerDocMax = actDoc.activeUsers
        if usersPassivePerDocMin > actDoc.users - actDoc.activeUsers:
            usersPassivePerDocMin = actDoc.users - actDoc.activeUsers
        if usersPassivePerDocMax < actDoc.users - actDoc.activeUsers:
            usersPassivePerDocMax = actDoc.users - actDoc.activeUsers

        totalUsersPerDoc[actDoc.users] = totalUsersPerDoc.get(actDoc.users, 0) + 1
        totalViewersPerDoc[actDoc.users - actDoc.activeUsers] = totalViewersPerDoc.get(actDoc.users - actDoc.activeUsers, 0) + 1
        totalEditorsPerDoc[actDoc.activeUsers] = totalEditorsPerDoc.get(actDoc.activeUsers, 0) + 1
        key = f"{actDoc.activeUsers} | {actDoc.users - actDoc.activeUsers}"
        passiveActivePerDoc[key] = passiveActivePerDoc.get(key, 0) + 1

    print("Documents opened: %d Documents edited: %d (=%4.2f%%)" % (documentsOpened, documentsEdited, 100.0*documentsEdited/documentsOpened))
    print("Total Users: %d Active users: %d (=%4.2f%%)" % (totalUsers, totalActiveUsers, 100.0*totalActiveUsers/totalUsers))
    print("Users/Document min-max: %d-%d Average: %4.2f)" % (usersPerDocMin, usersPerDocMax, 1.0*totalUsers/documentsOpened))
    print("   Active Users/Document min-max: %d-%d Average: %4.2f)" % (usersActivePerDocMin, usersActivePerDocMax, 1.0*totalActiveUsers/documentsOpened))
    print("   Passive Users/Document min-max: %d-%d Average: %4.2f)" % (usersPassivePerDocMin, usersPassivePerDocMax, 1.0*(totalUsers-totalActiveUsers)/documentsOpened))
    print("(Acive Users/All users) when document edited: %4.2f%%)" % (100.0*totalActiveUsers/totalUsersWhenDocEdited))

    # sort undoed commands by count
    sortedUndoedCommands = sorted(undoedCommands.items(), key=lambda x:x[1], reverse=True)

    # print statistics of undo
    print("\nMost undoed commands:\n(Count of undo, Count of all Commands, The command)")
    for cmd,count in sortedUndoedCommands:
        print(count, totalUndoedCommands[cmd], cmd)

    editorViewerDataTable = [["", "Documents"]]
    editorViewerDataTable.extend(
        [[key, count] for key, count in passiveActivePerDoc.items()]
    )
    sortedEditorViewerDataTable = sorted(
        editorViewerDataTable[1:],
        key=lambda x: (
            -int(x[0].split('|')[0]),
            -int(x[0].split('|')[1])
        )
    )
    sortedEditorViewerDataTable.insert(0, editorViewerDataTable[0])

    totalUserPerDocTable = [["", "Documents",]]
    totalUserPerDocTable.extend(totalUsersPerDoc.items())
    sortedTotalUserPerDocTable = sorted(
        totalUserPerDocTable[1:],
        key=lambda x: -x[0]
    )
    sortedTotalUserPerDocTable.insert(0, totalUserPerDocTable[0])

    totalViewersPerDocTable = [["", "Documents"]]
    totalViewersPerDocTable.extend(totalViewersPerDoc.items())
    sortedTotalViewerPerDocTable = sorted(
        totalViewersPerDocTable[1:],
        key=lambda x: -x[0]
    )
    sortedTotalViewerPerDocTable.insert(0, totalViewersPerDocTable[0])

    totalEditorsPerDocTable = [["", "Documents"]]
    totalEditorsPerDocTable.extend(totalEditorsPerDoc.items())
    sortedTotalEditorPerDocTable = sorted(
        totalEditorsPerDocTable[1:],
        key=lambda x: -x[0]
    )
    sortedTotalEditorPerDocTable.insert(0, totalEditorsPerDocTable[0])

    undoCommandDataTable = [["", "Total Commands", "Undo count"]]
    undoCommandDataTable.extend([[cmd, totalUndoedCommands.get(cmd, 0), count] for cmd, count in sortedUndoedCommands])
    sortedUndoCommandDataTable = sorted(
        undoCommandDataTable[1:],
        key=lambda x: -x[2]
    )

    convertViewerData = [["", "Count"]]
    convertViewerData.extend([[category, count] for category, count in documentCategories.items()])
    sortedConvertViewerData = sorted(
        convertViewerData[1:],
        key=lambda x: -x[1]
    )

    sortedConvertViewerData.insert(0, convertViewerData[0])
    sortedUndoCommandDataTable.insert(0, undoCommandDataTable[0])
    currentPreviousDataTable = (
        [[current, previous, count]
        for key, count in currentCommandPreviousCommand.items()
        for current, previous in [key.split("|")]
    ])
    currentPreviousMatrix = createCommandTransitionMatrix(currentPreviousDataTable)

    # Slices out a n x n amount from the matrix and creates new sheet. Easier to view important data
    maxRows = 11
    maxCols = 11
    sortedSubMatrix = [
        [currentPreviousMatrix[row][col] for col in range(maxCols)]
        for row in range(min(maxRows, len(currentPreviousMatrix)))
    ]

    dataSets = { # Sheet name, data set (data, x axis title, heat map effect)
        "Total_Users_Per_Document": [sortedTotalUserPerDocTable, "USERS", False],
        "Total_Viewers_Per_Doc": [sortedTotalViewerPerDocTable, "VIEWERS", False],
        "Total_Editors_Per_Doc": [sortedTotalEditorPerDocTable, "EDITORS", False],
        "Editor-Viewer_Per_Doc": [sortedEditorViewerDataTable, "EDITORS | VIEWERS", False],
        "Convert_Thumbnail_Viewer_Edit": [convertViewerData, "DOC TYPE", False],
        "Undo_Command": [undoCommandDataTable, "COMMAND", False],
        "Command_Transitions": [currentPreviousMatrix, None, False], # Change to true for heatmap effect
        "Sub_Command_Transitions": [sortedSubMatrix, None, True], # Change to false for no heatmap effect
    }

    NSMAP = {
        "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
        "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
        "chart": "urn:oasis:names:tc:opendocument:xmlns:chart:1.0",
        "draw": "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
        "style": "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
        "fo": "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
    }

    templateFile = "../test/data/empty-chart.fods"
    fileDest = "../test/data/updated-chart.fods"
    addSheetWithData(templateFile, fileDest, dataSets, NSMAP)
    chartStatistics(fileDest, NSMAP)
# vim: set shiftwidth=4 softtabstop=4 expandtab:
