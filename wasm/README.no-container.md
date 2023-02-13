<!---
NOTE: This file describes how to build Collabora Online as WASM
without using the Allotropia container.
-->

# Collabora Online as WASM (COWASM)

Before building Collabora Online as WASM you need to build three
dependencies: LibreOffice core, Poco, and zstd.

The toolchain used is Emscripten. Versions 2.0.31 and 3.1.30 are known
to work. The examples below assume 3.1.30.

Below we assume that the Emscripten environment is already set up,
that you have sourced the emsdk_env.sh file in your shell.

## Build LibreOffice core

Use the master branch of LibreOffice core. The feature/wasm branch is
not needed any longer, all commits to that branch are currently also
present in the master branch.

See the static/README.wasm.md file in LibreOffice core, especially the
section "Building headless LibreOffice as WASM for use in another
product".

## Build other Online dependencies

### zstd

Build libzstd  with assembly code disable, and using the Makefile (didn't try its other build systems):

    tar -xzvf ~/Downloads/zstd-1.5.2.tar.gz
    cd zstd-1.5.2/
    emmake make CC='emcc -pthread -fexceptions -s DISABLE_EXCEPTION_CATCHING=0' CXX='em++ -pthread -fexceptions -s DISABLE_EXCEPTION_CATCHING=0' lib-mt V=1 ZSTD_NO_ASM=1 PREFIX=/opt/zstd.emsc.3.1.30
    (cd lib && emmake make install-static install-includes ZSTD_NO_ASM=1 PREFIX=/opt/zstd.emsc.3.1.30)

This will install the zstd headers and libraries in `/opt/zstd.emsc.3.1.30`.

### Poco

Poco requires two patches plus renaming one source file (which
actually is from expat but Poco includes). Note that the header
Poco/Platform.h maps EMSCRIPTEN to POCO_OS_LINUX. It has both
Makefiles and CMake but I couldn't get CMake to work. Online requires
a single include directory so "make install" must be used.

Here we assume that the online repo is cloned at `$HOME/lo/online`,
adapt as necessary.

    tar -xjvf ~/Downloads/poco-1.12.4-release.tar.gz
    cd poco-poco-1.12.4-release
    patch -p1 < $HOME/lo/online/wasm/poco-1.12.4-emscripten.patch
    mv XML/src/xmlparse.cpp XML/src/xmlparse.c
    patch -p0 < $HOME/lo/online/wasm/poco-no-special-expat-sauce.diff
    emconfigure ./configure --static --no-samples --no-tests --omit=Crypto,NetSSL_OpenSSL,JWT,Data,Data/SQLite,Data/ODBC,Data/MySQL,Data/PostgreSQL,Zip,PageCompiler,PageCompiler/File2Page,MongoDB,Redis,ActiveRecord,ActiveRecord/Compiler,Prometheus
	emmake make CC=emcc CXX=em++  CXXFLAGS="-DPOCO_NO_LINUX_IF_PACKET_H -DPOCO_NO_INOTIFY -pthread -s USE_PTHREADS=1 -fexceptions -s DISABLE_EXCEPTION_CATCHING=0"
    make install INSTALLDIR=/opt/poco.emsc.3.1.30

This will install into `/opt/poco.emsc.3.1.30`.

## Build Online itself

    ./autogen.sh
	./configure --disable-werror --with-lokit-path=/home/tml/lo/core-cool-wasm/include --with-lo-path=/home/tml/lo/core-cool-wasm/instdir --with-lo-builddir=/home/tml/lo/core-cool-wasm --with-zstd-includes=/opt/zstd.emsc.3.1.30/include --with-zstd-libs=/opt/zstd.emsc.3.1.30/lib --with-poco-includes=/opt/poco.emsc.3.1.30/include --with-poco-libs=/opt/poco.emsc.3.1.30/lib --host=wasm32-local-emscripten --with-wasm-additional-files=/home/tml/lo/online-hacking/my-sample-docs
    make
