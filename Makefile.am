ETAGS=ctags -e

if ENABLE_MOBILEAPP

if ENABLE_GTKAPP
SUBDIRS = gtk browser
else
if ENABLE_WASM
SUBDIRS = wasm browser
else !ENABLE_WASM
SUBDIRS = browser
endif !ENABLE_WASM
endif

else

SUBDIRS = . browser test cypress_test

export ENABLE_DEBUG

bin_PROGRAMS = \
	coolforkit \
	coolmount \
        coolstress \
	coolconvert coolconfig

if ENABLE_LIBFUZZER
else
bin_PROGRAMS += coolwsd
endif

dist_bin_SCRIPTS = coolwsd-systemplate-setup \
                   coolwsd-generate-proof-key

man_MANS = man/coolwsd.1 \
           man/coolforkit.1 \
           man/coolconvert.1 \
           man/coolconfig.1 \
           man/coolstress.1 \
           man/coolwsd-systemplate-setup.1 \
           man/coolwsd-generate-proof-key.1 \
           man/coolmount.1


dist_doc_DATA = wsd/README \
                wsd/README.vars \
                wsd/protocol.txt \
                wsd/reference.md \
                wsd/metrics.txt

coolwsddatadir = @COOLWSD_DATADIR@

coolwsddata_DATA = discovery.xml \
                   favicon.ico

coolwsdconfigdir = @COOLWSD_CONFIGDIR@

coolwsdconfig_DATA = coolwsd.xml \
		     coolkitconfig.xcu

apache2configdir = ${sysconfdir}/apache2/conf-available

apache2config_DATA = etc/apache2/coolwsd.conf

nginxconfigdir = ${sysconfdir}/nginx/snippets

nginxconfig_DATA = etc/nginx/coolwsd.conf

ACLOCAL_AMFLAGS = -I m4

# quick and easy for now.
include_paths = -I${top_srcdir}/common -I${top_srcdir}/net -I${top_srcdir}/wsd -I${top_srcdir}/kit ${ZLIB_CFLAGS} ${ZSTD_CFLAGS} ${PNG_CFLAGS}
if ENABLE_SSL
include_paths += ${OPENSSL_CFLAGS}
endif

AM_CPPFLAGS = -pthread -DCOOLWSD_DATADIR='"@COOLWSD_DATADIR@"' \
	      -DCOOLWSD_CONFIGDIR='"@COOLWSD_CONFIGDIR@"' \
	      -DDEBUG_ABSSRCDIR='"@abs_srcdir@"' \
	      ${include_paths}

if !ENABLE_DEBUG
AM_CPPFLAGS += -DNDEBUG
endif

AM_LDFLAGS = -pthread -Wl,-E -lpam $(ZLIB_LIBS) $(ZSTD_LIBS) ${PNG_LIBS}

if ENABLE_SSL
AM_LDFLAGS += ${OPENSSL_LIBS}
else
coolwsd_LDADD = ${OPENSSL_LIBS}
coolconfig_LDADD = ${OPENSSL_LIBS}
endif

AM_ETAGSFLAGS = --c++-kinds=+p --fields=+iaS --extra=+q -R --totals=yes --exclude=browser *
AM_CTAGSFLAGS = $(AM_ETAGSFLAGS)

shared_sources = common/FileUtil.cpp \
                 common/JailUtil.cpp \
                 common/Log.cpp \
                 common/Protocol.cpp \
                 common/StringVector.cpp \
                 common/Session.cpp \
                 common/Seccomp.cpp \
                 common/MessageQueue.cpp \
                 common/MobileApp.cpp \
                 common/TraceEvent.cpp \
                 common/SigUtil.cpp \
                 common/SpookyV2.cpp \
                 common/Unit.cpp \
                 common/Util.cpp \
                 common/ConfigUtil.cpp \
                 common/Authorization.cpp \
                 common/CommandControl.cpp \
                 net/DelaySocket.cpp \
                 net/HttpRequest.cpp \
                 net/HttpHelper.cpp \
                 net/NetUtil.cpp \
                 net/Socket.cpp \
                 wsd/Exceptions.cpp
if ENABLE_SSL
shared_sources += net/Ssl.cpp
endif

