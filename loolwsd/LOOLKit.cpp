/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <sys/prctl.h>

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
#ifdef __linux
      if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>("prision_handler"), 0, 0, 0) != 0)
        std::cout << Util::logPrefix() << "Cannot set thread name :" << strerror(errno) << std::endl;
#endif
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

static int prefixcmp(const char *str, const char *prefix)
{
	for (; ; str++, prefix++)
		if (!*prefix)
			return 0;
		else if (*str != *prefix)
			return (unsigned char)*prefix - (unsigned char)*str;
}

const int MASTER_PORT_NUMBER = 9981;
const std::string CHILD_URI = "/loolws/child/";

int main(int argc, char** argv)
{
    std::string loSubPath;
    Poco::UInt64 _childId = 0;

    while (argc > 0)
    {
		  char *cmd = argv[0];
		  char *eq  = NULL;
      if (!prefixcmp(cmd, "--losubpath="))
      {
        eq = strchrnul(cmd, '=');
        if (*eq)
          loSubPath = std::string(++eq);
      }
      else if (!prefixcmp(cmd, "--child="))
      {
        eq = strchrnul(cmd, '=');
        if (*eq)
          _childId = std::stoll(std::string(++eq));
      }
		  argv++;
		  argc--;
    }

   if (loSubPath.empty())
   {
     std::cout << Util::logPrefix() << "--losubpath is empty" << std::endl;
     exit(1);
   }

   if ( !_childId )
   {
     std::cout << Util::logPrefix() << "--child is 0" << std::endl;
     exit(1);
   }

    try
    {
#ifdef __APPLE__
        LibreOfficeKit *loKit(lok_init_2(("/" + loSubPath + "/Frameworks").c_str(), "file:///user"));
#else
        LibreOfficeKit *loKit(lok_init_2(("/" + loSubPath + "/program").c_str(), "file:///user"));
#endif

        if (!loKit)
        {
            std::cout << Util::logPrefix() + "LibreOfficeKit initialization failed" << std::endl;
            exit(-1);
        }

        // Open websocket connection between the child process and the
        // parent. The parent forwards us requests that it can't handle.

        HTTPClientSession cs("127.0.0.1", MASTER_PORT_NUMBER);
        cs.setTimeout(0);
        HTTPRequest request(HTTPRequest::HTTP_GET, CHILD_URI);
        HTTPResponse response;
        std::shared_ptr<WebSocket> ws(new WebSocket(cs, request, response));

        std::shared_ptr<ChildProcessSession> session(new ChildProcessSession(ws, loKit));

        ws->setReceiveTimeout(0);

        std::string hello("child " + std::to_string(_childId) + " " + std::to_string(Process::id()));
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

        // Destroy LibreOfficeKit
        loKit->pClass->destroy(loKit);
    }
    catch (Exception& exc)
    {
        std::cout << Util::logPrefix() + "Exception: " + exc.what() << std::endl;
    }
    catch (std::exception& exc)
    {
        std::cout << Util::logPrefix() + "Exception: " + exc.what() << std::endl;
    }

    std::cout << Util::logPrefix() << "loolkit finished OK!" << std::endl;
    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
