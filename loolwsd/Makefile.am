SUBDIRS = test

bin_PROGRAMS = loolwsd loolmount

dist_bin_SCRIPTS = loolwsd-systemplate-setup

loolwsd_LDADD = @POCO_LIBS@
loolwsd_SOURCES = LOOLWSD.cpp LOOLSession.cpp MessageQueue.cpp TileCache.cpp Util.cpp LOOLProtocol.cpp

noinst_PROGRAMS = loadtest connect lokitclient

loadtest_LDADD = @POCO_LIBS@
loadtest_SOURCES = LoadTest.cpp Util.cpp LOOLProtocol.cpp

connect_LDADD = @POCO_LIBS@
connect_SOURCES = Connect.cpp Util.cpp LOOLProtocol.cpp

lokitclient_LDADD = @POCO_LIBS@
lokitclient_SOURCES = LOKitClient.cpp Util.cpp

loolmount_SOURCES = LOOLMount.cpp

noinst_HEADERS = LOKitHelper.hpp LOOLProtocol.hpp LOOLSession.hpp LOOLWSD.hpp LoadTest.hpp MessageQueue.hpp TileCache.hpp Util.hpp Png.hpp \
                 bundled/include/LibreOfficeKit/LibreOfficeKit.h bundled/include/LibreOfficeKit/LibreOfficeKitEnums.h \
                 bundled/include/LibreOfficeKit/LibreOfficeKitInit.h bundled/include/LibreOfficeKit/LibreOfficeKitTypes.h

EXTRA_DIST = loolwsd.service sysconfig.loolwsd

clean-cache:
# Intentionally don't use "*" below... Avoid risk of accidentally running rm -rf /*
	test -n "@LOOLWSD_CACHEDIR@" && rm -rf "@LOOLWSD_CACHEDIR@"/[0-9a-f]

# After building loolwsd, set its capabilities to allow chroot(). Dot
# it already after a plain 'make' to allow for testing without
# installing.
all-local: loolwsd
	if test "$$BUILDING_FROM_RPMBUILD" != yes; then \
	    if test `uname -s` = Linux; then \
		sudo @SETCAP@ cap_fowner,cap_mknod,cap_sys_admin,cap_sys_chroot=ep loolwsd; \
    sudo @SETCAP@ cap_sys_admin=ep loolmount; \
	    else \
		sudo chown root loolwsd && sudo chmod u+s loolwsd; \
	    fi; \
	fi

tags:
	ctags --c++-kinds=+p --fields=+iaS --extra=+q -R --totals=yes *
