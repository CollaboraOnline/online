#!/bin/bash

if [ $# -eq 0 ]; then
    echo "build-zstd-android.sh <abs-path-to-ndk-toplevel> <abs-path-to-build-top-dir>"
    exit;
fi

NDK_PATH=$1 # eg. /opt/libreoffice/android-ndk-r20b
BUILD_PATH=$2 # eg. /opt/libreoffice/

PLATFORMS="armeabi-v7a arm64-v8a x86 x86_64"

mkdir -p $BUILD_PATH
cd $BUILD_PATH
if ! test -f android-zstd/.git/config; then
    git clone https://android.googlesource.com/platform/external/zstd/ android-zstd
fi
cd android-zstd

TOP_PATH=$BUILD_PATH/android-zstd
mkdir -p $TOP_PATH/install
for p in $PLATFORMS; do
    echo "Building $p:"
    mkdir -p $TOP_PATH/install/$p
    cd $TOP_PATH/install/$p
    cmake \
        -DCMAKE_TOOLCHAIN_FILE=${NDK_PATH}/build/cmake/android.toolchain.cmake \
        -DANDROID_ABI=$p \
        -DCMAKE_ANDROID_ARCH_ABI=$p \
        -DANDROID_NDK=${NDK_PATH} \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_SYSTEM_NAME=Android \
        -DCMAKE_SYSTEM_VERSION=21 \
        -DZSTD_BUILD_PROGRAMS:BOOL=OFF \
        -DZSTD_BUILD_SHARED:BOOL=OFF \
        $TOP_PATH/build/cmake || exit 1;
    make
done
