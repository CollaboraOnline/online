#!/usr/bin/python
#

import os
import polib
import string
import sys
import codecs
UTF8Writer = codecs.getwriter('utf8')
sys.stdout = UTF8Writer(sys.stdout)

# get the translation for word "Layout"

po = polib.pofile("officecfg/registry/data/org/openoffice/Office/UI.po", autodetect_encoding=False, encoding="utf-8", wrapwidth=-1)
for entry in po.translated_entries():
	if entry.msgstr == '' or entry.msgstr == entry.msgid:
		continue
	if entry.msgid == "Layout":
		print("\n#: %s\nmsgid \"%s\"\nmsgstr \"%s\"" % (entry.occurrences[0][0], entry.msgid, entry.msgstr))

# get the translations for slide layouts

layouts = ['STR_AUTOLAYOUT_NONE\n', 'STR_AUTOLAYOUT_ONLY_TITLE\n', 'STR_AUTOLAYOUT_ONLY_TEXT\n', 'STR_AUTOLAYOUT_TITLE\n', 'STR_AUTOLAYOUT_CONTENT\n', 'STR_AUTOLAYOUT_2CONTENT\n', 'STR_AUTOLAYOUT_CONTENT_2CONTENT\n', 'STR_AUTOLAYOUT_2CONTENT_CONTENT\n', 'STR_AUTOLAYOUT_CONTENT_OVER_2CONTENT\n', 'STR_AUTOLAYOUT_2CONTENT_OVER_CONTENT\n', 'STR_AUTOLAYOUT_CONTENT_OVER_CONTENT\n', 'STR_AUTOLAYOUT_4CONTENT\n', 'STR_AUTOLAYOUT_6CONTENT\n', 'STR_AL_TITLE_VERT_OUTLINE\n', 'STR_AL_TITLE_VERT_OUTLINE_CLIPART\n', 'STR_AL_VERT_TITLE_TEXT_CHART\n', 'STR_AL_VERT_TITLE_VERT_OUTLINE\n']

po = polib.pofile("sd/source/ui/app.po", autodetect_encoding=False, encoding="utf-8", wrapwidth=-1)
for entry in po.translated_entries():
	if entry.msgstr == '' or entry.msgstr == entry.msgid:
		continue
	for layout in layouts:
		if layout in entry.msgctxt:
			print("\n#: %s\nmsgid \"%s\"\nmsgstr \"%s\"" % (entry.occurrences[0][0], entry.msgid, entry.msgstr))
