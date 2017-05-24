SUBDIRS = . test loleaflet

export ENABLE_DEBUG

bin_PROGRAMS = loolwsd loolforkit loolmap loolmount looltool loolstress loolconfig

dist_bin_SCRIPTS = loolwsd-systemplate-setup

dist_doc_DATA = wsd/README \
                wsd/README.vars \
                wsd/protocol.txt \
                wsd/reference.txt

loolwsddatadir = @LOOLWSD_DATADIR@

loolwsddata_DATA = discovery.xml \
                   favicon.ico \
                   robots.txt

loolwsdconfigdir = @LOOLWSD_CONFIGDIR@

loolwsdconfig_DATA = loolwsd.xml \
		     loolkitconfig.xcu

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

AM_LDFLAGS = -pthread -Wl,-E,-rpath,/snap/loolwsd/current/usr/lib $(ZLIB_LIBS)

if ENABLE_SSL
AM_LDFLAGS += -lssl -lcrypto
endif

loolwsd_fuzzer_CPPFLAGS = -DKIT_IN_PROCESS=1 -DFUZZER=1 -DTDOC=\"$(abs_top_srcdir)/test/data\" $(AM_CPPFLAGS)

AM_ETAGSFLAGS = --c++-kinds=+p --fields=+iaS --extra=+q -R --totals=yes --exclude=loleaflet *
AM_CTAGSFLAGS = $(AM_ETAGSFLAGS)

shared_sources = common/FileUtil.cpp \
                 common/IoUtil.cpp \
                 common/Log.cpp \
                 common/Protocol.cpp \
                 common/Session.cpp \
                 common/Seccomp.cpp \
                 common/MessageQueue.cpp \
                 common/SigUtil.cpp \
                 common/SpookyV2.cpp \
                 common/Unit.cpp \
                 common/UnitHTTP.cpp \
                 common/Util.cpp \
                 net/Socket.cpp
if ENABLE_SSL
shared_sources += net/Ssl.cpp
endif

loolwsd_sources = wsd/Admin.cpp \
                  wsd/AdminModel.cpp \
                  wsd/Auth.cpp \
                  wsd/DocumentBroker.cpp \
                  wsd/LOOLWSD.cpp \
                  wsd/ClientSession.cpp \
                  wsd/FileServer.cpp \
                  wsd/Storage.cpp \
                  wsd/TileCache.cpp

loolwsd_SOURCES = $(loolwsd_sources) \
                  $(shared_sources)

noinst_PROGRAMS = clientnb \
                  connect \
                  lokitclient \
                  loolforkit-nocaps \
                  loolwsd_fuzzer

connect_SOURCES = tools/Connect.cpp \
                  common/Log.cpp \
                  common/Protocol.cpp \
                  common/Util.cpp

lokitclient_SOURCES = common/IoUtil.cpp \
                      common/Log.cpp \
                      tools/KitClient.cpp \
                      common/Protocol.cpp \
                      common/Util.cpp

loolforkit_sources = kit/ChildSession.cpp \
                     kit/ForKit.cpp \
                     kit/Kit.cpp

loolforkit_SOURCES = $(loolforkit_sources) \
                     $(shared_sources)

loolwsd_fuzzer_SOURCES = $(loolwsd_sources) \
                         $(loolforkit_sources) \
                         $(shared_sources) \
                         kit/DummyLibreOfficeKit.cpp

loolnb_SOURCES = net/loolnb.cpp \
                 net/Socket.cpp \
                 common/Log.cpp \
                 common/SigUtil.cpp \
                 common/Util.cpp
if ENABLE_SSL
loolnb_SOURCES += net/Ssl.cpp
endif

clientnb_SOURCES = net/clientnb.cpp \
                   common/Log.cpp \
                   common/Util.cpp

# build a binary with no caps to help debugging
loolforkit_nocaps_SOURCES = $(loolforkit_SOURCES)

loolmount_SOURCES = tools/mount.cpp

loolmap_SOURCES = tools/map.cpp

looltool_SOURCES = tools/Tool.cpp

loolstress_CPPFLAGS = -DTDOC=\"$(abs_top_srcdir)/test/data\" ${include_paths}
loolstress_SOURCES = tools/Stress.cpp \
                     common/Protocol.cpp \
                     common/Log.cpp \
		     common/Util.cpp

loolconfig_SOURCES = tools/Config.cpp

wsd_headers = wsd/Admin.hpp \
              wsd/AdminModel.hpp \
              wsd/Auth.hpp \
              wsd/ClientSession.hpp \
              wsd/DocumentBroker.hpp \
              wsd/Exceptions.hpp \
              wsd/FileServer.hpp \
              wsd/LOOLWSD.hpp \
              wsd/QueueHandler.hpp \
              wsd/SenderQueue.hpp \
              wsd/Storage.hpp \
              wsd/TileCache.hpp \
              wsd/TileDesc.hpp \
              wsd/TraceFile.hpp \
              wsd/UserMessages.hpp

shared_headers = common/Common.hpp \
                 common/IoUtil.hpp \
                 common/FileUtil.hpp \
                 common/Log.hpp \
                 common/LOOLWebSocket.hpp \
                 common/Protocol.hpp \
                 common/Seccomp.hpp \
                 common/Session.hpp \
                 common/Unit.hpp \
                 common/UnitHTTP.hpp \
                 common/Util.hpp \
                 common/MessageQueue.hpp \
                 common/Message.hpp \
                 common/Png.hpp \
                 common/Rectangle.hpp \
                 common/SigUtil.hpp \
                 common/security.h \
                 common/SpookyV2.h \
                 net/ServerSocket.hpp \
                 net/Socket.hpp \
                 net/WebSocketHandler.hpp \
                 tools/Replay.hpp
