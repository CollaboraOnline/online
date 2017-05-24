/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <iostream>
#include <iomanip>
#include <termios.h>

#include <openssl/rand.h>
#include <openssl/evp.h>

#include <Poco/Exception.h>
#include <Poco/Util/Application.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Util/XMLConfiguration.h>

#include "Util.hpp"

using Poco::Util::Application;
using Poco::Util::Option;
using Poco::Util::OptionSet;
using Poco::Util::XMLConfiguration;

#define MIN_PWD_SALT_LENGTH 20
#define MIN_PWD_ITERATIONS 1000
#define MIN_PWD_HASH_LENGTH 20

class LoolConfig final: public XMLConfiguration
{
public:
    LoolConfig() :
        XMLConfiguration()
        {}
};

struct AdminConfig
{
    unsigned pwdSaltLength = 128;
    unsigned pwdIterations = 10000;
    unsigned pwdHashLength = 128;
};

// Config tool to change loolwsd configuration (loolwsd.xml)
class Config: public Application
{
    // Display help information on the console
    void displayHelp();

    LoolConfig _loolConfig;

    AdminConfig _adminConfig;

public:
    static std::string ConfigFile;

protected:
    void defineOptions(OptionSet&) override;
    void handleOption(const std::string&, const std::string&) override;
    int main(const std::vector<std::string>&) override;
};

std::string Config::ConfigFile = LOOLWSD_CONFIGDIR "/loolwsd.xml";

void Config::displayHelp()
{
    std::cout << "loolconfig - Configuration tool for LibreOffice Online." << std::endl
              << "Commands:" << std::endl
              << "  set-admin-password" << std::endl;
}

void Config::defineOptions(OptionSet& optionSet)
{
    Application::defineOptions(optionSet);

    optionSet.addOption(Option("help", "", "Config helper tool to set loolwsd configuration")
                        .required(false)
                        .repeatable(false));
    optionSet.addOption(Option("pwd-salt-length", "", "Length of the salt to use to hash password")
                        .required(false)
                        .repeatable(false).
                        argument("number"));
    optionSet.addOption(Option("pwd-iterations", "", "Number of iterations to do in PKDBF2 password hashing")
                        .required(false)
                        .repeatable(false)
                        .argument("number"));
    optionSet.addOption(Option("pwd-hash-length", "", "Length of password hash to generate")
                        .required(false)
                        .repeatable(false)
                        .argument("number"));
    optionSet.addOption(Option("config-file", "", "Specify configuration file path manually.")
                        .required(false)
                        .repeatable(false)
                        .argument("path"));
}

void Config::handleOption(const std::string& optionName, const std::string& optionValue)
{
    Application::handleOption(optionName, optionValue);
    if (optionName == "help")
    {
        displayHelp();
        std::exit(Application::EXIT_OK);
    }
    else if (optionName == "config-file")
    {
        ConfigFile = optionValue;
    }
    else if (optionName == "pwd-salt-length")
    {
        unsigned len = std::stoi(optionValue);
        if (len < MIN_PWD_SALT_LENGTH)
        {
            len = MIN_PWD_SALT_LENGTH;
            std::cout << "Password salt length adjusted to minimum " << len << std::endl;
        }
        _adminConfig.pwdSaltLength = len;
    }
    else if (optionName == "pwd-iterations")
    {
        unsigned len = std::stoi(optionValue);
        if (len < MIN_PWD_ITERATIONS)
        {
            len = MIN_PWD_ITERATIONS;
            std::cout << "Password iteration adjusted to minimum " << len << std::endl;
        }
        _adminConfig.pwdIterations = len;
    }
    else if (optionName == "pwd-hash-length")
    {
        unsigned len = std::stoi(optionValue);
        if (len < MIN_PWD_HASH_LENGTH)
        {
            len = MIN_PWD_HASH_LENGTH;
            std::cout << "Password hash length adjusted to minimum " << len << std::endl;
        }
        _adminConfig.pwdHashLength = len;
    }
}

int Config::main(const std::vector<std::string>& args)
{
    if (args.empty())
    {
        std::cerr << "Nothing to do." << std::endl;
        displayHelp();
        return Application::EXIT_NOINPUT;
    }

    _loolConfig.load(ConfigFile);

    for (unsigned i = 0; i < args.size(); i++) {
        if (args[i] == "set-admin-password")
        {
            unsigned char pwdhash[_adminConfig.pwdHashLength];
            unsigned char salt[_adminConfig.pwdSaltLength];
            RAND_bytes(salt, _adminConfig.pwdSaltLength);
            std::stringstream stream;

            // Ask for user password
            termios oldTermios;
            tcgetattr(STDIN_FILENO, &oldTermios);
            termios newTermios = oldTermios;
            // Disable user input mirroring on console for password input
            newTermios.c_lflag &= ~ECHO;
            tcsetattr(STDIN_FILENO, TCSANOW, &newTermios);
            std::string adminPwd;
            std::cout << "Enter admin password: ";
            std::cin >> adminPwd;
            std::string reAdminPwd;
            std::cout << std::endl << "Confirm admin password: ";
            std::cin >> reAdminPwd;
            std::cout << std::endl;
            // Set the termios to old state
            tcsetattr(STDIN_FILENO, TCSANOW, &oldTermios);
            if (adminPwd != reAdminPwd)
            {
                std::cout << "Password mismatch." << std::endl;
                return Application::EXIT_DATAERR;
            }

            // Do the magic !
            PKCS5_PBKDF2_HMAC(adminPwd.c_str(), -1,
                              salt, _adminConfig.pwdSaltLength,
                              _adminConfig.pwdIterations,
                              EVP_sha512(),
                              _adminConfig.pwdHashLength, pwdhash);

            // Make salt randomness readable
            for (unsigned j = 0; j < _adminConfig.pwdSaltLength; ++j)
                stream << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(salt[j]);
            const std::string saltHash = stream.str();

            // Clear our used hex stream to make space for password hash
            stream.str("");
            stream.clear();

            // Make the hashed password readable
            for (unsigned j = 0; j < _adminConfig.pwdHashLength; ++j)
                stream << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(pwdhash[j]);
            const std::string passwordHash = stream.str();

            const std::string pwdConfigValue = "pbkdf2.sha512." +
                                                std::to_string(_adminConfig.pwdIterations) + "." +
                                                saltHash + "." + passwordHash;
            _loolConfig.setString("admin_console.secure_password[@desc]",
                                  "Salt and password hash combination generated using PBKDF2 with SHA512 digest.");
            _loolConfig.setString("admin_console.secure_password", pwdConfigValue);

            std::cout << "Saving configuration to : " << ConfigFile << " ..." << std::endl;
            _loolConfig.save(ConfigFile);
        }
    }

    // This tool only handles options, nothing to do here
    return Application::EXIT_OK;
}

POCO_APP_MAIN(Config);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
