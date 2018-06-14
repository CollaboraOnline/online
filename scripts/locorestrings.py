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

def usageAndExit():
    message = """usage: {program} online_dir lo_translations_dir

Translates style names, layout names, language names, etc. from
LibreOffice files.

"""
    print(message.format(program = os.path.basename(sys.argv[0])))
    exit(1)

# extract translations from po files
def extractFromPo(poFile, stringIds, translations):
    if not os.path.isfile(poFile):
        return

    po = polib.pofile(poFile, autodetect_encoding=False, encoding="utf-8", wrapwidth=-1)

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

        # extract 'Clear formatting'
        poFile = dir + lang + '/svx/source/tbxctrls.po'
        extractFromPo(poFile, ["RID_SVXSTR_CLEARFORM"], translations)

        # extract some status bar strings
        poFile = dir + lang + '/svx/source/stbctrls.po'
        stringIds = ["RID_SVXMENU_SELECTION", "RID_SVXSTR_OVERWRITE_TEXT"]
        extractFromPo(poFile, stringIds, translations)
        poFile = dir + lang + '/sw/source/ui/shells.po'
        extractFromPo(poFile, ["STR_PAGE_COUNT"], translations)
        poFile = dir + lang + '/sw/source/ui/app.po'
        extractFromPo(poFile, ["STR_STATUSBAR_WORDCOUNT_NO_SELECTION"], translations)

        # extract Writer style names
        poFile = dir + lang + '/sw/source/ui/utlui.po'
        extractFromPo(poFile, ["STR_POOL"], translations)

        # extract Impress/Draw style names
        poFile = dir + lang + '/sd/source/core.po'
        streingIds = ["STR_STANDARD_STYLESHEET_NAME", "STR_POOL", "STR_PSEUDOSHEET"]
        extractFromPo(poFile, stringIds, translations)

        # extract Impress layout names and 'Slide %1 of %2'
        poFile = dir + lang + '/sd/source/ui/app.po'
        stringIds = ["STR_AUTOLAYOUT", "STR_AL_", "STR_SD_PAGE_COUNT"]
        extractFromPo(poFile, stringIds, translations)

        # extract Calc style names and strings for status bar
        poFile = dir + lang + '/sc/source/ui/src.po'
        stringIds = ["STR_STYLENAME_", "STR_FILTER_SELCOUNT", "STR_ROWCOL_SELCOUNT", "STR_FUN_TEXT_", "STR_UNDO_INSERTCELLS", "STR_TABLE_COUNT", "SCSTR_INSTABLE"]
        extractFromPo(poFile, stringIds, translations)

        # extract language names
        poFile = dir + lang + '/svtools/source/misc.po'
        extractFromPo(poFile, ["STR_ARR_SVT_LANGUAGE_TABLE"], translations)

        # extract 'None (Do not check spelling)'
        poFile = dir + lang + '/framework/source/classes.po'
        extractFromPo(poFile, ["STR_LANGSTATUS_NONE"], translations)

        f = open(onlineDir + '/loleaflet/dist/l10n/locore/' + lang + '.json', 'w')
        f.write('{\n')

        writeComma = False
        for key in sorted(translations.keys()):
            if writeComma:
                f.write(',\n')
            else:
                writeComma = True
            f.write(('"' + key + '":"' + translations[key] + '"').encode('utf-8'))

        f.write('\n}\n')

# vim: set shiftwidth=4 softtabstop=4 expandtab:
