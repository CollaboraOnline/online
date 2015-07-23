bin_PROGRAMS = loolwsd loolbroker loolkit

dist_bin_SCRIPTS = loolwsd-systemplate-setup

loolwsd_SOURCES = LOOLWSD.cpp LOOLSession.cpp MasterProcessSession.cpp TileCache.cpp Util.cpp LOOLProtocol.cpp

loolkit_SOURCES = LOOLKit.cpp LOOLSession.cpp ChildProcessSession.cpp Util.cpp LOOLProtocol.cpp

loolbroker_SOURCES = LOOLBroker.cpp Util.cpp

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
		sudo @SETCAP@ cap_fowner,cap_mknod,cap_sys_chroot=ep loolwsd; \
		sudo @SETCAP@ cap_fowner,cap_mknod,cap_sys_chroot=ep loolbroker; \
	    else \
		sudo chown root loolwsd && sudo chmod u+s loolwsd; \
		sudo chown root loolbroker && sudo chmod u+s loolbroker; \
	    fi; \
	fi
	mkdir -p ./systemplate/usr/bin
	cp loolkit ./systemplate/usr/bin
