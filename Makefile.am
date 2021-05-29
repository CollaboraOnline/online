ETAGS=ctags -e

if ENABLE_MOBILEAPP

if ENABLE_GTKAPP
SUBDIRS = gtk loleaflet
else
SUBDIRS = loleaflet
endif

else

SUBDIRS = . loleaflet test cypress_test

export ENABLE_DEBUG

bin_PROGRAMS = \
	loolforkit \
	loolmount \
	loolconvert loolconfig

if ENABLE_LIBFUZZER
else
bin_PROGRAMS += loolwsd
endif

dist_bin_SCRIPTS = loolwsd-systemplate-setup \
                   loolwsd-generate-proof-key

man_MANS = man/loolwsd.1 \
           man/loolforkit.1 \
           man/loolconvert.1 \
           man/loolconfig.1 \
           man/loolwsd-systemplate-setup.1 \
           man/loolwsd-generate-proof-key.1

dist_doc_DATA = wsd/README \
                wsd/README.vars \
                wsd/protocol.txt \
                wsd/reference.md \
                wsd/metrics.txt \
                EULA

loolwsddatadir = @LOOLWSD_DATADIR@

loolwsddata_DATA = discovery.xml \
                   favicon.ico

loolwsdconfigdir = @LOOLWSD_CONFIGDIR@

loolwsdconfig_DATA = loolwsd.xml \
		     loolkitconfig.xcu

apache2configdir = ${sysconfdir}/apache2/conf-available

apache2config_DATA = etc/apache2/loolwsd.conf

nginxconfigdir = ${sysconfdir}/nginx/snippets

nginxconfig_DATA = etc/nginx/loolwsd.conf

ACLOCAL_AMFLAGS = -I m4

# quick and easy for now.
include_paths = -I${top_srcdir}/common -I${top_srcdir}/net -I${top_srcdir}/wsd -I${top_srcdir}/kit ${ZLIB_CFLAGS}

AM_CPPFLAGS = -pthread -DLOOLWSD_DATADIR='"@LOOLWSD_DATADIR@"' \
	      -DLOOLWSD_CONFIGDIR='"@LOOLWSD_CONFIGDIR@"' \
	      -DDEBUG_ABSSRCDIR='"@abs_srcdir@"' \
	      ${include_paths}

if !ENABLE_DEBUG
AM_CPPFLAGS += -DNDEBUG
endif

AM_LDFLAGS = -pthread -Wl,-E,-rpath,/snap/loolwsd/current/usr/lib -lpam $(ZLIB_LIBS)

if ENABLE_SSL
AM_LDFLAGS += -lssl -lcrypto
else
loolwsd_fuzzer_LDADD = -lssl -lcrypto
loolwsd_LDADD = -lssl -lcrypto
loolconfig_LDADD = -lssl -lcrypto
endif

loolwsd_fuzzer_CPPFLAGS = -DKIT_IN_PROCESS=1 -DFUZZER=1 -DTDOC=\"$(abs_top_srcdir)/test/data\" $(AM_CPPFLAGS)

AM_ETAGSFLAGS = --c++-kinds=+p --fields=+iaS --extra=+q -R --totals=yes --exclude=loleaflet *
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
                 common/Freemium.cpp \
                 net/DelaySocket.cpp \
                 net/HttpRequest.cpp \
                 net/HttpHelper.cpp \
                 net/NetUtil.cpp \
                 net/Socket.cpp
if ENABLE_SSL
shared_sources += net/Ssl.cpp
endif

shared_json = $(patsubst %.cpp,%.cmd,$(shared_sources))

loolwsd_sources = common/Crypto.cpp \
                  wsd/Admin.cpp \
                  wsd/AdminModel.cpp \
                  wsd/Auth.cpp \
                  wsd/DocumentBroker.cpp \
                  wsd/ProxyProtocol.cpp \
                  wsd/LOOLWSD.cpp \
                  wsd/ClientSession.cpp \
                  wsd/FileServer.cpp \
                  wsd/FileServerUtil.cpp \
                  wsd/RequestDetails.cpp \
                  wsd/Storage.cpp \
                  wsd/TileCache.cpp \
                  wsd/ProofKey.cpp

loolwsd_json = $(patsubst %.cpp,%.cmd,$(loolwsd_sources))

