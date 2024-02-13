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

    inline std::string getDocumentTypeAsString(LibreOfficeKitDocument *loKitDocument)
    {
        assert(loKitDocument && "null loKitDocument");
        const auto type = static_cast<LibreOfficeKitDocumentType>(loKitDocument->pClass->getDocumentType(loKitDocument));
        return documentTypeToString(type);
    }

    inline std::string documentStatus(LibreOfficeKitDocument *loKitDocument)
    {
        char *ptrValue;
        assert(loKitDocument && "null loKitDocument");
        const auto type = static_cast<LibreOfficeKitDocumentType>(loKitDocument->pClass->getDocumentType(loKitDocument));

        const int parts = loKitDocument->pClass->getParts(loKitDocument);
        const int part = loKitDocument->pClass->getPart(loKitDocument);
        std::ostringstream oss;
        oss << "type=" << documentTypeToString(type)
            << " parts=" << parts
            << " current=" << part;

        long width, height;
        loKitDocument->pClass->getDocumentSize(loKitDocument, &width, &height);
        oss << " width=" << width
            << " height=" << height
            << " viewid=" << loKitDocument->pClass->getView(loKitDocument);

        if (type == LOK_DOCTYPE_SPREADSHEET)
        {
            long lastColumn, lastRow;
            loKitDocument->pClass->getDataArea(loKitDocument, part, &lastColumn, &lastRow);
            oss << " lastcolumn=" << lastColumn
                << " lastrow=" << lastRow;
        }

        if (type == LOK_DOCTYPE_SPREADSHEET || type == LOK_DOCTYPE_PRESENTATION || type == LOK_DOCTYPE_DRAWING)
        {
            std::ostringstream hposs;
            std::ostringstream sposs;
            std::ostringstream rtlposs;
            std::ostringstream protectss;
            std::string mode;
            for (int i = 0; i < parts; ++i)
            {
                ptrValue = loKitDocument->pClass->getPartInfo(loKitDocument, i);
                const std::string partinfo(ptrValue);
                std::free(ptrValue);
                for (const auto& prop : Util::JsonToMap(partinfo))
                {
                    const std::string& name = prop.first;
                    if (name == "visible")
                    {
                        if (prop.second == "0")
                            hposs << i << ',';
                    }
                    else if (name == "selected")
                    {
                        if (prop.second == "1")
                            sposs << i << ',';
                    }
                    else if (name == "rtllayout")
                    {
                        if (prop.second == "1")
                            rtlposs << i << ',';
                    }
                    else if (name == "protected")
                    {
                        if (prop.second == "1")
                            protectss << i << ',';
                    }
                    else if (name == "mode" && mode.empty())
                    {
                        std::ostringstream modess;
                        modess << prop.second;
                        mode = modess.str();
                    }
                }
            }

            if (!mode.empty())
                oss << " mode=" << mode;

            std::string hiddenparts = hposs.str();
            if (!hiddenparts.empty())
            {
                hiddenparts.pop_back(); // Remove last ','
                oss << " hiddenparts=" << hiddenparts;
            }

            std::string selectedparts = sposs.str();
            if (!selectedparts.empty())
            {
                selectedparts.pop_back(); // Remove last ','
                oss << " selectedparts=" << selectedparts;
            }

            std::string rtlparts = rtlposs.str();
            if (!rtlparts.empty())
            {
                rtlparts.pop_back(); // Remove last ','
                oss << " rtlparts=" << rtlparts;
            }

            std::string protectparts = protectss.str();
            if (!protectparts.empty())
            {
                protectparts.pop_back(); // Remove last ','
                oss << " protectedparts=" << protectparts;
            }

            if (type == LOK_DOCTYPE_SPREADSHEET)
            {
                char* values = loKitDocument->pClass->getCommandValues(loKitDocument, ".uno:ReadOnly");
                if (values)
                {
                    const std::string isReadOnly = std::string(values);
                    oss << " readonly=" << (isReadOnly.find("true") != std::string::npos);
                    std::free(values);
                }
            }

            for (int i = 0; i < parts; ++i)
            {
                oss << '\n';
                ptrValue = loKitDocument->pClass->getPartName(loKitDocument, i);
                oss << ptrValue;
                std::free(ptrValue);
            }

            if (type == LOK_DOCTYPE_PRESENTATION || type == LOK_DOCTYPE_DRAWING)
            {
                for (int i = 0; i < parts; ++i)
                {
                    oss << '\n';
                    ptrValue = loKitDocument->pClass->getPartHash(loKitDocument, i);
                    oss << ptrValue;
                    std::free(ptrValue);
                }
            }
        }

        if (type == LOK_DOCTYPE_TEXT)
        {
            std::string rectangles = loKitDocument->pClass->getPartPageRectangles(loKitDocument);

            std::string::iterator end_pos = std::remove(rectangles.begin(), rectangles.end(), ' ');
            rectangles.erase(end_pos, rectangles.end());

            oss << " pagerectangles=" << rectangles.c_str();
        }

        return oss.str();
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
