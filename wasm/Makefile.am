
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
	$(top_srcdir)/wsd/TileCache.cpp \
	$(top_srcdir)/wasm/wasmapp.cpp

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

