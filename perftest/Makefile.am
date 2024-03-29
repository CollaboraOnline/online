if ENABLE_PERFTEST

noinst_PROGRAMS = cycleperftest messageperftest timeperftest

include_paths = -I${top_srcdir}/common -I${top_srcdir}/net -I${top_srcdir}/wsd -I${top_srcdir}/kit -I${top_srcdir}/perftest
include_paths += ${ZLIB_CFLAGS} ${ZSTD_CFLAGS} ${PNG_CFLAGS}
if ENABLE_SSL
include_paths += ${OPENSSL_CFLAGS}
endif

AM_CPPFLAGS = $(include_paths)
AM_LDFLAGS = -Wl,-E -lpam $(ZLIB_LIBS) $(ZSTD_LIBS) ${PNG_LIBS} ${OPENSSL_LIBS}

#server_headers = net/Socket.hpp

shared_sources = \
				 ../common/DummyTraceEventEmitter.cpp \
				 ../common/FileUtil.cpp \
				 ../common/Authorization.cpp \
				 ../common/CommandControl.cpp \
				 ../common/ConfigUtil.cpp \
				 ../common/JailUtil.cpp \
				 ../common/Log.cpp \
				 ../common/MessageQueue.cpp \
				 ../common/MobileApp.cpp \
				 ../common/Protocol.cpp \
				 ../common/Seccomp.cpp \
				 ../common/Session.cpp \
				 ../common/SigUtil.cpp \
				 ../common/Simd.cpp \
				 ../common/SpookyV2.cpp \
				 ../common/StringVector.cpp \
				 ../common/TraceEvent.cpp \
				 ../common/Unit.cpp \
				 ../common/Util-desktop.cpp \
				 ../common/Util.cpp \
				 ../net/DelaySocket.cpp \
				 ../net/HttpHelper.cpp \
				 ../net/HttpRequest.cpp \
				 ../net/NetUtil.cpp \
				 ../net/Socket.cpp \
				 ../net/Ssl.cpp \
				 ../wsd/Exceptions.cpp

cycleperftest_SOURCES = $(shared_sources) \
							   CyclePerfTest.cpp
cycleperftest_CPPFLAGS = ${include_paths} #-DTDOC=\"$(abs_top_srcdir)/test/data\"

messageperftest_SOURCES = $(shared_sources) \
							   MessagePerfTest.cpp
messageperftest_CPPFLAGS = ${include_paths} #-DTDOC=\"$(abs_top_srcdir)/test/data\"

timeperftest_SOURCES = $(shared_sources) \
							   TimePerfTest.cpp
timeperftest_CPPFLAGS = ${include_paths} #-DTDOC=\"$(abs_top_srcdir)/test/data\"


V = $(if $(verbose),,@)

perftest:
	$(call run-messageperftest)

define run-messageperftest
$(V)echo "Running MessagePerfTest"
./messageperftest
endef


endif