coolwsd_sources = common/Crypto.cpp \
                  wsd/Admin.cpp \
                  wsd/AdminModel.cpp \
                  wsd/Auth.cpp \
                  wsd/DocumentBroker.cpp \
                  wsd/ProxyProtocol.cpp \
                  wsd/COOLWSD.cpp \
                  wsd/ClientSession.cpp \
                  wsd/FileServer.cpp \
                  wsd/ProxyRequestHandler.cpp \
                  wsd/FileServerUtil.cpp \
                  wsd/RequestDetails.cpp \
                  wsd/Storage.cpp \
                  wsd/HostUtil.cpp \
                  wsd/TileCache.cpp \
                  wsd/ProofKey.cpp \
                  wsd/QuarantineUtil.cpp

coolwsd_SOURCES = $(coolwsd_sources) \
                  $(shared_sources)

EXTRA_coolwsd_DEPENDENCIES = browser/node_modules

noinst_PROGRAMS = clientnb \
                  connect \
                  lokitclient \
                  coolmap \
                  coolsocketdump

if ENABLE_LIBFUZZER
noinst_PROGRAMS += \
		   admin_fuzzer \
		   clientsession_fuzzer \
		   httpresponse_fuzzer \
		   httpecho_fuzzer
endif

connect_SOURCES = tools/Connect.cpp \
                  common/DummyTraceEventEmitter.cpp \
                  common/Log.cpp \
                  common/Protocol.cpp \
                  common/StringVector.cpp \
                  common/Util.cpp

lokitclient_SOURCES = common/Log.cpp \
                      common/DummyTraceEventEmitter.cpp \
                      tools/KitClient.cpp \
                      common/Protocol.cpp \
                      common/StringVector.cpp \
                      common/TraceEvent.cpp \
                      common/Util.cpp

coolforkit_sources = kit/ChildSession.cpp \
                     kit/ForKit.cpp \
                     kit/Kit.cpp

coolforkit_SOURCES = $(coolforkit_sources) \
                     $(shared_sources)

if ENABLE_LIBFUZZER
coolforkit_SOURCES += \
		       common/DummyTraceEventEmitter.cpp

common_fuzzer_sources = \
		       common/DummyTraceEventEmitter.cpp \
		       $(coolwsd_sources) \
		       $(coolforkit_sources) \
		       $(shared_sources)

admin_fuzzer_CPPFLAGS = \
			-DKIT_IN_PROCESS=1 \
			$(AM_CPPFLAGS)
admin_fuzzer_SOURCES = \
		       $(common_fuzzer_sources) \
		       fuzzer/Admin.cpp
admin_fuzzer_LDFLAGS = -fsanitize=fuzzer $(AM_LDFLAGS)

clientsession_fuzzer_CPPFLAGS = \
				-DKIT_IN_PROCESS=1 \
				$(AM_CPPFLAGS)
clientsession_fuzzer_SOURCES = \
			       $(common_fuzzer_sources) \
			       fuzzer/ClientSession.cpp
clientsession_fuzzer_LDFLAGS = -fsanitize=fuzzer $(AM_LDFLAGS)

httpresponse_fuzzer_CPPFLAGS = \
				-DKIT_IN_PROCESS=1 \
				$(AM_CPPFLAGS)
httpresponse_fuzzer_SOURCES = \
			       $(common_fuzzer_sources) \
			       fuzzer/HttpResponse.cpp
httpresponse_fuzzer_LDFLAGS = -fsanitize=fuzzer $(AM_LDFLAGS)

httpecho_fuzzer_CPPFLAGS = \
				-DKIT_IN_PROCESS=1 \
				$(AM_CPPFLAGS) \
        -I${top_srcdir}/test
httpecho_fuzzer_SOURCES = \
			       $(common_fuzzer_sources) \
			       fuzzer/HttpEcho.cpp
httpecho_fuzzer_LDFLAGS = -fsanitize=fuzzer $(AM_LDFLAGS)

endif # ENABLE_LIBFUZZER

clientnb_SOURCES = net/clientnb.cpp \
                   common/DummyTraceEventEmitter.cpp \
                   common/Log.cpp \
                   common/StringVector.cpp \
                   common/Util.cpp

