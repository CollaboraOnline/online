SUBDIRS = . test

export ENABLE_DEBUG

bin_PROGRAMS = loolwsd loolforkit loolmap loolmount looltool loolstress

dist_bin_SCRIPTS = loolwsd-systemplate-setup

loolwsddatadir = @LOOLWSD_DATADIR@

loolwsddata_DATA = discovery.xml \
                   favicon.ico \
                   robots.txt

loolwsdconfigdir = @LOOLWSD_CONFIGDIR@

loolwsdconfig_DATA = loolwsd.xml \
                     etc/key.pem

if ENABLE_SSL
loolwsdconfig_DATA += etc/cert.pem \
                      etc/ca-chain.cert.pem
endif

ACLOCAL_AMFLAGS = -I m4

# quick and easy for now.
include_paths = -I${top_srcdir}/common -I${top_srcdir}/wsd -I${top_srcdir}/kit

AM_CPPFLAGS = -pthread -DLOOLWSD_DATADIR='"@LOOLWSD_DATADIR@"' -DLOOLWSD_CONFIGDIR='"@LOOLWSD_CONFIGDIR@"' ${include_paths}
AM_LDFLAGS = -pthread -Wl,-E
loolforkit_LDFLAGS = -pthread -Wl,-E,-rpath,/snap/loolwsd/current/usr/lib
loolmount_LDFLAGS = -pthread -Wl,-E,-rpath,/snap/loolwsd/current/usr/lib

AM_ETAGSFLAGS = --c++-kinds=+p --fields=+iaS --extra=+q -R --totals=yes *
AM_CTAGSFLAGS = $(AM_ETAGSFLAGS)

shared_sources = common/FileUtil.cpp \
                 common/IoUtil.cpp \
                 common/Log.cpp \
                 common/Protocol.cpp \
                 common/Session.cpp \
                 common/MessageQueue.cpp \
                 common/SigUtil.cpp \
                 common/SpookyV2.cpp \
                 common/Unit.cpp \
                 common/UnitHTTP.cpp \
                 common/Util.cpp

loolwsd_SOURCES = wsd/Admin.cpp \
                  wsd/AdminModel.cpp \
                  wsd/Auth.cpp \
                  wsd/DocumentBroker.cpp \
                  wsd/LOOLWSD.cpp \
                  wsd/ClientSession.cpp \
                  wsd/FileServer.cpp \
                  wsd/PrisonerSession.cpp \
                  wsd/Storage.cpp \
                  wsd/TileCache.cpp \
                  $(shared_sources)

noinst_PROGRAMS = connect \
                  lokitclient \
                  loolforkit-nocaps

connect_SOURCES = tools/Connect.cpp \
                  common/Log.cpp \
                  common/Protocol.cpp \
                  common/Util.cpp

lokitclient_SOURCES = common/IoUtil.cpp \
                      common/Log.cpp \
                      tools/KitClient.cpp \
                      common/Protocol.cpp \
                      common/Util.cpp

loolforkit_SOURCES = kit/ChildSession.cpp \
                     kit/ForKit.cpp \
                     kit/Kit.cpp \
                     $(shared_sources)

# build a binary with no caps to help debugging
loolforkit_nocaps_SOURCES = $(loolforkit_SOURCES)

loolmount_SOURCES = tools/mount.cpp

loolmap_SOURCES = tools/map.cpp

looltool_SOURCES = tools/Tool.cpp

loolstress_CPPFLAGS = -DTDOC=\"$(abs_top_srcdir)/test/data\" ${include_paths}
loolstress_SOURCES = tools/Stress.cpp \
                     common/Protocol.cpp \
                     common/Log.cpp

wsd_headers = wsd/Admin.hpp \
              wsd/AdminModel.hpp \
              wsd/Auth.hpp \
              wsd/ClientSession.hpp \
              wsd/DocumentBroker.hpp \
              wsd/Exceptions.hpp \
              wsd/FileServer.hpp \
              wsd/LOOLWebSocket.hpp \
              wsd/LOOLWSD.hpp \
              wsd/PrisonerSession.hpp \
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
                 common/Protocol.hpp \
                 common/Session.hpp \
                 common/Unit.hpp \
                 common/UnitHTTP.hpp \
                 common/Util.hpp \
                 common/MessageQueue.hpp \
                 common/Png.hpp \
                 common/Rectangle.hpp \
                 common/SigUtil.hpp \
                 common/security.h \
                 common/SpookyV2.h

kit_headers = kit/ChildSession.hpp \
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

EXTRA_DIST = discovery.xml \
             favicon.ico \
             loolwsd.xml.in \
             loolwsd.service \
             robots.txt \
             sysconfig.loolwsd \
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
	@cp $(abs_top_srcdir)/test/data/hello.odt $(abs_top_srcdir)/test/data/hello-world.odt
	@echo
	./loolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" --o:lo_template_path="@LO_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:admin_console.username=admin --o:admin_console.password=admin

run-valgrind: all @JAILS_PATH@ @SYSTEMPLATE_PATH@/system_stamp
	@echo "Launching loolwsd under valgrind (but not forkit/loolkit, yet)"
	valgrind --tool=memcheck --trace-children=no -v --read-var-info=yes \
		./loolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" --o:lo_template_path="@LO_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:admin_console.username=admin --o:admin_console.password=admin

run-callgrind: all @JAILS_PATH@ @SYSTEMPLATE_PATH@/system_stamp
	@echo "Launching loolwsd under valgrind (but not forkit/loolkit, yet)"
	valgrind --tool=callgrind --simulate-cache=yes --dump-instr=yes --num-callers=50 --error-limit=no \
		./loolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" --o:lo_template_path="@LO_PATH@" \
			  --o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			  --o:admin_console.username=admin --o:admin_console.password=admin
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
	( cd loleaflet && make )

# just run the build without any tests
build-nocheck: all-am
