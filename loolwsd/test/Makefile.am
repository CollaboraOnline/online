AUTOMAKE_OPTION = serial-tests

check_PROGRAMS = test

AM_CXXFLAGS = $(CPPUNIT_CFLAGS)

lib_LTLIBRARIES = \
	unit-timeout.la unit-prefork.la \
        unit-storage.la unit-fonts.la

AM_CPPFLAGS = -pthread -I$(top_srcdir)

test_CPPFLAGS = -DTDOC=\"$(top_srcdir)/test/data\"
test_SOURCES = httpposttest.cpp httpwstest.cpp test.cpp ../LOOLProtocol.cpp
test_LDADD = $(CPPUNIT_LIBS)

# unit test modules:
unit_fonts_la_SOURCES = UnitFonts.cpp
unit_fonts_la_LDFLAGS = -module
unit_timeout_la_SOURCES = UnitTimeout.cpp
unit_timeout_la_LDFLAGS = -module
unit_prefork_la_SOURCES = UnitPrefork.cpp
unit_prefork_la_LDFLAGS = -module
unit_storage_la_SOURCES = UnitStorage.cpp
unit_storage_la_LDFLAGS = -module

if HAVE_LO_PATH
SYSTEM_STAMP = @SYSTEMPLATE_PATH@/system_stamp
else
SYSTEM_STAMP =
endif

${top_builddir}/test/run_unit.sh.log ${top_builddir}/test/run_unit.sh.trs : \
	$(SYSTEM_STAMP) @JAILS_PATH@ \
	${top_srcdir}/test/run_unit.sh \
	${top_builddir}/loolwsd ${top_builddir}/loolforkit \
	$(wildcard *.la)
	if ${top_srcdir}/test/run_unit.sh; then \
	   touch ${top_builddir}/test/run_unit.sh.log; \
	fi

if HAVE_LO_PATH
TESTS = ${top_srcdir}/test/run_unit.sh ${top_srcdir}/test/run_test.sh
else
TESTS = ${top_builddir}/test/test
endif

EXTRA_DIST = data/hello.odt data/hello.txt $(test_SOURCES) run_unit.sh
