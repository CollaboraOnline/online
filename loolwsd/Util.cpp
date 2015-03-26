/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <string>

#include <Poco/Process.h>
#include <Poco/Thread.h>

#include "Util.hpp"

namespace Util
{

    std::string logPrefix()
    {
        return std::to_string(Poco::Process::id()) + ":" + (Poco::Thread::current() ? std::to_string(Poco::Thread::current()->id()) : "0") + ": ";
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