loolwsd_SOURCES = $(loolwsd_sources) \
                  $(shared_sources)

EXTRA_loolwsd_DEPENDENCIES = loleaflet/node_modules

noinst_PROGRAMS = clientnb \
                  connect \
                  lokitclient \
                  loolmap \
                  loolstress \
                  loolsocketdump

if ENABLE_LIBFUZZER
noinst_PROGRAMS += \
		   admin_fuzzer \
		   clientsession_fuzzer \
		   httpresponse_fuzzer
else
noinst_PROGRAMS += loolwsd_fuzzer
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

loolforkit_sources = kit/ChildSession.cpp \
                     kit/ForKit.cpp \
                     kit/Kit.cpp

loolforkit_json = $(patsubst %.cpp,%.cmd,$(loolforkit_sources))

loolforkit_SOURCES = $(loolforkit_sources) \
                     $(shared_sources)

loolwsd_fuzzer_SOURCES = $(loolwsd_sources) \
                         $(loolforkit_sources) \
                         $(shared_sources) \
                         kit/DummyLibreOfficeKit.cpp

admin_fuzzer_CPPFLAGS = \
			-DKIT_IN_PROCESS=1 \
			$(AM_CPPFLAGS)
admin_fuzzer_SOURCES = \
		       $(loolwsd_sources) \
		       $(loolforkit_sources) \
		       $(shared_sources) \
		       fuzzer/Admin.cpp
admin_fuzzer_LDFLAGS = -fsanitize=fuzzer $(AM_LDFLAGS)

clientsession_fuzzer_CPPFLAGS = \
				-DKIT_IN_PROCESS=1 \
				$(AM_CPPFLAGS)
clientsession_fuzzer_SOURCES = \
			       $(loolwsd_sources) \
			       $(loolforkit_sources) \
			       $(shared_sources) \
			       fuzzer/ClientSession.cpp
clientsession_fuzzer_LDFLAGS = -fsanitize=fuzzer $(AM_LDFLAGS)

httpresponse_fuzzer_CPPFLAGS = \
				-DKIT_IN_PROCESS=1 \
				$(AM_CPPFLAGS)
httpresponse_fuzzer_SOURCES = \
			       $(loolwsd_sources) \
			       $(loolforkit_sources) \
			       $(shared_sources) \
			       fuzzer/HttpResponse.cpp
httpresponse_fuzzer_LDFLAGS = -fsanitize=fuzzer $(AM_LDFLAGS)

clientnb_SOURCES = net/clientnb.cpp \
                   common/DummyTraceEventEmitter.cpp \
                   common/Log.cpp \
                   common/StringVector.cpp \
                   common/Util.cpp

loolmount_SOURCES = tools/mount.cpp

loolmap_SOURCES = tools/map.cpp

loolconvert_SOURCES = tools/Tool.cpp

loolstress_CPPFLAGS = -DTDOC=\"$(abs_top_srcdir)/test/data\" ${include_paths}
loolstress_SOURCES = tools/Stress.cpp \
                     common/DummyTraceEventEmitter.cpp \
                     common/Protocol.cpp \
                     common/StringVector.cpp \
                     common/Log.cpp \
                     common/Util.cpp

loolconfig_SOURCES = tools/Config.cpp \
		     common/DummyTraceEventEmitter.cpp \
		     common/Crypto.cpp \
		     common/Log.cpp \
		     common/StringVector.cpp \
		     common/Util.cpp

loolsocketdump_SOURCES = tools/WebSocketDump.cpp \
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
              wsd/LOOLWSD.hpp \
              wsd/ProofKey.hpp \
              wsd/RequestDetails.hpp \
              wsd/SenderQueue.hpp \
              wsd/ServerURL.hpp \
              wsd/Storage.hpp \
              wsd/TileCache.hpp \
              wsd/TileDesc.hpp \
              wsd/TraceFile.hpp \
              wsd/UserMessages.hpp

