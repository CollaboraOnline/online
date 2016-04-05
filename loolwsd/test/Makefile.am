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

jails=${top_builddir}/test/jails
systemplate=${top_builddir}/test/systemplate
export jails
export systemplate

${systemplate}/system_stamp :
	rm -rf ${systemplate}
	${top_srcdir}/loolwsd-systemplate-setup ${systemplate} ${LO_PATH} && touch ${systemplate}/system_stamp

${jails} :
	mkdir -p ${jails}

run_tests : ${systemplate}/system_stamp ${jails}
	${top_srcdir}/test/run_unit.sh "${LO_PATH}"

if HAVE_LO_PATH
TESTS = run_tests $(top_builddir)/test/test

clean-local:
	rm -rf ${top_builddir}/test/jails
	rm -rf ${systemplate}
else
TESTS = $(top_builddir)/test/test
endif

EXTRA_DIST = data/hello.odt data/hello.txt $(test_SOURCES) run_unit.sh


