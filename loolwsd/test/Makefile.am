# variables for tests
jails=${top_builddir}/test/jails
systemplate=${top_builddir}/test/systemplate
export jails
export systemplate
export LO_PATH

AUTOMAKE_OPTION = serial-tests

check_PROGRAMS = test

AM_CXXFLAGS = $(CPPUNIT_CFLAGS)

lib_LTLIBRARIES = unit-timeout.la unit-prefork.la unit-storage.la

AM_CPPFLAGS = -pthread -I$(top_srcdir)

test_CPPFLAGS = -DTDOC=\"$(top_srcdir)/test/data\"

test_LDADD = $(CPPUNIT_LIBS)

test_SOURCES = httpposttest.cpp httpwstest.cpp test.cpp ../LOOLProtocol.cpp

# unit test modules:
unit_timeout_la_SOURCES = UnitTimeout.cpp
unit_timeout_la_LDFLAGS = -module
unit_prefork_la_SOURCES = UnitPrefork.cpp
unit_prefork_la_LDFLAGS = -module
unit_storage_la_SOURCES = UnitStorage.cpp
unit_storage_la_LDFLAGS = -module

${systemplate}/system_stamp :
	rm -rf ${systemplate}
	${top_srcdir}/loolwsd-systemplate-setup ${systemplate} ${LO_PATH} && touch ${systemplate}/system_stamp

${jails} :
	mkdir -p ${jails}

${top_builddir}/test/run_unit.sh.log ${top_builddir}/test/run_unit.sh.trs : \
	${systemplate}/system_stamp ${jails} \
	${top_srcdir}/test/run_unit.sh \
	${top_builddir}/loolwsd \
	${top_builddir}/loolforkit \
	unit-timeout.la unit-prefork.la unit-storage.la
	if ${top_srcdir}/test/run_unit.sh; then \
	   touch ${top_builddir}/test/run_unit.sh.log; \
	fi

if HAVE_LO_PATH
TESTS = ${top_builddir}/test/run_unit.sh ${top_builddir}/test/test

clean-local:
	rm -rf ${top_builddir}/test/jails
	rm -rf ${systemplate}
	rm -f ${top_builddir}/test/unit_stamp;
else
TESTS = ${top_builddir}/test/test
endif

EXTRA_DIST = data/hello.odt data/hello.txt $(test_SOURCES) run_unit.sh


