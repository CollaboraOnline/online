#ifndef INCLUDED_PRISONERREQUESTDISPATCHER_HPP
#define INCLUDED_PRISONERREQUESTDISPATCHER_HPP

#include "config.h"

#include <memory>
#include <string>
#include <vector>

#include "Socket.hpp"
#include "WebSocketHandler.hpp"

class ChildProcess;

/// Handles the socket that the prisoner kit connected to WSD on.
class PrisonerRequestDispatcher final : public WebSocketHandler
{
    std::weak_ptr<ChildProcess> _childProcess;
    int _pid; ///< The Kit's PID (for logging).
    int _socketFD; ///< The socket FD to the Kit (for logging).
    bool _associatedWithDoc; ///< True when/if we get a DocBroker.

public:
    PrisonerRequestDispatcher();
    ~PrisonerRequestDispatcher();

private:
    /// Keep our socket around ...
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override;

    void onDisconnect() override;

    /// Called after successful socket reads.
    void handleIncomingMessage(SocketDisposition &disposition) override;

    /// Prisoner websocket fun ... (for now)
    virtual void handleMessage(const std::vector<char> &data) override;

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t & /* timeoutMaxMs */) override;

    void performWrites(std::size_t /*capacity*/) override;
};

#endif