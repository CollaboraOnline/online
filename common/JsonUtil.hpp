/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <cstddef>
#include <set>
#include <string>

#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>

#include <Log.hpp>
#include <JsonUtil.hpp>

namespace JsonUtil
{

// Parse the json string and fill the Poco::JSON object
// Returns true if parsing successful otherwise false
inline bool parseJSON(const std::string& json, Poco::JSON::Object::Ptr& object)
{
    bool success = false;
    const size_t index = json.find_first_of('{');
    if (index != std::string::npos)
    {
        const std::string stringJSON = json.substr(index);
        Poco::JSON::Parser parser;
        const Poco::Dynamic::Var result = parser.parse(stringJSON);
        object = result.extract<Poco::JSON::Object::Ptr>();
        success = true;
    }

    return success;
}

inline
int getLevenshteinDist(const std::string& string1, const std::string& string2)
{
    int matrix[string1.size() + 1][string2.size() + 1];
    std::memset(matrix, 0, sizeof(matrix[0][0]) * (string1.size() + 1) * (string2.size() + 1));

    for (size_t i = 0; i < string1.size() + 1; i++)
    {
        for (size_t j = 0; j < string2.size() + 1; j++)
        {
            if (i == 0)
            {
                matrix[i][j] = j;
            }
            else if (j == 0)
            {
                matrix[i][j] = i;
            }
            else if (string1[i - 1] == string2[j - 1])
            {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else
            {
                matrix[i][j] = 1 + std::min(std::min(matrix[i][j - 1], matrix[i - 1][j]),
                                            matrix[i - 1][j - 1]);
            }
        }
    }

    return matrix[string1.size()][string2.size()];
}

// Gets value for `key` directly from the given JSON in `object`
template <typename T>
T getJSONValue(const Poco::JSON::Object::Ptr &object, const std::string& key)
{
    try
    {
        const Poco::Dynamic::Var valueVar = object->get(key);
        return valueVar.convert<T>();
    }
    catch (const Poco::Exception& exc)
    {
        LOG_ERR("getJSONValue for [" << key << "]: " << exc.displayText() <<
                (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
    }

    return T();
}

/// Function that searches `object` for `key` and warns if there are minor mis-spellings involved.
/// Upon successfull search, fills `value` with value found in object.
/// Removes the entry from the JSON object if @bRemove == true.
template <typename T>
bool findJSONValue(Poco::JSON::Object::Ptr &object, const std::string& key, T& value, bool bRemove = true)
{
    std::string keyLower(key);
    std::transform(begin(key), end(key), begin(keyLower), ::tolower);

    std::vector<std::string> propertyNames;
    object->getNames(propertyNames);

    // Check each property name against given key
    // and warn for mis-spells with tolerance of 2.
    for (const std::string& userInput : propertyNames)
    {
        if (key != userInput)
        {
            std::string userInputLower(userInput);
            std::transform(begin(userInput), end(userInput), begin(userInputLower), ::tolower);

             // Mis-spelling tolerance.
            const int levDist = getLevenshteinDist(keyLower, userInputLower);
            if (levDist > 2)
                continue; // Not even close, keep searching.

            // We found something with some differences--warn and return.
            LOG_WRN("Incorrect JSON property [" << userInput << "]. Did you mean [" << key <<
                    "] ? (Levenshtein distance: " << levDist << ")");

            // Fail without exact match.
            return false;
        }

        value = getJSONValue<T>(object, userInput);
        if (bRemove)
            object->remove(userInput);

        LOG_TRC("Found JSON property [" << userInput << "] => [" << value << "]");
        return true;
    }

    LOG_INF("Missing JSON property [" << key << "] will default to [" << value << "].");
    return false;
}

} // end namespace JsonUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */

