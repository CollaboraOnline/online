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
                 Util.cpp

loolwsd_SOURCES = Admin.cpp \
		  AdminModel.cpp \
                  Auth.cpp \
                  DocumentBroker.cpp \
                  LOOLWSD.cpp \
                  MasterProcessSession.cpp \
                  Storage.cpp \
                  TileCache.cpp \
		  Unit.cpp \
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

clean-cache:
# Intentionally don't use "*" below... Avoid risk of accidentally running rm -rf /*
	test -n "@LOOLWSD_CACHEDIR@" && rm -rf "@LOOLWSD_CACHEDIR@"/[0-9a-f]

# After building loolforkit, set its capabilities as required. Do it
# already after a plain 'make' to allow for testing without
# installing. When building for packaging, no need for this, as the
# capabilities won't survive packaging anyway. Instead, handle it when
# installing the RPM or Debian package.

all-local: loolforkit certificates
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
