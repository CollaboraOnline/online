// This is just a temporary hack to make it easier to check one header
// at a time whether it compiles for Windows without having to compile
// a substantial C++ file.

#include <config.h>

#include <net/Socket.hpp> // Header to check

int foobar = 42;
