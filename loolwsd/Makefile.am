SUBDIRS = . test

bin_PROGRAMS = loolwsd loolforkit loolmap loolmount

dist_bin_SCRIPTS = loolwsd-systemplate-setup discovery.xml

AM_CPPFLAGS = -pthread
AM_LDFLAGS = -pthread -Wl,-E

AM_ETAGSFLAGS = --c++-kinds=+p --fields=+iaS --extra=+q -R --totals=yes *
AM_CTAGSFLAGS = $(AM_ETAGSFLAGS)

shared_sources = ChildProcessSession.cpp \
	  	 IoUtil.cpp \
                 LOOLProtocol.cpp \
                 LOOLSession.cpp \
                 MessageQueue.cpp \
		 Unit.cpp \
                 Util.cpp

loolwsd_SOURCES = Admin.cpp \
		  AdminModel.cpp \
                  Auth.cpp \
                  DocumentBroker.cpp \
                  LOOLWSD.cpp \
                  MasterProcessSession.cpp \
                  Storage.cpp \
                  TileCache.cpp \
                  $(shared_sources)

noinst_PROGRAMS = connect \
                  loadtest \
                  lokitclient

loadtest_SOURCES = LoadTest.cpp \
                   LOOLProtocol.cpp \
                   Util.cpp

connect_SOURCES = Connect.cpp \
                  LOOLProtocol.cpp \
                  Util.cpp

lokitclient_SOURCES = IoUtil.cpp \
                      LOKitClient.cpp \
                      LOOLProtocol.cpp \
                      Util.cpp

loolforkit_SOURCES = LOOLForKit.cpp \
		     LOOLKit.cpp \
                     $(shared_sources)

loolmount_SOURCES = loolmount.c

loolmap_SOURCES = loolmap.c

noinst_HEADERS = Admin.hpp \
                 AdminModel.hpp \
                 Auth.hpp \
                 ChildProcessSession.hpp \
                 Common.hpp \
                 DocumentBroker.hpp \
                 FileServer.hpp \
                 IoUtil.hpp \
                 LoadTest.hpp \
                 LOKitHelper.hpp \
		 LOOLKit.hpp \
                 LOOLProtocol.hpp \
                 LOOLSession.hpp \
                 LOOLWSD.hpp \
                 MasterProcessSession.hpp \
                 MessageQueue.hpp \
                 Png.hpp \
                 QueueHandler.hpp \
                 Rectangle.hpp \
                 Storage.hpp \
                 TileCache.hpp \
		 Unit.hpp \
	         UnitHTTP.hpp \
                 Util.hpp \
                 bundled/include/LibreOfficeKit/LibreOfficeKit.h \
                 bundled/include/LibreOfficeKit/LibreOfficeKitEnums.h \
                 bundled/include/LibreOfficeKit/LibreOfficeKitInit.h \
                 bundled/include/LibreOfficeKit/LibreOfficeKitTypes.h

EXTRA_DIST = discovery.xml \
             loolwsd.service \
             sysconfig.loolwsd

if HAVE_LO_PATH

SYSTEM_STAMP = @SYSTEMPLATE_PATH@/system_stamp

$(SYSTEM_STAMP) :
	if test "z@SYSTEMPLATE_PATH@" != "z"; then rm -rf "@SYSTEMPLATE_PATH@"; fi
	${top_srcdir}/loolwsd-systemplate-setup "@SYSTEMPLATE_PATH@" "@LO_PATH@" && touch $@

@JAILS_PATH@ :
	mkdir -p $@

clean-local:
	if test "z@JAILS_PATH@" != "z"; then rm -rf "@JAILS_PATH@"; fi
	if test "z@SYSTEMPLATE_PATH@" != "z"; then rm -rf "@SYSTEMPLATE_PATH@"; fi

run: @JAILS_PATH@ @SYSTEMPLATE_PATH@/system_stamp
	@echo "Launching loolwsd - launch this in your browser:"
	@echo "   https://localhost:9980/loleaflet/dist/loleaflet.html?file_path=file://$(abs_top_srcdir)/test/data/hello.odt&host=wss://localhost:9980"
	./loolwsd --systemplate="@SYSTEMPLATE_PATH@" --lotemplate="@LO_PATH@" \
                  --childroot="@JAILS_PATH@" --allowlocalstorage
else

SYSTEM_STAMP =

endif

clean-cache:
# Intentionally don't use "*" below... Avoid risk of accidentally running rm -rf /*
	test -n "@LOOLWSD_CACHEDIR@" && rm -rf "@LOOLWSD_CACHEDIR@"/[0-9a-f]

# After building loolforkit, set its capabilities as required. Do it
# already after a plain 'make' to allow for testing without
# installing. When building for packaging, no need for this, as the
# capabilities won't survive packaging anyway. Instead, handle it when
# installing the RPM or Debian package.

all-local: loolforkit certificates @JAILS_PATH@ $(SYSTEM_STAMP)
	if test "$$BUILDING_FROM_RPMBUILD" != yes; then \
	    sudo @SETCAP@ cap_fowner,cap_mknod,cap_sys_chroot=ep loolforkit; \
	    sudo @SETCAP@ cap_sys_admin=ep loolmount; \
	    echo "Set required capabilities"; \
	else \
	    echo "Skipping capability setting"; \
	fi

certificates: etc/cert.pem etc/key.pem etc/CollaboraCloudSuiteCA_ca-chain.cert.pem
	if test "$$BUILDING_FROM_RPMBUILD" != yes; then \
	    sudo mkdir -p /etc/loolwsd ; \
	    sudo cp $? /etc/loolwsd/ ; \
	fi
