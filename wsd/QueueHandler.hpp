/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <Poco/Runnable.h>

#include "Protocol.hpp"
#include "Session.hpp"
#include "MessageQueue.hpp"
#include "Util.hpp"

/// This thread handles incoming messages on a given kit instance.
class QueueHandler : public Poco::Runnable
{
public:
    QueueHandler(std::shared_ptr<MessageQueue> queue,
                 const std::shared_ptr<Session>& session,
                 const std::string& name):
        _queue(std::move(queue)),
        _session(session),
        _name(name)
    {
    }

    void run() override
    {
        Util::setThreadName(_name);

        LOG_DBG("Thread started.");

        try
        {
            while (true)
            {
                const auto input = _queue->get();
                if (LOOLProtocol::getFirstToken(input) == "eof")
                {
                    LOG_INF("Received EOF. Finishing.");
                    break;
                }

                if (!_session->handleInput(input.data(), input.size()))
                {
                    LOG_INF("Socket handler flagged for finishing.");
                    break;
                }
            }
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("QueueHandler::run: Exception: " << exc.what());
        }

        LOG_DBG("Thread finished.");
    }

private:
    std::shared_ptr<MessageQueue> _queue;
    std::shared_ptr<Session> _session;
    const std::string _name;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
