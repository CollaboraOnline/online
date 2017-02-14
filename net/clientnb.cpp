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
#include <Poco/Net/KeyConsoleHandler.h>
#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/StreamCopier.h>
#include <Poco/Thread.h>
#include <Poco/URI.h>
#include <Poco/Util/Application.h>
#include <Poco/Util/HelpFormatter.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionSet.h>

using Poco::Net::HTTPClientSession;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Runnable;
using Poco::Thread;
using Poco::URI;
using Poco::Util::Application;
using Poco::Util::HelpFormatter;
using Poco::Util::Option;
using Poco::Util::OptionSet;

constexpr int PortNumber = 9191;

Poco::Net::SocketAddress addr("127.0.0.1", PortNumber);

struct Client : public Poco::Util::Application
{
public:
    int main(const std::vector<std::string>& /* args */) override
    {
        const char *hostname = "127.0.0.1";
        bool https = false;
        Poco::Net::HTTPClientSession *session;
        if (https)
            session = new Poco::Net::HTTPSClientSession(hostname, PortNumber);
        else
            session = new Poco::Net::HTTPClientSession(hostname, PortNumber);
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/ping");
        try {
            Poco::Net::HTMLForm form;
            form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
            form.prepareSubmit(request);
            form.write(session->sendRequest(request));
        }
        catch (const Poco::Exception &e)
        {
            std::cerr << "Failed to write data: " << e.name() <<
                  " " << e.message() << "\n";
            return -1;
        }

        Poco::Net::HTTPResponse response;

        try {
            std::cerr << "try to get response\n";
            std::istream& responseStream = session->receiveResponse(response);

            std::cerr << "Got response '" << responseStream << "'\n";
        }
        catch (const Poco::Exception &e)
        {
            std::cerr << "Exception converting: " << e.name() <<
                  " " << e.message() << "\n";
            return -1;
        }
        return 0;
    }
};

POCO_APP_MAIN(Client)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
