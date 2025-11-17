#!/bin/bash

set -e

# Merge individual application MimeType lines:
for i in /app/share/applications/com.collabora.Office.{calc,draw,impress,writer}.desktop; do
  mime=$(grep ^MimeType= "$i")
  mime=${mime#MimeType=}
  mime=${mime%;}
  sed -i -e "s|^MimeType=|&${mime};|" /app/share/applications/com.collabora.Office.desktop
done

# Paste in full CODA description:
sed -i -e 's/Collabora Office Desktop is a powerful office suite./Collabora Office Desktop brings the familiar Collabora Online experience to your computer - so you can create, edit, and present with a beautiful, modern UI. Built on trusted LibreOffice technology and backed by the largest team of LibreOffice developers worldwide, it delivers excellent interoperability with ODF and Microsoft Office formats (DOCX/XLSX/PPTX), and exports to PDF with ease. Your documents stay on your device unless you choose to share them - privacy by design./' \
 /app/share/appdata/com.collabora.Office.appdata.xml
# Paste in CODA screenshots:
sed -i -e 's/writer.png/https:\/\/col.la\/codelinuxwriter/' \
 /app/share/appdata/com.collabora.Office.appdata.xml
sed -i -e 's/calc.png/https:\/\/col.la\/codelinuxcalc/' \
 /app/share/appdata/com.collabora.Office.appdata.xml
sed -i -e 's/impress.png/https:\/\/col.la\/codelinuximpress/' \
 /app/share/appdata/com.collabora.Office.appdata.xml
sed -i -e 's/draw.png/https:\/\/col.la\/codelinuxdraw/' \
 /app/share/appdata/com.collabora.Office.appdata.xml
# Strip out base and math applications from description, Comment and Actions:
sed -i -e 's/, formulas, and databases//' /app/share/applications/com.collabora.Office.desktop
sed -i -e 's/;Base;Math//' /app/share/applications/com.collabora.Office.desktop
sed -i -E -z -e 's/\[Desktop Action (Base|Math)\]\nName=[^\n]+\nExec=[^\n]+\n+//g' \
 /app/share/applications/com.collabora.Office.desktop

# Adapt calc, impress, writer, draw application Action names:
sed -i -e 's/^Name=Calc$/Name=Spreadsheet/' -e 's/^Name=Impress$/Name=Presentation/' \
 -e 's/^Name=Writer$/Name=Textdocument/' -e 's/^Name=Draw$/Name=Drawing/' /app/share/applications/com.collabora.Office.desktop

# Remove individual application desktop and icon files:
rm /app/share/applications/com.collabora.Office.*.desktop
rm /app/share/icons/hicolor/*/apps/com.collabora.Office.{base,basic,calc,chart,draw,impress,main,math,writer}.*

# Fix Exec lines:
sed -i -e s/^Exec=collaboraoffice/Exec=coda-qt/ /app/share/applications/com.collabora.Office.desktop
sed -i -e 's/^\(Exec=.*\)%U/\1%F/' /app/share/applications/com.collabora.Office.desktop
