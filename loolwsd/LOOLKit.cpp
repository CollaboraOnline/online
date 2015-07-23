
#include <memory>
#include <iostream>

#include <Poco/NamedMutex.h>
#include <Poco/Util/Application.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Thread.h>
#include <Poco/Runnable.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Exception.h>
#include <Poco/Process.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitInit.h>

#include "tsqueue.h"
#include "Util.hpp"
#include "ChildProcessSession.hpp"
#include "LOOLProtocol.hpp"

using namespace LOOLProtocol;
using Poco::Util::Application;
using Poco::Net::WebSocket;
using Poco::Net::HTTPClientSession;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Thread;
using Poco::Runnable;
using Poco::StringTokenizer;
using Poco::Exception;
using Poco::Process;

class QueueHandler: public Runnable
{
public:
    QueueHandler(tsqueue<std::string>& queue):
        _queue(queue)
    {
    }

    void setSession(std::shared_ptr<LOOLSession> session)
    {
        _session = session;
    }

    void run() override
    {
        while (true)
        {
            std::string input = _queue.get();
            if (input == "eof")
                break;
            if (!_session->handleInput(input.c_str(), input.size()))
                break;
        }
    }

private:
    std::shared_ptr<LOOLSession> _session;
    tsqueue<std::string>& _queue;
};

const int MASTER_PORT_NUMBER = 9981;
const std::string CHILD_URI = "/loolws/child/";

Poco::NamedMutex _namedMutexLOOL("loolwsd");

int main(int argc, char** argv)
{
    std::string loSubPath = "lo";
    Poco::UInt64 _childId = Process::id();

    try
    {
        _namedMutexLOOL.lock();

#ifdef __APPLE__
        LibreOfficeKit *loKit(lok_init_2(("/" + loSubPath + "/Frameworks").c_str(), "file:///user"));
#else
        LibreOfficeKit *loKit(lok_init_2(("/" + loSubPath + "/program").c_str(), "file:///user"));
#endif

        if (!loKit)
        {
            Application::instance().logger().fatal(Util::logPrefix() + "LibreOfficeKit initialisation failed");
            exit(Application::EXIT_UNAVAILABLE);
        }

        _namedMutexLOOL.unlock();

        // Open websocket connection between the child process and the
        // parent. The parent forwards us requests that it can't handle.

        HTTPClientSession cs("127.0.0.1", MASTER_PORT_NUMBER);
        cs.setTimeout(0);
        HTTPRequest request(HTTPRequest::HTTP_GET, CHILD_URI);
        HTTPResponse response;
        std::shared_ptr<WebSocket> ws(new WebSocket(cs, request, response));

        std::shared_ptr<ChildProcessSession> session(new ChildProcessSession(ws, loKit));

        ws->setReceiveTimeout(0);

        std::string hello("child " + std::to_string(_childId));
        session->sendTextFrame(hello);

        tsqueue<std::string> queue;
        Thread queueHandlerThread;
        QueueHandler handler(queue);

        handler.setSession(session);
        queueHandlerThread.start(handler);

        int flags;
        int n;
        do
        {
            char buffer[1024];
            n = ws->receiveFrame(buffer, sizeof(buffer), flags);

            if (n > 0 && (flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE)
            {
                std::string firstLine = getFirstLine(buffer, n);
                StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

                // The only kind of messages a child process receives are the single-line ones (?)
                assert(firstLine.size() == static_cast<std::string::size_type>(n));

                // Check if it is a "canceltiles" and in that case remove outstanding
                // "tile" messages from the queue.
                if (tokens.count() == 1 && tokens[0] == "canceltiles")
                {
                    queue.remove_if([](std::string& x) {
                        return (x.find("tile ") == 0 && x.find("id=") == std::string::npos);
                    });
                }
                else
                {
                    queue.put(firstLine);
                }
            }
        }
        while (n > 0 && (flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE);

        queue.clear();
        queue.put("eof");
        queueHandlerThread.join();
    }
    catch (Exception& exc)
    {
        Application::instance().logger().log(Util::logPrefix() + "Exception: " + exc.what());
    }
    catch (std::exception& exc)
    {
        Application::instance().logger().error(Util::logPrefix() + "Exception: " + exc.what());
    }
    
    std::cout << Util::logPrefix() << "loolkit finished OK!" << std::endl;
    return 0;
}
