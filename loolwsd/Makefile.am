bin_PROGRAMS = loolwsd

loolwsd_SOURCES = LOOLWSD.cpp LOOLSession.cpp TileCache.cpp Util.cpp LOOLProtocol.cpp

noinst_PROGRAMS = loadtest connect lokitclient

loadtest_SOURCES = LoadTest.cpp Util.cpp LOOLProtocol.cpp

connect_SOURCES = Connect.cpp  Util.cpp

lokitclient_SOURCES = LOKitClient.cpp Util.cpp

clean-cache:
# Intentionally don't use "*" below... Avoid risk of accidentally running rm -rf /*
	test -n "@LOOLWSD_CACHEDIR@" && rm -rf "@LOOLWSD_CACHEDIR@"/[0-9a-f]