if ENABLE_SSL
shared_headers += net/Ssl.hpp \
                  net/SslSocket.hpp
endif

kit_headers = kit/ChildSession.hpp \
              kit/DummyLibreOfficeKit.hpp \
              kit/Kit.hpp \
              kit/KitHelper.hpp

noinst_HEADERS = $(wsd_headers) $(shared_headers) $(kit_headers) \
                 bundled/include/LibreOfficeKit/LibreOfficeKit.h \
                 bundled/include/LibreOfficeKit/LibreOfficeKit.hxx \
                 bundled/include/LibreOfficeKit/LibreOfficeKitEnums.h \
                 bundled/include/LibreOfficeKit/LibreOfficeKitInit.h \
                 bundled/include/LibreOfficeKit/LibreOfficeKitTypes.h \
                 test/countloolkits.hpp \
                 test/helpers.hpp

dist-hook:
	git log -1 --format=%h > $(distdir)/dist_git_hash 2> /dev/null || rm $(distdir)/dist_git_hash

EXTRA_DIST = discovery.xml \
             favicon.ico \
             loolkitconfig.xcu \
             loolwsd.spec \
             loolwsd.xml.in \
             loolwsd.service \
             robots.txt \
             sysconfig.loolwsd \
             debian/compat \
             debian/copyright \
             debian/loolwsd.cron.d \
             debian/loolwsd.preinst \
             debian/loolwsd.service \
             debian/rules \
             debian/source/format \
             debian/changelog \
             debian/control \
             debian/loolwsd.postinst \
             etc/key.pem \
             etc/cert.pem \
             etc/ca-chain.cert.pem

if HAVE_LO_PATH

SYSTEM_STAMP = @SYSTEMPLATE_PATH@/system_stamp

$(SYSTEM_STAMP) : ${top_srcdir}/loolwsd-systemplate-setup
	if test "z@SYSTEMPLATE_PATH@" != "z"; then rm -rf "@SYSTEMPLATE_PATH@"; fi
	${top_srcdir}/loolwsd-systemplate-setup "@SYSTEMPLATE_PATH@" "@LO_PATH@" && touch $@

@JAILS_PATH@ :
	mkdir -p $@

clean-local:
	if test "z@JAILS_PATH@" != "z"; then rm -rf "@JAILS_PATH@"; fi
	if test "z@SYSTEMPLATE_PATH@" != "z"; then rm -rf "@SYSTEMPLATE_PATH@"; fi

run: all @JAILS_PATH@ @SYSTEMPLATE_PATH@/system_stamp
	@echo "Launching loolwsd"
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@cp $(abs_top_srcdir)/test/data/hello.odt $(abs_top_srcdir)/test/data/hello-world.odt
	@echo
	./loolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" --o:lo_template_path="@LO_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=true --o:logging.level=trace

run-valgrind: all @JAILS_PATH@ @SYSTEMPLATE_PATH@/system_stamp
	@echo "Launching loolwsd under valgrind (but not forkit/loolkit, yet)"
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@cp $(abs_top_srcdir)/test/data/hello.odt $(abs_top_srcdir)/test/data/hello-world.odt
	valgrind --tool=memcheck --trace-children=no -v --read-var-info=yes \
		./loolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" --o:lo_template_path="@LO_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=false --o:logging.level=trace

run-callgrind: all @JAILS_PATH@ @SYSTEMPLATE_PATH@/system_stamp
	@echo "Launching loolwsd under valgrind's callgrind"
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@cp $(abs_top_srcdir)/test/data/hello.odt $(abs_top_srcdir)/test/data/hello-world.odt
	valgrind --tool=callgrind --simulate-cache=yes --dump-instr=yes --num-callers=50 --error-limit=no --trace-children=yes \
		./loolwsd --nocaps \
			  --o:sys_template_path="@SYSTEMPLATE_PATH@" --o:lo_template_path="@LO_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			  --o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			  --o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			  --o:admin_console.username=admin --o:admin_console.password=admin \
			  --o:logging.file[@enable]=false --o:logging.level=error
else

SYSTEM_STAMP =

endif

clean-cache cache-clean:
# Intentionally don't use "*" below... Avoid risk of accidentally running rm -rf /*
	test -n "@LOOLWSD_CACHEDIR@" && rm -rf "@LOOLWSD_CACHEDIR@"/[0-9a-f]

clang-tidy:
	for i in {common,kit,tools,wsd}/*.cpp; do echo $$i; clang-tidy -header-filter=^$(PWD).* $$i || break; done

# After building loolforkit, set its capabilities as required. Do it
# already after a plain 'make' to allow for testing without
# installing. When building for packaging, no need for this, as the
# capabilities won't survive packaging anyway. Instead, handle it when
# installing the RPM or Debian package.

all-local: loolforkit @JAILS_PATH@ $(SYSTEM_STAMP)
	@if test "$$BUILDING_FROM_RPMBUILD" != yes; then \
	    sudo @SETCAP@ cap_fowner,cap_mknod,cap_sys_chroot=ep loolforkit; \
	    sudo @SETCAP@ cap_sys_admin=ep loolmount; \
	    echo "Set required capabilities"; \
	else \
	    echo "Skipping capability setting"; \
	fi

# just run the build without any tests
build-nocheck: all-am
