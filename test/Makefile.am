# Cap threadpools to 4 threads.
export MAX_CONCURRENCY=4
AUTOMAKE_OPTION = serial-tests

# unittest: tests that do not need loolwsd running, and that are run during a
# normal build
# test: tests that need loolwsd running, and that are run via 'make check'
check_PROGRAMS = test fakesockettest

noinst_PROGRAMS = test fakesockettest unittest

AM_CXXFLAGS = -fPIC -DPIC $(CPPUNIT_CFLAGS) -DTDOC=\"$(top_srcdir)/test/data\" \
	-I${top_srcdir}/common -I${top_srcdir}/net -I${top_srcdir}/wsd -I${top_srcdir}/kit

noinst_PROGRAMS += \
	unit-convert.so unit-typing.so \
	unit-timeout.so unit-prefork.so \
	unit-storage.so unit-client.so \
	unit-admin.so unit-tilecache.so \
	unit-fuzz.so unit-oob.so unit-http.so unit-oauth.so \
	unit-wopi.so unit-wopi-saveas.so \
	unit-wopi-ownertermination.so unit-wopi-versionrestore.so \
	unit-wopi-documentconflict.so unit_wopi_renamefile.so \
	unit-wopi-loadencoded.so


AM_LDFLAGS = -pthread $(ZLIB_LIBS)

if ENABLE_SSL
AM_LDFLAGS += -lssl -lcrypto
endif

# We work around some of the mess of using the same sources both on
# the server side and here in unit tests with conditional compilation
# based on BUILDING_TESTS

AM_CPPFLAGS = -pthread -I$(top_srcdir) -DBUILDING_TESTS

wsd_sources = \
            ../common/FileUtil.cpp \
            ../common/SigUtil.cpp \
            ../common/IoUtil.cpp \
            ../common/Log.cpp \
            ../common/Protocol.cpp \
            ../common/Session.cpp \
            ../common/SpookyV2.cpp \
            ../common/Util.cpp \
            ../common/MessageQueue.cpp \
            ../common/Authorization.cpp \
            ../kit/Kit.cpp \
            ../kit/TestStubs.cpp \
            ../wsd/Auth.cpp \
            ../wsd/TileCache.cpp \
            ../wsd/TestStubs.cpp \
            ../common/Unit.cpp \
            ../net/Socket.cpp

if ENABLE_SSL
wsd_sources += ../net/Ssl.cpp
endif

WsdSources.cpp :
	for F in $(wsd_sources); do \
		echo '#include "'$$F'"'; \
	done >WsdSources.cpp

test_base_source = \
	TileQueueTests.cpp \
	WhiteBoxTests.cpp \
	DeltaTests.cpp \
	WsdSources.cpp

test_all_source = \
	$(test_base_source) \
	TileCacheTests.cpp \
	integration-http-server.cpp \
	httpwstest.cpp \
	httpcrashtest.cpp \
	httpwserror.cpp

unittest_CPPFLAGS = -I$(top_srcdir) -DBUILDING_TESTS
unittest_SOURCES = $(test_base_source) test.cpp
unittest_LDADD = $(CPPUNIT_LIBS)

test_CPPFLAGS = -I$(top_srcdir) -DBUILDING_TESTS
test_SOURCES = $(test_all_source) test.cpp
test_LDADD = $(CPPUNIT_LIBS)

fakesockettest_SOURCES = fakesockettest.cpp ../net/FakeSocket.cpp
fakesockettest_LDADD = $(CPPUNIT_LIBS)

