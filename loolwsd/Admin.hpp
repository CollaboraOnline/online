/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_ADMIN_HPP
#define INCLUDED_ADMIN_HPP

#include <Poco/Net/HTTPServer.h>
#include <Poco/Runnable.h>
#include <Poco/Types.h>

#include "AdminModel.hpp"

const std::string FIFO_NOTIFY = "loolnotify.fifo";

/// An admin command processor.
class Admin : public Poco::Runnable
{
public:
    Admin(const int brokerPipe, const int notifyPipe);

    ~Admin();

    static int getBrokerPid() { return Admin::BrokerPipe; }

    void run() override;

    AdminModel& getModel();

private:
    void handleInput(std::string& message);

private:
    Poco::Net::HTTPServer _srv;
    AdminModel _model;

    static int BrokerPipe;
    static int NotifyPipe;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