coolmount_SOURCES = tools/mount.cpp

coolmap_SOURCES = tools/map.cpp

coolconvert_SOURCES = tools/Tool.cpp

coolstress_CPPFLAGS = -DTDOC=\"$(abs_top_srcdir)/test/data\" ${include_paths}
coolstress_SOURCES = tools/Stress.cpp \
                     common/DummyTraceEventEmitter.cpp \
                     $(shared_sources)

coolconfig_SOURCES = tools/Config.cpp \
		     tools/ConfigMigrationAssistant.cpp \
		     common/DummyTraceEventEmitter.cpp \
		     common/Crypto.cpp \
		     common/Log.cpp \
		     common/StringVector.cpp \
		     common/Util.cpp

coolsocketdump_SOURCES = tools/WebSocketDump.cpp \
			 common/DummyTraceEventEmitter.cpp \
			 $(shared_sources)

wsd_headers = wsd/Admin.hpp \
              wsd/AdminModel.hpp \
              wsd/Auth.hpp \
              wsd/ClientSession.hpp \
              wsd/DocumentBroker.hpp \
              wsd/ProxyProtocol.hpp \
              wsd/Exceptions.hpp \
              wsd/FileServer.hpp \
              wsd/ProxyRequestHandler.hpp \
              wsd/COOLWSD.hpp \
              wsd/ProofKey.hpp \
              wsd/RequestDetails.hpp \
              wsd/SenderQueue.hpp \
              wsd/ServerURL.hpp \
              wsd/Storage.hpp \
              wsd/TileCache.hpp \
              wsd/TileDesc.hpp \
              wsd/TraceFile.hpp \
              wsd/UserMessages.hpp \
              wsd/QuarantineUtil.hpp \
              wsd/HostUtil.hpp

shared_headers = common/Common.hpp \
                 common/Clipboard.hpp \
                 common/Crypto.hpp \
                 common/JsonUtil.hpp \
                 common/FileUtil.hpp \
                 common/JailUtil.hpp \
                 common/LangUtil.hpp \
                 common/Log.hpp \
                 common/Protocol.hpp \
                 common/StateEnum.hpp \
                 common/StringVector.hpp \
                 common/Seccomp.hpp \
                 common/Session.hpp \
                 common/Unit.hpp \
                 common/Util.hpp \
                 common/ConfigUtil.hpp \
                 common/Authorization.hpp \
                 common/MessageQueue.hpp \
                 common/Message.hpp \
                 common/MobileApp.hpp \
                 common/Png.hpp \
                 common/TraceEvent.hpp \
                 common/Rectangle.hpp \
                 common/RenderTiles.hpp \
                 common/SigUtil.hpp \
                 common/security.h \
                 common/SpookyV2.h \
                 common/CommandControl.hpp \
                 net/Buffer.hpp \
                 net/DelaySocket.hpp \
                 net/FakeSocket.hpp \
                 net/HttpRequest.hpp \
                 net/HttpHelper.hpp \
                 net/NetUtil.hpp \
                 net/ServerSocket.hpp \
                 net/Socket.hpp \
                 net/WebSocketHandler.hpp \
                 net/WebSocketSession.hpp \
                 tools/Replay.hpp
if ENABLE_SSL
shared_headers += net/Ssl.hpp \
                  net/SslSocket.hpp
endif

kit_headers = kit/ChildSession.hpp \
              kit/Delta.hpp \
              kit/DummyLibreOfficeKit.hpp \
              kit/Kit.hpp \
              kit/KitHelper.hpp \
              kit/SetupKitEnvironment.hpp \
              kit/Watermark.hpp

noinst_HEADERS = $(wsd_headers) $(shared_headers) $(kit_headers) \
                 tools/COOLWebSocket.hpp \
                 test/UnitHTTP.hpp \
                 test/HttpTestServer.hpp \
                 test/WopiTestServer.hpp \
                 test/countcoolkits.hpp \
                 test/lokassert.hpp \
                 test/test.hpp \
                 test/testlog.hpp \
                 test/HttpTestServer.hpp \
                 test/WOPIUploadConflictCommon.hpp \
                 test/UnitWSDClient.hpp \
                 test/helpers.hpp

