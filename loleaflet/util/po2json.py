#!/usr/bin/python
#
# convert .po to .json
#

import json
import optparse
import os
import polib
import re
import string
import sys

parser = optparse.OptionParser(usage="usage: %prog [options] pofile...")
parser.add_option("--quiet", action="store_false", default=True, dest="verbose", help="don't print status messages to stdout")
parser.add_option("-o", type="string", default="", dest="destfile", help="output file name (if there is exactly one input file)")

(options, args) = parser.parse_args()

if args == None or len(args) == 0:
	print("ERROR: you must specify at least one po file to translate");
	sys.exit(1)

if options.destfile != '' and len(args) != 1:
	print("ERROR: when -o is provided, there has to be exactly 1 input file")
	sys.exit(1)

paramFix = re.compile("(\\(([0-9])\\))")

for srcfile in args:

	destfile = os.path.splitext(srcfile)[0] + ".json"
	if options.destfile != '':
		destfile = options.destfile

	if options.verbose:
		print("INFO: converting %s to %s" % (srcfile, destfile))

	xlate_map = {}

	po = polib.pofile(srcfile, autodetect_encoding=False, encoding="utf-8", wrapwidth=-1)
	for entry in po.translated_entries():
		if entry.msgstr == '':
			continue

		xlate_map[entry.msgid] = entry.msgstr;

	dest = open(destfile, "w")

	dest.write(json.dumps(xlate_map, sort_keys = True));

	dest.close()

