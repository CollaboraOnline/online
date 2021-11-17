/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <iostream>
#include <iomanip>
#include <sstream>
#include <sysexits.h>
#include <termios.h>
#include <unistd.h>

#include <openssl/rand.h>
#include <openssl/evp.h>

#include <Poco/Exception.h>
#include <Poco/Util/Application.h>
#include <Poco/Util/HelpFormatter.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Util/XMLConfiguration.h>

#include <Util.hpp>
#include <Crypto.hpp>

using Poco::Util::Application;
using Poco::Util::HelpFormatter;
using Poco::Util::Option;
using Poco::Util::OptionSet;
using Poco::Util::XMLConfiguration;

#define MIN_PWD_SALT_LENGTH 20
#define MIN_PWD_ITERATIONS 1000
#define MIN_PWD_HASH_LENGTH 20

class CoolConfig final: public XMLConfiguration
{
public:
    CoolConfig()
        {}
};

struct AdminConfig
{
private:
    unsigned _pwdSaltLength = 128;
    unsigned _pwdIterations = 10000;
    unsigned _pwdHashLength = 128;
public:

    void setPwdSaltLength(unsigned pwdSaltLength) { _pwdSaltLength = pwdSaltLength; }
    unsigned getPwdSaltLength() const { return _pwdSaltLength; }
    void setPwdIterations(unsigned pwdIterations) { _pwdIterations = pwdIterations; }
    unsigned getPwdIterations() const { return _pwdIterations; }
    void setPwdHashLength(unsigned pwdHashLength) { _pwdHashLength = pwdHashLength; }
    unsigned getPwdHashLength() const { return _pwdHashLength; }
};

// Config tool to change loolwsd configuration (loolwsd.xml)
class Config: public Application
{
    // Display help information on the console
    void displayHelp();

    CoolConfig _coolConfig;

    AdminConfig _adminConfig;

public:
    static std::string ConfigFile;
    static std::string SupportKeyString;
    static bool SupportKeyStringProvided;
    static std::uint64_t AnonymizationSalt;
    static bool AnonymizationSaltProvided;

protected:
    void defineOptions(OptionSet&) override;
    void handleOption(const std::string&, const std::string&) override;
    int main(const std::vector<std::string>&) override;
};

std::string Config::ConfigFile =
#if ENABLE_DEBUG
    DEBUG_ABSSRCDIR
#else
    LOOLWSD_CONFIGDIR
#endif
    "/loolwsd.xml";

std::string Config::SupportKeyString;
bool Config::SupportKeyStringProvided = false;
std::uint64_t Config::AnonymizationSalt = 0;
bool Config::AnonymizationSaltProvided = false;

void Config::displayHelp()
{
    HelpFormatter helpFormatter(options());
    helpFormatter.setCommand(commandName());
    helpFormatter.setUsage("COMMAND [OPTIONS]");
    helpFormatter.setHeader("coolconfig - Configuration tool for Collabora Online.\n"
                            "\n"
                            "Some options make sense only with a specific command.\n\n"
                            "Options:");

    helpFormatter.format(std::cout);

    // Command list
    std::cout << std::endl
              << "Commands: " << std::endl
              << "    anonymize [string-1]...[string-n]" << std::endl
              << "    set-admin-password" << std::endl
#if ENABLE_SUPPORT_KEY
              << "    set-support-key" << std::endl
#endif
              << "    set <key> <value>" << std::endl
              << "    update-system-template" << std::endl << std::endl;
}

void Config::defineOptions(OptionSet& optionSet)
{
    Application::defineOptions(optionSet);

    optionSet.addOption(Option("help", "h", "Show this usage information.")
                        .required(false)
                        .repeatable(false));
    optionSet.addOption(Option("config-file", "", "Specify configuration file path manually.")
                        .required(false)
                        .repeatable(false)
                        .argument("path"));

    optionSet.addOption(Option("pwd-salt-length", "", "Length of the salt to use to hash password [set-admin-password].")
                        .required(false)
                        .repeatable(false).
                        argument("number"));
    optionSet.addOption(Option("pwd-iterations", "", "Number of iterations to do in PKDBF2 password hashing [set-admin-password].")
                        .required(false)
                        .repeatable(false)
                        .argument("number"));
    optionSet.addOption(Option("pwd-hash-length", "", "Length of password hash to generate [set-admin-password].")
                        .required(false)
                        .repeatable(false)
                        .argument("number"));

#if ENABLE_SUPPORT_KEY
    optionSet.addOption(Option("support-key", "", "Specify the support key [set-support-key].")
                        .required(false)
                        .repeatable(false)
                        .argument("key"));
#endif

    optionSet.addOption(Option("anonymization-salt", "", "Anonymize strings with the given 64-bit salt instead of the one in the config file.")
                        .required(false)
                        .repeatable(false)
                        .argument("salt"));
}

void Config::handleOption(const std::string& optionName, const std::string& optionValue)
{
    Application::handleOption(optionName, optionValue);
    if (optionName == "help")
    {
        displayHelp();
        std::exit(EX_OK);
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
        _adminConfig.setPwdSaltLength(len);
    }
    else if (optionName == "pwd-iterations")
    {
        unsigned len = std::stoi(optionValue);
        if (len < MIN_PWD_ITERATIONS)
        {
            len = MIN_PWD_ITERATIONS;
            std::cout << "Password iteration adjusted to minimum " << len << std::endl;
        }
        _adminConfig.setPwdIterations(len);
    }
    else if (optionName == "pwd-hash-length")
    {
        unsigned len = std::stoi(optionValue);
        if (len < MIN_PWD_HASH_LENGTH)
        {
            len = MIN_PWD_HASH_LENGTH;
            std::cout << "Password hash length adjusted to minimum " << len << std::endl;
        }
        _adminConfig.setPwdHashLength(len);
    }
    else if (optionName == "support-key")
    {
        SupportKeyString = optionValue;
        SupportKeyStringProvided = true;
    }
    else if (optionName == "anonymization-salt")
    {
        AnonymizationSalt = std::stoull(optionValue);
        AnonymizationSaltProvided = true;
        std::cout << "Anonymization Salt: [" << AnonymizationSalt << "]." << std::endl;
    }
}