# unit test modules:
unit_oob_so_SOURCES = UnitOOB.cpp
unit_oob_so_LDFLAGS = -shared
unit_http_so_SOURCES = UnitHTTP.cpp
unit_http_so_LDFLAGS = -shared
unit_fuzz_so_SOURCES = UnitFuzz.cpp
unit_fuzz_so_LDFLAGS = -shared
unit_admin_so_SOURCES = UnitAdmin.cpp
unit_admin_so_LDFLAGS = -shared
unit_admin_so_LDADD = $(CPPUNIT_LIBS)
unit_client_so_SOURCES = UnitClient.cpp ${test_all_source}
unit_client_so_LDFLAGS = -shared
unit_client_so_LDADD = $(CPPUNIT_LIBS)
unit_typing_so_SOURCES = UnitTyping.cpp
unit_typing_so_LDFLAGS = -shared
unit_typing_so_LDADD = $(CPPUNIT_LIBS)
unit_convert_so_SOURCES = UnitConvert.cpp
unit_convert_so_LDFLAGS = -shared
unit_timeout_so_SOURCES = UnitTimeout.cpp
unit_timeout_so_LDFLAGS = -shared
unit_prefork_so_SOURCES = UnitPrefork.cpp
unit_prefork_so_LDFLAGS = -shared
unit_storage_so_SOURCES = UnitStorage.cpp
unit_storage_so_LDFLAGS = -shared
unit_tilecache_so_SOURCES = UnitTileCache.cpp
unit_tilecache_so_LDFLAGS = -shared
unit_oauth_so_SOURCES = UnitOAuth.cpp
unit_oauth_so_LDFLAGS = -shared $(CPPUNIT_LIBS)
unit_wopi_so_SOURCES = UnitWOPI.cpp
unit_wopi_so_LDFLAGS = -shared
unit_wopi_so_LDADD = $(CPPUNIT_LIBS)
unit_wopi_saveas_so_SOURCES = UnitWOPISaveAs.cpp
unit_wopi_saveas_so_LDFLAGS = -shared
unit_wopi_saveas_so_LDADD = $(CPPUNIT_LIBS)
unit_wopi_ownertermination_so_SOURCES = UnitWopiOwnertermination.cpp
unit_wopi_ownertermination_so_LDFLAGS = -shared
unit_wopi_ownertermination_so_LDADD = $(CPPUNIT_LIBS)
unit_wopi_versionrestore_so_SOURCES = UnitWOPIVersionRestore.cpp
unit_wopi_versionrestore_so_LDFLAGS = -shared
unit_wopi_versionrestore_so_LDADD = $(CPPUNIT_LIBS)
unit_wopi_documentconflict_so_SOURCES = UnitWOPIDocumentConflict.cpp
unit_wopi_documentconflict_so_LDFLAGS = -shared
unit_wopi_documentconflict_so_LDADD = $(CPPUNIT_LIBS)
unit_wopi_renamefile_so_SOURCES = UnitWOPIRenameFile.cpp
unit_wopi_renamefile_so_LDFLAGS = -shared
unit_wopi_renamefile_so_LDADD = $(CPPUNIT_LIBS)
unit_wopi_loadencoded_so_SOURCES = UnitWOPILoadEncoded.cpp
unit_wopi_loadencoded_so_LDFLAGS = -shared
unit_wopi_loadencoded_so_LDADD = $(CPPUNIT_LIBS)

if HAVE_LO_PATH
SYSTEM_STAMP = @SYSTEMPLATE_PATH@/system_stamp
else
SYSTEM_STAMP =
endif

if HAVE_LO_PATH
check-local:
	./fakesockettest
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	./run_unit.sh --log-file test.log --trs-file test.trs
# FIXME 2: unit-oob.la fails with symbol undefined:
# UnitWSD::testHandleRequest(UnitWSD::TestRequest, UnitHTTPServerRequest&, UnitHTTPServerResponse&) ,

TESTS = unit-typing.so unit-convert.so unit-prefork.so unit-tilecache.so \
	unit-timeout.so unit-oauth.so unit-wopi.so unit-wopi-saveas.so \
        unit-wopi-ownertermination.so unit-wopi-versionrestore.so \
        unit-wopi-documentconflict.so unit_wopi_renamefile.so \
	unit-http.so \
	unit-wopi-loadencoded.so
# TESTS = unit-client.so
# TESTS += unit-admin.so
# TESTS += unit-storage.so
else
TESTS = ${top_builddir}/test/test
endif

TEST_EXTENSIONS = .so
SO_LOG_DRIVER = ${top_srcdir}/test/run_unit.sh

EXTRA_DIST = data/delta-text.png data/delta-text2.png data/hello.odt data/hello.txt $(test_SOURCES) $(unittest_SOURCES) run_unit.sh

check_valgrind: all
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	./run_unit.sh --log-file test.log --trs-file test.trs --valgrind

# run unittest during the normal build
all-local: unittest
	@echo
	@echo "Running build-time unit tests.  For more thorough testing, please run 'make check'."
	@echo
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@${top_builddir}/test/unittest
