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

#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Timestamp.h>

#include "Common.hpp"
#include "LOOLProtocol.hpp"
#include "Log.hpp"
#include "Unit.hpp"
#include "Util.hpp"

#define UNIT_URI "/loolwsd/unit-font"

namespace {
    // interrogate the vcl/ fontmanager for its hook ...
    std::string getFontList()
    {
        void *me = dlopen(NULL,RTLD_NOW);
        typedef const char *(GetFontsFn)(void);
        GetFontsFn *fn = reinterpret_cast<GetFontsFn *>(
                                dlsym(me, "unit_online_get_fonts"));
        if (fn)
            return std::string(fn());
        else
            return std::string("can't find unit_online_get_fonts hook");
    }

    std::string readFontList(const std::shared_ptr<LOOLWebSocket> &socket)
    {
        int flags;
        char buffer[100 * 1000];

        int length = socket->receiveFrame(buffer, sizeof (buffer), flags);
        if (length > 0)
        {
            assert(length<(int)sizeof(buffer));
            buffer[length] = '\0';
            return std::string(buffer);
        }
        else
            return std::string("read failure");
    }
}

// Inside the WSD process
class UnitPrefork : public UnitWSD
{
    std::string _fontsKit;
    std::string _fontsBroker;
public:
    UnitPrefork()
    {
        setHasKitHooks();
    }

    void check()
    {
        if (!_fontsKit.length() || !_fontsBroker.length())
            return; // defer till we have all the data.
        if (_fontsKit != _fontsBroker)
        {
            std::cerr << "Error - font list mismatch" << std::endl;
            std::cerr << "Kit : '" << _fontsKit << "' vs. Broker : '" << _fontsBroker << "'" << std::endl;
            exitTest(TestResult::TEST_FAILED);
        }
        else
        {
            Poco::StringTokenizer tokens(_fontsKit, "\n");
            if (tokens.count() > 0)
                std::cerr << "  " << tokens[0] << std::endl;

            exitTest(TestResult::TEST_OK);
        }
    }

    virtual void newChild(const std::shared_ptr<LOOLWebSocket> &socket) override
    {
        Log::info("Fetching font list from kit");
        socket->sendFrame("unit-getfontlist: \n",
                          sizeof("unit-getfontlist: \n") - 1);
        _fontsKit = readFontList(socket);
        check();
    }

    virtual bool filterHandleRequest(
                     TestRequest type,
                     Poco::Net::HTTPServerRequest& request,
                     Poco::Net::HTTPServerResponse& response) override
    {
        if (type == UnitWSD::TestRequest::TEST_REQ_PRISONER &&
            request.getURI().find(UNIT_URI) == 0)
        {
            auto ws = std::make_shared<LOOLWebSocket>(request, response);
            _fontsBroker = readFontList(ws);
            check();
            return true;
        }

        return false;
    }
};

// Inside the forkit & kit processes
class UnitKitPrefork : public UnitKit
{
public:
    UnitKitPrefork()
    {
    }

    // Called in the forkit after forking the kit
    virtual void launchedKit(int /* pid */) override
    {
        // Open websocket connection between the child process and WSD.
        Poco::Net::HTTPClientSession cs("127.0.0.1", MasterPortNumber);
        cs.setTimeout(0);
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET,
                                       std::string(UNIT_URI));
        Poco::Net::HTTPResponse response;
        auto ws = std::make_shared<LOOLWebSocket>(cs, request, response);
        ws->setReceiveTimeout(0);
        Log::info("Fetching font list from forkit");
        std::string fontListMsg = getFontList() + "\n";
        ws->sendFrame(fontListMsg.c_str(), fontListMsg.length());
    }

    // Called from WSD and handled inside the kit.
    virtual bool filterKitMessage(const std::shared_ptr<LOOLWebSocket> &ws,
                                  std::string &message) override
    {
        const std::string token = LOOLProtocol::getFirstToken(message);
        if (token == "unit-getfontlist:")
        {
            const std::string fontListReply = getFontList() + "\n";
            ws->sendFrame(fontListReply.c_str(), fontListReply.length());
            return true;
        }

        return false;
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitPrefork();
}

UnitBase *unit_create_kit(void)
{
    return new UnitKitPrefork();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
