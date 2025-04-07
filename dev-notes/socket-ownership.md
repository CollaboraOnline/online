## Socket Ownership

Generally a Socket belongs to a SocketPoll which holds it by shared_ptr via
_pollSockets.

A SocketPoll drops ownership of a Socket if:

+ SocketPoll::poll sees a Socket that reports isShutdown then SocketPoll
  removes it from _pollSockets and the socket object is destroyed.
+ Socket::handlePoll sets its SocketDisposition argument to setClosed() which
  follow the same behaviour as above.
+ Socket::handlePoll uses the SocketDisposition argument to setup transferring
  ownership of the Socket to something else. The preferred approach being via
  SocketDisposition::setTransfer to transfer ownership to another SocketPoll.

The expection is that with Sockets owned by a SocketPoll then long-lived
references to Sockets elsewhere are held by weak_ptr.

## Socket Handlers

Sockets have SocketHandler's which the Socket hold by shared_ptr.
SocketHandlers derive from ProtocolHandlerInterface. If a SocketHandler
requires a reference back to the Socket it is handling then holding that by
shared_ptr creates a circular dependency problem, so typically a weak_ptr is
expected.

## SocketPoll

SocketPolls should have a single obvious owner. A SocketPoll should only be
created as owned by shared_ptr (enforced by clang-plugin) and additional
long-lived references to it held via weak_ptr.
