SUBDIRS = test

bin_PROGRAMS = loolwsd loolbroker loolkit loolmap

dist_bin_SCRIPTS = loolwsd-systemplate-setup discovery.xml

AM_CPPFLAGS = -pthread
AM_LDFLAGS = -pthread

AM_ETAGSFLAGS = --c++-kinds=+p --fields=+iaS --extra=+q -R --totals=yes *
AM_CTAGSFLAGS = $(AM_ETAGSFLAGS)

shared_sources = LOOLProtocol.cpp LOOLSession.cpp MessageQueue.cpp Util.cpp

loolwsd_SOURCES = LOOLWSD.cpp ChildProcessSession.cpp MasterProcessSession.cpp TileCache.cpp Admin.cpp $(shared_sources)

noinst_PROGRAMS = loadtest connect lokitclient

loadtest_SOURCES = LoadTest.cpp Util.cpp LOOLProtocol.cpp

connect_SOURCES = Connect.cpp Util.cpp LOOLProtocol.cpp

lokitclient_SOURCES = LOKitClient.cpp Util.cpp

broker_shared_sources = ChildProcessSession.cpp $(shared_sources)

loolkit_SOURCES = LOOLKit.cpp $(broker_shared_sources)

loolbroker_SOURCES = LOOLBroker.cpp $(broker_shared_sources)

loolmap_SOURCES = loolmap.c

noinst_HEADERS = LOKitHelper.hpp LOOLProtocol.hpp LOOLSession.hpp MasterProcessSession.hpp ChildProcessSession.hpp \
                 LOOLWSD.hpp LoadTest.hpp MessageQueue.hpp TileCache.hpp Util.hpp Png.hpp Common.hpp Capabilities.hpp \
                 Rectangle.hpp QueueHandler.hpp Admin.hpp Auth.hpp Storage.hpp AdminModel.hpp DocumentBroker.hpp \
                 bundled/include/LibreOfficeKit/LibreOfficeKit.h bundled/include/LibreOfficeKit/LibreOfficeKitEnums.h \
                 bundled/include/LibreOfficeKit/LibreOfficeKitInit.h bundled/include/LibreOfficeKit/LibreOfficeKitTypes.h

EXTRA_DIST = loolwsd.service sysconfig.loolwsd discovery.xml

clean-cache:
# Intentionally don't use "*" below... Avoid risk of accidentally running rm -rf /*
	test -n "@LOOLWSD_CACHEDIR@" && rm -rf "@LOOLWSD_CACHEDIR@"/[0-9a-f]

# After building loolbroker and loolkit, set their capabilities as
# required. Do it already after a plain 'make' to allow for testing
# without installing. When building for packaging, no need for this,
# as the capabilities won't survive packaging anyway. Instead, handle
# it when installing the RPM or Debian package.

all-local: loolbroker loolkit
	if test "$$BUILDING_FROM_RPMBUILD" != yes; then \
	    sudo @SETCAP@ cap_fowner,cap_mknod,cap_sys_chroot=ep loolbroker; \
	    sudo @SETCAP@ cap_fowner,cap_mknod,cap_sys_chroot=ep loolkit; \
	fi
