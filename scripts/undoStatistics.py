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

if __name__ == "__main__":

    if len(sys.argv) != 2:
        usageAndExit()

    documents = []
    users = {}

    # dict of (command - count of undo)
    undoedCommands = {}
    totalUndoedCommands = {}

    # Process all Document related, and undo related calculations
    f = open(sys.argv[1], 'r')
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
    f = open(sys.argv[1], 'r')
    for line in f:
        if line.startswith("time="):
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

# vim: set shiftwidth=4 softtabstop=4 expandtab:
