#include <iostream>

#include "config.h"

#include <net/HttpRequest.hpp>
#include <fuzzer/Common.hpp>

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size)
{
    static bool initialized = fuzzer::DoInitialization();
    (void)initialized;

    for (size_t i = 0; i < size; ++i)
    {
        http::Response response;
        response.readData(reinterpret_cast<const char*>(data), i);
    }
    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
