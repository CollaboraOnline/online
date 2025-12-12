#include "SslSocketFactory.hpp"
#include "core/Delay.hpp"
#include "core/Log.hpp"
#include "coolwsd/CoolWsdDefines.hpp"
#if ENABLE_SSL

std::shared_ptr<Socket> SslSocketFactory::create(const int physicalFd, Socket::Type type)
{
    int fd = physicalFd;

#if !MOBILEAPP
    if (SimulatedLatencyMs > 0)
    {
        int delayFd = Delay::create(SimulatedLatencyMs, physicalFd);
        if (delayFd == -1)
            LOG_ERR("Delay creation failed, fallback to original fd");
        else
            fd = delayFd;
    }
#endif
    return StreamSocket::create<SslStreamSocket>(std::string(), fd, type, false, HostType::Other,
                                                  std::make_shared<ClientRequestDispatcher>());
}

#endif // ENABLE_SSL