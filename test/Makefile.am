# Cap threadpools to 4 threads.
export MAX_CONCURRENCY=4
AUTOMAKE_OPTION = serial-tests

# unittest: tests that run a captive loolwsd as part of themselves.
check_PROGRAMS = fakesockettest

noinst_PROGRAMS = fakesockettest unittest unithttplib

AM_CXXFLAGS = $(CPPUNIT_CFLAGS) -DTDOC=\"$(abs_top_srcdir)/test/data\" \
	-I${top_srcdir}/common -I${top_srcdir}/net -I${top_srcdir}/wsd -I${top_srcdir}/kit \
	-I${top_srcdir} \
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
	unit-wopi-loadencoded.la \
	unit-wopi-temp.la \
	unit-wopi-fileurl.la \
	unit-wopi-httpheaders.la

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
            ../common/SpookyV2.cpp \
            ../common/Authorization.cpp \
            ../kit/Kit.cpp \
            ../kit/TestStubs.cpp \
            ../wsd/FileServerUtil.cpp \
            ../wsd/RequestDetails.cpp \
            ../wsd/TileCache.cpp \
            ../wsd/ProofKey.cpp

test_base_source = \
	TileQueueTests.cpp \
	WhiteBoxTests.cpp \
	HttpWhiteBoxTests.cpp \
	DeltaTests.cpp \
	WopiProofTests.cpp \
	$(wsd_sources)

common_sources = \
	../common/Protocol.cpp \
	../common/ConfigUtil.cpp \
	../common/Log.cpp \
	../common/MessageQueue.cpp \
	../common/Session.cpp \
	../common/SigUtil.cpp \
	../common/Unit.cpp \
	../common/FileUtil.cpp \
	../common/Util.cpp \
	../common/StringVector.cpp \
	../net/HttpRequest.cpp \
	../net/Socket.cpp \
	../net/NetUtil.cpp \
	../wsd/Auth.cpp

unithttplib_CPPFLAGS = -I$(top_srcdir) -DBUILDING_TESTS -DSTANDALONE_CPPUNIT -g
unithttplib_SOURCES = $(common_sources) test.cpp HttpRequestTests.cpp
unithttplib_LDADD = $(CPPUNIT_LIBS)

unittest_CPPFLAGS = -I$(top_srcdir) -DBUILDING_TESTS -DSTANDALONE_CPPUNIT -g
unittest_SOURCES = \
    $(test_base_source) \
	$(common_sources) \
    ../wsd/TestStubs.cpp \
    test.cpp

unittest_LDADD = $(CPPUNIT_LIBS)
unit_base_la_LIBADD = $(CPPUNIT_LIBS)
if ENABLE_SSL
unittest_SOURCES += ../net/Ssl.cpp
unithttplib_SOURCES += ../net/Ssl.cpp
else
unittest_LDADD += -lssl -lcrypto
unithttplib_LDADD += -lssl -lcrypto
unit_base_la_LIBADD += -lssl -lcrypto
endif

fakesockettest_CPPFLAGS = -g
fakesockettest_SOURCES = fakesockettest.cpp  ../net/FakeSocket.cpp ../common/Log.cpp ../common/Util.cpp
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
unit_wopi_fileurl_la_SOURCES = UnitWOPIFileUrl.cpp
unit_wopi_fileurl_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_httpheaders_la_SOURCES = UnitWOPIHttpHeaders.cpp
unit_wopi_httpheaders_la_LIBADD = $(CPPUNIT_LIBS)
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

CLEANUP_COMMAND=if test -s ../loolwsd; then echo "Cleaning up..." && ../loolwsd --disable-lool-user-checking --cleanup --o:logging.level=trace; fi

if HAVE_LO_PATH
check-local:
	$(CLEANUP_COMMAND)
	./fakesockettest
	@fc-cache "@LO_PATH@"/share/fonts/truetype

# FIXME 2: unit-oob.la fails with symbol undefined:
# UnitWSD::testHandleRequest(UnitWSD::TestRequest, UnitHTTPServerRequest&, UnitHTTPServerResponse&) ,
TESTS = \
	unit-base.la unit-tiletest.la \
	unit-integration.la unit-httpws.la unit-crash.la \
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
	unit-wopi-loadencoded.la \
	unit-wopi-temp.la \
	unit-wopi-fileurl.la \
	unit-wopi-httpheaders.la \
	unithttplib
# TESTS += unit-admin.test
# TESTS += unit-storage.test

endif

TEST_EXTENSIONS = .la
LA_LOG_DRIVER = ${top_builddir}/test/run_unit.sh

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
	echo "Done test all-local"
	$(CLEANUP_COMMAND)
