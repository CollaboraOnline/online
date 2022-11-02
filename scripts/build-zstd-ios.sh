#!/bin/bash

if [ $# -eq 0 ]; then
    echo "build-zstd-ios.sh <abs-path-to-build-top-dir>"
    exit;
fi

BUILD_PATH=$1 # for instance $PWD/zstd-build-dir

PLATFORMS="OS64"

mkdir -p $BUILD_PATH
cd $BUILD_PATH
if ! test -f ios-cmake/.git/config; then
	git clone https://github.com/leetal/ios-cmake.git ios-cmake
fi
if ! test -f ios-zstd/.git/config; then
	git clone https://github.com/facebook/zstd.git ios-zstd
fi
cd ios-zstd

TOP_PATH=$BUILD_PATH/ios-zstd
rm -Rf $TOP_PATH/install
mkdir -p $TOP_PATH/install
for p in $PLATFORMS; do
    echo "Building $p:"
    mkdir -p $TOP_PATH/install/$p
    cd $TOP_PATH/install/$p
    rm -f CMakeCache.txt
    CFLAGS="-isysroot `xcode-select -print-path`/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk"
    CXXFLAGS="-isysroot `xcode-select -print-path`/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk"
    cmake \
	-DCMAKE_TOOLCHAIN_FILE=$BUILD_PATH/ios-cmake/ios.toolchain.cmake -DPLATFORM=$p \
	-DENABLE_BITCODE=OFF \
    -DCMAKE_C_FLAGS="$CFLAGS" \
    -DCMAKE_CXX_FLAGS="$CFLAGS" \
    -DDEPLOYMENT_TARGET=13.6 \
        -DCMAKE_BUILD_TYPE=Release \
        $TOP_PATH/build/cmake || exit 1;
#    cmake --build . --config Release
    make -j4 libzstd_static
done
