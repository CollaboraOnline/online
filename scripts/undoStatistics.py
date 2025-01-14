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

Reads the logfile and make a statisctics about what commands was undo-ed most times.
And how many times  was a command like that was undoed.

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

def createCommandTransitionMatrix(command_transitions):
    commands = set()
    for current, previous, count in command_transitions:
        if current.strip():
            commands.add(current)
        if previous.strip():
            commands.add(previous)
    commands = sorted(list(commands))

    matrix = {cmd: {prev: 0 for prev in commands} for cmd in commands}

    for current, previous, count in command_transitions:
        if current.strip() and previous.strip():
            matrix[current][previous] = count

    result = []

    header = commands[:]
    header.insert(0, "")
    result.append(header)

    for cmd in commands:
        row = [cmd]
        for prev_cmd in commands:
            row.append(matrix[cmd][prev_cmd])
        result.append(row)

    return result


def addSheetWithData(template_file, output_file, data_sets):
    NSMAP = {
        "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
        "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
    }

    def parseTemplate(file):
        tree = etree.parse(file)
        root = tree.getroot()
        spreadsheet = root.find(f".//office:spreadsheet", namespaces=NSMAP)
        template = root.find(f".//table:table[@table:name='Sheet1']", namespaces=NSMAP)
        if template is None:
            raise ValueError("Sheet1 not found in the template")
        return tree, root, spreadsheet, template

    def createRow(sheet, row_data):
        row = etree.SubElement(sheet, f"{{{NSMAP['table']}}}table-row")
        for cell_value in row_data:
            cell = etree.SubElement(row, f"{{{NSMAP['table']}}}table-cell")
            cell.set(f"{{{NSMAP['office']}}}value-type", "float" if isinstance(cell_value, (int, float)) else "string")
            if isinstance(cell_value, (int, float)):
                cell.set(f"{{{NSMAP['office']}}}value", str(cell_value))
            text_p = etree.SubElement(cell, f"{{{NSMAP['text']}}}p")
            text_p.text = str(cell_value)
        return row


    def copyTableStructure(root, source_sheet_name, new_sheet_name):
        source_sheet = root.find(f".//table:table[@table:name='{source_sheet_name}']", namespaces=NSMAP)
        if source_sheet is None:
            raise ValueError(f"Source table '{source_sheet_name}' not found in the source tree.")

        new_table = etree.fromstring(etree.tostring(source_sheet))
        new_table.set(f"{{{NSMAP['table']}}}name", new_sheet_name)

        spreadsheet = root.find(".//office:spreadsheet", namespaces=NSMAP)
        spreadsheet.append(new_table)

    def duplicateAndPrepareSheet(root, template, sheet_name, data):
        copyTableStructure(root, "Sheet1", sheet_name)
        new_sheet = tree.find(f".//table:table[@table:name='{sheet_name}']", namespaces=NSMAP)
        if new_sheet is None:
            raise ValueError(f"Failed to find newly copied sheet '{sheet_name}' in the target tree.")

        # Remove existing rows
        for row in new_sheet.findall("table:table-row", namespaces=NSMAP):
            new_sheet.remove(row)

        column_count = len(data[0])
        column = etree.SubElement(new_sheet, f"{{{NSMAP['table']}}}table-column")
        column.set(f"{{{NSMAP['table']}}}style-name", "co1")
        column.set(f"{{{NSMAP['table']}}}number-columns-repeated", str(column_count))

        for row_data in data:
            createRow(new_sheet, row_data)

        return new_sheet

    tree, root, spreadsheet, template = parseTemplate(template_file)

    for sheet_name, data in data_sets.items():
        duplicateAndPrepareSheet(root, template, sheet_name, data)

    # Remove template sheet
    spreadsheet.remove(template)
    with open(output_file, "wb") as f:
        f.write(etree.tostring(tree, pretty_print=True, xml_declaration=True, encoding="UTF-8"))

    print(f"\nFile '{output_file}' successfully created with {len(data_sets)} sheets.")

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

    # dict of (edtitors and viewers - documents)
    passiveActivePerDoc = {}

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
                key = f"{lineCmd[4:-1]}-{users[userId].lastCmd}"
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

        key = f"{actDoc.activeUsers}-{actDoc.users - actDoc.activeUsers}"
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

    viewer_editor_data = [["Editors", "Viewers", "Documents"]]
    viewer_editor_data.extend(
        [[int(key.split("-")[0]), int(key.split("-")[1]), count] for key, count in passiveActivePerDoc.items()]
    )

    total_users_per_doc = [["Users", "Documents",]]
    total_users_per_doc.extend(totalUsersPerDoc.items())

    undo_command_data = [["", "Total Commands", "Undo count"]]
    undo_command_data.extend([[cmd, totalUndoedCommands.get(cmd, 0), count] for cmd, count in sortedUndoedCommands])

    current_previous_data = (
        [[current, previous, count]
        for key, count in currentCommandPreviousCommand.items()
        for current, previous in [key.split("-")]
    ])
    current_previous_matrix = createCommandTransitionMatrix(current_previous_data)

    data_sets = {
        "Viewer_Editor_Stats": viewer_editor_data,
        "Undo_Command_Stats": undo_command_data,
        "Command_Transitions": current_previous_matrix,
        "Total_Users_Per_Document": total_users_per_doc,
    }

    addSheetWithData("../test/data/empty-chart.fods", "../test/data/updated-chart.fods", data_sets)

# vim: set shiftwidth=4 softtabstop=4 expandtab:
