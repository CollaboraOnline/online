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
# C++ is built by the engine's gbuild, which resolves the libraries online links
# against out of the engine's workdir.  Those are expat, libpng, openssl and
# zstd, all of them C; zlib comes from the system, and POCO is built below.  This
# list mirrors the one the publishing job packs, so keep the two in step, and
# keep both in step with what online links.
engine_assets_paths=(
    instdir
    workdir/Misc/DUMMY
    workdir/Executable/concat-deps.run
    workdir/Headers/Executable/concat-deps
    workdir/Headers/StaticLibrary/libexpat.a
    workdir/LinkTarget/Executable/concat-deps
    workdir/LinkTarget/StaticLibrary/libexpat.a
    workdir/LinkTarget/StaticLibrary/liblibpng.a
    workdir/LinkTarget/StaticLibrary/libzstd.a
    workdir/Package/openssl.filelist
    workdir/Package/prepared/openssl
    workdir/ExternalProject/openssl.done
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

detect_engine_cxx_abi() {
    # The engine's COKit interface passes std::string and std::vector across the
    # boundary into the engine's own libraries, so online has to be compiled with
    # the same libstdc++ string ABI as the engine it is going to call.  A prebuilt
    # engine comes from another machine, whose compiler default need not be this
    # container's, so read the ABI off the engine and follow it.  Ubuntu's
    # libstdc++ carries both, and online links no other C++ library, so either
    # answer builds.
    local abi=0
    if nm -D --defined-only "$engine_dir"/instdir/program/libmergedlo.so 2>/dev/null \
       | grep -q __cxx11 ; then
        abi=1
    fi
    echo "Engine libstdc++ string ABI: _GLIBCXX_USE_CXX11_ABI=$abi"
    engine_abi_flag="-D_GLIBCXX_USE_CXX11_ABI=$abi"
}

build_engine_poco() {
    local tarball version sha256
    cd "$engine_dir" || return 1
    # POCO is the one C++ library online links out of the engine workdir, so it
    # has to come from the compiler that links it.  The assets are built on
    # another machine, whose libstdc++ string ABI need not be this container's,
    # and archives from the older ABI do not link here at all.  So discard the
    # POCO the tarball brought, unpack markers included, and build it from the
    # engine's own sources.  With the markers left in place gbuild would take
    # the tree for already unpacked and never lay down the sources.
    rm -rf workdir/UnpackedTarball/poco workdir/UnpackedTarball/poco.* \
           workdir/LinkTarget/StaticLibrary/libPoco*.a* \
           workdir/Headers/StaticLibrary/libPoco*.a
    tarball=$(sed -n 's/^POCO_TARBALL := //p' download.lst)
    sha256=$(sed -n 's/^POCO_SHA256SUM := //p' download.lst)
    version=${tarball#poco-}
    version=${version%%-all.*}
    test -n "$tarball" -a -n "$sha256" -a -n "$version" || return 1
    mkdir -p external/tarballs || return 1
    # POCO is not on the LibreOffice tarball mirror, it has its own bucket.
    wget -nc -P external/tarballs \
         "https://pocoproject.org/releases/poco-$version/$tarball" || return 1
    echo "$sha256  external/tarballs/$tarball" | sha256sum -c - || return 1
    make -j "$(nproc)" -C external/poco BUILDDIR="$engine_dir" ENVCFLAGSCXX="$engine_abi_flag"
}

if [ -z "$ENGINE_ASSETS" ]; then
  # build engine from source
  ( cd "$engine_dir" && ./autogen.sh --with-distro=CPLinux-LOKit --disable-epm --without-package-format --disable-symbols ) || exit 1
  ( cd "$engine_dir" && make $ENGINE_BUILD_TARGET ) || exit 1
  detect_engine_cxx_abi
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
  detect_engine_cxx_abi
  ( build_engine_poco ) || exit 1
fi

mkdir -p "$INSTDIR"/opt/
cp -a "$engine_dir"/instdir "$INSTDIR"/opt/collaboraoffice

##### coolwsd & cool #####

# build
( cd online && ./autogen.sh ) || exit 1
( cd online && ./configure --prefix=/usr --sysconfdir=/etc --localstatedir=/var --enable-silent-rules --disable-tests --with-lokit-path="$engine_dir"/include --with-lo-path=/opt/collaboraoffice --with-lo-builddir="$engine_dir" CPPFLAGS="$engine_abi_flag" $ONLINE_EXTRA_BUILD_OPTIONS) || exit 1
( cd online && make -j $(nproc) ENVCFLAGSCXX="$engine_abi_flag" ) || exit 1

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
