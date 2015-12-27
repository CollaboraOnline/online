/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <unistd.h>

#include <algorithm>
#include <cstring>
#include <fstream>
#include <iostream>
#include <random>

#include <Poco/Condition.h>
#include <Poco/Mutex.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/SocketStream.h>
#include <Poco/Net/StreamSocket.h>
#include <Poco/Net/TCPServer.h>
#include <Poco/Net/TCPServerConnection.h>
#include <Poco/Net/TCPServerConnectionFactory.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Process.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Thread.h>
#include <Poco/Timespan.h>
#include <Poco/Timestamp.h>
#include <Poco/URI.h>
#include <Poco/Util/Application.h>
#include <Poco/Util/HelpFormatter.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionSet.h>

#include "Common.hpp"
#include "LoadTest.hpp"
#include "LOOLProtocol.hpp"
#include "LOOLWSD.hpp"
#include "Util.hpp"

using namespace LOOLProtocol;

using Poco::Condition;
using Poco::Mutex;
using Poco::Net::HTTPClientSession;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Net::Socket;
using Poco::Net::SocketOutputStream;
using Poco::Net::StreamSocket;
using Poco::Net::TCPServer;
using Poco::Net::TCPServerConnection;
using Poco::Net::WebSocket;
using Poco::Net::WebSocketException;
using Poco::Runnable;
using Poco::StringTokenizer;
using Poco::Thread;
using Poco::Timespan;
using Poco::Timestamp;
using Poco::URI;
using Poco::Util::Application;
using Poco::Util::HelpFormatter;
using Poco::Util::Option;
using Poco::Util::OptionSet;

class Output: public Runnable
{
public:
    Output(WebSocket& ws, Condition& cond, Mutex& mutex) :
        _ws(ws),
        _cond(cond),
        _mutex(mutex),
        _type(LOK_DOCTYPE_OTHER),
        _width(0),
        _height(0)
    {
    }

