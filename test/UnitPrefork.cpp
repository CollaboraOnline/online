/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <Unit.hpp>
#include <wsd/LOOLWSD.hpp>

const int NumToPrefork = 20;

// Inside the WSD process
class UnitPrefork : public UnitWSD
{
    std::chrono::steady_clock::time_point _startTime = std::chrono::steady_clock::now();
    std::atomic< int > _childSockets;

public:
    UnitPrefork()
        : _childSockets(0)
    {
        setTimeout(60 * 1000);
    }

    virtual void configure(Poco::Util::LayeredConfiguration& config) override
    {
        config.setInt("num_prespawn_children", NumToPrefork);
        UnitWSD::configure(config);
    }

    virtual void newChild(WebSocketHandler &) override
    {
        _childSockets++;
        LOG_INF("Unit-prefork: got new child, have " << _childSockets << " of " << NumToPrefork);

        if (_childSockets >= NumToPrefork)
        {
            const auto duration = std::chrono::steady_clock::now() - _startTime;
            const auto totalTime = std::chrono::duration_cast<std::chrono::milliseconds>(duration);

            LOG_INF("Launched " << _childSockets << " in " << totalTime);
            std::cerr << "Launch time total   " << totalTime << std::endl;
            std::cerr << "Launch time average " << (totalTime.count() / _childSockets) << "ms"
                      << std::endl;

            exitTest(TestResult::Ok);
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitPrefork();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
