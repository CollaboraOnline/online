#include <iostream>
#include <memory>
#include <sstream>
#include <string>

#include <Poco/Util/XMLConfiguration.h>
#include <Poco/Util/AbstractConfiguration.h>
#include <Poco/AutoPtr.h>

using Poco::Util::XMLConfiguration;
using Poco::Util::AbstractConfiguration;

static const std::set<std::string> multiElems {".net.post_allow.host", ".storage.wopi.host", ".logging.file.property", ".ssl.hpkp.pins"};
static const std::map<std::string, std::string> renamedElems { {"loleaflet_logging", "browser_logging"} };
static const std::map<std::string, std::string> specialDefault {
                    {".ssl.cert_file_path", "/etc/loolwsd/cert.pem"},
                    {".ssl.key_file_path", "/etc/loolwsd/key.pem"},
                    {".ssl.ca_file_path", "/etc/loolwsd/ca-chain.cert.pem"},
                    {".ssl.termination", "false"},
                    {".logging.file.property[@name=path]", "/var/log/loolwsd.log"} };
static const std::map<std::string, std::string> specialAttribute {
                    {".logging.file", "enable"},
                    {".trace_event", "enable"},
                    {".trace.path","compress"},
                    {".trace.path","snapshot"},
                    {".net.post_allow","allow"},
                    {".ssl.hpkp","enable"},
                    {".ssl.hpkp","report_only"},
                    {".ssl.hpkp.max_age","enable"},
                    {".ssl.hpkp.report_uri","enable"} };
//                    {".storage.filesystem","allow"}, // don't migrate this
//                    {".storage.wopi","allow"}, // and this

