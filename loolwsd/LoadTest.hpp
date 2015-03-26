/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOADTEST_HPP
#define INCLUDED_LOADTEST_HPP

#include <Poco/Util/Application.h>
#include <Poco/Util/OptionSet.h>

class LoadTest: public Poco::Util::Application
{
public:
    LoadTest();
    ~LoadTest();

    unsigned getNumDocsPerClient() const;
    unsigned getDuration() const;
    std::string getURL() const;
    std::vector<std::string> getDocList() const;

protected:
    void defineOptions(Poco::Util::OptionSet& options) override;
    void handleOption(const std::string& name, const std::string& value) override;
    void displayHelp();
    int main(const std::vector<std::string>& args) override;

private:
    std::vector<std::string> readDocList(const std::string& filename);

    unsigned _numClients;
    unsigned _numDocsPerClient;
    unsigned _duration;
    std::string _url;
    std::vector<std::string> _docList;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
