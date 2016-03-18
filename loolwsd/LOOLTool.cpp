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
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <random>

#include <Poco/Condition.h>
#include <Poco/Mutex.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/FilePartSource.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>
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
#include "LOOLProtocol.hpp"
#include "Util.hpp"

#include <Poco/Util/Application.h>
#include <Poco/Util/OptionSet.h>

class Tool: public Poco::Util::Application
{
public:
    Tool();
    ~Tool() {}

    unsigned    _numWorkers;
    std::string _serverURI;
    std::string _destinationFormat;
    std::string _destinationDir; // FIXME: implement me.

protected:
    void defineOptions(Poco::Util::OptionSet& options) override;
    void handleOption(const std::string& name, const std::string& value) override;
    int  main(const std::vector<std::string>& args) override;
};


using namespace LOOLProtocol;

using Poco::Condition;
using Poco::Mutex;
using Poco::Net::HTTPClientSession;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
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

class Worker: public Runnable
{
public:
    Tool& _app;
    std::vector< std::string > _files;
    Worker(Tool& app, const std::vector< std::string > & files) :
        _app(app), _files(files)
    {
    }

    void run() override
    {
        for (auto i : _files)
            convertFile(i);
    }

    void convertFile(const std::string& document)
    {
        std::cerr << "convert file " << document << "\n";

        Poco::URI uri(_app._serverURI);
        Poco::Net::HTTPClientSession session(uri.getHost(), uri.getPort());
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/convert-to");

        try {
            Poco::Net::HTMLForm form;
            form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
            form.set("format", _app._destinationFormat);
            form.addPart("data", new Poco::Net::FilePartSource(document));
            form.prepareSubmit(request);

            // If this results in a Poco::Net::ConnectionRefusedException, loolwsd is not running.
            form.write(session.sendRequest(request));
        }
        catch (const Poco::Exception &e)
        {
            std::cerr << "Failed to connect: " << e.name() <<
                  " " << e.message() << "\n";
            return;
        }

        Poco::Net::HTTPResponse response;
        std::stringstream actualStream;

        // receiveResponse() resulted in a Poco::Net::NoMessageException.
        std::istream& responseStream = session.receiveResponse(response);
        Poco::StreamCopier::copyStream(responseStream, actualStream);

        // FIXME: implement destinationDir
        Poco::Path path(document);

        std::string outPath = path.getBaseName() + "." + _app._destinationFormat;
        std::cerr << "write to " << outPath << "\n";
        std::ifstream fileStream(outPath);
        std::stringstream expectedStream;
        expectedStream << fileStream.rdbuf();

        // In some cases the result is prefixed with (the UTF-8 encoding of) the Unicode BOM
        // (U+FEFF). Skip that.
        std::string actualString = actualStream.str();
        if (actualString.size() > 3 && actualString[0] == '\xEF' && actualString[1] == '\xBB' && actualString[2] == '\xBF')
            actualString = actualString.substr(3);
    }
};

Tool::Tool() :
    _numWorkers(4),
#if ENABLE_SSL
    _serverURI("https://localhost:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER) + "/wss"),
#else
    _serverURI("http://localhost:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER) + "/ws"),
#endif
    _destinationFormat("txt")
{
}

void Tool::defineOptions(OptionSet& optionSet)
{
    Application::defineOptions(optionSet);

    optionSet.addOption(Option("help", "", "Display help information on command line arguments.")
                        .required(false).repeatable(false));
    optionSet.addOption(Option("extension", "", "file format extension to convert to")
                        .required(false).repeatable(false)
                        .argument("format"));
    optionSet.addOption(Option("outdir", "", "output directory for converted files")
                        .required(false).repeatable(false));
    optionSet.addOption(Option("parallelism", "", "number of simultaneous threads to use")
                        .required(false) .repeatable(false)
                        .argument("threads"));
    optionSet.addOption(Option("server", "", "URI of LOOL server")
                        .required(false).repeatable(false)
                        .argument("uri"));
}

void Tool::handleOption(const std::string& optionName,
                            const std::string& value)
{
    Application::handleOption(optionName, value);

    if (optionName == "help")
    {
        HelpFormatter helpFormatter(options());

        helpFormatter.setCommand(commandName());
        helpFormatter.setUsage("OPTIONS");
        helpFormatter.setHeader("LibreOffice On-Line tool.");
        helpFormatter.format(std::cout);
        std::exit(Application::EXIT_OK);
    }
    else if (optionName == "format")
        _destinationFormat = value;
    else if (optionName == "outdir")
        _destinationDir = value;
    else if (optionName == "threads")
        _numWorkers = std::min(std::stoi(value), 1);
    else if (optionName == "uri")
        _serverURI = value;
}

int Tool::main(const std::vector<std::string>& args)
{
    Thread *clients[_numWorkers];

    size_t chunk = (args.size() + _numWorkers - 1) / _numWorkers;
    size_t offset = 0;
    for (unsigned i = 0; i < _numWorkers; i++)
    {
        clients[i] = new Thread();
        size_t toCopy = std::min(args.size() - offset, chunk);
        if (toCopy > 0)
        {
            std::vector< std::string > files( toCopy );
            std::copy( args.begin() + offset, args.begin() + offset + chunk, files.begin() );
            offset += toCopy;
            clients[i]->start(*(new Worker(*this, files)));
        }
    }

    for (unsigned i = 0; i < _numWorkers; i++)
    {
        clients[i]->join();
    }

    return Application::EXIT_OK;
}

POCO_APP_MAIN(Tool)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
