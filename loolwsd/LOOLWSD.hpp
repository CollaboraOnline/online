/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOOLWSD_HPP
#define INCLUDED_LOOLWSD_HPP

#include "config.h"

#include <string>
#include <mutex>
#include <atomic>

#include <Poco/Util/OptionSet.h>
#include <Poco/Random.h>
#include <Poco/Path.h>
#include <Poco/Util/ServerApplication.h>
#include <Poco/SharedMemory.h>
#include <Poco/NamedMutex.h>

#include "Util.hpp"

class LOOLWSD: public Poco::Util::ServerApplication
{
public:
    LOOLWSD();
    ~LOOLWSD();

    // An Application is a singleton anyway, so just keep these as
    // statics
    static std::atomic<unsigned> NextSessionId;
    static int NumPreSpawnedChildren;
    static int BrokerWritePipe;
    static bool doTest;
    static std::string cache;
    static std::string sysTemplate;
    static std::string loTemplate;
    static std::string childRoot;
    static std::string loSubPath;
    static Poco::NamedMutex NamedMutexLOOL;

    static const std::string CHILD_URI;
    static const std::string PIDLOG;
    static const std::string FIFO_FILE;
    static const std::string LOKIT_PIDLOG;

    static
    std::string GenSessionId()
    {
        return Util::encodeId(++NextSessionId, 4);
    }

protected:
    static void setSignals(bool bIgnore);
    static void handleSignal(int nSignal);

    void initialize(Poco::Util::Application& self) override;
    void uninitialize() override;
    void defineOptions(Poco::Util::OptionSet& options) override;
    void handleOption(const std::string& name, const std::string& value) override;
    int main(const std::vector<std::string>& args) override;

private:
    void displayHelp();
    void componentMain();
    void desktopMain();
    void startupComponent(int nComponents);
    void startupDesktop(int nDesktop);
    int  createComponent();
    int  createDesktop();

    void startupBroker(int nBroker);
    int  createBroker();
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
