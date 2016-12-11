/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "SenderQueue.hpp"

#include <algorithm>

#include <Protocol.hpp>
#include <Log.hpp>

SenderQueue SenderQueue::TheQueue;

bool DispatchSendItem(const size_t timeoutMs)
{
    SendItem item;
    if (SenderQueue::instance().waitDequeue(item, timeoutMs))
    {
        auto session = item.Session.lock();
        if (session)
        {
            try
            {
                const std::vector<char>& data = item.Data->data();
                if (item.Data->isBinary())
                {
                    return session->sendBinaryFrame(data.data(), data.size());
                }
                else
                {
                    return session->sendTextFrame(data.data(), data.size());
                }
            }
            catch (const std::exception& ex)
            {
                LOG_ERR("Failed to send tile to " << session->getName() << ": " << ex.what());
            }
        }
    }

    return false;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
