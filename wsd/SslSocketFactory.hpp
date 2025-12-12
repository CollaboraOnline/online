#pragma once

#if ENABLE_SSL

#include <memory>
#include <string> 
#include "net/SocketFactory.hpp"
#include "net/Socket.hpp"
#include "net/StreamSocket.hpp"
#include "net/SslStreamSocket.hpp"
#include "client/ClientRequestDispatcher.hpp" 
#include "core/Delay.hpp" 
#include "core/Log.hpp" 
#include "coolwsd/CoolWsdDefines.hpp" 

class SslSocketFactory final : public SocketFactory
{
public:
    std::shared_ptr<Socket> create(const int physicalFd, Socket::Type type) override;
};

#endif // ENABLE_SSL