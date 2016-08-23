#!/bin/bash

LODIR=/home/timar/cp-5.1
LEAFLETDIR=/home/timar/online

for lang in `ls -1 $LODIR/translations/source`; do
echo -ne "{" > $lang.json
for unocommand in `grep -Pzo "(?s)^(\s*)\N*whitelist: .*?{.*?^\1}" $LEAFLETDIR/loleaflet/src/control/Control.ContextMenu.js | grep -Po "'.*?'" | tr -d "'" | sed -e "s/^/.uno:/"`;do grep -A4 $unocommand $LODIR/translations/source/$lang/officecfg/registry/data/org/openoffice/Office/UI.po | grep -P "msgid|msgstr" | tr -d "~" | sed -e "s/msgid //" -e "s/msgstr //";done | paste -d" " - - | sort | uniq | sed -e 's/" "/": "/' -e 's/$/, /' | grep -v '""' | tr -d "\n" | sed -e "s/, $//" >> $lang.json
echo -ne "}" >> $lang.json
done


