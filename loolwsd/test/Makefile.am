AUTOMAKE_OPTION = serial-tests

check_PROGRAMS = test

AM_CXXFLAGS = $(CPPUNIT_CFLAGS)

noinst_LTLIBRARIES = \
        unit-timeout.la unit-prefork.la \
        unit-storage.la unit-fonts.la \
        unit-admin.la

MAGIC_TO_FORCE_SHLIB_CREATION = -rpath /dummy
AM_LDFLAGS = -pthread -module $(MAGIC_TO_FORCE_SHLIB_CREATION)
AM_CPPFLAGS = -pthread -I$(top_srcdir)

test_CPPFLAGS = -DTDOC=\"$(top_srcdir)/test/data\"
test_SOURCES = WhiteBoxTests.cpp integration-http-server.cpp httpwstest.cpp httpcrashtest.cpp test.cpp ../LOOLProtocol.cpp
test_LDADD = $(CPPUNIT_LIBS)

# unit test modules:
unit_admin_la_SOURCES = UnitAdmin.cpp
unit_admin_la_CPPFLAGS = -DTDOC=\"$(top_srcdir)/test/data\"
unit_fonts_la_SOURCES = UnitFonts.cpp
unit_timeout_la_SOURCES = UnitTimeout.cpp
unit_prefork_la_SOURCES = UnitPrefork.cpp
unit_storage_la_SOURCES = UnitStorage.cpp

if HAVE_LO_PATH
SYSTEM_STAMP = @SYSTEMPLATE_PATH@/system_stamp
else
SYSTEM_STAMP =
endif

if HAVE_LO_PATH
TESTS = unit-admin.la unit-timeout.la unit-fonts.la unit-storage.la unit-prefork.la run_test.sh
else
TESTS = ${top_builddir}/test/test
endif

TEST_EXTENSIONS = .la .sh
LA_LOG_DRIVER = ${top_srcdir}/test/run_unit.sh
SH_LOG_DRIVER = ${top_srcdir}/test/run_unit.sh

EXTRA_DIST = data/hello.odt data/hello.txt $(test_SOURCES) run_unit.sh