void MigrateLevel(const XMLConfiguration &sourceConfig, XMLConfiguration &targetConfig, bool write, const std::string sourceLevel)
{
    Poco::Util::AbstractConfiguration::Keys subKeys;
    sourceConfig.keys(sourceLevel, subKeys);
    for (auto key: subKeys)
    {
        const std::string fullKey = sourceLevel + "." + key;
        MigrateLevel(sourceConfig, targetConfig, write, fullKey);
    }
    if (subKeys.empty())
    {
        const std::string sourceElement = sourceConfig.getString(sourceLevel);
        // Need to handle keys pointing to multiple elements separately, refer to multiElems
        const std::string commonKeyPart =
                sourceLevel.find("[") != std::string::npos ? sourceLevel.substr(0, sourceLevel.find("[")) : sourceLevel;
        if (multiElems.find(commonKeyPart) != multiElems.end())
        {
            if (commonKeyPart == ".logging.file.property")
            {
                const std::string propName = sourceConfig.getString(sourceLevel + "[@name]");
                const std::string targetKey = commonKeyPart + "[@name=" + propName + "]";
                const std::string targetElement = targetConfig.getString(targetKey);
                const bool hasSpecialDefault = specialDefault.find(targetKey) != specialDefault.end();
                if (targetElement != sourceElement && (!hasSpecialDefault || sourceElement != specialDefault.at(targetKey)))
                {
                    std::cout << targetKey << ": replaced \"" << targetElement << "\" with \"" << sourceElement << "\"." << std::endl;

                    targetConfig.setString(targetKey, sourceElement);
                }
            }
            else if (commonKeyPart == ".net.post_allow.host" || commonKeyPart == ".storage.wopi.host")
            {
                bool foundKey = false;
                int id = 0;
                while (!foundKey)
                {
                    const std::string targetKey(id == 0 ? commonKeyPart : commonKeyPart + "[" + std::to_string(id) + "]");
                    if (!targetConfig.has(targetKey))
                    {
                        break;
                    }
                    if (targetConfig.getString(targetKey) == sourceElement)
                    {
                        foundKey = true;
                    }
                    id++;
                }
                if (!foundKey)
                {
                    const std::string targetKeyRoot(commonKeyPart + "[" + std::to_string(id) + "]");
                    std::cout << targetKeyRoot << ": added \"" << sourceElement << "\"." << std::endl;

                    targetConfig.setString(targetKeyRoot, sourceElement);
                    targetConfig.setString(targetKeyRoot + "[@desc]", sourceConfig.getString(sourceLevel + "[@desc]"));
                    // for WOPI host, copy "allow" attribute as well
                    if (commonKeyPart == ".storage.wopi.host")
                    {
                        targetConfig.setString(targetKeyRoot + "[@allow]", sourceConfig.getString(sourceLevel + "[@allow]"));
                    }
                }
            }
            // generic handling of lists that are shipped empty
            else if (commonKeyPart == ".ssl.hpkp.pins.pin" || commonKeyPart == ".monitors.monitor")
            {
                // Shipped empty, no need to check for existing, append new ones
                int id = 0;
                while (true)
                {
                    const std::string targetKey(id == 0 ? commonKeyPart : commonKeyPart + "[" + std::to_string(id) + "]");
                    if (!targetConfig.has(targetKey))
                    {
                        break;
                    }
                    id++;
                }
                const std::string targetKey(id == 0 ? commonKeyPart : commonKeyPart + "[" + std::to_string(id) + "]");
                std::cout << targetKey << ": added \"" << sourceElement << "\"." << std::endl;

                targetConfig.setString(targetKey, sourceElement);
            }
            else
            {
                std::cerr << "Unhandled key with multiples: " << sourceLevel << std::endl;
            }
            return;
        }

        bool moveOn = false;
        // Don't migrate empty elements
        if (sourceElement == "")
        {
            moveOn = true;
        }
        const std::string targetKey = renamedElems.find(sourceLevel) != renamedElems.end() ? renamedElems.at(sourceLevel) : sourceLevel;
        // Special default and normal default cases
        if (!moveOn && specialDefault.find(sourceLevel) != specialDefault.end())
        {
            if (sourceElement != specialDefault.at(sourceLevel))
            {
                std::cout << targetKey << ": replaced \"" << targetConfig.getString(targetKey) << "\" with \"" << sourceElement << "\"." << std::endl;

                targetConfig.setString(targetKey, sourceElement);
            }
            moveOn = true;
        }
        else if (!moveOn)
        {
            const std::string defaultAttr = sourceLevel + "[@default]";
            // Nothing to migrate if the config is the same as the default (if a default exists)
            if (sourceConfig.has(defaultAttr) && (sourceElement == sourceConfig.getString(defaultAttr)))
            {
                moveOn = true;
            }
        }
        // If new config doesn't have the element anymore, disregard
        if (!moveOn && !targetConfig.has(targetKey))
        {
            std::cout << targetKey << " does not exist, and is not relevant anymore." << std::endl;
            moveOn = true;
        }
        // Finally, migrate if the source and target values are different
        if (!moveOn && sourceElement != targetConfig.getString(targetKey))
        {
            const std::string targetElement = targetConfig.getString(targetKey);
            // Don't log password
            if (sourceLevel == ".admin_console.password")
                std::cout << targetKey << ": replaced \"" << targetElement << "\" with \"******\"." << std::endl;
            else
                std::cout << targetKey << ": replaced \"" << targetElement << "\" with \"" << sourceElement << "\"." << std::endl;

            targetConfig.setString(targetKey, sourceElement);
            moveOn = true;
        }
    }
    // Handle special attributes, can exist both for leaf nodes and elements with subnodes
    if (specialAttribute.find(sourceLevel) != specialAttribute.end())
    {
        const std::string targetAttrKey =
                (renamedElems.find(sourceLevel) != renamedElems.end() ? renamedElems.at(sourceLevel) : sourceLevel) +
                "[@" + specialAttribute.at(sourceLevel) + "]";
        const std::string sourceAttrKey = sourceLevel+ "[@" + specialAttribute.at(sourceLevel) + "]";
        const std::string sourceAttribute = sourceConfig.getString(sourceAttrKey);
        const std::string targetAttribute = targetConfig.getString(targetAttrKey);
        if (sourceAttribute != targetAttribute)
        {
            std::cout << sourceAttrKey << ": replaced attribute \"" << targetAttribute << "\" with \""<< sourceAttribute << "\"." << std::endl;

            targetConfig.setString(targetAttrKey, sourceAttribute);
        }
    }
}

int MigrateConfig(std::string oldConfigFile, std::string newConfigFile, bool write) {
    Poco::AutoPtr<XMLConfiguration> oldXMLConfig(new XMLConfiguration(oldConfigFile));
    Poco::AutoPtr<XMLConfiguration> newXMLConfig(new XMLConfiguration(newConfigFile));
    MigrateLevel(*oldXMLConfig, *newXMLConfig, write, "");
    if (write)
        newXMLConfig->save(newConfigFile);
    return 0;
}