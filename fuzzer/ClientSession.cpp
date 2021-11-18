#include <iostream>

#include "config.h"

#include "ClientSession.hpp"

bool DoInitialization()
{
    COOLWSD::ChildRoot = "/fuzz/child-root";
    return true;
}

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size)
{
    static bool initialized = DoInitialization();
    (void)initialized;

    std::string uri;
    Poco::URI uriPublic;
    std::string docKey = "/fuzz/fuzz.odt";
    auto docBroker = std::make_shared<DocumentBroker>(DocumentBroker::ChildType::Interactive, uri,
                                                      uriPublic, docKey);

    std::shared_ptr<ProtocolHandlerInterface> ws;
    std::string id;
    bool isReadOnly = false;
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, uri,
                                   Poco::Net::HTTPMessage::HTTP_1_1);
    request.setHost("localhost:9980");
    const RequestDetails requestDetails(request, "");
    auto session
        = std::make_shared<ClientSession>(ws, id, docBroker, uriPublic, isReadOnly, requestDetails);

    std::string input(reinterpret_cast<const char*>(data), size);
    std::stringstream ss(input);
    std::string line;
    while (std::getline(ss, line, '\n'))
    {
        std::vector<char> lineVector(line.data(), line.data() + line.size());
        session->handleMessage(lineVector);
    }

    // Make sure SocketPoll::_newCallbacks does not grow forever, leading to OOM.
    Admin::instance().poll(std::chrono::microseconds(0));

    // Make sure the anon map does not grow forever, leading to OOM.
    Util::clearAnonymized();
    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
