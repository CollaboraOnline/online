#! /bin/bash
# This file is part of the LibreOffice project.
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# check we can sudo without asking a pwd
echo "Trying if sudo works without a password"
echo
echo "If you get a password prompt now, break, and fix your setup using 'sudo visudo'; add something like:"
echo "yourusername ALL=(ALL) NOPASSWD: ALL"
echo
sudo echo "works"

# check if we have jake
which jake || { cat << EOF

jake is not installed, get it like:

  npm install -g jake
EOF
exit 1 ; }

# do everything in the builddir
SRCDIR=$(realpath `dirname $0`)
INSTDIR="$SRCDIR/instdir"
BUILDDIR="$SRCDIR/builddir"

mkdir -p "$BUILDDIR"
cd "$BUILDDIR"

rm -rf "$INSTDIR"
mkdir -p "$INSTDIR"

##### cloning & updating #####

# libreoffice repo
if test ! -d libreoffice ; then
    git clone git://anongit.freedesktop.org/libreoffice/core libreoffice || exit 1
fi

( cd libreoffice && git checkout master && ./g pull -r ) || exit 1

# online repo
if test ! -d online ; then
    git clone git://anongit.freedesktop.org/libreoffice/online online || exit 1
    ( cd online && ./autogen.sh ) || exit 1
fi

( cd online && git checkout -f master && git pull -r ) || exit 1

##### LibreOffice #####

# build LibreOffice
cat > libreoffice/autogen.input << EOF
--disable-cups
--disable-dbus
--disable-dconf
--disable-epm
--disable-evolution2
--disable-ext-nlpsolver
--disable-ext-wiki-publisher
--disable-firebird-sdbc
--disable-gio
--disable-gstreamer-0-10
--disable-gstreamer-1-0
--disable-gtk
--disable-gtk3
--disable-kde4
--disable-odk
--disable-online-update
--disable-pdfimport
--disable-postgresql-sdbc
--disable-report-builder
--disable-scripting-beanshell
--disable-scripting-javascript
--disable-sdremote
--disable-sdremote-bluetooth
--enable-extension-integration
--enable-mergelibs
--enable-python=internal
--enable-release-build
--with-external-dict-dir=/usr/share/hunspell
--with-external-hyph-dir=/usr/share/hyphen
--with-external-thes-dir=/usr/share/mythes
--with-fonts
--with-galleries=no
--with-lang=ALL
--with-linker-hash-style=both
--with-system-dicts
--with-system-zlib
--with-theme=tango
--without-branding
--without-help
--without-java
--without-junit
--with-myspell-dicts
--without-package-format
--without-system-cairo
--without-system-jars
--without-system-jpeg
--without-system-libpng
--without-system-libxml
--without-system-openssl
--without-system-poppler
--without-system-postgresql
EOF

( cd libreoffice && ./autogen.sh ) || exit 1
( cd libreoffice && make ) || exit 1

# copy stuff
mkdir -p "$INSTDIR"/opt/
cp -a libreoffice/instdir "$INSTDIR"/opt/libreoffice
mkdir -p "$INSTDIR"/usr/share/hunspell
mkdir -p "$INSTDIR"/usr/share/hyphen
mkdir -p "$INSTDIR"/opt/lool/systemplate/usr/share/hyphen
for i in `find libreoffice/instdir/share/extensions/ -name hyph*.dic`;do cp -a $i "$INSTDIR"/opt/lool/systemplate/usr/share/hyphen;done
for i in `find libreoffice/instdir/share/extensions/ -name hyph*.dic`;do cp -a $i "$INSTDIR"/usr/share/hyphen;done
cp -a libreoffice/instdir/share/extensions/dict-en/en_US.* "$INSTDIR"/usr/share/hunspell
cp -a libreoffice/instdir/share/extensions/dict-en/en_GB.* "$INSTDIR"/usr/share/hunspell
cp -a libreoffice/instdir/share/extensions/dict-it/it_IT.* "$INSTDIR"/usr/share/hunspell
cp -a libreoffice/instdir/share/extensions/dict-nl/nl_NL.* "$INSTDIR"/usr/share/hunspell
cp -a libreoffice/instdir/share/extensions/dict-pl/pl_PL.* "$INSTDIR"/usr/share/hunspell
cp -a libreoffice/instdir/share/extensions/dict-ru/ru_RU.* "$INSTDIR"/usr/share/hunspell
cp -a libreoffice/instdir/share/extensions/dict-pt-BR/pt_BR.* "$INSTDIR"/usr/share/hunspell
cp -a libreoffice/instdir/share/extensions/dict-pt-PT/pt_PT.* "$INSTDIR"/usr/share/hunspell
cp -a libreoffice/instdir/share/extensions/dict-fr/fr.dic "$INSTDIR"/usr/share/hunspell/fr_FR.dic
cp -a libreoffice/instdir/share/extensions/dict-fr/fr.aff "$INSTDIR"/usr/share/hunspell/fr_FR.aff
cp -a libreoffice/instdir/share/extensions/dict-es/es_ANY.dic "$INSTDIR"/usr/share/hunspell/es_ES.dic
cp -a libreoffice/instdir/share/extensions/dict-es/es_ANY.aff "$INSTDIR"/usr/share/hunspell/es_ES.aff
cp -a libreoffice/instdir/share/extensions/dict-de/de_AT_frami.dic "$INSTDIR"/usr/share/hunspell/de_AT.dic
cp -a libreoffice/instdir/share/extensions/dict-de/de_AT_frami.aff "$INSTDIR"/usr/share/hunspell/de_AT.aff
cp -a libreoffice/instdir/share/extensions/dict-de/de_CH_frami.dic "$INSTDIR"/usr/share/hunspell/de_CH.dic
cp -a libreoffice/instdir/share/extensions/dict-de/de_CH_frami.aff "$INSTDIR"/usr/share/hunspell/de_CH.aff
cp -a libreoffice/instdir/share/extensions/dict-de/de_DE_frami.dic "$INSTDIR"/usr/share/hunspell/de_DE.dic
cp -a libreoffice/instdir/share/extensions/dict-de/de_DE_frami.aff "$INSTDIR"/usr/share/hunspell/de_DE.aff


##### loolwsd & loleaflet #####

# build
( cd online && ./configure --prefix=/usr --sysconfdir=/etc --localstatedir=/var --enable-silent-rules --with-lokit-path="$BUILDDIR"/libreoffice/include --with-lo-path="$INSTDIR"/opt/libreoffice ) || exit 1
( cd online/loleaflet/po && ../../scripts/downloadpootle.sh )
( cd online/loleaflet && make l10n) || exit 1
( cd online && make -j 8) || exit 1

# copy stuff
( cd online && DESTDIR="$INSTDIR" make install ) || exit 1

# Create new docker image

cd "$SRCDIR"
docker build --no-cache -t libreoffice/online:master . || exit 1
docker push libreoffice/online:master || exit 1