    void run() override
    {
        int flags;
        int n;
        int tileCount = 0;
        try
        {
            do
            {
                char buffer[100000];
                n = _ws.receiveFrame(buffer, sizeof(buffer), flags);

                if (n > 0 && (flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE)
                {
#if 0
                    Log::debug() << "Client got " << n << " bytes: "
                                 << getAbbreviatedMessage(buffer, n) << Log::end;
#endif
                    std::string response = getFirstLine(buffer, n);
                    StringTokenizer tokens(response, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

                    int size;
                    if (tokens.count() == 2 && tokens[0] == "nextmessage:" && getTokenInteger(tokens[1], "size", size) && size > 0)
                    {
                        char largeBuffer[size];

                        n = _ws.receiveFrame(largeBuffer, size, flags);

#if 0
                        Log::debug() << "Client got " << n << " bytes: "
                                     << getAbbreviatedMessage(largeBuffer, n) << Log::end;
#endif
                        response = getFirstLine(buffer, n);
                    }
                    if (response.find("status:") == 0)
                    {
                        parseStatus(response, _type, _numParts, _currentPart, _width, _height);
                        _cond.signal();
                    }
                    else if (response.find("tile:") == 0)
                    {
                        tileCount++;
                    }
                }
            }
            while (n > 0 && (flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE);
        }
        catch (WebSocketException& exc)
        {
            Application::instance().logger().error("WebSocketException: " + exc.message());
            _ws.close();
        }
        Log::debug() << "Got " << tileCount << " tiles" << Log::end;
    }

    WebSocket& _ws;
    Condition& _cond;
    Mutex& _mutex;
    LibreOfficeKitDocumentType _type;

    int _numParts;
    int _currentPart;
    int _width;
    int _height;
};

class Client: public Runnable
{
public:

    Client(LoadTest& app) :
        _app(app),
        _g(_rd())
    {
    }

    void run() override
    {
        std::vector<std::string> uris(_app.getDocList());
        std::shuffle(uris.begin(), uris.end(), _g);
        if (uris.size() > _app.getNumDocsPerClient())
            uris.resize(_app.getNumDocsPerClient());
        while (!clientDurationExceeded())
        {
            std::shuffle(uris.begin(), uris.end(), _g);
            for (auto i : uris)
            {
                if (clientDurationExceeded())
                    break;

                testDocument(i);
            }
        }
    }

private:
    bool clientDurationExceeded()
    {
        return _clientStartTimestamp.isElapsed(_app.getDuration() * Timespan::HOURS);
    }

    void testDocument(const std::string& document)
    {
        Timestamp documentStartTimestamp;

        URI uri(_app.getURL());

        Log::debug() << "Starting client for '" << document << "'" << Log::end;

        HTTPClientSession cs(uri.getHost(), uri.getPort());
        HTTPRequest request(HTTPRequest::HTTP_GET, "/ws");
        HTTPResponse response;
        WebSocket ws(cs, request, response);

        Condition cond;
        Mutex mutex;

        Thread thread;
        Output output(ws, cond, mutex);

        thread.start(output);

        if (document[0] == '/')
            sendTextFrame(ws, "load " + document);
        else
            sendTextFrame(ws, "load url=" + document);

        sendTextFrame(ws, "status");

        // Wait for the "status:" message
        mutex.lock();
        cond.wait(mutex);
        mutex.unlock();

        Log::debug() << "Got status, size=" << output._width << "x" << output._height << Log::end;

        int y = 0;
        const int DOCTILESIZE = 5000;

        std::uniform_int_distribution<> dis(0, 20);
        int extra = dis(_g);

        int requestCount = 0;

        // Exercise the server with this document for some minutes
        while (!documentStartTimestamp.isElapsed((20 + extra) * Timespan::SECONDS) && !clientDurationExceeded())
        {
            int x = 0;
            while (!documentStartTimestamp.isElapsed((20 + extra) * Timespan::SECONDS) && !clientDurationExceeded())
            {
                sendTextFrame(ws,
                              "tile part=0 width=256 height=256 "
                              "tileposx=" + std::to_string(x * DOCTILESIZE) + " "
                              "tileposy=" + std::to_string(y * DOCTILESIZE) + " "
                              "tilewidth=" + std::to_string(DOCTILESIZE) + " "
                              "tileheight=" + std::to_string(DOCTILESIZE));
                requestCount++;
                x = ((x + 1) % ((output._width-1)/DOCTILESIZE + 1));
                if (x == 0)
                    break;
            }
            y = ((y + 1) % ((output._height-1)/DOCTILESIZE + 1));
            Thread::sleep(50);
        }
        sendTextFrame(ws, "canceltiles");

        Thread::sleep(10000);

        Log::debug() << "Sent " << requestCount << " tile requests, shutting down client for '" << document << "'" << Log::end;

        ws.shutdown();
        thread.join();
    }

    void sendTextFrame(WebSocket& ws, const std::string& s)
    {
        ws.sendFrame(s.data(), s.size());
    }

    LoadTest& _app;
    Timestamp _clientStartTimestamp;

    std::random_device _rd;
    std::mt19937 _g;
};

LoadTest::LoadTest() :
    _numClients(20),
    _numDocsPerClient(500),
    _duration(6),
    _url("http://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER) + "/ws")
{
}

LoadTest::~LoadTest()
{
}

unsigned LoadTest::getNumDocsPerClient() const
{
    return _numDocsPerClient;
}

unsigned LoadTest::getDuration() const
{
    return _duration;
}

std::string LoadTest::getURL() const
{
    return _url;
}

std::vector<std::string> LoadTest::getDocList() const
{
    return _docList;
}

void LoadTest::defineOptions(OptionSet& optionSet)
{
    Application::defineOptions(optionSet);

    optionSet.addOption(Option("help", "", "Display help information on command line arguments.")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("doclist", "", "file containing URIs or pathnames of documents to load, - for stdin")
                        .required(true)
                        .repeatable(false)
                        .argument("file"));

    optionSet.addOption(Option("numclients", "", "number of simultaneous clients to simulate")
                        .required(false)
                        .repeatable(false)
                        .argument("number"));

    optionSet.addOption(Option("numdocs", "", "number of sequential documents per client")
                        .required(false)
                        .repeatable(false)
                        .argument("number"));

    optionSet.addOption(Option("duration", "", "duration in hours")
                        .required(false)
                        .repeatable(false)
                        .argument("hours"));

    optionSet.addOption(Option("server", "", "URI of LOOL server")
                        .required(false)
                        .repeatable(false)
                        .argument("uri"));
}

void LoadTest::handleOption(const std::string& optionName, const std::string& value)
{
    Application::handleOption(optionName, value);

    if (optionName == "help")
    {
        displayHelp();
        exit(Application::EXIT_OK);
    }
    else if (optionName == "doclist")
        _docList = readDocList(value);
    else if (optionName == "numclients")
        _numClients = std::stoi(value);
    else if (optionName == "numdocs")
        _numDocsPerClient = std::stoi(value);
    else if (optionName == "duration")
        _duration = std::stoi(value);
    else if (optionName == "url")
        _url = value;
}

void LoadTest::displayHelp()
{
    HelpFormatter helpFormatter(options());
    helpFormatter.setCommand(commandName());
    helpFormatter.setUsage("OPTIONS");
    helpFormatter.setHeader("LibreOffice On-Line WebSocket server load test.");
    helpFormatter.format(std::cout);
}

int LoadTest::main(const std::vector<std::string>& /*args*/)
{
    Thread *clients[_numClients];

    for (unsigned i = 0; i < _numClients; i++)
    {
        clients[i] = new Thread();
        clients[i]->start(*(new Client(*this)));
    }

    for (unsigned i = 0; i < _numClients; i++)
    {
        clients[i]->join();
    }

    return Application::EXIT_OK;
}

std::vector<std::string> LoadTest::readDocList(const std::string& filename)
{
    std::vector<std::string> result;

    std::ifstream infile;
    std::istream *input;
    if (filename == "-")
        input = &std::cin;
    else
    {
        infile.open(filename);
        input = &infile;
    }

    while (!input->eof())
    {
        std::string s;
        *input >> std::ws;
        if (input->eof())
            break;
        *input >> s;
        result.push_back(s);
    }

    if (filename == "-")
        infile.close();

    return result;
}

POCO_APP_MAIN(LoadTest)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
