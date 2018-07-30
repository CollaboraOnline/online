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
import sys
import itertools
import re

def usageAndExit():
    message = """usage: {program} online_dir lo_translations_dir lang

Prints en-US strings that do not have translations in the specified language.

"""
    print(message.format(program = os.path.basename(sys.argv[0])))
    exit(1)

# extract translations from po files
def extractFromPo(poFile, stringIds, untranslated):
    if not os.path.isfile(poFile):
        return

    po = polib.pofile(poFile, autodetect_encoding=False, encoding="utf-8", wrapwidth=-1)

    for entry in itertools.chain(po.untranslated_entries(), po.fuzzy_entries()):
        for stringId in stringIds:
            if stringId in entry.msgctxt:
                untranslated.append(entry.msgid)

# Read the uno commands present in the unocommands.js for checking
def parseUnocommandsJS(onlineDir):
    strings = {}

    f = open(onlineDir + '/loleaflet/unocommands.js', 'r')
    readingCommands = False
    for line in f:
        line = line.decode('utf-8')
        m = re.match(r"\t([^:]*):.*", line)
        if m:
            command = m.group(1)

            n = re.findall(r"_\('([^']*)'\)", line)
            if n:
                strings[command] = n

    return strings

# Remove duplicates from list
def uniq(seq):
    seen = set()
    seen_add = seen.add
    return [x for x in seq if not (x in seen or seen_add(x))]

if __name__ == "__main__":
    if len(sys.argv) != 4:
        usageAndExit()

    onlineDir = sys.argv[1]
    translationsDir = sys.argv[2]
    lang = sys.argv[3]

    dir = translationsDir + '/source/'

    untranslated = []

# LO Core strings

    # extract 'Clear formatting'
    poFile = dir + lang + '/svx/source/tbxctrls.po'
    extractFromPo(poFile, ["RID_SVXSTR_CLEARFORM"], untranslated)

    # extract some status bar strings
    poFile = dir + lang + '/svx/source/stbctrls.po'
    stringIds = ["RID_SVXMENU_SELECTION", "RID_SVXSTR_OVERWRITE_TEXT"]
    extractFromPo(poFile, stringIds, untranslated)
    poFile = dir + lang + '/sw/source/ui/shells.po'
    extractFromPo(poFile, ["STR_PAGE_COUNT"], untranslated)
    poFile = dir + lang + '/sw/source/ui/app.po'
    extractFromPo(poFile, ["STR_STATUSBAR_WORDCOUNT_NO_SELECTION"], untranslated)

    # extract Writer style names
    poFile = dir + lang + '/sw/source/ui/utlui.po'
    extractFromPo(poFile, ["STR_POOL"], untranslated)

    # extract Impress/Draw style names
    poFile = dir + lang + '/sd/source/core.po'
    streingIds = ["STR_STANDARD_STYLESHEET_NAME", "STR_POOL", "STR_PSEUDOSHEET"]
    extractFromPo(poFile, stringIds, untranslated)

    # extract Impress layout names and 'Slide %1 of %2'
    poFile = dir + lang + '/sd/source/ui/app.po'
    stringIds = ["STR_AUTOLAYOUT", "STR_AL_", "STR_SD_PAGE_COUNT"]
    extractFromPo(poFile, stringIds, untranslated)

    # extract Calc style names and strings for status bar
    poFile = dir + lang + '/sc/source/ui/src.po'
    stringIds = ["STR_STYLENAME_", "STR_FILTER_SELCOUNT", "STR_ROWCOL_SELCOUNT", "STR_FUN_TEXT_", "STR_UNDO_INSERTCELLS", "STR_TABLE_COUNT"]
    extractFromPo(poFile, stringIds, untranslated)

    # extract language names
    poFile = dir + lang + '/svtools/source/misc.po'
    extractFromPo(poFile, ["STR_ARR_SVT_LANGUAGE_TABLE"], untranslated)

    # extract 'None (Do not check spelling)'
    poFile = dir + lang + '/framework/source/classes.po'
    extractFromPo(poFile, ["STR_LANGSTATUS_NONE"], untranslated)

# UNO command strings

    parsed = parseUnocommandsJS(onlineDir)
    keys = set(parsed.keys())

    poFile = dir + lang + '/officecfg/registry/data/org/openoffice/Office/UI.po'

    po = polib.pofile(poFile, autodetect_encoding=False, encoding="utf-8", wrapwidth=-1)

    for entry in itertools.chain(po.untranslated_entries(), po.fuzzy_entries()):
        m = re.search(r"\.uno:([^\n]*)\n", entry.msgctxt)
        if m:
            command = m.group(1)
            if command in keys:
                for text in parsed[command]:
                    if text == entry.msgid:
                        untranslated.append(entry.msgid.replace("~",""))

# Online UI

    poFile = onlineDir + '/loleaflet/po/ui-' + lang.replace("-","_") + '.po'
    po = polib.pofile(poFile, autodetect_encoding=False, encoding="utf-8", wrapwidth=-1)

    for entry in itertools.chain(po.untranslated_entries(), po.fuzzy_entries()):
        untranslated.append(entry.msgid)

# Online help (keyboard shortcuts)

    poFile = onlineDir + '/loleaflet/po/help-' + lang.replace("-","_") + '.po'
    po = polib.pofile(poFile, autodetect_encoding=False, encoding="utf-8", wrapwidth=-1)

    for entry in itertools.chain(po.untranslated_entries(), po.fuzzy_entries()):
        untranslated.append(entry.msgid)

# Print the results

    for elem in uniq(untranslated):
        print elem.encode('utf-8')


# vim: set shiftwidth=4 softtabstop=4 expandtab:
