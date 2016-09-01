# Cap threadpools to 4 threads.
export MAX_CONCURRENCY=4
AUTOMAKE_OPTION = serial-tests

check_PROGRAMS = test
noinst_PROGRAMS = test

AM_CXXFLAGS = $(CPPUNIT_CFLAGS)

noinst_LTLIBRARIES = \
        unit-timeout.la unit-prefork.la \
        unit-storage.la unit-fonts.la \
        unit-admin.la unit-tilecache.la \
	unit-fuzz.la

MAGIC_TO_FORCE_SHLIB_CREATION = -rpath /dummy
AM_LDFLAGS = -pthread -module $(MAGIC_TO_FORCE_SHLIB_CREATION)
AM_CPPFLAGS = -pthread -I$(top_srcdir)

wsd_sources = \
            ../IoUtil.cpp \
            ../Log.cpp \
            ../LOOLProtocol.cpp \
            ../TileCache.cpp \
            ../MessageQueue.cpp \
            ../Unit.cpp \
            ../Util.cpp

test_CPPFLAGS = -DTDOC=\"$(top_srcdir)/test/data\" -I$(top_srcdir)
test_SOURCES = TileCacheTests.cpp WhiteBoxTests.cpp integration-http-server.cpp \
               httpwstest.cpp httpcrashtest.cpp test.cpp $(wsd_sources)
test_LDADD = $(CPPUNIT_LIBS)

# unit test modules:
unit_fuzz_la_SOURCES = UnitFuzz.cpp
unit_admin_la_SOURCES = UnitAdmin.cpp
unit_admin_la_CPPFLAGS = -DTDOC=\"$(top_srcdir)/test/data\"
unit_fonts_la_SOURCES = UnitFonts.cpp
unit_timeout_la_SOURCES = UnitTimeout.cpp
unit_prefork_la_SOURCES = UnitPrefork.cpp
unit_storage_la_SOURCES = UnitStorage.cpp
unit_tilecache_la_SOURCES = UnitTileCache.cpp
unit_tilecache_la_CPPFLAGS = -DTDOC=\"$(top_srcdir)/test/data\"

if HAVE_LO_PATH
SYSTEM_STAMP = @SYSTEMPLATE_PATH@/system_stamp
else
SYSTEM_STAMP =
endif

if HAVE_LO_PATH
check-local:
	./run_unit.sh --log-file test.log --trs-file test.trs
# FIXME unit-fonts.la is unstable, disabled for now.
TESTS = unit-tilecache.la unit-admin.la unit-timeout.la unit-storage.la unit-prefork.la
else
TESTS = ${top_builddir}/test/test
endif

TEST_EXTENSIONS = .la
LA_LOG_DRIVER = ${top_srcdir}/test/run_unit.sh

EXTRA_DIST = data/hello.odt data/hello.txt $(test_SOURCES) run_unit.sh

check_valgrind: all
	./run_unit.sh --log-file test.log --trs-file test.trs --valgrind

