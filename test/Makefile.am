# Cap threadpools to 4 threads.
export MAX_CONCURRENCY=4
AUTOMAKE_OPTION = serial-tests

# unittest: tests that run a captive loolwsd as part of themselves.
check_PROGRAMS = fakesockettest

noinst_PROGRAMS = fakesockettest unittest

AM_CXXFLAGS = $(CPPUNIT_CFLAGS) -DTDOC=\"$(abs_top_srcdir)/test/data\" \
	-I${top_srcdir}/common -I${top_srcdir}/net -I${top_srcdir}/wsd -I${top_srcdir}/kit \
	-pthread -DLOOLWSD_DATADIR='"@LOOLWSD_DATADIR@"' \
	-DLOOLWSD_CONFIGDIR='"@LOOLWSD_CONFIGDIR@"' \
	-DDEBUG_ABSSRCDIR='"@abs_srcdir@"' \
	${include_paths}

noinst_LTLIBRARIES = \
	unit-base.la unit-tiletest.la \
	unit-integration.la unit-httpws.la unit-crash.la \
	unit-convert.la unit-typing.la unit-copy-paste.la \
	unit-timeout.la unit-prefork.la unit-storage.la \
	unit-admin.la unit-tilecache.la \
	unit-fuzz.la unit-oob.la unit-http.la unit-oauth.la \
	unit-wopi.la unit-wopi-saveas.la \
	unit-wopi-ownertermination.la unit-wopi-versionrestore.la \
	unit-wopi-documentconflict.la unit_wopi_renamefile.la unit_wopi_watermark.la \
	unit-tiff-load.la \
	unit-large-paste.la \
	unit-paste.la \
	unit-load-torture.la \
	unit-rendering-options.la \
	unit-password-protected.la \
	unit-render-shape.la \
	unit-each-view.la \
	unit-session.la \
	unit-uno-command.la \
	unit-load.la \
	unit-cursor.la \
	unit-calc.la \
	unit-insert-delete.la \
	unit-close.la \
	unit-bad-doc-load.la \
	unit-hosting.la \
	unit-wopi-loadencoded.la unit-wopi-temp.la

MAGIC_TO_FORCE_SHLIB_CREATION = -rpath /dummy
AM_LDFLAGS = -pthread -module $(MAGIC_TO_FORCE_SHLIB_CREATION) $(ZLIB_LIBS)

if ENABLE_SSL
AM_LDFLAGS += -lssl -lcrypto
endif

# We work around some of the mess of using the same sources both on
# the server side and here in unit tests with conditional compilation
# based on BUILDING_TESTS

AM_CPPFLAGS = -pthread -I$(top_srcdir) -DBUILDING_TESTS -DLOK_ABORT_ON_ASSERTION

wsd_sources = \
            ../common/FileUtil.cpp \
            ../common/IoUtil.cpp \
            ../common/Protocol.cpp \
            ../common/SpookyV2.cpp \
            ../common/Util.cpp \
            ../common/Authorization.cpp \
            ../kit/Kit.cpp \
            ../kit/TestStubs.cpp \
            ../wsd/TileCache.cpp \
            ../wsd/ProofKey.cpp

test_base_source = \
	TileQueueTests.cpp \
	WhiteBoxTests.cpp \
	DeltaTests.cpp \
	WopiProofTests.cpp \
	$(wsd_sources)

unittest_CPPFLAGS = -I$(top_srcdir) -DBUILDING_TESTS -DSTANDALONE_CPPUNIT
unittest_SOURCES = \
    $(test_base_source) \
    ../common/Log.cpp \
    ../common/MessageQueue.cpp \
    ../common/Session.cpp \
    ../common/SigUtil.cpp \
    ../common/Unit.cpp \
    ../common/StringVector.cpp \
    ../net/Socket.cpp \
    ../wsd/Auth.cpp \
    ../wsd/TestStubs.cpp \
    test.cpp

unittest_LDADD = $(CPPUNIT_LIBS)
unit_base_la_LIBADD = $(CPPUNIT_LIBS)
if ENABLE_SSL
unittest_SOURCES += ../net/Ssl.cpp
else
unittest_LDADD += -lssl -lcrypto
unit_base_la_LIBADD += -lssl -lcrypto
endif

fakesockettest_SOURCES = fakesockettest.cpp ../net/FakeSocket.cpp
fakesockettest_LDADD = $(CPPUNIT_LIBS)

