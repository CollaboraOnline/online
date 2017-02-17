/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <atomic>
#include <cerrno>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <mutex>
#include <thread>
#include <assert.h>

#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/FilePartSource.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Net/KeyConsoleHandler.h>
#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>
#include <Poco/Util/Application.h>
#include <Poco/Util/HelpFormatter.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Runnable.h>
#include <Poco/Thread.h>

using Poco::Net::HTTPClientSession;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Net::WebSocket;
using Poco::Runnable;
using Poco::Thread;
using Poco::URI;
using Poco::Util::Application;
using Poco::Util::HelpFormatter;
using Poco::Util::Option;
using Poco::Util::OptionSet;

const char *HostName = "127.0.0.1";
constexpr int PortNumber = 9191;

struct Session
{
    std::string _session_name;
    Poco::Net::HTTPClientSession *_session;

    Session(const char *session_name, bool https = false)
        : _session_name(session_name)
    {
        if (https)
            _session = new Poco::Net::HTTPSClientSession(HostName, PortNumber);
        else
            _session = new Poco::Net::HTTPClientSession(HostName, PortNumber);
    }
    ~Session()
    {
        delete _session;
    }

    void sendPing(int i)
    {
        Poco::Net::HTTPRequest request(
            Poco::Net::HTTPRequest::HTTP_POST,
            "/ping/" + _session_name + "/" + std::to_string(i));
        try {
            Poco::Net::HTMLForm form;
            form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
            form.prepareSubmit(request);
            form.write(_session->sendRequest(request));
        }
        catch (const Poco::Exception &e)
        {
            std::cerr << "Failed to write data: " << e.name() <<
                  " " << e.message() << "\n";
            throw;
        }
    }
    int getResponse()
    {
        int number = 42;
        Poco::Net::HTTPResponse response;

        try {
//            std::cerr << "try to get response\n";
            std::istream& responseStream = _session->receiveResponse(response);

            std::string result(std::istreambuf_iterator<char>(responseStream), {});
//            std::cerr << "Got response '" << result << "'\n";
            number = std::stoi(result);
        }
        catch (const Poco::Exception &e)
        {
            std::cerr << "Exception converting: " << e.name() <<
                  " " << e.message() << "\n";
            throw;
        }
        return number;
    }

    std::shared_ptr<WebSocket> getWebSocket()
    {
        _session->setTimeout(Poco::Timespan(10, 0));
        HTTPRequest request(HTTPRequest::HTTP_GET, "/ws");
        HTTPResponse response;
        return std::shared_ptr<WebSocket>(
            new WebSocket(*_session, request, response));
    }
};

struct ThreadWorker : public Runnable
{
    const char *_domain;
    ThreadWorker(const char *domain = nullptr)
        : _domain(domain)
    {
    }
    virtual void run()
    {
        for (int i = 0; i < 100; ++i)
        {
            Session ping(_domain ? _domain : "init");
            ping.sendPing(i);
            int back = ping.getResponse();
            assert(back == i + 1);
        }
    }
};

struct Client : public Poco::Util::Application
{
    void testLadder()
    {
        ThreadWorker ladder;
        Thread thread;
        thread.start(ladder);
        thread.join();
    }

    void testParallel()
    {
        const int num = 10;
        Thread snakes[num];
        ThreadWorker ladders[num];

        for (size_t i = 0; i < num; i++)
            snakes[i].start(ladders[i]);

        for (int i = 0; i < num; i++)
            snakes[i].join();
    }

    void testWebsocket()
    {
        Session session("ws");
        std::shared_ptr<WebSocket> ws = session.getWebSocket();
        for (size_t i = 0; i < 10; i++)
        {
            ws->sendFrame(&i, sizeof(i), WebSocket::SendFlags::FRAME_BINARY);
            size_t back[5];
            int flags = 0;
            int recvd = ws->receiveFrame((void *)back, sizeof(back), flags);
            assert(recvd == sizeof(size_t));
            assert(back[0] == i + 1);
        }
    }

public:
    int main(const std::vector<std::string>& /* args */) override
    {
        if (getenv("WS"))
            testWebsocket();
        else
        {
            Session first("init");
            Session second("init");

            int count = 42, back;
            first.sendPing(count);
            second.sendPing(count + 1);

            back = first.getResponse();
            assert (back == count + 1);

            back = second.getResponse();
            assert (back == count + 2);

            testLadder();
            testParallel();
        }
        return 0;
    }
};

POCO_APP_MAIN(Client)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
