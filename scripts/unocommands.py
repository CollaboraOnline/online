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
import polib
import re
import sys
from lxml import etree

def usageAndExit():
    message = """usage: {program} [--check|--update|--translate] online_dir [...]

Checks, extracts, or translates .uno: command descriptions from the
LibreOffice XCU files.

Check whether all the commands in the menus have their descriptions in
unocommands.js:

    {program} --check /path/to/online

Update the unocommands.js by fetching the .uno: commands descriptions from the
core.git.  This is what you want to do after you add new .uno: commands or
dialogs to the menus:

    {program} --update /path/to/online /path/to/loffice

Update the translations of unocommands.js before releasing:

    {program} --translate /path/to/online /path/to/translations

"""
    print(message.format(program = os.path.basename(sys.argv[0])))
    exit(1)

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
    m = re.search(r"\buno: *'\.uno:([^']*)'", line)
    if m:
        return [ m.group(1) ]

    m = re.search(r"\b_UNO\('.uno:([^']*)'", line)
    if m:
        return [ m.group(1) ]

    return []

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
        elif line.find("_UNO(") >= 0:
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
def writeUnocommandsJS(onlineDir, lofficeDir, commands):
    descriptions = {}
    dir = lofficeDir + '/officecfg/registry/data/org/openoffice/Office/UI'
    for file in os.listdir(dir):
        if file.endswith(".xcu"):
            descriptions.update(printCommandsFromXCU(os.path.join(dir, file), commands))

    # output the unocommands.js
    f = open(onlineDir + '/loleaflet/unocommands.js', 'w')
    f.write('''// Don't modify, generated using unocommands.py

var unoCommandsArray = {\n''')

    for key in sorted(descriptions.keys()):
        f.write(('    ' + key + ": _('" + descriptions[key] + "'),\n").encode('utf-8'))

    f.write('''};

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
}\n''')

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
            descriptions[command] = text.decode('utf-8')

    return descriptions

# Generate translation JSONs for the .uno: commands
def writeTranslations(onlineDir, translationsDir, descriptions):
    keys = set(descriptions.keys())

    dir = translationsDir + '/source/'
    for lang in os.listdir(dir):
        poFile = dir + lang + '/officecfg/registry/data/org/openoffice/Office/UI.po'
        if not os.path.isfile(poFile):
            continue

        sys.stderr.write('Generating ' + lang + '...\n')

        po = polib.pofile(poFile, autodetect_encoding=False, encoding="utf-8", wrapwidth=-1)

        translations = {}
        for entry in po.translated_entries():
            m = re.search(r"\.uno:([^\n]*)\n", entry.msgctxt)
            if m:
                command = m.group(1)
                if command in keys and descriptions[command] == entry.msgid:
                    translations[entry.msgid] = entry.msgstr

        f = open(onlineDir + '/loleaflet/dist/l10n/uno/' + lang + '.json', 'w')
        f.write('{\n')

        writeComma = False
        for key in sorted(translations.keys()):
            if writeComma:
                f.write(',\n')
            else:
                writeComma = True
            f.write(('"' + key + '":"' + translations[key] + '"').encode('utf-8'))

        f.write('\n}\n')

if __name__ == "__main__":
    if len(sys.argv) < 1:
        usageAndExit()

    check = False
    translate = False
    onlineDir = ''
    lofficeDir = ''
    translationsDir = ''
    if (sys.argv[1] == '--check'):
        if len(sys.argv) != 3:
            usageAndExit()

        check = True
        onlineDir = sys.argv[2]
    elif (sys.argv[1] == '--translate'):
        translate = True
        if len(sys.argv) != 4:
            usageAndExit()

        onlineDir = sys.argv[2]
        translationsDir = sys.argv[3]
    elif (sys.argv[1] == "--update"):
        if len(sys.argv) != 4:
            usageAndExit()

        onlineDir = sys.argv[2]
        lofficeDir = sys.argv[3]
    else:
        usageAndExit()

    commands = extractCommands(onlineDir)

    # build the uno descriptions from all the xcu files
    descriptions = {}
    if (check or translate):
        descriptions = parseUnocommandsJS(onlineDir)
    else:
        descriptions = writeUnocommandsJS(onlineDir, lofficeDir, commands)

    # check that we have translations for everything
    dif = commands - set(descriptions.keys())
    if len(dif) > 0:
        sys.stderr.write("ERROR: The following commands are not covered in unocommands.js, run scripts/unocommands.py --update:\n\n.uno:" + '\n.uno:'.join(dif) + "\n\n")
        exit(1)

    if (translate):
        writeTranslations(onlineDir, translationsDir, descriptions)

# vim: set shiftwidth=4 softtabstop=4 expandtab:
