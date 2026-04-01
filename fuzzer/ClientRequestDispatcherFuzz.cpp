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

/*
 * Fuzzer for ClientRequestDispatcher HTTP request handling.
 * Functions: LLVMFuzzerTestOneInput() - Tests ClientRequestDispatcher
 */

#include <config.h>

#include <fuzzer/Common.hpp>
#include <net/HttpRequest.hpp>
#include <test/MockStreamSocket.hpp>
#include <wsd/ClientRequestDispatcher.hpp>
#include <wsd/ContentType.hpp>

#include <cstdint>

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size)
{
    [[maybe_unused]] static bool initialized = fuzzer::DoInitialization();

    try
    {
        std::shared_ptr<ProtocolHandlerInterface> handler =
            std::make_shared<ClientRequestDispatcher>();

        const uint8_t* pos = data;
        const uint8_t* const end = data + size;
        while (pos < end)
        {
            // Skip null streaks.
            while (*pos == '\0')
            {
                if (++pos >= end)
                    return 0;
            }

            auto socket = std::make_shared<MockStreamSocket>();
            socket->setHandler(handler);
            handler->onConnect(socket);
            Buffer& inBuf = socket->getInBuffer();

            assert(pos < end);
            const uint8_t* nul = static_cast<const uint8_t*>(memchr(pos, '\0', end - pos));
            const uint8_t* blockEnd = nul ? nul : end;
            const size_t blockSize = blockEnd - pos;
            for (size_t subSize = 1; subSize <= blockSize; ++subSize)
            {
                // Inject the HTTP request into the socket's input buffer, one byte at a time.
                inBuf.append(reinterpret_cast<const char*>(pos), 1);
                ++pos;

                SocketDisposition disposition(socket);
                handler->handleIncomingMessage(disposition);
                if (disposition.isTransfer())
                {
                    disposition.execute(); // In case we have to move, to clear it.
                    break; // We can't reuse this socket.
                }
            }
        }
    }
    catch (const std::exception&)
    {
        // Bad Request, etc.
    }

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
