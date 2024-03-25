if ENABLE_PERFTEST

noinst_PROGRAMS = messagecountperftest

include_paths = -I${top_srcdir}/common -I${top_srcdir}/net -I${top_srcdir}/wsd -I${top_srcdir}/kit -Ipoiu ${ZLIB_CFLAGS} -Izxcv ${ZSTD_CFLAGS} -Iqwer ${PNG_CFLAGS} -Iasdf

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

messagecountperftest_SOURCES = $(shared_sources) \
							   MessageCountPerfTest.cpp
messagecountperftest_CPPFLAGS = ${include_paths} #-DTDOC=\"$(abs_top_srcdir)/test/data\" 


V = $(if $(verbose),,@)

perftest:
	$(call run-messagecountperftest)

define run-messagecountperftest
$(V)echo "Running MessageCountPerfTest"
./messagecountperftest
endef


endif
