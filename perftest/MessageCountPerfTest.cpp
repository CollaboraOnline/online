/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <sysexits.h>
#include <filesystem>

#include <Poco/Util/Application.h>

#include <net/Ssl.hpp>
#if ENABLE_SSL
#  include <SslSocket.hpp>
#endif

#include <ReplaySocketHandler.hpp>

struct Stats
{
    size_t _messageCount;
    size_t _messageBytes;

    Stats() :
        _messageCount(0),
        _messageBytes(0)
    {
    }

    void addMessage(const std::vector<char> &data)
    {
        _messageCount++;
        _messageBytes += data.size();
    }
};

class MessageCountSocketHandler : public ReplaySocketHandler
{
    bool _measuring;
    std::shared_ptr<Stats> _stats;
public:
    MessageCountSocketHandler(SocketPoll &poll, /* bad style */
                        const std::string &uri,
                        const std::string &trace,
                        const std::shared_ptr<Stats> stats) :
        ReplaySocketHandler(poll, uri, trace),
        _measuring(false),
        _stats(stats)
    {
    }

    void handleMessage(const std::vector<char> &data) override
    {
        if (_measuring) {
            _stats->addMessage(data);
        }
        ReplaySocketHandler::handleMessage(data);
    }

    void startMeasurement() override
    {
        _measuring = true;
    }

    void stopMeasurement() override
    {
        _measuring = false;
    }
};

class MessageCountPerfTest : public Poco::Util::Application
{
public:
    MessageCountPerfTest() {}
protected:
    int  main(const std::vector<std::string>& args) override;
};

// coverity[root_function] : don't warn about uncaught exceptions
int MessageCountPerfTest::main(const std::vector<std::string>& args)
{
    if (args.size() != 2) {
        std::cerr << "Usage: ./messagecountperftest <server> <trace-path>" << std::endl;
        std::cerr << "       server : Started separately. URI must start with ws:// or wss://. eg: wss://localhost:9980" << std::endl;
        std::cerr << "       trace  : Created from make run-trace and manually edited." << std::endl;
        std::cerr << "       See README for more info." << std::endl;
        return EX_USAGE;
    }

    std::string server = args[0];
    if (!server.starts_with("ws")) {
        std::cerr << "Server must start with ws:// or wss://. Server was: " << server << std::endl;
        return EX_USAGE;
    }

    std::string trace = args[1];
    if (!std::filesystem::exists(trace)) {
        std::cerr << "Trace file does not exist. Trace was: " << trace << std::endl;
        return EX_USAGE;
    }

    std::cerr << "Starting" << std::endl;

#if ENABLE_SSL
    ssl::Manager::initializeClientContext("", "", "",
            "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH",
            ssl::CertificateVerification::Disabled);
    if (!ssl::Manager::isClientContextInitialized()) {
        std::cerr << "Failed to initialize Client SSL.\n";
        return -1;
    }
#endif

    std::string filePath = "../test/data/hello-world.odt";
    std::string fileUri = ReplaySocketHandler::getFileUri(filePath);
    std::string serverUri = ReplaySocketHandler::getServerUri(server, fileUri);

    auto stats = std::make_shared<Stats>();
    TerminatingPoll poll("MessageCountPerfTest poll");
    auto handler = std::make_shared<MessageCountSocketHandler>(poll, fileUri, trace, stats);

    ReplaySocketHandler::start(handler, poll, serverUri);

    do {
        poll.poll(TerminatingPoll::DefaultPollTimeoutMicroS);
    } while (poll.continuePolling() && poll.getSocketCount() > 0);

    std::cerr << "Finished" << std::endl;

    // This is supposed to be json
    std::cout << "{\n"
              << "    name: " << trace << ",\n"
              << "    messageCount: " << stats->_messageCount << ",\n"
              << "    messageBytes: " << stats->_messageBytes << "\n"
              << "}" << std::endl;

    return EX_OK;
}

// coverity[root_function] : don't warn about uncaught exceptions
POCO_APP_MAIN(MessageCountPerfTest)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