GIT_BRANCH := $(shell git symbolic-ref --short HEAD)
GIT_HASH := $(shell git log -1 --format=%h)

dist-hook:
	git log -1 --format=%h > $(distdir)/dist_git_hash 2> /dev/null || rm $(distdir)/dist_git_hash
	mkdir -p $(distdir)/bundled/include/LibreOfficeKit/
	cp @LOKIT_PATH@/LibreOfficeKit/LibreOfficeKit.h \
	   @LOKIT_PATH@/LibreOfficeKit/LibreOfficeKit.hxx \
	   @LOKIT_PATH@/LibreOfficeKit/LibreOfficeKitEnums.h \
	   @LOKIT_PATH@/LibreOfficeKit/LibreOfficeKitInit.h \
	   @LOKIT_PATH@/LibreOfficeKit/LibreOfficeKitTypes.h \
	   $(distdir)/bundled/include/LibreOfficeKit/

EXTRA_DIST = discovery.xml \
             favicon.ico \
             coolkitconfig.xcu \
             coolwsd.init.rhel6 \
             coolwsd.spec \
             coolwsd.xml.in \
             coolwsd.service \
             sysconfig.coolwsd \
             debian/compat \
             debian/copyright \
             debian/coolwsd.preinst \
             debian/coolwsd.service \
             debian/rules \
             debian/source/format \
             debian/changelog \
             debian/control \
             debian/coolwsd.postinst \
             debian/coolwsd.postrm \
             etc/key.pem \
             etc/cert.pem \
             etc/ca-chain.cert.pem \
             etc/apache2/coolwsd.conf \
             etc/nginx/coolwsd.conf \
             scripts/unocommands.py \
             scripts/refresh-git-hooks \
             README.md \
             $(man_MANS)

if ENABLE_LIBFUZZER
CLEANUP_COMMAND=true
else
# Use coolwsd to cleanup jails, if any. If it fails, we may have a broken/old coolwsd binary, remove it to rebuild.
# A CI box may switch branches without cleaning up the binaries, if coolwsd from a broken branch is used here
# it will fail all subsequent builds, until it's rebuilt from the new branch. So removing coolwsd after failing is needed.
CLEANUP_COMMAND=if test -s ./coolwsd; then echo "Cleaning up..." && ./coolwsd --disable-cool-user-checking --cleanup --o:logging.level=trace || rm ./coolwsd; fi
endif

if HAVE_LO_PATH

SYSTEM_STAMP = @SYSTEMPLATE_PATH@/system_stamp
CAPABILITIES = $(if @ENABLE_SETCAP@,true,false)
RUN_GDB = $(if $(GDB_FRONTEND),$(GDB_FRONTEND),gdb --tui --args)

if ENABLE_SETCAP
SET_CAPS_COMMAND=sudo @SETCAP@ cap_fowner,cap_chown,cap_mknod,cap_sys_chroot=ep coolforkit && sudo @SETCAP@ cap_sys_admin=ep coolmount
else
SET_CAPS_COMMAND=echo "Skipping capability setting"
endif

if ENABLE_LIBFUZZER
CLEANUP_DEPS=
else
CLEANUP_DEPS=coolwsd coolmount coolforkit
endif

# Build coolwsd and coolmount first, so we can cleanup before updating
# the systemplate directory, which we can't rm if it's mounted.
$(SYSTEM_STAMP): ${top_srcdir}/coolwsd-systemplate-setup $(CLEANUP_DEPS)
	$(SET_CAPS_COMMAND)
	$(CLEANUP_COMMAND)
	if test "z@SYSTEMPLATE_PATH@" != "z"; then chmod u+w -R --silent "@SYSTEMPLATE_PATH@" ; rm -rf "@SYSTEMPLATE_PATH@" && \
	${top_srcdir}/coolwsd-systemplate-setup "@SYSTEMPLATE_PATH@" "@LO_PATH@" && touch $@; fi

@JAILS_PATH@:
	@$(CLEANUP_COMMAND)
	mkdir -p $@

cleanup:
	$(CLEANUP_COMMAND)