shared_headers = common/Common.hpp \
                 common/Clipboard.hpp \
                 common/Crypto.hpp \
                 common/JsonUtil.hpp \
                 common/FileUtil.hpp \
                 common/JailUtil.hpp \
                 common/Log.hpp \
                 common/LOOLWebSocket.hpp \
                 common/Protocol.hpp \
                 common/StringVector.hpp \
                 common/Seccomp.hpp \
                 common/Session.hpp \
                 common/Unit.hpp \
                 common/UnitHTTP.hpp \
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
                 common/Freemium.hpp \
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
                 test/HttpTestServer.hpp \
                 test/WopiTestServer.hpp \
                 test/countloolkits.hpp \
                 test/lokassert.hpp \
                 test/test.hpp \
                 test/testlog.hpp \
                 test/HttpTestServer.hpp \
                 test/helpers.hpp

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
             loolkitconfig.xcu \
             loolwsd.init.rhel6 \
             loolwsd.spec \
             loolwsd.xml.in \
             loolwsd.service \
             sysconfig.loolwsd \
             debian/compat \
             debian/copyright \
             debian/loolwsd.preinst \
             debian/loolwsd.service \
             debian/rules \
             debian/source/format \
             debian/changelog \
             debian/control \
             debian/loolwsd.postinst \
             debian/loolwsd.postrm \
             etc/key.pem \
             etc/cert.pem \
             etc/ca-chain.cert.pem \
             etc/apache2/loolwsd.conf \
             etc/nginx/loolwsd.conf \
             scripts/unocommands.py \
             scripts/refresh-git-hooks \
             README.md \
             $(man_MANS)

if ENABLE_LIBFUZZER
CLEANUP_COMMAND=true
else
# Use loolwsd to cleanup jails, if any. If it fails, we may have a broken/old loolwsd binary, remove it to rebuild.
# A CI box may switch branches without cleaning up the binaries, if loolwsd from a broken branch is used here
# it will fail all subsequent builds, until it's rebuilt from the new branch. So removing loolwsd after failing is needed.
CLEANUP_COMMAND=if test -s ./loolwsd; then echo "Cleaning up..." && ./loolwsd --disable-lool-user-checking --cleanup --o:logging.level=trace || rm ./loolwsd; fi
endif

if HAVE_LO_PATH

SYSTEM_STAMP = @SYSTEMPLATE_PATH@/system_stamp
CAPABILITIES = $(if @ENABLE_SETCAP@,true,false)
RUN_GDB = $(if $(GDB_FRONTEND),$(GDB_FRONTEND),gdb --tui --args)

if ENABLE_SETCAP
SET_CAPS_COMMAND=sudo @SETCAP@ cap_fowner,cap_chown,cap_mknod,cap_sys_chroot=ep loolforkit && sudo @SETCAP@ cap_sys_admin=ep loolmount
else
SET_CAPS_COMMAND=echo "Skipping capability setting"
endif

if ENABLE_LIBFUZZER
CLEANUP_DEPS=
else
CLEANUP_DEPS=loolwsd loolmount loolforkit
endif

# Build loolwsd and loolmount first, so we can cleanup before updating
# the systemplate directory, which we can't rm if it's mounted.
$(SYSTEM_STAMP): ${top_srcdir}/loolwsd-systemplate-setup $(CLEANUP_DEPS)
	$(SET_CAPS_COMMAND)
	$(CLEANUP_COMMAND)
	if test "z@SYSTEMPLATE_PATH@" != "z"; then rm -rf "@SYSTEMPLATE_PATH@" && \
	${top_srcdir}/loolwsd-systemplate-setup "@SYSTEMPLATE_PATH@" "@LO_PATH@" && touch $@; fi

@JAILS_PATH@:
	$(CLEANUP_COMMAND)
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

if ENABLE_DEBUG
# can write to /tmp/loolwsd.log
  OUTPUT_TO_FILE=true
else
# can't write to /var/log/loolwsd.log
  OUTPUT_TO_FILE=false
endif

run: all @JAILS_PATH@
	@echo "Launching loolwsd"
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@cp $(abs_top_srcdir)/test/data/hello.odt $(abs_top_srcdir)/test/data/hello-world.odt
	@cp $(abs_top_srcdir)/test/data/hello.ods $(abs_top_srcdir)/test/data/hello-world.ods
	@cp $(abs_top_srcdir)/test/data/hello.odp $(abs_top_srcdir)/test/data/hello-world.odp
	@echo
	./loolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			  --o:security.capabilities="$(CAPABILITIES)" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=${OUTPUT_TO_FILE} --o:logging.level=trace \
			  --o:trace_event[@enable]=true

