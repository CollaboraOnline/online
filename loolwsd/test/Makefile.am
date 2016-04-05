check_PROGRAMS = test

AM_CXXFLAGS = $(CPPUNIT_CFLAGS)

lib_LTLIBRARIES = unit-prefork.la

AM_CPPFLAGS = -pthread -I$(top_srcdir)

test_CPPFLAGS = -DTDOC=\"$(top_srcdir)/test/data\"

test_LDADD = $(CPPUNIT_LIBS)

test_SOURCES = httpposttest.cpp httpwstest.cpp test.cpp ../LOOLProtocol.cpp

# unit test modules:
unit_prefork_la_SOURCES = \
	UnitPrefork.cpp
unit_prefork_la_LDFLAGS = -module

if HAVE_LO_PATH
TESTS = $(top_builddir)/test/test $(top_builddir)/loolwsd/test/run_unit.sh
else
TESTS = $(top_builddir)/test/test
endif

EXTRA_DIST = data/hello.odt data/hello.txt $(test_SOURCES) run_unit.sh

clean-hook:
	@echo "rm -Rf $(top_builddir)/test/jails"

