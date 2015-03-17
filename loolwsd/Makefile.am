bin_PROGRAMS = loolwsd

loolwsd_SOURCES = LOOLWSD.cpp LOOLSession.cpp TileCache.cpp Util.cpp

# This code not actually used for now
MIGRATORY_SOCKET_SOURCES = MigratorySocket.cpp MigratorySocketTransport.cpp

noinst_PROGRAMS = sockettransporttest

sockettransporttest_SOURCES = SocketTransportTest.cpp $(MIGRATORY_SOCKET_SOURCES)

clean-cache:
# Intentionally don't use "*" below... Avoid risk of accidentally running rm -rf /*
	test -n "@LOOLWSD_CACHEDIR@" && rm -rf "@LOOLWSD_CACHEDIR@"/[0-9a-f]/*
