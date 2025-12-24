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

#include "Util.hpp"

#ifdef __linux__
#include <sys/time.h>
#include <sys/resource.h>
#elif defined __FreeBSD__
#include <sys/resource.h>
#endif

#include <dirent.h>

#include <fstream>
#include <iomanip>
#include <unistd.h>

#include <Poco/Exception.h>
#include "Log.hpp"

namespace Util
{

// TODO FIXME This should be shared with common/Util-linux.cpp, not a copy of that
class CounterImpl {
private:
    DIR* _dir = nullptr;

public:
    CounterImpl(const char* procPath)
        : _dir(opendir(procPath))
    {
        if (!_dir)
            LOG_ERR("No proc mounted for procPath " << procPath << ", can't count threads");
    }

    ~CounterImpl() { closedir(_dir); }

    int count()
    {
        if (!_dir)
            return -1;

        rewinddir(_dir);

        int tasks = 0;
        struct dirent* i;
        while ((i = readdir(_dir)))
        {
            if (i->d_name[0] != '.')
                tasks++;
        }

        return tasks;
    }
};

// TODO FIXME This is just a copy from a3334b96cdb25e1b6e90bb1a7313222b59658cc9, should be made to work
ThreadCounter::ThreadCounter() { pid = getpid(); }

ThreadCounter::~ThreadCounter() {}

int ThreadCounter::count()
{
    size_t len = 0, olen = 0;
    struct kinfo_proc* kipp = NULL;
    int name[4] = { CTL_KERN, KERN_PROC, KERN_PROC_PID | KERN_PROC_INC_THREAD, pid };
    int error = sysctl(name, 4, NULL, &len, NULL, 0);
    if (len == 0 || (error < 0 && errno != EPERM)) {
        goto fail;
    }
    do
    {
        len += len / 10;
        kipp = (struct kinfo_proc *) reallocf(kipp, len);
        if (kipp == NULL)
        {
            goto fail;
        }
        olen = len;
        error = sysctl(name, 4, kipp, &len, NULL, 0);
    } while (error < 0 && errno == ENOMEM && olen == len);

    if (error < 0 && errno != EPERM) {
        goto fail;
    }
    return len / sizeof(*kipp);

fail:
    if (kipp)
        free(kipp);
    return 0;
}

FDCounter::FDCounter() : _impl(new CounterImpl("/proc/self/fd")) {}

FDCounter::~FDCounter() = default;

int FDCounter::count() { return _impl->count(); }

} // namespace Util

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
