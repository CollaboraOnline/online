bin_PROGRAMS = mobile

include_paths = -I${top_srcdir}/common -I${top_srcdir}/net -I${top_srcdir}/kit -I${top_srcdir}/wsd -I${top_srcdir} ${ZSTD_CFLAGS}

warning_flags = -Wall -Werror -Wno-parentheses -Wno-sign-compare -Wno-unused-variable
define_flags = -DMOBILEAPP=1

AM_CPPFLAGS = -pthread \
              -DCOOLWSD_DATADIR='"@COOLWSD_DATADIR@"' \
              -DCOOLWSD_CONFIGDIR='"@COOLWSD_CONFIGDIR@"' \
	      -DDEBUG_ABSSRCDIR='"'$(realpath ${top_srcdir})'"' \
              -DTOPSRCDIR='"'$(realpath ${top_srcdir})'"' \
              -DGTKAPP \
              ${define_flags} \
              ${warning_flags} \
              ${include_paths} \
              ${WEBKIT_CFLAGS}

AM_LDFLAGS = -pthread ${WEBKIT_LIBS} -ldl $(ZSTD_LIBS) ${PNG_LIBS}

common_sources = \
                 ../common/Authorization.cpp \
                 ../common/ConfigUtil.cpp \
                 ../common/FileUtil.cpp \
                 ../common/Log.cpp \
                 ../common/MessageQueue.cpp \
                 ../common/Protocol.cpp \
                 ../common/Session.cpp \
                 ../common/SigUtil.cpp \
                 ../common/SpookyV2.cpp \
                 ../common/StringVector.cpp \
                 ../common/TraceEvent.cpp \
                 ../common/Unit.cpp \
                 ../common/Util.cpp

kit_sources = ../kit/ChildSession.cpp \
              ../kit/Kit.cpp

net_sources = ../net/FakeSocket.cpp \
              ../net/Socket.cpp

wsd_sources = ../wsd/ClientSession.cpp \
              ../wsd/DocumentBroker.cpp \
              ../wsd/COOLWSD.cpp \
              ../wsd/RequestDetails.cpp \
              ../wsd/Storage.cpp \
              ../wsd/TileCache.cpp \
              ../wsd/coolwsd-fork.cpp

mobile_SOURCES = mobile.cpp $(common_sources) $(kit_sources) $(net_sources) $(wsd_sources)