# Always cleanup before removing the binaries.
# Note: this can break with -j option!
clean-am: cleanup clean-binPROGRAMS clean-generic clean-libtool clean-local clean-noinstPROGRAMS mostlyclean-am

clean-local:
	$(CLEANUP_COMMAND)
	if test "z@JAILS_PATH@" != "z"; then rm -rf "@JAILS_PATH@"; fi
	if test "z@SYSTEMPLATE_PATH@" != "z"; then rm -rf "@SYSTEMPLATE_PATH@"; fi
	rm -rf "${top_srcdir}/loleaflet"
	rm -rf loolconfig loolconvert loolforkit loolmap loolmount # kill old binaries
	rm -rf loolwsd loolwsd_fuzzer coolwsd_fuzzer loolstress loolsocketdump
	rm -rf ${abs_top_srcdir}/gcov
	find . -iname "*.gc??" -delete

if ENABLE_DEBUG
# can write to /tmp/coolwsd.log
  OUTPUT_TO_FILE=true
else
# can't write to /var/log/coolwsd.log
  OUTPUT_TO_FILE=false
endif

setup-wsd: all @JAILS_PATH@
	@echo "Launching coolwsd"
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@cp $(abs_top_srcdir)/test/data/hello.odt $(abs_top_srcdir)/test/data/hello-world.odt
	@cp $(abs_top_srcdir)/test/data/hello.ods $(abs_top_srcdir)/test/data/hello-world.ods
	@cp $(abs_top_srcdir)/test/data/hello.odp $(abs_top_srcdir)/test/data/hello-world.odp
	@echo

run: setup-wsd
	./coolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			  --o:security.capabilities="$(CAPABILITIES)" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=${OUTPUT_TO_FILE} --o:logging.level=trace \
			  --o:trace_event[@enable]=true

if ENABLE_DEBUG
run-one: setup-wsd
	./coolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			  --o:security.capabilities="$(CAPABILITIES)" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=true --o:logging.level=trace \
			  --singlekit
endif

sync-writer:
	browser-sync start --config browsersync-config.js --startPath "browser/96c23f663/cool.html?file_path=file://$(abs_top_srcdir)/test/data/hello-world.odt"

sync-calc:
	browser-sync start --config browsersync-config.js --startPath "browser/96c23f663/cool.html?file_path=file://$(abs_top_srcdir)/test/data/hello-world.ods"

sync-impress:
	browser-sync start --config browsersync-config.js --startPath "browser/96c23f663/cool.html?file_path=file://$(abs_top_srcdir)/test/data/hello-world.odp"

run-trace: setup-wsd
	./coolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=false --o:logging.level=trace \
                          --o:trace[@enable]=true --o:trace.path=${builddir}/trace.txt.gz \
                          --o:trace.outgoing.record=false

run-valgrind: setup-wsd
	@echo "Launching coolwsd under valgrind (but not forkit/coolkit, yet)"
	valgrind --tool=memcheck --trace-children=no -v --read-var-info=yes \
		./coolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=false --o:logging.level=trace

run-gdb: setup-wsd
	@echo "Launching coolwsd under gdb"
	$(RUN_GDB) \
		./coolwsd --o:security.capabilities="false" \
			  --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=false --o:logging.level=error

run-callgrind: setup-wsd
	@echo "Launching coolwsd under valgrind's callgrind"
	valgrind --tool=callgrind --simulate-cache=yes --dump-instr=yes --num-callers=50 --error-limit=no --trace-children=yes \
		./coolwsd --o:security.capabilities="false" \
			  --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=false --o:logging.level=error

run-strace: setup-wsd
	@echo "Launching coolwsd under strace"
	strace -o strace.log -f -tt -s 256 \
		./coolwsd --o:security.capabilities="false" \
			  --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=false --o:logging.level=error

else

SYSTEM_STAMP =

endif

.PHONY: cleanup setup-wsd

if ENABLE_LIBFUZZER
ALL_LOCAL_DEPS=
else
ALL_LOCAL_DEPS=coolwsd
endif