# old-style unit tests - bootstrapped via UnitClient
unit_base_la_SOURCES = UnitClient.cpp ${test_base_source}
unit_tiletest_la_SOURCES = UnitClient.cpp TileCacheTests.cpp
unit_tiletest_la_LIBADD = $(CPPUNIT_LIBS)
unit_integration_la_SOURCES = UnitClient.cpp integration-http-server.cpp
unit_integration_la_LIBADD = $(CPPUNIT_LIBS)
unit_httpws_la_SOURCES = UnitClient.cpp httpwstest.cpp
unit_httpws_la_LIBADD = $(CPPUNIT_LIBS)
unit_crash_la_SOURCES = UnitClient.cpp httpcrashtest.cpp
unit_crash_la_LIBADD = $(CPPUNIT_LIBS)

# unit test modules:
unit_oob_la_SOURCES = UnitOOB.cpp
unit_http_la_SOURCES = UnitHTTP.cpp
unit_http_la_LIBADD = $(CPPUNIT_LIBS)
unit_fuzz_la_SOURCES = UnitFuzz.cpp
unit_admin_la_SOURCES = UnitAdmin.cpp
unit_admin_la_LIBADD = $(CPPUNIT_LIBS)
unit_typing_la_SOURCES = UnitTyping.cpp
unit_typing_la_LIBADD = $(CPPUNIT_LIBS)
unit_copy_paste_la_SOURCES = UnitCopyPaste.cpp
unit_copy_paste_la_LIBADD = $(CPPUNIT_LIBS)
unit_convert_la_SOURCES = UnitConvert.cpp
unit_timeout_la_SOURCES = UnitTimeout.cpp
unit_prefork_la_SOURCES = UnitPrefork.cpp
unit_storage_la_SOURCES = UnitStorage.cpp
unit_tilecache_la_SOURCES = UnitTileCache.cpp
unit_oauth_la_SOURCES = UnitOAuth.cpp
unit_oauth_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_la_SOURCES = UnitWOPI.cpp
unit_wopi_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_saveas_la_SOURCES = UnitWOPISaveAs.cpp
unit_wopi_saveas_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_ownertermination_la_SOURCES = UnitWopiOwnertermination.cpp
unit_wopi_ownertermination_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_versionrestore_la_SOURCES = UnitWOPIVersionRestore.cpp
unit_wopi_versionrestore_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_documentconflict_la_SOURCES = UnitWOPIDocumentConflict.cpp
unit_wopi_documentconflict_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_renamefile_la_SOURCES = UnitWOPIRenameFile.cpp
unit_wopi_renamefile_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_watermark_la_SOURCES = UnitWOPIWatermark.cpp
unit_wopi_watermark_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_loadencoded_la_SOURCES = UnitWOPILoadEncoded.cpp
unit_wopi_loadencoded_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_temp_la_SOURCES = UnitWOPITemplate.cpp
unit_wopi_temp_la_LIBADD = $(CPPUNIT_LIBS)
unit_tiff_load_la_SOURCES = UnitTiffLoad.cpp
unit_tiff_load_la_LIBADD = $(CPPUNIT_LIBS)
unit_large_paste_la_SOURCES = UnitLargePaste.cpp
unit_large_paste_la_LIBADD = $(CPPUNIT_LIBS)
unit_paste_la_SOURCES = UnitPaste.cpp
unit_paste_la_LIBADD = $(CPPUNIT_LIBS)
unit_load_torture_la_SOURCES = UnitLoadTorture.cpp
unit_load_torture_la_LIBADD = $(CPPUNIT_LIBS)
unit_rendering_options_la_SOURCES = UnitRenderingOptions.cpp
unit_rendering_options_la_LIBADD = $(CPPUNIT_LIBS)
unit_password_protected_la_SOURCES = UnitPasswordProtected.cpp
unit_password_protected_la_LIBADD = $(CPPUNIT_LIBS)
unit_render_shape_la_SOURCES = UnitRenderShape.cpp
unit_render_shape_la_LIBADD = $(CPPUNIT_LIBS)
unit_each_view_la_SOURCES = UnitEachView.cpp
unit_each_view_la_LIBADD = $(CPPUNIT_LIBS)
unit_session_la_SOURCES = UnitSession.cpp
unit_session_la_LIBADD = $(CPPUNIT_LIBS)
unit_uno_command_la_SOURCES = UnitUNOCommand.cpp
unit_uno_command_la_LIBADD = $(CPPUNIT_LIBS)
unit_load_la_SOURCES = UnitLoad.cpp
unit_load_la_LIBADD = $(CPPUNIT_LIBS)
unit_cursor_la_SOURCES = UnitCursor.cpp
unit_cursor_la_LIBADD = $(CPPUNIT_LIBS)
unit_calc_la_SOURCES = UnitCalc.cpp
unit_calc_la_LIBADD = $(CPPUNIT_LIBS)
unit_insert_delete_la_SOURCES = UnitInsertDelete.cpp
unit_insert_delete_la_LIBADD = $(CPPUNIT_LIBS)
unit_close_la_SOURCES = UnitClose.cpp
unit_close_la_LIBADD = $(CPPUNIT_LIBS)
unit_bad_doc_load_la_SOURCES = UnitBadDocLoad.cpp
unit_bad_doc_load_la_LIBADD = $(CPPUNIT_LIBS)
unit_hosting_la_SOURCES = UnitHosting.cpp
unit_hosting_la_LIBADD = $(CPPUNIT_LIBS)

