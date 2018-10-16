PROGS = mobile

all : $(PROGS)

WARNINGFLAGS = -Wall -Werror -Wno-parentheses -Wno-sign-compare -Wno-unused-variable
INCLUDEFLAGS = -I../common -I../net -I../kit -I../wsd -I../bundled/include -I.. -I.
DEFINEFLAGS = -DMOBILEAPP -DLOOLWSD_DATADIR='"/usr/local/share/loolwsd"' -DLOOLWSD_CONFIGDIR='"/usr/local/etc/loolwsd"' -DTOPSRCDIR='"'$(realpath $(PWD)/..)'"'

CFLAGS = -g $(WARNINGFLAGS) `pkg-config --cflags webkit2gtk-4.0` $(INCLUDEFLAGS) $(DEFINEFLAGS)
CXXFLAGS = $(CFLAGS)

LIBS=`pkg-config --libs webkit2gtk-4.0` -lPocoFoundationd -lPocoUtild -lPocoXMLd -lPocoJSONd -lPocoNetd -lpng -lpthread -ldl

common_OBJS = Unit.o FileUtil.o Log.o MessageQueue.o Protocol.o Session.o SigUtil.o SpookyV2.o Util.o
kit_OBJS = ChildSession.o Kit.o
net_OBJS = FakeSocket.o Socket.o
wsd_OBJS = ClientSession.o DocumentBroker.o LOOLWSD.o Storage.o TileCache.o

mobile_OBJS = main.o $(common_OBJS) $(kit_OBJS) $(net_OBJS) $(wsd_OBJS)

$(common_OBJS) : %.o : ../common/%.cpp
	$(CXX) $(CXXFLAGS) -c -o $@ $^

$(kit_OBJS) : %.o : ../kit/%.cpp
	$(CXX) $(CXXFLAGS) -c -o $@ $^

$(net_OBJS) : %.o : ../net/%.cpp
	$(CXX) $(CXXFLAGS) -c -o $@ $^

$(wsd_OBJS) : %.o : ../wsd/%.cpp
	$(CXX) $(CXXFLAGS) -c -o $@ $^

mobile : $(mobile_OBJS)
	$(CXX) -o $@ $(mobile_OBJS) $(LIBS)

clean :
	rm -f $(PROGS) *.o 2>/dev/null
