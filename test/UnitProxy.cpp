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

#include <iostream>

#include <Common.hpp>
#include <Protocol.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include <FileUtil.hpp>
#include <helpers.hpp>
#include <net/HttpRequest.hpp>

// Inside the WSD process
class UnitProxy : public UnitWSD
{
    std::thread _worker;
    std::shared_ptr<SocketPoll>  _poll;
    http::Request _req;
    bool _sentRequest;

public:
    UnitProxy()
        : UnitWSD("UnitProxy"),
          _poll(std::make_shared<SocketPoll>("proxy-poll")),
          _sentRequest(false)
    {
        setTimeout(std::chrono::seconds(10));
    }

    void invokeWSDTest() override
    {
        if (_sentRequest)
            return; // be more patient.
        _sentRequest = true;

        auto httpSession = http::Session::create(helpers::getTestServerURI());

        httpSession->setTimeout(std::chrono::seconds(9));

        TST_LOG("Attempt proxy URL fetch");

        // Request from rating.collaboraonline.com.
        _req = http::Request("/browser/a90f83c/foo/remote/static/lokit-extra-img.svg");

        httpSession->setConnectFailHandler([this](const std::shared_ptr<http::Session>&) {
            LOK_ASSERT_FAIL("Unexpected connection failure");
        });

        httpSession->setFinishedHandler([&](const std::shared_ptr<http::Session>&) {
            TST_LOG("Got a valid response from the proxy");
            // any result short of server choking is fine - we may be off-line
            exitTest(TestResult::Ok);
        });

        httpSession->asyncRequest(_req, _poll);

        _poll->startThread();
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitProxy();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
