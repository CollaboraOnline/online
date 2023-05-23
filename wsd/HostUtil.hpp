/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <Util.hpp>
#include <Poco/URI.h>
#include <Poco/Util/Application.h>

/// This class contains static methods to parse alias_groups and WOPI host and static containers to store the data from the coolwsd.xml
class HostUtil
{
private:
    /// Allowed/denied WOPI hosts, if any and if WOPI is enabled.
    static Util::RegexListMatcher WopiHosts;
    /// mapping of alias host and port to real host and port
    static std::map<std::string, std::string> AliasHosts;
    /// When group configuration is not defined only the firstHost gets access
    static std::string FirstHost;
    /// list of host (not aliases) in alias_groups
    static std::set<std::string> hostList;

    static bool WopiEnabled;

public:
    /// parse wopi.storage.host
    static void parseWopiHost(Poco::Util::LayeredConfiguration& conf);

    /// parse wopi.storage.alias_groups.group
    static void parseAliases(Poco::Util::LayeredConfiguration& conf);

    /// if request uri is an alias, replace request uri host and port with
    /// original hostname and port defined by group tag from coolwsd.xml
    /// to avoid possibility of opening the same file as two if the WOPI host
    /// is accessed using different aliases
    static std::string getNewUri(const Poco::URI& uri);

    /// add host to WopiHosts
    static void addWopiHost(std::string host, bool allow);

    static bool allowedWopiHost(const std::string& host);

    static bool isWopiEnabled() { return WopiEnabled; }

    /// replace the authority of aliashost to realhost if it matches
    static const Poco::URI getNewLockedUri(const Poco::URI& uri);

    static void setFirstHost(const Poco::URI& uri);
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
