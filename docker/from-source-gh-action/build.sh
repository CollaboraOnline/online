#! /bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# -- Available env vars --
# * CORE_ASSETS  - which prebuilt assets to build in core
# * CORE_BRANCH  - which branch to build in core
# * COLLABORA_ONLINE_REPO - which git repo to clone online from
# * COLLABORA_ONLINE_BRANCH - which branch to build in online
# * CORE_BUILD_TARGET - which make target to run (in core repo)
# * ONLINE_EXTRA_BUILD_OPTIONS - extra build options for online

if [ -z "$CORE_ASSETS" ]; then
  if [ -z "$CORE_BRANCH" ]; then
    CORE_BRANCH="distro/collabora/co-24.04"
  fi;
  echo "Building core branch '$CORE_BRANCH'"
else
  echo "Building from core assets $CORE_ASSETS"
fi;

if [ -z "$COLLABORA_ONLINE_REPO" ]; then
  COLLABORA_ONLINE_REPO="https://github.com/CollaboraOnline/online.git"
fi;
if [ -z "$COLLABORA_ONLINE_BRANCH" ]; then
  COLLABORA_ONLINE_BRANCH="master"
fi;
echo "Building online branch '$COLLABORA_ONLINE_BRANCH' from '$COLLABORA_ONLINE_REPO'"

if [ -z "$CORE_BUILD_TARGET" ]; then
  CORE_BUILD_TARGET=""
fi;
echo "LOKit (core) build target: '$CORE_BUILD_TARGET'"

SRCDIR=$(realpath `dirname $0`)
INSTDIR="$SRCDIR/instdir"
BUILDDIR="$SRCDIR/builddir"

mkdir -p "$BUILDDIR"
cd "$BUILDDIR"

rm -rf "$INSTDIR" || true
mkdir -p "$INSTDIR"

##### build static poco #####

if test ! -f poco/lib/libPocoFoundation.a ; then
    wget https://pocoproject.org/releases/poco-1.12.5p2/poco-1.12.5p2-all.tar.gz
    tar -xzf poco-1.12.5p2-all.tar.gz
    cd poco-1.12.5p2-all/
    ./configure --static --no-tests --no-samples --no-sharedlibs --cflags="-fPIC" --omit=Zip,Data,Data/SQLite,Data/ODBC,Data/MySQL,MongoDB,PDF,CppParser,PageCompiler,Redis,Encodings,ActiveRecord --prefix=$BUILDDIR/poco
    make -j $(nproc)
    make install
    cd ..
fi


##### cloning & updating #####

# core repo
# only if CORE_ASSETS is not set
if [ -z "$CORE_ASSETS" ]; then
  if test ! -d core ; then
    git clone https://git.libreoffice.org/core || exit 1
  fi

  ( cd core && git fetch --all && git checkout $CORE_BRANCH && ./g pull -r ) || exit 1
else
  mkdir -p core
  ( cd core/ && wget "$CORE_ASSETS" -O core-assets.tar.xz && tar -xzf core-assets.tar.xz && rm core-assets.tar.xz) || exit 1
fi


# Clone online repo
if test ! -d online ; then
  git clone --depth=1 "$COLLABORA_ONLINE_REPO" online || exit 1
fi

( cd online && git fetch --all && git checkout -f $COLLABORA_ONLINE_BRANCH && git clean -f -d && git pull -r ) || exit 1

##### LOKit (core) #####

# only if core assets are not set
if [ -z "$CORE_ASSETS" ]; then
  # build
  if [ "$CORE_BRANCH" == "distro/collabora/co-22.05" ]; then
    ( cd core && ./autogen.sh --with-distro=CPLinux-LOKit --disable-epm --without-package-format --disable-symbols ) || exit 1
  else
    ( cd core && ./autogen.sh --with-distro=LibreOfficeOnline ) || exit 1
  fi
  ( cd core && make $CORE_BUILD_TARGET ) || exit 1

  # copy stuff
  mkdir -p "$INSTDIR"/opt/
  cp -a core/instdir "$INSTDIR"/opt/lokit
else
  echo "Using prebuilt core assets"
  mkdir -p "$INSTDIR"/opt/
  cp -a core/instdir "$INSTDIR"/opt/lokit
fi

##### coolwsd & cool #####

# build
( cd online && ./autogen.sh ) || exit 1
( cd online && ./configure --prefix=/usr --sysconfdir=/etc --localstatedir=/var --enable-silent-rules --disable-tests --with-lokit-path="$BUILDDIR"/core/include --with-lo-path=/opt/lokit --with-poco-includes=$BUILDDIR/poco/include --with-poco-libs=$BUILDDIR/poco/lib $ONLINE_EXTRA_BUILD_OPTIONS) || exit 1
( cd online && make -j $(nproc)) || exit 1

# copy stuff
( cd online && DESTDIR="$INSTDIR" make install ) || exit 1

# Build online branding if available
if test -d online-branding ; then
  npm install -g sass
  cd online-branding
  ./brand.sh $INSTDIR/opt/lokit $INSTDIR/usr/share/coolwsd/browser/dist 3 # CODE
  ./brand.sh $INSTDIR/opt/lokit $INSTDIR/usr/share/coolwsd/browser/dist 5 # Nextcloud Office
  cd ..
fi