# After building coolforkit, set its capabilities as required. Do it
# already after a plain 'make' to allow for testing without
# installing. When building for packaging, no need for this, as the
# capabilities won't survive packaging anyway. Instead, handle it when
# installing the RPM or Debian package.
all-local: $(ALL_LOCAL_DEPS) @JAILS_PATH@ $(SYSTEM_STAMP)
	$(SET_CAPS_COMMAND)
	@$(abs_top_srcdir)/scripts/refresh-git-hooks

# just run the build without any tests
build-nocheck: all-am

endif

define file_target
$(1): $(2)

endef

define file_targets
$(foreach file,$(1),$(call file_target,$(file),$(patsubst %.cmd,%.cpp,$(file))))
endef

CLANGXX_COMPILE_FLAGS=clang++ $(DEFS) $(DEFAULT_INCLUDES) $(INCLUDES) \
	$(AM_CPPFLAGS) $(CPPFLAGS) $(AM_CXXFLAGS) $(CXXFLAGS)

JSON_COMPILE_FLAGS=$(subst ",\",$(subst \,\\,$(CLANGXX_COMPILE_FLAGS)))

JSON_COMPILE_SRC = $(patsubst %.cpp,%.cmd,$(wildcard **/*.cpp))

$(eval $(call file_targets,$(JSON_COMPILE_SRC)))

.cpp.cmd:
	@echo -n "{\"directory\":\"$(abs_builddir)\",\"command\":\"" > $@
	@echo -n $(JSON_COMPILE_FLAGS) >> $@
	@echo -n "\",\"file\":\"$<\"}" >> $@

$(abs_srcdir)/compile_commands.json: $(JSON_COMPILE_SRC)
	@echo -n "[" > $@
	@for file in $(JSON_COMPILE_SRC) ; \
	do \
		cat $$file; \
		echo ","; \
		rm -f $$file; \
	done >> $@
	@echo -n "]" >> $@

compile_commands: $(abs_srcdir)/compile_commands.json

browser/node_modules: browser/package.json browser/archived-packages
	@cd browser && npm install

install-exec-hook:
	cd $(DESTDIR)$(bindir) && \
	$(LN_S) coolconfig loolconfig && \
	$(LN_S) coolwsd loolwsd && \
	$(LN_S) coolwsd-systemplate-setup loolwsd-systemplate-setup

stress_file=$(abs_top_srcdir)/test/data/hello-world.odt
trace_dir=$(abs_top_srcdir)/test/traces
stress:
	@cp $(abs_top_srcdir)/test/data/hello.odt $(stress_file)
	@echo "Watch at: https://localhost:9980/browser/12345/cool.html?file_path=$(stress_file)"
	./coolstress wss://localhost:9980 \
		$(stress_file) $(trace_dir)/writer-quick.txt \
		$(stress_file) $(trace_dir)/writer-add-bullet.txt \
		$(stress_file) $(trace_dir)/writer-mash-text-table.txt \
		$(stress_file) $(trace_dir)/writer-document-edit.txt \
		$(stress_file) $(trace_dir)/writer-mash-text-table.txt \
		$(stress_file) $(trace_dir)/writer-hello-shape.txt \
		$(stress_file) $(trace_dir)/writer-quick.txt

if ENABLE_CODE_COVERAGE
GEN_COVERAGE_COMMAND=mkdir -p ${abs_top_srcdir}/gcov && \
lcov --no-external --capture --rc 'lcov_excl_line=' --rc 'lcov_excl_br_line=LOG_|TST_|LOK_|WSD_|TRANSITION|assert' \
--compat libtool=on --directory ${abs_top_srcdir}/. --output-file ${abs_top_srcdir}/gcov/cool.coverage.test.info && \
genhtml --prefix ${abs_top_srcdir}/. --ignore-errors source ${abs_top_srcdir}/gcov/cool.coverage.test.info \
--legend --title "${GIT_BRANCH} @ ${GIT_HASH}" --output-directory=${abs_top_srcdir}/gcov/html && \
echo "Code-Coverage report generated in ${abs_top_srcdir}/gcov/html"
else
GEN_COVERAGE_COMMAND=true
endif

check: check-recursive
	$(GEN_COVERAGE_COMMAND)

coverage-report:
	$(GEN_COVERAGE_COMMAND)

czech: check
	@echo "This should do something much cooler"
