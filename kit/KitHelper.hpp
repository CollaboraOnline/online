/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <sstream>
#include <string>
#include <unordered_map>

#include <JsonUtil.hpp>
#include <Util.hpp>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

namespace LOKitHelper
{
    constexpr auto tunnelledDialogImageCacheSize = 100;

    inline std::string documentTypeToString(LibreOfficeKitDocumentType type)
    {
        switch (type)
        {
        case LOK_DOCTYPE_TEXT:
            return "text";
        case LOK_DOCTYPE_SPREADSHEET:
            return "spreadsheet";
        case LOK_DOCTYPE_PRESENTATION:
            return "presentation";
        case LOK_DOCTYPE_DRAWING:
            return "drawing";
        default:
            return "other-" + std::to_string(type);
        }
    }

    inline std::string getPartData(LibreOfficeKitDocument *loKitDocument, int part)
    {
        char* ptrToData = loKitDocument->pClass->getPartInfo(loKitDocument, part);
        std::string result(ptrToData);
        std::free(ptrToData);
        return result;
    }

    inline std::string MapToJSONString(std::unordered_map<std::string, std::string> &map)
    {
        std::string resultingString = "{";
        for (std::unordered_map<std::string, std::string>::iterator i = map.begin(); i != map.end(); i++)
        {
            resultingString += "\"" + i->first + "\": " + i->second + ',';
        }
        resultingString.pop_back();
        resultingString += "}";

        return resultingString;
    }

    inline int getMode(const std::string &partData)
    {
        Poco::JSON::Parser parser;
        Poco::Dynamic::Var partJsonVar = parser.parse(partData);
        const Poco::SharedPtr<Poco::JSON::Object>& partObject = partJsonVar.extract<Poco::JSON::Object::Ptr>();

        if (partObject->has("mode"))
            return std::atoi(partObject->get("mode").toString().c_str());
        else
            return 0;
    }

    inline void fetchPartsData(LibreOfficeKitDocument *loKitDocument, std::unordered_map<std::string, std::string> &resultInfo, int partsCount, int &mode)
    {
        /*
            Except for Writer.

            Since parts should be an array, we will start an array and put parts into it.
            We are building a JSON array.
        */

        std::string resultingPartsArray = "[";

        for (int i = 0; i < partsCount; ++i)
        {
            std::string partData = getPartData(loKitDocument, i); // Part data is sent from the core side as JSON string.
            resultingPartsArray += partData + (i < partsCount - 1 ? ", ": "]");

            if (i == 0)
                mode = getMode(partData);
        }

        resultInfo["parts"] = resultingPartsArray;
    }

    inline void fetchWriterSpecificData(LibreOfficeKitDocument *loKitDocument, std::unordered_map<std::string, std::string> &resultInfo)
    {
        std::string rectangles = loKitDocument->pClass->getPartPageRectangles(loKitDocument);

        rectangles = Util::replace(rectangles, ";", "], [");

        resultInfo["pagerectangles"] = "[ [" + rectangles + "] ]";
    }

    inline void fetchCalcSpecificData(LibreOfficeKitDocument *loKitDocument, std::unordered_map<std::string, std::string> &resultInfo, int part)
    {
        long lastColumn, lastRow;
        loKitDocument->pClass->getDataArea(loKitDocument, part, &lastColumn, &lastRow);
        resultInfo["lastcolumn"] = std::to_string(lastColumn);
        resultInfo["lastrow"] = std::to_string(lastRow);

        char* value = loKitDocument->pClass->getCommandValues(loKitDocument, ".uno:ReadOnly");
        if (value)
        {
            const std::string isReadOnly = std::string(value);
            std::free(value);

            bool readOnly = (isReadOnly.find("true") != std::string::npos);
            resultInfo["readonly"] = readOnly ? "true": "false";
        }
    }

    inline std::string getDocumentTypeAsString(LibreOfficeKitDocument *loKitDocument)
    {
        assert(loKitDocument && "null loKitDocument");
        const auto type = static_cast<LibreOfficeKitDocumentType>(loKitDocument->pClass->getDocumentType(loKitDocument));
        return documentTypeToString(type);
    }

    inline std::string documentStatus(LibreOfficeKitDocument *loKitDocument)
    {
        assert(loKitDocument && "null loKitDocument");
        const auto type = static_cast<LibreOfficeKitDocumentType>(loKitDocument->pClass->getDocumentType(loKitDocument));

        std::unordered_map<std::string, std::string> resultInfo;

        const int partsCount = loKitDocument->pClass->getParts(loKitDocument);
        const int selectedPart = loKitDocument->pClass->getPart(loKitDocument);

        long width, height;
        loKitDocument->pClass->getDocumentSize(loKitDocument, &width, &height);
        int viewId = loKitDocument->pClass->getView(loKitDocument);

        resultInfo["type"] = "\"" + documentTypeToString(type) + "\"";
        resultInfo["partscount"] = std::to_string(partsCount);
        resultInfo["selectedpart"] = std::to_string(selectedPart);
        resultInfo["width"] = std::to_string(width);
        resultInfo["height"] = std::to_string(height);
        resultInfo["viewid"] = std::to_string(viewId);

        int mode = 0;

        if (type == LOK_DOCTYPE_SPREADSHEET)
            fetchCalcSpecificData(loKitDocument, resultInfo, selectedPart);
        else if (type == LOK_DOCTYPE_TEXT)
            fetchWriterSpecificData(loKitDocument, resultInfo);

        if (type == LOK_DOCTYPE_SPREADSHEET || type == LOK_DOCTYPE_PRESENTATION || type == LOK_DOCTYPE_DRAWING)
            fetchPartsData(loKitDocument, resultInfo, partsCount, mode);

        resultInfo["mode"] = std::to_string(mode);

        return MapToJSONString(resultInfo);
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
