/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <Poco/Runnable.h>

#include "MessageQueue.hpp"
#include "LOOLSession.hpp"
#include "Util.hpp"

// This thread handles incoming messages
// on a given kit instance.
class QueueHandler: public Poco::Runnable
{
public:
    QueueHandler(MessageQueue& queue, const std::shared_ptr<LOOLSession>& session):
        _queue(queue),
        _session(session)
    {
    }

    void run() override
    {
        static const std::string thread_name = "kit_queue_" + _session->getId();
#ifdef __linux
        if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(thread_name.c_str()), 0, 0, 0) != 0)
            Log::error("Cannot set thread name to " + thread_name + ".");
#endif
        Log::debug("Thread [" + thread_name + "] started.");

        try
        {
            while (true)
            {
                const std::string input = _queue.get();
                if (input == "eof")
                    break;
                if (!_session->handleInput(input.c_str(), input.size()))
                    break;
            }
        }
        catch (const std::exception& exc)
        {
            Log::error(std::string("Exception: ") + exc.what());
            raise(SIGABRT);
        }
        catch (...)
        {
            Log::error("Unexpected Exception.");
            raise(SIGABRT);
        }

        Log::debug("Thread [" + thread_name + "] finished.");
    }

private:
    MessageQueue& _queue;
    std::shared_ptr<LOOLSession> _session;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
