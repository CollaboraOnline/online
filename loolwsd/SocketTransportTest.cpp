/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <iostream>

#include <Poco/Process.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Util/ServerApplication.h>

#include "MigratorySocket.hpp"
#include "MigratorySocketTransport.hpp"

using Poco::Process;
using Poco::ProcessHandle;
using Poco::Util::Application;
using Poco::Util::Option;
using Poco::Util::OptionSet;

class SocketTransportTest: public Poco::Util::ServerApplication
{
    void defineOptions(OptionSet& options) override
    {
        ServerApplication::defineOptions(options);

        options.addOption(
            Option("child", "", "when invoking the child from the parent")
                .required(false)
                .repeatable(false));
    }

    int main(const std::vector<std::string>& args) override
    {
        MigratorySocketTransport transport(MigratorySocketTransport::create());
    
        Process::Args kidArgs;
        kidArgs.push_back("--child");
        kidArgs.push_back(transport.string());
    
        ProcessHandle kid = Process::launch("./sockettransporttest", kidArgs);

        Poco::Net::Socket socket;
        MigratorySocket migrant(socket);

        transport.send(migrant);
        migrant.close();

        return Application::EXIT_OK;
    }
};

POCO_SERVER_MAIN(SocketTransportTest)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
