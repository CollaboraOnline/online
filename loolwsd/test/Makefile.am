check_PROGRAMS = test

AM_CXXFLAGS = $(CPPUNIT_CFLAGS)

test_CPPFLAGS = -DTDOC=\"$(top_srcdir)/test/data\"

test_LDADD = $(CPPUNIT_LIBS)

test_SOURCES = httpposttest.cpp httpwstest.cpp test.cpp ../LOOLProtocol.cpp

EXTRA_DIST = data/hello.odt data/hello.txt $(test_SOURCES)

TESTS = test
