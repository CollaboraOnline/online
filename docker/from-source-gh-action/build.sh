#! /bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# -- Available env vars --
# * ENGINE_ASSETS  - URL of prebuilt engine assets tarball (skips building engine)
# * COLLABORA_ONLINE_REPO - which git repo to clone the online monorepo from
# * COLLABORA_ONLINE_BRANCH - which branch to build
# * ENGINE_BUILD_TARGET - which make target to run for the engine (when building from source)
# * ONLINE_EXTRA_BUILD_OPTIONS - extra build options for online

if [ -z "$COLLABORA_ONLINE_REPO" ]; then
  COLLABORA_ONLINE_REPO="https://gerrit.collaboraoffice.com/online"
fi;
if [ -z "$COLLABORA_ONLINE_BRANCH" ]; then
  COLLABORA_ONLINE_BRANCH="main"
fi;
echo "Building branch '$COLLABORA_ONLINE_BRANCH' from '$COLLABORA_ONLINE_REPO'"

if [ -z "$ENGINE_ASSETS" ]; then
  echo "Building engine from source"
else
  echo "Using prebuilt engine assets from $ENGINE_ASSETS"
fi;

if [ -z "$ENGINE_BUILD_TARGET" ]; then
  ENGINE_BUILD_TARGET=""
fi;
echo "Engine build target: '$ENGINE_BUILD_TARGET'"

SRCDIR=$(realpath `dirname $0`)
INSTDIR="$SRCDIR/instdir"
BUILDDIR="$SRCDIR/builddir"

mkdir -p "$BUILDDIR"
cd "$BUILDDIR"

rm -rf "$INSTDIR" || true
mkdir -p "$INSTDIR"

##### cloning & updating #####

# Clone the online monorepo (engine/ contains the rendering engine)
if test ! -d online ; then
  git clone --depth=1 --branch $COLLABORA_ONLINE_BRANCH "$COLLABORA_ONLINE_REPO" online || exit 1
fi

( cd online && git fetch --all && git checkout -f $COLLABORA_ONLINE_BRANCH && git clean -f -d && git pull -r ) || exit 1

##### engine #####

engine_dir="$BUILDDIR/online/engine"

# The engine assets tarball has to be a complete engine build tree.  Online's own
# C++ is built by the engine's gbuild, which resolves the POCO archives and
# headers, plus the externals online links against, out of the engine's workdir.
# Those externals are expat, libpng, openssl and zstd; zlib comes from the
# system.  This list mirrors the one the publishing job packs, so keep the two in
# step, and keep both in step with what online links.
engine_assets_paths=(
    instdir
    workdir/Misc/DUMMY
    workdir/Executable/concat-deps.run
    workdir/Headers/Executable/concat-deps
    workdir/Headers/StaticLibrary/libPocoFoundation.a
    workdir/LinkTarget/Executable/concat-deps
    workdir/LinkTarget/StaticLibrary/libPocoFoundation.a
    workdir/LinkTarget/StaticLibrary/libPocoZip.a
    workdir/LinkTarget/StaticLibrary/libexpat.a
    workdir/LinkTarget/StaticLibrary/liblibpng.a
    workdir/LinkTarget/StaticLibrary/libzstd.a
    workdir/Package/openssl.filelist
    workdir/Package/prepared/openssl
    workdir/ExternalProject/openssl.done
    workdir/UnpackedTarball/poco/include/Poco/Net/WebSocket.h
    workdir/UnpackedTarball/poco.update
    workdir/UnpackedTarball/expat/lib
    workdir/UnpackedTarball/expat.update
    workdir/UnpackedTarball/libpng
    workdir/UnpackedTarball/libpng.update
    workdir/UnpackedTarball/zstd/lib
    workdir/UnpackedTarball/zstd.update
    workdir/UnpackedTarball/openssl/include
    workdir/UnpackedTarball/openssl/libssl.a
    workdir/UnpackedTarball/openssl/libcrypto.a
    workdir/UnpackedTarball/openssl.update
)

check_engine_assets() {
    local missing=()
    local path
    for path in "${engine_assets_paths[@]}" ; do
        if test ! -e "$engine_dir/$path" ; then
            missing+=("$path")
        fi
    done
    if test "${#missing[@]}" -gt 0 ; then
        echo "The engine assets tarball is not a complete engine build tree."
        echo "Online's C++ is built by the engine's gbuild, which needs one."
        echo "These paths are missing from $ENGINE_ASSETS:"
        for path in "${missing[@]}" ; do
            echo "    $path"
        done
        echo "README.md next to this script lists everything the tarball has to"
        echo "carry.  The job that publishes it has to be extended to match."
        return 1
    fi
}

if [ -z "$ENGINE_ASSETS" ]; then
  # build engine from source
  ( cd "$engine_dir" && ./autogen.sh --with-distro=CPLinux-LOKit --disable-epm --without-package-format --disable-symbols ) || exit 1
  ( cd "$engine_dir" && make $ENGINE_BUILD_TARGET ) || exit 1
else
  # drop in prebuilt engine assets
  ( cd "$engine_dir" && wget "$ENGINE_ASSETS" -O engine-assets.tar.gz && tar -xzf engine-assets.tar.gz && rm engine-assets.tar.gz ) || exit 1
  check_engine_assets || exit 1
  # The assets come from another machine, so configure the tree here.  gbuild
  # compiles online's C++ with the compiler, the linker and the paths that
  # config_host.mk names, and those have to be this container's.  The switches
  # match the ones the assets were built with, so the choices between system and
  # bundled libraries agree with the archives that arrived in the tarball.
  # The libraries all arrive built, so external fetching is off and the engine's
  # fetch target has nothing left to do.
  ( cd "$engine_dir" && ./autogen.sh --with-distro=CPLinux-LOKit --with-lang=en-US --without-package-format --disable-symbols --disable-fetch-external ) || exit 1
fi

mkdir -p "$INSTDIR"/opt/
cp -a "$engine_dir"/instdir "$INSTDIR"/opt/collaboraoffice

##### coolwsd & cool #####

# build
( cd online && ./autogen.sh ) || exit 1
( cd online && ./configure --prefix=/usr --sysconfdir=/etc --localstatedir=/var --enable-silent-rules --disable-tests --with-lokit-path="$engine_dir"/include --with-lo-path=/opt/collaboraoffice --with-lo-builddir="$engine_dir" $ONLINE_EXTRA_BUILD_OPTIONS) || exit 1
( cd online && make -j $(nproc)) || exit 1

# copy stuff
( cd online && DESTDIR="$INSTDIR" make install ) || exit 1

# Build online branding if available
if test -d online-branding ; then
  if ! which sass &> /dev/null; then npm install -g sass; fi
  cd online-branding
  ./brand.sh $INSTDIR/opt/collaboraoffice $INSTDIR/usr/share/coolwsd/browser/dist CODE # CODE
  ./brand.sh $INSTDIR/opt/collaboraoffice $INSTDIR/usr/share/coolwsd/browser/dist NC-theme-community # Nextcloud Office
  cd ..
fi
