#! /bin/bash
# This file is part of the LibreOffice project.
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# -- Available env vars --
# * DOCKER_HUB_REPO - which Docker Hub repo to use
# * DOCKER_HUB_TAG  - which Docker Hub tag to create
# * CORE_BRANCH  - which core branch to build
# * ONLINE_BRANCH - which online branch to build
# * ONLINE_EXTRA_BUILD_OPTIONS - extra build options for online
# * NO_DOCKER_IMAGE - if set, don't build the docker image itself, just do all the preps

CORE_BRANCH=distro/collabora/cp-6.0
ONLINE_BRANCH=distro/collabora/collabora-online-4
DOCKER_HUB_REPO=collabora/code
DOCKER_HUB_TAG=4.1-snapshot

# check we can sudo without asking a pwd
echo "Trying if sudo works without a password"
echo
echo "If you get a password prompt now, break, and fix your setup using 'sudo visudo'; add something like:"
echo "yourusername ALL=(ALL) NOPASSWD: /sbin/setcap"
echo
sudo echo "works"

echo "Building core branch '$CORE_BRANCH'"
echo "Building online branch '$ONLINE_BRANCH'"
echo "Using Docker Hub Repository: '$DOCKER_HUB_REPO' with tag '$DOCKER_HUB_TAG'."

# do everything in the builddir
SRCDIR=$(realpath `dirname $0`)
INSTDIR="$SRCDIR/instdir"
BUILDDIR="$SRCDIR/builddir"

mkdir -p "$BUILDDIR"
cd "$BUILDDIR"

rm -rf "$INSTDIR" || true
mkdir -p "$INSTDIR"

##### cloning & updating #####

# core repo
if test ! -d core ; then
    git clone https://git.libreoffice.org/core core || exit 1
fi

( cd core && git fetch --all && git checkout $CORE_BRANCH && ./g pull -r ) || exit 1

# online repo
if test ! -d online ; then
    git clone https://git.libreoffice.org/online online || exit 1
fi

( cd online && git fetch --all && git checkout -f $ONLINE_BRANCH && git pull -r ) || exit 1

# online-branding repo

if test ! -d online-branding; then
    git clone git@gitlab.collabora.com:productivity/online-branding.git || echo "Warning: online-branding.git was not cloned. Lack of permissions?"
fi

( cd online-branding && git pull -r && git checkout master ) || echo "Warning: pull from online-branding.git cannot be performed. Lack of permissions?"

##### core #####

# build core
( cd core && ./autogen.sh --with-distro=CPLinux-LOKit --without-package-format --disable-symbols ) || exit 1
( cd core && make ) || exit 1

# copy stuff
mkdir -p "$INSTDIR"/opt/
cp -a core/instdir "$INSTDIR"/opt/collaboraoffice6.0

# FIXME fix RPATH of libcairo
chrpath -r '$ORIGIN' "$INSTDIR"/opt/collaboraoffice6.0/program/libcairo.so.2

##### online #####

# build
( cd online && ./autogen.sh ) || exit 1
( cd online && ./configure --prefix=/usr --sysconfdir=/etc --localstatedir=/var --enable-silent-rules --with-lokit-path="$BUILDDIR"/core/include --with-lo-path="$INSTDIR"/opt/collaboraoffice6.0 --with-app-name="Collabora Online Development Edition" $ONLINE_EXTRA_BUILD_OPTIONS) || exit 1
( cd online && make -j 8) || exit 1

# copy stuff
( cd online && DESTDIR="$INSTDIR" make install ) || exit 1

# CODE branding
mkdir -p $INSTDIR/usr/share/loolwsd/loleaflet/dist/images
mkdir -p $INSTDIR/opt/collaboraoffice6.0/share/theme_definitions/online
cp -a online-branding/online-theme/* $INSTDIR/opt/collaboraoffice6.0/share/theme_definitions/online
# FIXME branding-CODE.css ??
cp -a online-branding/branding.css $INSTDIR/usr/share/loolwsd/loleaflet/dist/branding.css
cp -a online-branding/branding-CODE.js $INSTDIR/usr/share/loolwsd/loleaflet/dist/branding.js
cp -a online-branding/toolbar-bg-CODE-logo.svg $INSTDIR/usr/share/loolwsd/loleaflet/dist/images/toolbar-bg.svg
for i in `grep -o images/.*svg online-branding/branding.css | sed -e "s/images\///" | grep -v toolbar-bg.svg`
do
    cp -a online-branding/$i $INSTDIR/usr/share/loolwsd/loleaflet/dist/images/
done

# Create new docker image
if [ -z "$NO_DOCKER_IMAGE" ]; then
  cd "$SRCDIR"
  docker build --no-cache -t $DOCKER_HUB_REPO:$DOCKER_HUB_TAG . || exit 1
  docker push $DOCKER_HUB_REPO:$DOCKER_HUB_TAG || exit 1
else
  echo "Skipping docker image build"
fi;
