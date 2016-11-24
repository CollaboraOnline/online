/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <dlfcn.h>
#include <ftw.h>
#include <cassert>
#include <iostream>
#include <sys/types.h>
#include <dirent.h>

#include "Common.hpp"
#include "IoUtil.hpp"
#include "Protocol.hpp"
#include <LOOLWebSocket.hpp>
#include "Unit.hpp"
#include "Util.hpp"

#include <Poco/Timestamp.h>
#include <Poco/StringTokenizer.h>

// Inside the WSD process
class UnitFuzz : public UnitWSD
{
public:
    UnitFuzz()
    {
        std::cerr << "UnitFuzz startup\n";
        setHasKitHooks();
    }

    virtual bool filterHandleRequest(
        TestRequest /* type */,
        Poco::Net::HTTPServerRequest& /* request */,
        Poco::Net::HTTPServerResponse& /* response */) override
    {
        return false;
    }
};

// Inside the forkit & kit processes
class UnitKitFuzz : public UnitKit
{
public:
    UnitKitFuzz()
    {
        std::cerr << "UnitKit Fuzz init !\n";
    }
    ~UnitKitFuzz()
    {
    }

    virtual bool filterKitMessage(const std::shared_ptr<LOOLWebSocket> & /* ws */,
                                  std::string & /* message */) override
    {
        return false;
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitFuzz();
}

UnitBase *unit_create_kit(void)
{
    return new UnitKitFuzz();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
