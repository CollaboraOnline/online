CXXFLAGS = -std=c++11 -I/home/tml/lo/master-suse/include -I/opt/poco/include -g -Wall

LIBS = -L/opt/poco/lib -lPocoNetd -lPocoUtild -lPocoXMLd -lPocoJSONd -lPocoFoundationd -lpng -ldl

SRCS = LOOLWS.cpp LOOLConnectionServer.cpp

loolwsd : $(SRCS) Makefile
	$(CXX) $(CXXFLAGS) -o $@ $(SRCS) $(LIBS)
