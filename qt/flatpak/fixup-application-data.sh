#!/bin/bash

set -e

# Merge individual application MimeType lines:
for i in /app/share/applications/org.collabora.CODA.{calc,draw,impress,writer}.desktop; do
  mime=$(grep ^MimeType= "$i")
  mime=${mime#MimeType=}
  mime=${mime%;}
  sed -i -e "s|^MimeType=|&${mime};|" /app/share/applications/org.collabora.CODA.desktop
done

# Strip out base and math applications from description, Comment and Actions:
sed -i -e 's/, Base (databases), and Math (formula editing)//' \
 /app/share/appdata/org.collabora.CODA.appdata.xml
sed -i -e 's/, formulas, and databases//' /app/share/applications/org.collabora.CODA.desktop
sed -i -e 's/;Base;Math//' /app/share/applications/org.collabora.CODA.desktop
sed -i -E -z -e 's/\[Desktop Action (Base|Math)\]\nName=[^\n]+\nExec=[^\n]+\n+//g' \
 /app/share/applications/org.collabora.CODA.desktop

# Remove individual application desktop and icon files:
rm /app/share/applications/org.collabora.CODA.*.desktop
rm /app/share/icons/hicolor/*/apps/org.collabora.CODA.{base,basic,calc,chart,draw,impress,main,math,writer}.*

# Fix Exec lines:
sed -i -e s/^Exec=collaboraoffice/Exec=coda/ /app/share/applications/org.collabora.CODA.desktop
sed -i -e 's/^\(Exec=.*\)%U/\1%F/' /app/share/applications/org.collabora.CODA.desktop
