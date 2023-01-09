
noinst_LIBRARIES = libonline.a

libonline_a_SOURCES = \
	../common/Authorization.cpp \
	../common/ConfigUtil.cpp \
	../common/FileUtil.cpp \
	../common/CommandControl.cpp \
	../common/Log.cpp \
	../common/MessageQueue.cpp \
	../common/TraceEvent.cpp \
	../common/Protocol.cpp \
	../common/StringVector.cpp \
	../common/Session.cpp \
	../common/SigUtil.cpp \
	../common/SpookyV2.cpp \
	../common/Unit.cpp \
	../common/Util.cpp \
	../common/CommandControl.cpp \
	../kit/ChildSession.cpp \
	../kit/Kit.cpp \
	../net/FakeSocket.cpp \
	../net/Socket.cpp \
	../wsd/ClientSession.cpp \
	../wsd/DocumentBroker.cpp \
	../wsd/COOLWSD.cpp \
	../wsd/RequestDetails.cpp \
	../wsd/Storage.cpp \
	../wsd/TileCache.cpp \
	wasmapp.cpp

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

