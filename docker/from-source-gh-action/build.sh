#!/bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# -- Available env vars --
# * CORE_ASSETS            - which prebuilt assets to build in core (по умолчанию берём co-24.04)
# * CORE_BRANCH            - which branch to build in core (игнорируется, если CORE_ASSETS задан)
# * CORE_BUILD_TARGET      - which make target to run (in core repo)
# * ONLINE_EXTRA_BUILD_OPTIONS - extra build options for online

echo "Building from current repository (expected branch: vaulterix/co-24.04 or similar custom fork)"

# Проверяем, что мы внутри репозитория Collabora Online (есть ключевые директории)
if [ ! -f "src/coolwsd.cpp" ] && [ ! -d "wsd" ] && [ ! -d "kit" ] && [ ! -f "Makefile.am" ]; then
    echo "ERROR: This script must be run from inside Collabora Online source tree"
    echo "       (expected files/directories like src/, wsd/, kit/, autogen.sh etc. not found)"
    exit 1
fi

if [ -z "$CORE_ASSETS" ]; then
    CORE_ASSETS="https://github.com/CollaboraOnline/online/releases/download/for-code-assets/core-co-24.04-assets.tar.gz"
    echo "Using default core assets: $CORE_ASSETS"
else
    echo "Using custom core assets: $CORE_ASSETS"
fi

if [ -z "$CORE_BUILD_TARGET" ]; then
    CORE_BUILD_TARGET=""
fi
echo "LOKit (core) build target: '$CORE_BUILD_TARGET'"

SRCDIR=$(realpath "$(dirname "$0")")
INSTDIR="$SRCDIR/instdir"
BUILDDIR="$SRCDIR/builddir"

mkdir -p "$BUILDDIR"
cd "$BUILDDIR" || exit 1

rm -rf "$INSTDIR" || true
mkdir -p "$INSTDIR"

##### build static poco #####

if [ ! -f poco/lib/libPocoFoundation.a ]; then
    wget https://pocoproject.org/releases/poco-1.12.5p2/poco-1.12.5p2-all.tar.gz
    tar -xzf poco-1.12.5p2-all.tar.gz
    cd poco-1.12.5p2-all/ || exit 1
    ./configure --static --no-tests --no-samples --no-sharedlibs --cflags="-fPIC" \
        --omit=Zip,Data,Data/SQLite,Data/ODBC,Data/MySQL,MongoDB,PDF,CppParser,PageCompiler,Redis,Encodings,ActiveRecord \
        --prefix="$BUILDDIR/poco"
    make -j "$(nproc)"
    make install
    cd ..
fi

##### core (LOKit) #####

# Мы используем pre-built assets (как в официальном Dockerfile)
mkdir -p core
(
    cd core || exit 1
    wget -O core-assets.tar.xz "$CORE_ASSETS"
    tar -xJf core-assets.tar.xz
    rm core-assets.tar.xz
) || exit 1

# Копируем собранный lokit
mkdir -p "$INSTDIR/opt/"
cp -a core/instdir "$INSTDIR/opt/lokit"

##### coolwsd & cool (online часть) #####

# Используем текущий код (из вашей ветки vaulterix/co-24.04)

# build
( ./autogen.sh ) || exit 1

( ./configure --prefix=/usr --sysconfdir=/etc --localstatedir=/var \
    --enable-silent-rules --disable-tests \
    --with-lokit-path="$BUILDDIR/core/include" \
    --with-lo-path=/opt/lokit \
    --with-poco-includes="$BUILDDIR/poco/include" \
    --with-poco-libs="$BUILDDIR/poco/lib" \
    $ONLINE_EXTRA_BUILD_OPTIONS ) || exit 1

make -j "$(nproc)" || exit 1

# install
DESTDIR="$INSTDIR" make install || exit 1

# Build online branding if available
if [ -d online-branding ]; then
    if ! command -v sass >/dev/null; then
        npm install -g sass
    fi
    cd online-branding || exit 1
    ./brand.sh "$INSTDIR/opt/lokit" "$INSTDIR/usr/share/coolwsd/browser/dist" CODE
    ./brand.sh "$INSTDIR/opt/lokit" "$INSTDIR/usr/share/coolwsd/browser/dist" NC-theme-community
    cd ..
fi

echo "Build completed successfully."
echo "Installed files are in: $INSTDIR"
