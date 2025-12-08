#include <Socket.hpp>

// Singleton proxy poll - one thread handles all proxy connections
class ProxyPoll : public TerminatingPoll
{
public:
    static ProxyPoll& instance()
    {
        static ProxyPoll poll;
        return poll;
    }

private:
    ProxyPoll()
        : TerminatingPoll("proxy-poll")
    {
        startThread(); // Spawns new thread running pollingThread()
    }
};