if HAVE_LO_PATH
SYSTEM_STAMP = @SYSTEMPLATE_PATH@/system_stamp
else
SYSTEM_STAMP =
endif

if HAVE_LO_PATH
check-local:
	./fakesockettest
	@fc-cache "@LO_PATH@"/share/fonts/truetype

# FIXME 2: unit-oob.la fails with symbol undefined:
# UnitWSD::testHandleRequest(UnitWSD::TestRequest, UnitHTTPServerRequest&, UnitHTTPServerResponse&) ,
TESTS = \
	unit-base.la unit-tiletest.la \
	unit-integration.la unit-httpws.la unit-crash.la \
	\
	unit-copy-paste.la unit-typing.la unit-convert.la unit-prefork.la unit-tilecache.la unit-timeout.la \
        unit-oauth.la unit-wopi.la unit-wopi-saveas.la \
        unit-wopi-ownertermination.la unit-wopi-versionrestore.la \
        unit-wopi-documentconflict.la unit_wopi_renamefile.la unit_wopi_watermark.la \
	unit-http.la \
	unit-tiff-load.la \
	unit-large-paste.la \
	unit-paste.la \
	unit-load-torture.la \
	unit-rendering-options.la \
	unit-password-protected.la \
	unit-render-shape.la \
	unit-each-view.la \
	unit-session.la \
	unit-uno-command.la \
	unit-load.la \
	unit-cursor.la \
	unit-calc.la \
	unit-insert-delete.la \
	unit-close.la \
	unit-bad-doc-load.la \
	unit-hosting.la \
	unit-wopi-loadencoded.la unit-wopi-temp.la
# TESTS += unit-admin.test
# TESTS += unit-storage.test

# Start forced grouping of tests using stamp files

# unit-base.log
unit-tiletest.log : unit-base.log
unit-integration.log : unit-base.log
unit-httpws.log : unit-base.log
unit-crash.log : unit-base.log

group1.log: unit-httpws.log unit-crash.log unit-tiletest.log unit-integration.log
	touch $@

unit-typing.log     : group1.log
unit-convert.log    : group1.log
unit-tilecache.log  : group1.log
unit-timeout.log    : group1.log

group1a.log: unit-typing.log unit-convert.log unit-tilecache.log unit-timeout.log
	touch $@

# isolate this one - it's not a happy test.
unit-copy-paste.log : group1a.log

group2.log: unit-copy-paste.log
	touch $@

unit-prefork.log : group2.log
unit-oauth.log : group2.log
unit-wopi.log : group2.log
unit-wopi-saveas.log : group2.log
unit-wopi-ownertermination.log : group2.log
unit-wopi-versionrestore.log : group2.log
unit-wopi-documentconflict.log : group2.log
unit_wopi_renamefile.log : group2.log
unit_wopi_watermark.log : group2.log

group3.log: unit-oauth.log unit-wopi.log unit-wopi-saveas.log unit-wopi-ownertermination.log unit-wopi-versionrestore.log unit-wopi-documentconflict.log unit_wopi_renamefile.log unit_wopi_watermark.log
	touch $@

unit-http.log : group3.log
unit-tiff-load.log : group3.log
unit-large-paste.log : group3.log
unit-paste.log : group3.log
unit-load-torture.log : group3.log
unit-rendering-options.log : group3.log
unit-password-protected.log : group3.log
unit-render-shape.log : group3.log
unit-each-view.log : group3.log

group4.log: unit-http.log unit-tiff-load.log unit-large-paste.log unit-paste.log unit-load-torture.log unit-rendering-options.log unit-password-protected.log unit-render-shape.log unit-each-view.log
	touch $@

unit-session.log : group4.log
unit-uno-command.log : group4.log
unit-load.log : group4.log
unit-cursor.log : group4.log
unit-calc.log : group4.log
unit-insert-delete.log : group4.log

group5.log: unit-session.log unit-uno-command.log unit-load.log unit-cursor.log unit-calc.log unit-insert-delete.log
	touch $@

unit-close.log : group5.log
unit-bad-doc-load.log : group5.log
unit-hosting.log : group5.log
unit-wopi-loadencoded.log : group5.log
unit-wopi-temp.log : group5.log

# end forced grouping

endif

TEST_EXTENSIONS = .la
LA_LOG_DRIVER = ${top_srcdir}/test/run_unit.sh

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
	@UNITTEST=1 ${top_builddir}/test/unittest
