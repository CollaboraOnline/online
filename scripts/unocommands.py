#!/usr/bin/env python
# -*- tab-width: 4; indent-tabs-mode: nil; py-indent-offset: 4 -*-
#
# This file is part of the LibreOffice project.
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

import os
import re
import sys
from lxml import etree

def usage():
    message = """usage: {program} [--check] online_srcdir [loffice_srcdir]

Extracts .uno: command descriptions from the LibreOffice XCU files.
Also it is used during build to check consistency of unocommands.js.

loffice_srcdir does not have to be provided when --check param is
specified.

Example:
    {program} --check /path/to/online
    {program} /path/to/online /path/to/loffice > unocommands.js
"""
    print(message.format(program = os.path.basename(sys.argv[0])))

# Extract uno commands name from lines like "  'Command1', 'Command2',"
def commandsFromLine(line):
    commands = []

    inCommand = False
    command = ''
    for c in line:
        if c == "'":
            inCommand = not inCommand
            # command ended, collect it
            if not inCommand and command != '':
                commands += [ command ]
                command = ''
        elif inCommand:
            command += c

    return commands

# Extract uno commands name from lines like "  {uno: '.uno:Command3',"
def commandFromMenuLine(line):
    commands = []

    m = re.search(r"\buno: *'\.uno:([^']*)'", line)
    if m:
        commands = [ m.group(1) ]

    return commands

# Extract all the uno commands we are using in the Online
def extractCommands(path):
    commands = []

    #files = { path + '/loleaflet/src/control/Control.ContextMenu.js',
    #    path + '/loleaflet/src/control/Control.Menubar.js'
    #}

    # extract from the comments whitelist
    f = open(path + '/loleaflet/src/control/Control.ContextMenu.js', 'r')
    readingCommands = False
    for line in f:
        if line.find('UNOCOMMANDS_EXTRACT_START') >= 0:
            readingCommands = True
        elif line.find('UNOCOMMANDS_EXTRACT_END') >= 0:
            readingCommands = False
        elif readingCommands:
            commands += commandsFromLine(line)

    # extract from the menu specifications
    f = open(path + '/loleaflet/src/control/Control.Menubar.js', 'r')
    for line in f:
        if line.find("uno:") >= 0 and line.find("name:") < 0:
            commands += commandFromMenuLine(line)

    # may the list unique
    return set(commands)

# Create mapping between the commands and appropriate strings
def printCommandsFromXCU(xcu, commands):
    descriptions = {}

    root = etree.parse(xcu)
    nodes = root.xpath("/oor:component-data/node/node/node", namespaces = {
        'oor': 'http://openoffice.org/2001/registry',
        })
    for node in nodes:
        # extract the uno command name
        unoCommand = node.get('{http://openoffice.org/2001/registry}name')
        unoCommand = unoCommand[5:]

        if unoCommand in commands:
            textElement = node.xpath('prop[@oor:name="Label"]/value', namespaces = {
                'oor': 'http://openoffice.org/2001/registry',
                })

            if len(textElement) == 1:
                # extract the uno command's English text
                text = ''.join(textElement[0].itertext())
                descriptions[unoCommand] = text

    return descriptions

# Print commands from all the XCU files, and collect them too
def printCommands(lofficeDir, commands):
    descriptions = {}
    dir = lofficeDir + '/officecfg/registry/data/org/openoffice/Office/UI'
    for file in os.listdir(dir):
        if file.endswith(".xcu"):
            descriptions.update(printCommandsFromXCU(os.path.join(dir, file), commands))

    # output the unocommands.js
    print '''// Don't modify, generated using unocommands.py

var unoCommandsArray = {'''

    for key in sorted(descriptions.keys()):
        print ('    ' + key + ": _('" + descriptions[key] + "'),").encode('utf-8')

    print '''};

global._UNO = function(string) {
    var text = unoCommandsArray[string.substr(5)];
    if (text !== undefined) {
        text = text.replace('~', '');
    } else {
        // we should avoid this, but when it happens, present at least
        // somehow reasonable text
        text = string.substr(5);
    }
    return text;
}'''

    return descriptions

# Read the uno commands present in the unocommands.js for checking
def parseUnocommandsJS(onlineDir):
    descriptions = {}

    f = open(onlineDir + '/loleaflet/unocommands.js', 'r')
    readingCommands = False
    for line in f:
        m = re.match(r"    ([^:]*): _\('([^']*)'\),", line)
        if m:
            command = m.group(1)
            text = m.group(2)
            descriptions[command] = text

    return descriptions

if __name__ == "__main__":
    if len(sys.argv) != 3:
        usage()
        exit(1)

    check = False
    onlineDir = ''
    lofficeDir = ''
    if (sys.argv[1] == '--check'):
        check = True
        onlineDir = sys.argv[2]
    else:
        onlineDir = sys.argv[1]
        lofficeDir = sys.argv[2]

    commands = extractCommands(onlineDir)

    # build the uno descriptions from all the xcu files
    descriptions = {}
    if (check):
        descriptions = parseUnocommandsJS(onlineDir)
    else:
        descriptions = printCommands(lofficeDir, commands)

    # check that we have translations for everything
    dif = commands - set(descriptions.keys())
    if len(dif) > 0:
        sys.stderr.write("ERROR: The following commands are not covered in unocommands.js:\n\n.uno:" + '\n.uno:'.join(dif) + "\n\n")
        exit(1)

# vim: set shiftwidth=4 softtabstop=4 expandtab:
