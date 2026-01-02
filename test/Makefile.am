#
# Copyright the Collabora Online contributors.
#
# SPDX-License-Identifier: MPL-2.0
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Cap threadpools to 4 threads.
export MAX_CONCURRENCY=4
AUTOMAKE_OPTION = serial-tests

DIST_FOLDER ?= $(abs_top_builddir)/browser/dist

# unittest: tests that run a captive coolwsd as part of themselves.
check_PROGRAMS = fakesockettest

noinst_PROGRAMS = fakesockettest unittest unithttplib

include_paths = ${ZLIB_CFLAGS} ${ZSTD_CFLAGS} ${PNG_CFLAGS}
if ENABLE_SSL
include_paths += ${OPENSSL_CFLAGS}
endif

AM_CXXFLAGS = $(CPPUNIT_CFLAGS) -DTDOC=\"$(abs_top_srcdir)/test/data\" -DTDIST=\"$(DIST_FOLDER)\" \
	-I${top_srcdir}/common -I${top_srcdir}/net -I${top_srcdir}/wsd -I${top_srcdir}/kit \
	-I${top_srcdir} -I${top_srcdir}/test \
	${include_paths}

# These are ordered by how long each takes to run.
# The longest-running tests are put first, the
# fastest tests are last. This reduces the
# total time with parallel runs.
# The time each test takes is logged, looked for
# 'Finished in' in the `make check` output.
# When adding new tests, please maintain order.
all_la_unit_tests = \
	unit-wopi-async-slow.la \
	unit-wopi-fail-upload.la \
	unit-wopi-lock.la \
	unit-tiletest.la \
	unit-wopi-documentconflict.la \
	unit-wopi-stuck-save.la \
	unit-wopi-transient-connect-fault.la \
	unit-perf.la \
	unit-close.la \
	unit-user-presets.la \
	unit-wopi-watermark.la \
	unit-crash.la \
	unit-invalidation.la \
	unit-httpws.la \
	unit-synthetic-lok.la \
	unit-any-input.la \
	unit-convert.la \
	unit-copy-paste.la \
	unit-wopi-save-on-exit.la \
	unit-uno-command.la \
	unit-proxy.la \
	unit-proxy-protocol.la \
	unit-each-view.la \
	unit-load.la \
	unit-integration.la \
	unit-quarantine.la \
	unit-multi-tenant.la \
	unit-load-torture.la \
	unit-save-torture.la \
	unit-copy-paste-writer.la \
	unit-wopi-fileurl.la \
	unit-wopi-languages.la \
	unit-insert-delete.la \
	unit-password-protected.la \
	unit-wopi-httpredirect.la \
	unit-calc.la \
	unit-http.la \
	unit-wopi-temp.la \
	unit-session.la \
	unit-render-shape.la \
	unit-wopi-ownertermination.la \
	unit-wopi-httpheaders.la \
	unit-wopi.la \
	unit-wopi-crash-modified.la \
	unit-oauth.la \
	unit-wopi-versionrestore.la \
	unit-rendering-options.la \
	unit-paste.la \
	unit-large-paste.la \
	unit-typing.la \
	unit-cursor.la \
	unit-render-search-result.la \
	unit-tiff-load.la \
	unit-save.la \
	unit-wopi-saveas-with-encoded-file-name.la \
	unit-storage.la \
	unit-wopi-async-upload-modifyclose.la \
	unit-wopi-saveas.la \
	unit_wopi_renamefile.la \
	unit-prefork.la \
	unit-bad-doc-load.la \
	unit-hosting.la \
	unit-join-disconnect.la \
	unit-initial-load-fail.la \
	unit-timeout.la \
	unit-timeout_inactive.la \
	unit-timeout_conn.la \
	unit-timeout_none.la \
	unit-serversock_accept1.la \
	unit-streamsock_ctor1.la \
	unit-kit-child-session.la \
	unit-base.la
#	unit-admin.la
#	unit-tilecache.la # Empty test.

if ENABLE_LIBFUZZER
all_la_unit_tests += unit-fuzz.la
endif

check_LTLIBRARIES = ${all_la_unit_tests}

MAGIC_TO_FORCE_SHLIB_CREATION = -rpath /dummy
AM_LDFLAGS = -module $(MAGIC_TO_FORCE_SHLIB_CREATION) $(ZLIB_LIBS) $(ZSTD_LIBS) ${PNG_LIBS}

# Clang's linker doesn't like -pthread.
if !HAVE_CLANG
AM_CXXFLAGS += -pthread
AM_LDFLAGS += -pthread
endif

if ENABLE_SSL
AM_LDFLAGS += ${OPENSSL_LIBS}
endif

# We work around some of the mess of using the same sources both on
# the server side and here in unit tests with conditional compilation
# based on BUILDING_TESTS

AM_CPPFLAGS = -pthread -I$(top_srcdir) -DBUILDING_TESTS -DLOK_ABORT_ON_ASSERTION

wsd_sources = \
	../kit/Kit.cpp \
	../kit/KitWebSocket.cpp \
	../kit/TestStubs.cpp \
	../wsd/FileServerUtil.cpp \
	../wsd/ProofKey.cpp \
	../wsd/RequestDetails.cpp \
	../wsd/TileCache.cpp

test_base_sources = \
	KitQueueTests.cpp \
	RequestDetailsTests.cpp \
	StringVectorTests.cpp \
	FileServeWhiteBoxTests.cpp \
	NetUtilWhiteBoxTests.cpp \
	WhiteBoxTests.cpp \
	HttpWhiteBoxTests.cpp \
	DeltaTests.cpp \
	UtilTests.cpp \
	WopiProofTests.cpp \
	UriTests.cpp \
	TestGlobals.cpp \
	HostUtilTests.cpp \
	$(wsd_sources)

common_sources = \
	../common/Authorization.cpp \
	../common/ConfigUtil.cpp \
	../common/DummyTraceEventEmitter.cpp \
	../common/FileUtil.cpp \
	../common/FileUtil-unix.cpp \
	../common/Log.cpp \
	../common/Protocol.cpp \
	../common/RegexUtil.cpp \
	../common/Session.cpp \
	../common/SigUtil-server.cpp \
	../common/Simd.cpp \
	../common/SpookyV2.cpp \
	../common/StringVector.cpp \
	../common/TraceEvent.cpp \
	../common/Unit.cpp \
	../common/Unit-server.cpp \
	../common/Uri.cpp \
	../common/Util-server.cpp \
	../common/Util-unix.cpp \
	../common/Util.cpp \
	../kit/KitQueue.cpp \
	../kit/LogUI.cpp \
	../wsd/Exceptions.cpp \
	../net/HttpRequest.cpp \
	../net/Socket.cpp \
	../net/NetUtil.cpp \
	../wsd/Auth.cpp \
	../wsd/HostUtil.cpp

globals_sources = ../common/Globals.cpp

unithttplib_CPPFLAGS = -I$(top_srcdir) -DBUILDING_TESTS -DSTANDALONE_CPPUNIT -g
unithttplib_SOURCES = $(common_sources) $(globals_sources) test.cpp HttpRequestTests.cpp
unithttplib_LDADD = $(CPPUNIT_LIBS)

unittest_CPPFLAGS = -I$(top_srcdir) -DBUILDING_TESTS -DSTANDALONE_CPPUNIT -g
unittest_SOURCES = \
	$(test_base_sources) \
	$(common_sources) \
	../common/Globals.cpp \
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
fakesockettest_SOURCES = fakesockettest.cpp  ../net/FakeSocket.cpp ../common/DummyTraceEventEmitter.cpp ../common/Log.cpp ../common/Util.cpp ../common/Util-server.cpp ../common/Util-unix.cpp ../common/Globals.cpp
fakesockettest_LDADD = $(CPPUNIT_LIBS)

# old-style unit tests - bootstrapped via UnitClient
unit_base_la_SOURCES = UnitClient.cpp ${test_base_sources}
unit_tiletest_la_SOURCES = UnitClient.cpp TileCacheTests.cpp KitPidHelpers.cpp
unit_tiletest_la_LIBADD = $(CPPUNIT_LIBS)
unit_integration_la_SOURCES = UnitClient.cpp integration-http-server.cpp KitPidHelpers.cpp
unit_integration_la_LIBADD = $(CPPUNIT_LIBS)
unit_httpws_la_SOURCES = UnitClient.cpp httpwstest.cpp KitPidHelpers.cpp
unit_httpws_la_LIBADD = $(CPPUNIT_LIBS)
unit_crash_la_SOURCES = UnitClient.cpp httpcrashtest.cpp KitPidHelpers.cpp
unit_crash_la_LIBADD = $(CPPUNIT_LIBS)

# unit test modules:
unit_http_la_SOURCES = UnitHTTP.cpp
unit_http_la_LIBADD = $(CPPUNIT_LIBS)
if ENABLE_LIBFUZZER
unit_fuzz_la_SOURCES = UnitFuzz.cpp
endif
#unit_admin_la_SOURCES = UnitAdmin.cpp
#unit_admin_la_LIBADD = $(CPPUNIT_LIBS)
unit_typing_la_SOURCES = UnitTyping.cpp
unit_typing_la_LIBADD = $(CPPUNIT_LIBS)
unit_copy_paste_la_SOURCES = UnitCopyPaste.cpp
unit_copy_paste_la_LIBADD = $(CPPUNIT_LIBS)
unit_copy_paste_writer_la_SOURCES = UnitCopyPasteWriter.cpp
unit_copy_paste_writer_la_LIBADD = $(CPPUNIT_LIBS)
unit_convert_la_SOURCES = UnitConvert.cpp
unit_initial_load_fail_la_SOURCES = UnitInitialLoadFail.cpp
unit_initial_load_fail_la_LIBADD = $(CPPUNIT_LIBS)
unit_join_disconnect_la_SOURCES = UnitJoinDisconnect.cpp
unit_join_disconnect_la_LIBADD = $(CPPUNIT_LIBS)
unit_timeout_la_SOURCES = UnitTimeout.cpp
unit_timeout_la_LIBADD = $(CPPUNIT_LIBS)
unit_timeout_inactive_la_SOURCES = UnitTimeoutInactive.cpp
unit_timeout_inactive_la_LIBADD = $(CPPUNIT_LIBS)
unit_timeout_conn_la_SOURCES = UnitTimeoutConnections.cpp
unit_timeout_conn_la_LIBADD = $(CPPUNIT_LIBS)
unit_timeout_none_la_SOURCES = UnitTimeoutNone.cpp
unit_timeout_none_la_LIBADD = $(CPPUNIT_LIBS)
unit_serversock_accept1_la_SOURCES = UnitServerSocketAcceptFailure1.cpp
unit_serversock_accept1_la_LIBADD = $(CPPUNIT_LIBS)
unit_streamsock_ctor1_la_SOURCES = UnitStreamSocketCtorFailure1.cpp
unit_streamsock_ctor1_la_LIBADD = $(CPPUNIT_LIBS)
unit_prefork_la_SOURCES = UnitPrefork.cpp
unit_prefork_la_LIBADD = $(CPPUNIT_LIBS)
unit_storage_la_SOURCES = UnitStorage.cpp
unit_storage_la_LIBADD = $(CPPUNIT_LIBS)
# unit_tilecache_la_SOURCES = UnitTileCache.cpp
# unit_tilecache_la_LIBADD = $(CPPUNIT_LIBS)
unit_oauth_la_SOURCES = UnitOAuth.cpp
unit_oauth_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_la_SOURCES = UnitWOPI.cpp
unit_wopi_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_async_upload_modifyclose_la_SOURCES = UnitWOPIAsyncUpload_ModifyClose.cpp
unit_wopi_async_upload_modifyclose_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_async_slow_la_SOURCES = UnitWOPISlow.cpp
unit_wopi_async_slow_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_crash_modified_la_SOURCES = UnitWOPICrashModified.cpp
unit_wopi_crash_modified_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_saveas_la_SOURCES = UnitWOPISaveAs.cpp
unit_wopi_saveas_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_saveas_with_encoded_file_name_la_SOURCES = UnitWOPISaveAsWithEncodedFileName.cpp
unit_wopi_saveas_with_encoded_file_name_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_ownertermination_la_SOURCES = UnitWopiOwnertermination.cpp
unit_wopi_ownertermination_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_versionrestore_la_SOURCES = UnitWOPIVersionRestore.cpp
unit_wopi_versionrestore_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_documentconflict_la_SOURCES = UnitWOPIDocumentConflict.cpp
unit_wopi_documentconflict_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_save_on_exit_la_SOURCES = UnitWOPISaveOnExit.cpp
unit_wopi_save_on_exit_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_stuck_save_la_SOURCES = UnitWOPIStuckSave.cpp
unit_wopi_stuck_save_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_transient_connect_fault_la_SOURCES = UnitWOPITransientConnectFault.cpp
unit_wopi_transient_connect_fault_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_fail_upload_la_SOURCES = UnitWOPIFailUpload.cpp
unit_wopi_fail_upload_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_renamefile_la_SOURCES = UnitWOPIRenameFile.cpp
unit_wopi_renamefile_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_languages_la_SOURCES = UnitWOPILanguages.cpp
unit_wopi_languages_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_lock_la_SOURCES = UnitWOPILock.cpp
unit_wopi_lock_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_watermark_la_SOURCES = UnitWOPIWatermark.cpp
unit_wopi_watermark_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_temp_la_SOURCES = UnitWOPITemplate.cpp
unit_wopi_temp_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_fileurl_la_SOURCES = UnitWOPIFileUrl.cpp
unit_wopi_fileurl_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_httpheaders_la_SOURCES = UnitWOPIHttpHeaders.cpp
unit_wopi_httpheaders_la_LIBADD = $(CPPUNIT_LIBS)
unit_wopi_httpredirect_la_SOURCES = UnitWOPIHttpRedirect.cpp
unit_wopi_httpredirect_la_LIBADD = $(CPPUNIT_LIBS)
unit_tiff_load_la_SOURCES = UnitTiffLoad.cpp
unit_tiff_load_la_LIBADD = $(CPPUNIT_LIBS)
unit_save_la_SOURCES = UnitSave.cpp
unit_save_la_LIBADD = $(CPPUNIT_LIBS)
unit_any_input_la_SOURCES = UnitAnyInput.cpp
unit_any_input_la_LIBADD = $(CPPUNIT_LIBS)
unit_kit_child_session_la_SOURCES = UnitKitChildSession.cpp
unit_kit_child_session_la_LIBADD = $(CPPUNIT_LIBS)
unit_large_paste_la_SOURCES = UnitLargePaste.cpp
unit_large_paste_la_LIBADD = $(CPPUNIT_LIBS)
unit_paste_la_SOURCES = UnitPaste.cpp
unit_paste_la_LIBADD = $(CPPUNIT_LIBS)
unit_load_torture_la_SOURCES = UnitLoadTorture.cpp
unit_load_torture_la_LIBADD = $(CPPUNIT_LIBS)
unit_save_torture_la_SOURCES = UnitSaveTorture.cpp
unit_save_torture_la_LIBADD = $(CPPUNIT_LIBS)
unit_synthetic_lok_la_SOURCES = UnitSyntheticLok.cpp
unit_synthetic_lok_la_LIBADD = $(CPPUNIT_LIBS)
unit_rendering_options_la_SOURCES = UnitRenderingOptions.cpp
unit_rendering_options_la_LIBADD = $(CPPUNIT_LIBS)
unit_invalidation_la_SOURCES = UnitInvalidation.cpp
unit_invalidation_la_LIBADD = $(CPPUNIT_LIBS)
unit_password_protected_la_SOURCES = UnitPasswordProtected.cpp
unit_password_protected_la_LIBADD = $(CPPUNIT_LIBS)
unit_render_search_result_la_SOURCES = UnitRenderSearchResult.cpp
unit_render_search_result_la_LIBADD = $(CPPUNIT_LIBS)
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
unit_quarantine_la_SOURCES = UnitQuarantine.cpp
unit_quarantine_la_LIBADD = $(CPPUNIT_LIBS)
unit_multi_tenant_la_SOURCES = UnitMultiTenant.cpp
unit_multi_tenant_la_LIBADD = $(CPPUNIT_LIBS)
unit_user_presets_la_SOURCES = UnitUserPresets.cpp
unit_user_presets_la_LIBADD = $(CPPUNIT_LIBS)
unit_perf_la_SOURCES = UnitPerf.cpp
unit_perf_la_LIBADD = $(CPPUNIT_LIBS) $(LIBPFM_LIBS)
unit_proxy_la_SOURCES = UnitProxy.cpp
unit_proxy_la_LIBADD = $(CPPUNIT_LIBS) $(LIBPFM_LIBS)
unit_proxy_protocol_la_SOURCES = UnitProxyProtocol.cpp
unit_proxy_protocol_la_LIBADD = $(CPPUNIT_LIBS) $(LIBPFM_LIBS)

if HAVE_LO_PATH
SYSTEM_STAMP = @SYSTEMPLATE_PATH@/system_stamp
else
SYSTEM_STAMP =
endif

CLEANUP_COMMAND=if test -s ../coolwsd; then echo "Cleaning up..." && ../coolwsd --disable-cool-user-checking --cleanup --o:logging.level=trace; fi

if HAVE_LO_PATH
check-local:
	@$(CLEANUP_COMMAND)
	@UNITTEST=1 ./fakesockettest 2> test.log || (cat test.log && /bin/false)
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@echo "Done test check-local"

TESTS = \
	${all_la_unit_tests} \
	unithttplib

endif

TEST_EXTENSIONS = .la
LA_LOG_DRIVER = ${top_builddir}/test/run_unit.sh
LOG_DRIVER = ${top_builddir}/test/run_unit_standalone.sh

EXTRA_DIST = data/delta-text.png data/delta-text2.png data/delta-graphic.png data/delta-graphic2.png data/hello.odt data/hello.txt $(test_SOURCES) $(unittest_SOURCES) run_unit.sh run_unit_standalone.sh

check_valgrind: all
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	./run_unit.sh --log-file test.log --trs-file test.trs --valgrind

# run unittest during the normal build
all-local: unittest
	@echo
	@echo "Running build-time unit tests.  For more thorough testing, please run 'make check'."
	@echo "Test output is in `pwd`/test.log and is displayed on failure."
	@echo
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@UNITTEST=1 ${top_builddir}/test/unittest --cert-path ${abs_top_srcdir}/etc 2> test.log || (cat test.log && /bin/false)
	@echo "Done test all-local"
	@$(CLEANUP_COMMAND)

.PRECIOUS: $(TEST_LOGS)
