#include <iostream>

#include "config.h"

#include "Admin.hpp"
#include <fuzzer/Common.hpp>

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size)
{
    static bool initialized = fuzzer::DoInitialization();
    (void)initialized;

    Admin& admin = Admin::instance();
    auto handler = std::make_shared<AdminSocketHandler>(&admin);

    std::string input(reinterpret_cast<const char*>(data), size);
    std::stringstream ss(input);
    std::string line;
    while (std::getline(ss, line, '\n'))
    {
        std::vector<char> lineVector(line.data(), line.data() + line.size());
        handler->handleMessage(lineVector);
    }

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
