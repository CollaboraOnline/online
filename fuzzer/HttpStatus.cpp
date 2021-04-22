#include <iostream>

#include "config.h"

#include <net/HttpRequest.hpp>

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size)
{
    http::StatusLine statusLine;
    int64_t length = size;
    statusLine.parse(reinterpret_cast<const char*>(data), length);
    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
