#!/usr/bin/env python

import os
import re
import sys
from lxml import etree

def usage():
    message = """usage: {program} loffice_srcdir online_srcdir"""
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
                commands += [ '.uno:' + command ]
                command = ''
        elif inCommand:
            command += c

    return commands

# Extract uno commands name from lines like "  type: 'unocommand', uno: '.uno:Command3',"
def commandFromMenuLine(line):
    commands = []

    m = re.search(r"\buno: *'([^']*)'", line)
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
        if line.find("'unocommand'") >= 0:
            commands += commandFromMenuLine(line)

    # may the list unique
    return set(commands)

# Create mapping between the commands and appropriate strings
def printCommandsFromXCU(xcu, commands):
    usedCommands = []

    root = etree.parse(xcu)
    nodes = root.xpath("/oor:component-data/node/node/node", namespaces = {
        'oor': 'http://openoffice.org/2001/registry',
        })
    for node in nodes:
        # extract the uno command name
        unoCommand = node.get('{http://openoffice.org/2001/registry}name')

        if unoCommand in commands:
            textElement = node.xpath('prop[@oor:name="Label"]/value', namespaces = {
                'oor': 'http://openoffice.org/2001/registry',
                })

            if len(textElement) == 1:
                # extract the uno command's English text
                text = ''.join(textElement[0].itertext())
                print ('    ' + unoCommand[5:] + ": _('" + text + "'),").encode('utf-8')

		usedCommands += [ unoCommand ]

    return usedCommands

if __name__ == "__main__":
    if len(sys.argv) != 3:
        usage()
        exit(1)

    commands = extractCommands(sys.argv[2])

    print '''// Don't modify, generated using unocommands.py

var unoCommandsArray = {'''

    # try all xcu files
    usedCommands = []
    dir = sys.argv[1] + '/officecfg/registry/data/org/openoffice/Office/UI'
    for file in os.listdir(dir):
        if file.endswith(".xcu"):
            usedCommands += printCommandsFromXCU(os.path.join(dir, file), commands)

    print '};'

    dif = commands - set(usedCommands)
    if len(dif) > 0:
	sys.stderr.write("ERROR: The following commands are not covered:\n\n" + '\n'.join(dif) + "\n")
