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
    QueueHandler(MessageQueue& queue, const std::shared_ptr<LOOLSession>& session,
                 const std::string& name):
        _queue(queue),
        _session(session),
        _name(name)
    {
    }

    void run() override
    {
#ifdef __linux
        if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(_name.c_str()), 0, 0, 0) != 0)
            Log::error("Cannot set thread name to " + _name + ".");
#endif
        Log::debug("Thread [" + _name + "] started.");

        try
        {
            while (true)
            {
                const std::string input = _queue.get();
                if (input == "eof")
                {
                    Log::info("Received EOF. Finishing.");
                    break;
                }

                if (!_session->handleInput(input.c_str(), input.size()))
                {
                    Log::info("Socket handler flagged for finishing.");
                    break;
                }
            }
        }
        catch (const std::exception& exc)
        {
            Log::error(std::string("Exception: ") + exc.what());
        }
        catch (...)
        {
            Log::error("Unexpected Exception.");
        }

        Log::debug("Thread [" + _name + "] finished.");
    }

private:
    MessageQueue& _queue;
    std::shared_ptr<LOOLSession> _session;
    const std::string _name;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
