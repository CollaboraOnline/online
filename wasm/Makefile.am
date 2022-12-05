
noinst_LIBRARIES = libonline.a

libonline_a_SOURCES = \
	$(top_srcdir)/common/Authorization.cpp \
	$(top_srcdir)/common/ConfigUtil.cpp \
	$(top_srcdir)/common/FileUtil.cpp \
	$(top_srcdir)/common/CommandControl.cpp \
	$(top_srcdir)/common/Log.cpp \
	$(top_srcdir)/common/MessageQueue.cpp \
	$(top_srcdir)/common/TraceEvent.cpp \
	$(top_srcdir)/common/Protocol.cpp \
	$(top_srcdir)/common/StringVector.cpp \
	$(top_srcdir)/common/Session.cpp \
	$(top_srcdir)/common/SigUtil.cpp \
	$(top_srcdir)/common/SpookyV2.cpp \
	$(top_srcdir)/common/Unit.cpp \
	$(top_srcdir)/common/Util.cpp \
	$(top_srcdir)/common/CommandControl.cpp \
	$(top_srcdir)/kit/ChildSession.cpp \
	$(top_srcdir)/kit/Kit.cpp \
	$(top_srcdir)/net/FakeSocket.cpp \
	$(top_srcdir)/net/Socket.cpp \
	$(top_srcdir)/wsd/ClientSession.cpp \
	$(top_srcdir)/wsd/DocumentBroker.cpp \
	$(top_srcdir)/wsd/COOLWSD.cpp \
	$(top_srcdir)/wsd/RequestDetails.cpp \
	$(top_srcdir)/wsd/Storage.cpp \
	$(top_srcdir)/wsd/TileCache.cpp

AM_CXXFLAGS = \
	-pthread -s USE_PTHREADS=1 \
	-s DISABLE_EXCEPTION_CATCHING=0

AM_CPPFLAGS = \
	-I$(top_srcdir) \
	-I$(top_srcdir)/common \
	-I$(top_srcdir)/kit \
	-I$(top_srcdir)/net \
	-I$(top_srcdir)/wsd \
	-I@LOBUILDDIR@/workdir/UnpackedTarball/libpng \
	-I@LOBUILDDIR@/workdir/UnpackedTarball/zlib \
	-DCOOLWSD_CONFIGDIR='"@COOLWSD_CONFIGDIR@"' \
	-DMOBILEAPP=1

bin_PROGRAMS = online

online_SOURCES = $(top_srcdir)/wasm/wasmapp.cpp

online_DEPENDENCIES = \
	libonline.a

# note cannot add .linkdeps to DEPENDENCIES because it contains -lFoo
online_LDADD = \
	libonline.a \
	${POCOLIB}/libPocoEncodings@POCODEBUG@.a \
	${POCOLIB}/libPocoNet@POCODEBUG@.a \
	${POCOLIB}/libPocoUtil@POCODEBUG@.a \
	${POCOLIB}/libPocoXML@POCODEBUG@.a \
	${POCOLIB}/libPocoJSON@POCODEBUG@.a \
	${POCOLIB}/libPocoFoundation@POCODEBUG@.a \
	${ZSTDLIB}/libzstd.a \
	-L@LOBUILDDIR@/instdir/program \
	$(shell cat @LOBUILDDIR@/instdir/program/soffice.html.linkdeps)

# TODO these are just copypasta from core
# TODO still missing --pre-js flags, which are needed?
online_LDFLAGS = \
	-pthread -s USE_PTHREADS=1 -s TOTAL_MEMORY=1GB -s PTHREAD_POOL_SIZE=4 --bind -s FORCE_FILESYSTEM=1 -s WASM_BIGINT=1 -s ERROR_ON_UNDEFINED_SYMBOLS=1 -s FETCH=1 -s ASSERTIONS=1 -s EXIT_RUNTIME=0 -s EXPORTED_RUNTIME_METHODS=["UTF16ToString","stringToUTF16","UTF8ToString","allocateUTF8","printErr","ccall","cwrap","FS"] -pthread -s USE_PTHREADS=1 -s DISABLE_EXCEPTION_CATCHING=0 -s EXPORTED_FUNCTIONS=["_main","_libreofficekit_hook","_libreofficekit_hook_2","_lok_preinit","_lok_preinit_2"] \
	--pre-js @LOBUILDDIR@/workdir/CustomTarget/static/emscripten_fs_image/soffice.data.js.link


