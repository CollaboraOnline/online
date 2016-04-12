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

#include <atomic>
#include <mutex>
#include <string>

#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/Random.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Util/ServerApplication.h>

#include "Auth.hpp"
#include "Common.hpp"
#include "DocumentBroker.hpp"
#include "Util.hpp"

class MasterProcessSession;

class LOOLWSD: public Poco::Util::ServerApplication
{
public:
    LOOLWSD();
    ~LOOLWSD();

    // An Application is a singleton anyway,
    // so just keep these as statics.
    static std::atomic<unsigned> NextSessionId;
    static unsigned int NumPreSpawnedChildren;
    static int ForKitWritePipe;
    static std::string Cache;
    static std::string SysTemplate;
    static std::string LoTemplate;
    static std::string ChildRoot;
    static std::string LoSubPath;
    static std::string FileServerRoot;
    static std::string AdminCreds;
    static bool AllowLocalStorage;

    static
    std::string GenSessionId()
    {
        return Util::encodeId(++NextSessionId, 4);
    }

protected:
    void initialize(Poco::Util::Application& self) override;
    void uninitialize() override;
    void defineOptions(Poco::Util::OptionSet& options) override;
    void handleOption(const std::string& name, const std::string& value) override;
    int main(const std::vector<std::string>& args) override;

private:
    void initializeSSL();
    void displayHelp();
    void displayVersion();
    Poco::Process::PID createForKit();

    /// Reads and processes path entries with the given property
    /// from the configuration.
    /// Converts relative paths to absolute.
    //TODO: Move to a better namespace.
    std::string getPathFromConfig(const std::string& property) const
    {
        auto path = config().getString(property);
        if (path.empty() && config().hasProperty(property + "[@default]"))
        {
            // Use the default value if empty and a default provided.
            path = config().getString(property + "[@default]");
        }

        // Reconstruct absolute path if relative.
        if (config().hasProperty(property + "[@relative]") &&
            config().getBool(property + "[@relative]"))
        {
            path = Poco::Path(Application::instance().commandPath()).parent().append(path).toString();
        }

        return path;
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
