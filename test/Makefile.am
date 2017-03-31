# Cap threadpools to 4 threads.
export MAX_CONCURRENCY=4
AUTOMAKE_OPTION = serial-tests

# unittest: tests that do not need loolwsd running, and that are run during a
# normal build
# test: tests that need loolwsd running, and that are run via 'make check'
check_PROGRAMS = test

noinst_PROGRAMS = test unittest

AM_CXXFLAGS = $(CPPUNIT_CFLAGS) -DTDOC=\"$(top_srcdir)/test/data\" \
	-I${top_srcdir}/common -I${top_srcdir}/net -I${top_srcdir}/wsd -I${top_srcdir}/kit

noinst_LTLIBRARIES = \
        unit-timeout.la unit-prefork.la \
        unit-storage.la \
        unit-admin.la unit-tilecache.la \
	unit-fuzz.la unit-oob.la \
	unit-minsocketbuffersize.la

MAGIC_TO_FORCE_SHLIB_CREATION = -rpath /dummy
AM_LDFLAGS = -pthread -module $(MAGIC_TO_FORCE_SHLIB_CREATION) $(ZLIB_LIBS)

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
            ../common/Util.cpp \
            ../common/MessageQueue.cpp \
            ../kit/Kit.cpp \
            ../wsd/TileCache.cpp \
            ../wsd/TestStubs.cpp \
            ../common/Unit.cpp \
            ../net/Socket.cpp

unittest_CPPFLAGS = -I$(top_srcdir) -DBUILDING_TESTS
unittest_SOURCES = TileQueueTests.cpp WhiteBoxTests.cpp test.cpp $(wsd_sources)
unittest_LDADD = $(CPPUNIT_LIBS)

test_CPPFLAGS = -I$(top_srcdir) -DBUILDING_TESTS
test_SOURCES = TileCacheTests.cpp integration-http-server.cpp \
               httpwstest.cpp httpcrashtest.cpp httpwserror.cpp $(unittest_SOURCES)
test_LDADD = $(CPPUNIT_LIBS)

# unit test modules:
unit_oob_la_SOURCES = UnitOOB.cpp
unit_fuzz_la_SOURCES = UnitFuzz.cpp
unit_admin_la_SOURCES = UnitAdmin.cpp
unit_admin_la_LIBADD = $(CPPUNIT_LIBS)
unit_timeout_la_SOURCES = UnitTimeout.cpp
unit_prefork_la_SOURCES = UnitPrefork.cpp
unit_storage_la_SOURCES = UnitStorage.cpp
unit_tilecache_la_SOURCES = UnitTileCache.cpp
unit_minsocketbuffersize_la_SOURCES = UnitMinSocketBufferSize.cpp

if HAVE_LO_PATH
SYSTEM_STAMP = @SYSTEMPLATE_PATH@/system_stamp
else
SYSTEM_STAMP =
endif

if HAVE_LO_PATH
check-local:
	./run_unit.sh --log-file test.log --trs-file test.trs
# FIXME 2: unit-oob.la fails with symbol undefined:
# UnitWSD::testHandleRequest(UnitWSD::TestRequest, UnitHTTPServerRequest&, UnitHTTPServerResponse&) ,
TESTS = unit-prefork.la # unit-tilecache.la unit-storage.la unit-timeout.la unit-admin.la unit-minsocketbuffersize.la
else
TESTS = ${top_builddir}/test/test
endif

TEST_EXTENSIONS = .la
LA_LOG_DRIVER = ${top_srcdir}/test/run_unit.sh

EXTRA_DIST = data/hello.odt data/hello.txt $(test_SOURCES) $(unittest_SOURCES) run_unit.sh

check_valgrind: all
	./run_unit.sh --log-file test.log --trs-file test.trs --valgrind

# run unittest during the normal build
all-local: unittest
	@echo
	@echo "Running build-time unit tests.  For more thorough testing, please run 'make check'."
	@echo
	@${top_builddir}/test/unittest 2> unittest.log || { cat unittest.log ; exit 1 ; }
