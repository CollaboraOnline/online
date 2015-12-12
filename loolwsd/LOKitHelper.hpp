/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOKITHELPER_HPP
#define INCLUDED_LOKITHELPER_HPP

#include <string>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

namespace LOKitHelper
{
    inline
    std::string documentTypeToString(LibreOfficeKitDocumentType type)
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

    inline
    std::string documentStatus(LibreOfficeKitDocument *loKitDocument)
    {
        std::string typeString(documentTypeToString(static_cast<LibreOfficeKitDocumentType>(loKitDocument->pClass->getDocumentType(loKitDocument))));
        long width, height, parts;
        loKitDocument->pClass->getDocumentSize(loKitDocument, &width, &height);
        parts = loKitDocument->pClass->getParts(loKitDocument);
        std::string status =
               ("type=" + typeString + " "
                "parts=" + std::to_string(parts) + " "
                "current=" + std::to_string(loKitDocument->pClass->getPart(loKitDocument)) + " "
                "width=" + std::to_string(width) + " "
                "height=" + std::to_string(height));
        if (typeString == "spreadsheet" || typeString == "presentation")
        {
            for (int i = 0; i < parts; i++)
            {
                status += "\n";
                status += loKitDocument->pClass->getPartName(loKitDocument, i);
            }
        }
        return status;
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
