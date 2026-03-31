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
 * Fuzzer for HTTP response parsing.
 * Functions: LLVMFuzzerTestOneInput() - Tests http::Response parsing
 */

#include <config.h>

#include <fuzzer/Common.hpp>
#include <net/HttpRequest.hpp>
#include <net/HttpRequest.hpp>
#include <test/MockStreamSocket.hpp>
#include <wsd/ClientRequestDispatcher.hpp>
#include <wsd/ContentType.hpp>

#include <cstdint>

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size)
{
    [[maybe_unused]] static bool initialized = fuzzer::DoInitialization();

    std::shared_ptr<ProtocolHandlerInterface> handler = std::make_shared<ClientRequestDispatcher>();

    try
    {
        const uint8_t* pos = data;
        const uint8_t* const end = data + size;
        while (pos < end)
        {
            const uint8_t* nul = static_cast<const uint8_t*>(memchr(pos, '\0', end - pos));
            const uint8_t* blockEnd = nul ? nul : end;
            size_t blockSize = blockEnd - pos;
            if (blockSize > 1)
            {
                auto socket = std::make_shared<MockStreamSocket>();
                socket->setHandler(handler);
                handler->onConnect(socket);

                // Inject the HTTP request into the socket's input buffer.
                auto& inBuf = socket->getInBuffer();
                inBuf.append(reinterpret_cast<const char*>(pos), blockSize);

                SocketDisposition disposition(socket);
                handler->handleIncomingMessage(disposition);
                if (disposition.isTransfer())
                {
                    disposition.execute(); // In case we have to move, to clear it.
                }
            }

            pos = blockEnd + 1; // skip past the null separator
        }
    }
    catch (const std::exception&)
    {
        // Bad Request, etc.
    }

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
