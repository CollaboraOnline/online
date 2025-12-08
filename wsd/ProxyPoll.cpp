#include <ProxyPoll.hpp>
#include <Socket.hpp>
#include <memory>

class ProxyHandler : public ProtocolHandlerInterface
{
    // The other end of the proxy pair
    std::weak_ptr<StreamSocket> _peerSocket;

    // 256KB flow control
    static constexpr size_t MAX_BUFFER = 256 * 1024;

public:
    ProxyHandler(const std::shared_ptr<StreamSocket>& peer)
        : _peerSocket(peer)
    {
    }

    void onConnect(const std::shared_ptr<StreamSocket>& /* socket */) override
    {
        LOG_TRC("Proxy connection established to target pod");
    }

    void handleIncomingMessage(SocketDisposition& disposition) override
    {
        auto peer = _peerSocket.lock();
        auto self = std::static_pointer_cast<StreamSocket>(disposition.getSocket());

        if (!peer || !self)
        {
            disposition.setClosed();
            return;
        }

        // Flow control: pause if peer's output buffer is full
        if (peer->getOutBuffer().size() >= MAX_BUFFER)
        {
            LOG_TRC("Backpressure: peer buffer full, pausing read");
            return;
        }

        // Pump data: self -> peer
        auto& inBuffer = self->getInBuffer();
        if (!inBuffer.empty())
        {
            peer->send(inBuffer.data(), inBuffer.size());
            inBuffer.clear();
        }
    }

    void onDisconnect() override
    {
        if (auto peer = _peerSocket.lock())
            peer->asyncShutdown();
    }
};