int Config::main(const std::vector<std::string>& args)
{
    if (args.empty())
    {
        std::cerr << "Nothing to do." << std::endl;
        displayHelp();
        return EX_NOINPUT;
    }

    int retval = EX_OK;
    bool changed = false;
    _coolConfig.load(ConfigFile);

    if (args[0] == "set-admin-password")
    {
#if HAVE_PKCS5_PBKDF2_HMAC
        unsigned char pwdhash[_adminConfig.getPwdHashLength()];
        unsigned char salt[_adminConfig.getPwdSaltLength()];
        RAND_bytes(salt, _adminConfig.getPwdSaltLength());
        std::stringstream stream;

        // Ask for admin username
        std::string adminUser;
        std::cout << "Enter admin username [admin]: ";
        std::getline(std::cin, adminUser);
        if (adminUser.empty())
        {
            adminUser = "admin";
        }

        // Ask for user password
        termios oldTermios;
        tcgetattr(STDIN_FILENO, &oldTermios);
        termios newTermios = oldTermios;
        // Disable user input mirroring on console for password input
        newTermios.c_lflag &= ~ECHO;
        tcsetattr(STDIN_FILENO, TCSANOW, &newTermios);
        std::string adminPwd;
        std::cout << "Enter admin password: ";
        std::getline(std::cin, adminPwd);
        std::string reAdminPwd;
        std::cout << std::endl << "Confirm admin password: ";
        std::getline(std::cin, reAdminPwd);
        std::cout << std::endl;
        // Set the termios to old state
        tcsetattr(STDIN_FILENO, TCSANOW, &oldTermios);
        if (adminPwd != reAdminPwd)
        {
            std::cout << "Password mismatch." << std::endl;
            return EX_DATAERR;
        }

        // Do the magic !
        PKCS5_PBKDF2_HMAC(adminPwd.c_str(), -1,
                          salt, _adminConfig.getPwdSaltLength(),
                          _adminConfig.getPwdIterations(),
                          EVP_sha512(),
                          _adminConfig.getPwdHashLength(), pwdhash);

        // Make salt randomness readable
        for (unsigned j = 0; j < _adminConfig.getPwdSaltLength(); ++j)
            stream << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(salt[j]);
        const std::string saltHash = stream.str();

        // Clear our used hex stream to make space for password hash
        stream.str("");
        stream.clear();

        // Make the hashed password readable
        for (unsigned j = 0; j < _adminConfig.getPwdHashLength(); ++j)
            stream << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(pwdhash[j]);
        const std::string passwordHash = stream.str();

        std::stringstream pwdConfigValue("pbkdf2.sha512.", std::ios_base::in | std::ios_base::out | std::ios_base::ate);
        pwdConfigValue << std::to_string(_adminConfig.getPwdIterations()) << '.';
        pwdConfigValue << saltHash << '.' << passwordHash;
        _coolConfig.setString("admin_console.username", adminUser);
        _coolConfig.setString("admin_console.secure_password[@desc]",
                              "Salt and password hash combination generated using PBKDF2 with SHA512 digest.");
        _coolConfig.setString("admin_console.secure_password", pwdConfigValue.str());

        changed = true;
#else
        std::cerr << "This application was compiled with old OpenSSL. Operation not supported. You can use plain text password in /etc/loolwsd/loolwsd.xml." << std::endl;
        return EX_UNAVAILABLE;
#endif
    }
#if ENABLE_SUPPORT_KEY
    else if (args[0] == "set-support-key")
    {
        std::string supportKeyString;
        if (SupportKeyStringProvided)
            supportKeyString = SupportKeyString;
        else
        {
            std::cout << "Enter support key: ";
            std::getline(std::cin, supportKeyString);
        }

        if (!supportKeyString.empty())
        {
            SupportKey key(supportKeyString);
            if (!key.verify())
                std::cerr << "Invalid key\n";
            else {
                int validDays =  key.validDaysRemaining();
                if (validDays <= 0)
                    std::cerr << "Valid but expired key\n";
                else
                {
                    std::cerr << "Valid for " << validDays << " days - setting to config\n";
                    _coolConfig.setString("support_key", supportKeyString);
                    changed = true;
                }
            }
        }
        else
        {
            std::cerr << "Removing empty support key\n";
            _coolConfig.remove("support_key");
            changed = true;
        }
    }
#endif
    else if (args[0] == "set")
    {
        if (args.size() == 3)
        {
            // args[1] = key
            // args[2] = value
            if (_coolConfig.has(args[1]))
            {
                const std::string val = _coolConfig.getString(args[1]);
                std::cout << "Previous value found in config file: \""  << val << '"' << std::endl;
                std::cout << "Changing value to: \"" << args[2] << '"' << std::endl;
                _coolConfig.setString(args[1], args[2]);
                changed = true;
            }
            else
                std::cerr << "No property, \"" << args[1] << "\"," << " found in config file." << std::endl;
        }
        else
            std::cerr << "set expects a key and value as arguments" << std::endl
                      << "Eg: " << std::endl
                      << "    set logging.level trace" << std::endl;

    }
    else if (args[0] == "update-system-template")
    {
        const char command[] = "coolwsd-systemplate-setup /opt/cool/systemplate " LO_PATH " >/dev/null 2>&1";
        std::cout << "Running the following command:" << std::endl
                  << command << std::endl;

        retval = system(command);
        if (retval != 0)
            std::cerr << "Error when executing command." << std::endl;
    }
    else if (args[0] == "anonymize")
    {
        if (!AnonymizationSaltProvided)
        {
            const std::string val = _coolConfig.getString("logging.anonymize.anonymization_salt");
            AnonymizationSalt = std::stoull(val);
            std::cout << "Anonymization Salt: [" << AnonymizationSalt << "]." << std::endl;
        }

        for (std::size_t i = 1; i < args.size(); ++i)
        {
            std::cout << '[' << args[i] << "]: " << Util::anonymizeUrl(args[i], AnonymizationSalt) << std::endl;
        }
    }
    else
    {
        std::cerr << "No such command, \"" << args[0]  << '"' << std::endl;
        displayHelp();
    }

    if (changed)
    {
        std::cout << "Saving configuration to : " << ConfigFile << " ..." << std::endl;
        _coolConfig.save(ConfigFile);
        std::cout << "Saved" << std::endl;
    }

    return retval;
}

POCO_APP_MAIN(Config);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
