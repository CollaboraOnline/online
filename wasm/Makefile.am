
EXEEXT = .js

AM_CXXFLAGS = \
	-pthread -s USE_PTHREADS=1 \
	-fwasm-exceptions

AM_CPPFLAGS = \
	-I$(top_srcdir) \
	-I$(top_srcdir)/common \
	-I$(top_srcdir)/kit \
	-I$(top_srcdir)/net \
	-I$(top_srcdir)/wsd \
	-I@LOBUILDDIR@/workdir/UnpackedTarball/libpng \
	-I@LOBUILDDIR@/workdir/UnpackedTarball/zlib \
	-DMOBILEAPP=1

bin_PROGRAMS = online

online_SOURCES = \
	wasmapp.cpp \
	../common/Authorization.cpp \
	../common/ConfigUtil.cpp \
	../common/Crypto-stub.cpp \
	../common/FileUtil.cpp \
	../common/FileUtil-unix.cpp \
	../common/CommandControl.cpp \
	../common/Log.cpp \
	../common/TraceEvent.cpp \
	../common/Protocol.cpp \
	../common/RegexUtil.cpp \
	../common/StringVector.cpp \
	../common/Session.cpp \
	../common/SigUtil-mobile.cpp \
	../common/Simd.cpp \
	../common/SpookyV2.cpp \
	../common/Unit.cpp \
	../common/Uri.cpp \
	../common/Util.cpp \
	../common/Util-mobile.cpp \
	../common/Util-unix.cpp \
	../kit/ChildSession.cpp \
	../kit/Kit.cpp \
	../kit/KitQueue.cpp \
	../kit/LogUI.cpp \
	../kit/KitWebSocket.cpp \
	../kit/DeltaSimd.c \
	../net/FakeSocket.cpp \
	../net/Socket.cpp \
	../wsd/ClientSession.cpp \
	../wsd/DocumentBroker.cpp \
	../wsd/COOLWSD.cpp \
	../wsd/ClientRequestDispatcher.cpp \
	../wsd/RequestDetails.cpp \
	../wsd/RequestVettingStation.cpp \
	../wsd/Storage.cpp \
	../wsd/TileCache.cpp \
	../wsd/coolwsd-fork.cpp

online_DEPENDENCIES = \
	exports \
	@LOBUILDDIR@/instdir/program/soffice.js.linkdeps \
	soffice.data \
	soffice.data.js.metadata

# note cannot add content of .linkdeps to DEPENDENCIES because it contains -lFoo
online_LDADD = \
	${POCOLIB}/libPocoEncodings@POCODEBUG@.a \
	${POCOLIB}/libPocoNet@POCODEBUG@.a \
	${POCOLIB}/libPocoUtil@POCODEBUG@.a \
	${POCOLIB}/libPocoXML@POCODEBUG@.a \
	${POCOLIB}/libPocoJSON@POCODEBUG@.a \
	${POCOLIB}/libPocoFoundation@POCODEBUG@.a \
	${ZSTDLIB}/libzstd.a \
	-L@LOBUILDDIR@/instdir/program \
	$(shell cat @LOBUILDDIR@/instdir/program/soffice.js.linkdeps) \
	@LOBUILDDIR@/workdir/LinkTarget/StaticLibrary/libunoembind.a

# TODO these are just copypasta from core
online_LDFLAGS = \
	-pthread -s MODULARIZE -s EXPORT_NAME=createOnlineModule -s USE_PTHREADS=1 -s TOTAL_MEMORY=1GB -s PTHREAD_POOL_SIZE=15 --bind -s FORCE_FILESYSTEM=1 -s WASM_BIGINT=1 -s ERROR_ON_UNDEFINED_SYMBOLS=1 -s FETCH=1 -s ASSERTIONS=1 -s EXIT_RUNTIME=0 -s EXPORTED_RUNTIME_METHODS=["UTF16ToString","stringToUTF16","UTF8ToString","stringToNewUTF8","ccall","cwrap","FS","registerType"] -pthread -s USE_PTHREADS=1 -fwasm-exceptions -s EXPORTED_FUNCTIONS=@exports \
	--pre-js @LOBUILDDIR@/workdir/CustomTarget/static/emscripten_fs_image/soffice.data.js.link

if ENABLE_DEBUG
online_LDFLAGS += \
	-gseparate-dwarf
endif

if ENABLE_WASM_ADDITIONAL_FILES
online_LDFLAGS += \
	--preload-file $(WASM_ADDITIONAL_FILES)@
endif

exports: @LOBUILDDIR@/workdir/CustomTarget/desktop/soffice_bin-emscripten-exports/exports
	cp $< $@
	printf '_handle_cool_message\n' >>$@

soffice.dat%: @LOBUILDDIR@/instdir/program/soffice.dat%
	cp $< $@
