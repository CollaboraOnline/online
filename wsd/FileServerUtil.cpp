/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <Poco/JSON/Object.h>

#include "FileServer.hpp"

std::string FileServerRequestHandler::uiDefaultsToJSON(const std::string& uiDefaults)
{
    static std::string previousUIDefaults;
    static std::string previousJSON("{}");

    // early exit if we are serving the same thing
    if (uiDefaults == previousUIDefaults)
        return previousJSON;

    Poco::JSON::Object json;
    Poco::JSON::Object textDefs;
    Poco::JSON::Object spreadsheetDefs;
    Poco::JSON::Object presentationDefs;

    StringVector tokens(Util::tokenize(uiDefaults, ';'));
    for (const auto& token : tokens)
    {
        StringVector keyValue(Util::tokenize(tokens.getParam(token), '='));
        Poco::JSON::Object* currentDef = nullptr;
        std::string key;

        // detect the UIMode or component
        if (keyValue[0] == "UIMode")
        {
            if (keyValue[1] == "classic" || keyValue[1] == "notebookbar")
                json.set("uiMode", keyValue[1]);
            else
                LOG_WRN("unknown UIMode value " << keyValue[1]);

            continue;
        }
        else if (Util::startsWith(keyValue[0], "Text"))
        {
            currentDef = &textDefs;
            key = keyValue[0].substr(4);
        }
        else if (Util::startsWith(keyValue[0], "Spreadsheet"))
        {
            currentDef = &spreadsheetDefs;
            key = keyValue[0].substr(11);
        }
        else if (Util::startsWith(keyValue[0], "Presentation"))
        {
            currentDef = &presentationDefs;
            key = keyValue[0].substr(12);
        }
        else
        {
            LOG_WRN("unknown UI default's component " << keyValue[0]);
            continue;
        }

        assert(currentDef);

        // detect the actual UI widget we want to hide or show
        if (key == "Ruler" || key == "Sidebar" || key == "Statusbar")
        {
            bool value(true);
            if (keyValue[1] == "false" || keyValue[1] == "False" || keyValue[1] == "0")
                value = false;

            currentDef->set("Show" + key, value);
        }
        else
        {
            LOG_WRN("unknown UI default " << keyValue[0]);
            continue;
        }
    }

    if (textDefs.size() > 0)
        json.set("text", textDefs);

    if (spreadsheetDefs.size() > 0)
        json.set("spreadsheet", spreadsheetDefs);

    if (presentationDefs.size() > 0)
        json.set("presentation", presentationDefs);

    std::ostringstream oss;
    Poco::JSON::Stringifier::stringify(json, oss);

    previousUIDefaults = uiDefaults;
    previousJSON = oss.str();

    return previousJSON;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
