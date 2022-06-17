#include <iostream>

#include "config.h"

#include <net/HttpRequest.hpp>

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size)
{
    http::Response response;
    response.readData(reinterpret_cast<const char*>(data), size);
    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
