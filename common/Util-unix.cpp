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

#include <fcntl.h>
#include <time.h>
#include <unistd.h>

#include <common/Log.hpp>
#include <common/Util.hpp>

namespace Util
{
    namespace rng
    {
        int getURandom()
        {
            static int urandom = open("/dev/urandom", O_RDONLY);
            if (urandom < 0)
            {
                LOG_SYS("Failed to source hard random numbers");
                fprintf(stderr, "No adequate source of randomness");
                abort();
                // Potentially dangerous to continue without randomness
            }
            return urandom;
        }

        // Since we have a fd always open to /dev/urandom
        // 'read' is hopefully no less efficient than getrandom.
        std::vector<char> getBytes(const std::size_t length)
        {
            std::vector<char> v(length);
            char* p = v.data();
            size_t nbytes = length;

            while (nbytes)
            {
                ssize_t b = read(getURandom(), p, nbytes);
                if (b <= 0)
                {
                    if (errno == EINTR)
                        continue;
                    break;
                }

                assert(static_cast<size_t>(b) <= nbytes);

                nbytes -= b;
                p += b;
            }

            size_t offset = p - v.data();
            if (offset < length)
            {
                fprintf(stderr, "No adequate source of randomness, "
                        "failed to read %ld bytes: with error %s\n",
                        (long int)length, strerror(errno));
                // Potentially dangerous to continue without randomness
                abort();
            }

            return v;
        }
    } // namespace rng

    long getProcessId()
    {
        return getpid();
    }

    void time_t_to_localtime(std::time_t t, std::tm& tm)
    {
        localtime_r(&t, &tm);
    }
} // namespace Util

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
