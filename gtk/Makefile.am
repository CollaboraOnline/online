bin_PROGRAMS = mobile

include_paths = -I${top_srcdir}/common -I${top_srcdir}/net -I${top_srcdir}/kit -I${top_srcdir}/wsd -I${top_srcdir} ${ZSTD_CFLAGS}

warning_flags = -Wall -Werror -Wno-parentheses -Wno-sign-compare -Wno-unused-variable
define_flags = -DMOBILEAPP=1

AM_CPPFLAGS = -pthread \
              -DCOOLWSD_DATADIR='"@COOLWSD_DATADIR@"' \
              -DCOOLWSD_CONFIGDIR='"@COOLWSD_CONFIGDIR@"' \
              -DCOOLWSD_LOGLEVEL='"@COOLWSD_LOGLEVEL@"' \
              -DDEBUG_ABSSRCDIR='"'$(realpath ${top_srcdir})'"' \
              -DNUM_PRESPAWN_CHILDREN='"@NUM_PRESPAWN_CHILDREN@"' \
              -DTOPSRCDIR='"'$(realpath ${top_srcdir})'"' \
              -DGTKAPP \
              ${define_flags} \
              ${warning_flags} \
              ${include_paths} \
              ${WEBKIT_CFLAGS}

AM_LDFLAGS = -pthread ${WEBKIT_LIBS} -ldl $(ZSTD_LIBS) ${PNG_LIBS}

# Android's CMakefile list re-worked:

cmake_list= \
            ../common/Authorization.cpp \
            ../common/ConfigUtil.cpp \
            ../common/CommandControl.cpp \
            ../common/Crypto-stub.cpp \
            ../common/FileUtil.cpp \
            ../common/Log.cpp \
            ../common/TraceEvent.cpp \
            ../common/Protocol.cpp \
            ../common/Simd.cpp \
            ../common/StringVector.cpp \
            ../common/Session.cpp \
            ../common/SigUtil.cpp \
            ../common/SpookyV2.cpp \
            ../common/Unit.cpp \
            ../common/Util.cpp \
            ../common/Util-mobile.cpp \
            ../kit/ChildSession.cpp \
            ../kit/DeltaSimd.c \
            ../kit/Kit.cpp \
            ../kit/KitQueue.cpp \
            ../kit/LogUI.cpp \
            ../kit/KitWebSocket.cpp \
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

mobile_SOURCES = mobile.cpp $(cmake_list)
