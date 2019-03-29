#!/bin/bash

if [ "$#" -ne 2 ]; then
    echo "Usage: plist2pot.sh Root.plist ios.pot"
    exit 1;
fi

rm -f $2

cat << EOF >> $2
# SOME DESCRIPTIVE TITLE.
# Copyright (C) YEAR THE PACKAGE'S COPYRIGHT HOLDER
# This file is distributed under the same license as the PACKAGE package.
# FIRST AUTHOR <EMAIL@ADDRESS>, YEAR.
#
#, fuzzy
msgid ""
msgstr ""
"Project-Id-Version: PACKAGE VERSION\n"
"Report-Msgid-Bugs-To: \n"
"POT-Creation-Date: $(date +"%Y-%m-%d %H:%M%z")\n"
"PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE\n"
"Last-Translator: FULL NAME <EMAIL@ADDRESS>\n"
"Language-Team: LANGUAGE <LL@li.org>\n"
"Language: \n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=CHARSET\n"
"Content-Transfer-Encoding: 8bit\n"

EOF

sed -n 'N;/<key>Title<\/key>/{N;/<string>.*<\/string>/{s/.*<string>\(.*\)<\/string>.*/#: Root.plist\
msgid "\1"\
msgstr ""\
/p;};}' $1 >> $2
