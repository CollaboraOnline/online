#!/usr/bin/env python
# -*- tab-width: 4; indent-tabs-mode: nil; py-indent-offset: 4 -*-
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

import os
import polib
import sys


def usageAndExit():
    message = """usage: {program} online_dir lo_translations_dir

Translates style names, layout names, language names, etc. from
LibreOffice files.

"""
    print(message.format(program=os.path.basename(sys.argv[0])))
    exit(1)

# extract translations from po files


def extractFromPo(poFile, stringIds, translations):
    if not os.path.isfile(poFile):
        return

    po = polib.pofile(
            poFile,
            autodetect_encoding=False,
            encoding="utf-8", wrapwidth=-1)

    for entry in po.translated_entries():
        for stringId in stringIds:
            if stringId in entry.msgctxt:
                translations[entry.msgid] = entry.msgstr


if __name__ == "__main__":
    if len(sys.argv) != 3:
        usageAndExit()

    onlineDir = sys.argv[1]
    translationsDir = sys.argv[2]

    dir = translationsDir + '/source/'

    for lang in os.listdir(dir):
        translations = {}

        sys.stderr.write('Generating ' + lang + '...\n')

        # extract 'Clear formatting', shape group names,
        # and some status bar strings
        poFile = dir + lang + '/svx/messages.po'
        extractFromPo(
            poFile,
            ["RID_SVXSTR_CLEARFORM",
             "RID_SVXSTR_OVERWRITE_TEXT",
             "RID_SVXITEMS_PAGE_LAND_TRUE",
             "RID_SVXITEMS_PAGE_LAND_FALSE",
             "selectionmenu|",
             "defaultshapespanel|"], translations)

        # extract Writer style names and status bar strings
        poFile = dir + lang + '/sw/messages.po'
        extractFromPo(
            poFile,
            ["STR_POOL",
             "STR_PAGE_COUNT",
             "STR_STATUSBAR_WORDCOUNT_NO_SELECTION",
             "STR_LANGSTATUS_NONE"], translations)

        # extract Impress/Draw style names,
        # layout names and 'Slide %1 of %2'
        poFile = dir + lang + '/sd/messages.po'
        extractFromPo(
            poFile,
            ["STR_STANDARD_STYLESHEET_NAME",
             "STR_POOL", "STR_PSEUDOSHEET",
             "STR_AUTOLAYOUT",
             "STR_AL_",
             "STR_SD_PAGE_COUNT",
             "drawpagedialog|DrawPageDialog"], translations)

        # extract Calc style names and strings for status bar
        poFile = dir + lang + '/sc/messages.po'
        extractFromPo(
            poFile,
            ["STR_STYLENAME_",
             "STR_FILTER_SELCOUNT",
             "STR_ROWCOL_SELCOUNT",
             "STR_FUN_TEXT_",
             "STR_UNDO_INSERTCELLS",
             "STR_TABLE_COUNT"], translations)

        # extract Function Wizard name for formula bar
        poFile = dir + lang + '/formula/messages.po'
        extractFromPo(poFile, ["STR_TITLE1"], translations)

        # extract language names
        poFile = dir + lang + '/svtools/messages.po'
        extractFromPo(poFile, ["STR_ARR_SVT_LANGUAGE_TABLE"], translations)

        f = open(onlineDir + '/browser/l10n/locore/' + lang + '.json', 'w')
        f.write('{\n')

        writeComma = False
        for key in sorted(translations.keys()):
            if writeComma:
                f.write(',\n')
            else:
                writeComma = True
            f.write(
                ('"' + key + '":"' + translations[key] + '"').encode('utf-8'))

        f.write('\n}\n')

# vim: set shiftwidth=4 softtabstop=4 expandtab:
