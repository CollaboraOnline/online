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

#include <sys/types.h>
#include <time.h>
#include <unistd.h>

#include <common/Util.hpp>

namespace Util
{
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
