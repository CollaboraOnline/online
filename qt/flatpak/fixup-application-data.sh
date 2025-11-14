#!/bin/bash

set -e

# Merge individual application MimeType lines:
for i in /app/share/applications/com.collabora.Office.{calc,draw,impress,writer}.desktop; do
  mime=$(grep ^MimeType= "$i")
  mime=${mime#MimeType=}
  mime=${mime%;}
  sed -i -e "s|^MimeType=|&${mime};|" /app/share/applications/com.collabora.Office.desktop
done

# Strip out base and math applications from description, Comment and Actions:
sed -i -e 's/, Base (databases), and Math (formula editing)//' \
 /app/share/appdata/com.collabora.Office.appdata.xml
sed -i -e 's/, formulas, and databases//' /app/share/applications/com.collabora.Office.desktop
sed -i -e 's/;Base;Math//' /app/share/applications/com.collabora.Office.desktop
sed -i -E -z -e 's/\[Desktop Action (Base|Math)\]\nName=[^\n]+\nExec=[^\n]+\n+//g' \
 /app/share/applications/com.collabora.Office.desktop

# Strip out draw application from Actions for now:
sed -i -e 's/;Draw//' /app/share/applications/com.collabora.Office.desktop
sed -i -E -z -e 's/\[Desktop Action Draw\]\nName=[^\n]+\nExec=[^\n]+\n+//g' \
 /app/share/applications/com.collabora.Office.desktop

# Adapt calc, impress, writer application Action names:
sed -i -e 's/^Name=Calc$/Name=Spreadsheet/' -e 's/^Name=Impress$/Name=Presentation/' \
 -e 's/^Name=Writer$/Name=Document/' /app/share/applications/com.collabora.Office.desktop

# Remove individual application desktop and icon files:
rm /app/share/applications/com.collabora.Office.*.desktop
rm /app/share/icons/hicolor/*/apps/com.collabora.Office.{base,basic,calc,chart,draw,impress,main,math,writer}.*

# Fix Exec lines:
sed -i -e s/^Exec=collaboraoffice/Exec=coda-qt/ /app/share/applications/com.collabora.Office.desktop
sed -i -e 's/^\(Exec=.*\)%U/\1%F/' /app/share/applications/com.collabora.Office.desktop