if ENABLE_DEBUG
run-one: all @JAILS_PATH@
	@echo "Launching loolwsd"
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@cp $(abs_top_srcdir)/test/data/hello.odt $(abs_top_srcdir)/test/data/hello-world.odt
	@cp $(abs_top_srcdir)/test/data/hello.ods $(abs_top_srcdir)/test/data/hello-world.ods
	@cp $(abs_top_srcdir)/test/data/hello.odp $(abs_top_srcdir)/test/data/hello-world.odp
	@echo
	./loolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" \
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
	browser-sync start --config browsersync-config.js --startPath "loleaflet/96c23f663/loleaflet.html?file_path=file://$(abs_top_srcdir)/test/data/hello-world.odt"

sync-calc:
	browser-sync start --config browsersync-config.js --startPath "loleaflet/96c23f663/loleaflet.html?file_path=file://$(abs_top_srcdir)/test/data/hello-world.ods"

sync-impress:
	browser-sync start --config browsersync-config.js --startPath "loleaflet/96c23f663/loleaflet.html?file_path=file://$(abs_top_srcdir)/test/data/hello-world.odp"

run-valgrind: all @JAILS_PATH@
	@echo "Launching loolwsd under valgrind (but not forkit/loolkit, yet)"
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@cp $(abs_top_srcdir)/test/data/hello.odt $(abs_top_srcdir)/test/data/hello-world.odt
	@cp $(abs_top_srcdir)/test/data/hello.ods $(abs_top_srcdir)/test/data/hello-world.ods
	@cp $(abs_top_srcdir)/test/data/hello.odp $(abs_top_srcdir)/test/data/hello-world.odp
	valgrind --tool=memcheck --trace-children=no -v --read-var-info=yes \
		./loolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=false --o:logging.level=trace

run-gdb: all @JAILS_PATH@
	@echo "Launching loolwsd under gdb"
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@cp $(abs_top_srcdir)/test/data/hello.odt $(abs_top_srcdir)/test/data/hello-world.odt
	@cp $(abs_top_srcdir)/test/data/hello.ods $(abs_top_srcdir)/test/data/hello-world.ods
	@cp $(abs_top_srcdir)/test/data/hello.odp $(abs_top_srcdir)/test/data/hello-world.odp
	$(RUN_GDB) \
		./loolwsd --o:security.capabilities="false" \
			  --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=false --o:logging.level=error

run-callgrind: all @JAILS_PATH@
	@echo "Launching loolwsd under valgrind's callgrind"
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@cp $(abs_top_srcdir)/test/data/hello.odt $(abs_top_srcdir)/test/data/hello-world.odt
	@cp $(abs_top_srcdir)/test/data/hello.ods $(abs_top_srcdir)/test/data/hello-world.ods
	@cp $(abs_top_srcdir)/test/data/hello.odp $(abs_top_srcdir)/test/data/hello-world.odp
	valgrind --tool=callgrind --simulate-cache=yes --dump-instr=yes --num-callers=50 --error-limit=no --trace-children=yes \
		./loolwsd --o:security.capabilities="false" \
			  --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=false --o:logging.level=error

run-strace: all @JAILS_PATH@
	@echo "Launching loolwsd under strace"
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@cp $(abs_top_srcdir)/test/data/hello.odt $(abs_top_srcdir)/test/data/hello-world.odt
	@cp $(abs_top_srcdir)/test/data/hello.ods $(abs_top_srcdir)/test/data/hello-world.ods
	@cp $(abs_top_srcdir)/test/data/hello.odp $(abs_top_srcdir)/test/data/hello-world.odp
	strace -o strace.log -f -tt -s 256 \
		./loolwsd --o:security.capabilities="false" \
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

.PHONY: cleanup

if ENABLE_LIBFUZZER
ALL_LOCAL_DEPS=
else
ALL_LOCAL_DEPS=loolwsd
endif

# After building loolforkit, set its capabilities as required. Do it
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

JSON_COMPILE_SRC = $(loolwsd_json) $(loolforkit_json) $(shared_json)

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

loleaflet/node_modules: loleaflet/package.json loleaflet/archived-packages
	@cd loleaflet && npm install
