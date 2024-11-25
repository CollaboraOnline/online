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

#include <random>

#include <process.h>

#include <common/Util.hpp>

namespace Util
{
    namespace rng
    {
        std::vector<char> getBytes(const std::size_t length)
        {
            std::vector<char> v(length);

            static std::random_device rd;
            size_t offset;
            size_t byteoffset = 0;
            std::random_device::result_type buffer;
            for (offset = 0; offset < length; offset++)
            {
                if (offset % sizeof(std::random_device::result_type) == 0)
                    buffer = rd();
                v[offset] = (buffer >> byteoffset) & 0xFF;
                byteoffset = (byteoffset + 8) % (8 * sizeof(std::random_device::result_type));
            }

            return v;
        }
    } // namespace rng

    long getProcessId()
    {
        return _getpid();
    }

    void time_t_to_localtime(std::time_t t, std::tm& tm)
    {
        localtime_s(&tm, &t);
    }
} // namespace Util

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
