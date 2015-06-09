bin_PROGRAMS = loolwsd

dist_bin_SCRIPTS = loolwsd-systemplate-setup

loolwsd_SOURCES = LOOLWSD.cpp LOOLSession.cpp TileCache.cpp Util.cpp LOOLProtocol.cpp

noinst_PROGRAMS = loadtest connect lokitclient

loadtest_SOURCES = LoadTest.cpp Util.cpp LOOLProtocol.cpp

connect_SOURCES = Connect.cpp Util.cpp LOOLProtocol.cpp

lokitclient_SOURCES = LOKitClient.cpp Util.cpp

noinst_HEADERS = LOKitHelper.hpp LOOLProtocol.hpp LOOLSession.hpp LOOLWSD.hpp LoadTest.hpp TileCache.hpp Util.hpp \
                 tsqueue.h \
                 bundled/include/LibreOfficeKit/LibreOfficeKit.h bundled/include/LibreOfficeKit/LibreOfficeKitEnums.h \
                 bundled/include/LibreOfficeKit/LibreOfficeKitInit.h bundled/include/LibreOfficeKit/LibreOfficeKitTypes.h

clean-cache:
# Intentionally don't use "*" below... Avoid risk of accidentally running rm -rf /*
	test -n "@LOOLWSD_CACHEDIR@" && rm -rf "@LOOLWSD_CACHEDIR@"/[0-9a-f]

# After building loolwsd, set its capabilities to allow chroot(). Dot
# it already after a plain 'make' to allow for testing without
# installing.
all-local: loolwsd
	if test "$$BUILDING_FROM_RPMBUILD" != yes; then \
	    if test `uname -s` = Linux; then \
		sudo @SETCAP@ cap_fowner,cap_sys_chroot=ep loolwsd; \
	    else \
		sudo chown root loolwsd && sudo chmod u+s loolwsd; \
	    fi; \
	fi
