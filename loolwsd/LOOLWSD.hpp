/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOOLWSD_HPP
#define INCLUDED_LOOLWSD_HPP

#include <string>

#include <Poco/Util/OptionSet.h>
#include <Poco/Util/ServerApplication.h>

class LOOLWSD: public Poco::Util::ServerApplication
{
public:
    LOOLWSD();
    ~LOOLWSD();

    // An Application is a singleton anyway, so just keep these as
    // statics
    static int portNumber;
    static std::string sysTemplate;
    static std::string loTemplate;
    static std::string childRoot;
    static std::string loSubPath;
    static std::string jail;

    static int numPreForkedChildren;

    static const int DEFAULT_PORT_NUMBER = 9980;

protected:
    void initialize(Poco::Util::Application& self) override;
    void uninitialize() override;
    void defineOptions(Poco::Util::OptionSet& options) override;
    void handleOption(const std::string& name, const std::string& value) override;
    int main(const std::vector<std::string>& args) override;

private:
    void displayHelp();
    int childMain();
    bool childMode() const;

    bool _doTest;
    long long _childId;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
