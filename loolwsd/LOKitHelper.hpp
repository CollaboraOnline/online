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
    std::string kitCallbackTypeToString (const int nType)
    {
        // Keep in the same order as in LibreOfficeKitEnums.h
        switch (nType)
        {
        case LOK_CALLBACK_INVALIDATE_TILES:
            return "INVALIDATE_TILES";
        case LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR:
            return "INVALIDATE_VISIBLE_CURSOR";
        case LOK_CALLBACK_TEXT_SELECTION:
            return "TEXT_SELECTION";
        case LOK_CALLBACK_TEXT_SELECTION_START:
            return "TEXT_SELECTION_START";
        case LOK_CALLBACK_TEXT_SELECTION_END:
            return "TEXT_SELECTION_END";
        case LOK_CALLBACK_CURSOR_VISIBLE:
            return "CURSOR_VISIBLE";
        case LOK_CALLBACK_GRAPHIC_SELECTION:
            return "GRAPHIC_SELECTION";
        case LOK_CALLBACK_HYPERLINK_CLICKED:
            return "HYPERLINK_CLICKED";
        case LOK_CALLBACK_STATE_CHANGED:
            return "STATE_CHANGED";
        case LOK_CALLBACK_STATUS_INDICATOR_START:
            return "STATUS_INDICATOR_START";
        case LOK_CALLBACK_STATUS_INDICATOR_SET_VALUE:
            return "STATUS_INDICATOR_SET_VALUE";
        case LOK_CALLBACK_STATUS_INDICATOR_FINISH:
            return "STATUS_INDICATOR_FINISH";
        case LOK_CALLBACK_SEARCH_NOT_FOUND:
            return "SEARCH_NOT_FOUND";
        case LOK_CALLBACK_DOCUMENT_SIZE_CHANGED:
            return "DOCUMENT_SIZE_CHANGED";
        case LOK_CALLBACK_SET_PART:
            return "SET_PART";
        case LOK_CALLBACK_SEARCH_RESULT_SELECTION:
            return "SEARCH_RESULT_SELECTION";
        case LOK_CALLBACK_UNO_COMMAND_RESULT:
            return "UNO_COMMAND_RESULT";
        case LOK_CALLBACK_CELL_CURSOR:
            return "CELL_CURSOR";
        case LOK_CALLBACK_MOUSE_POINTER:
            return "MOUSE_POINTER";
        case LOK_CALLBACK_CELL_FORMULA:
            return "CELL_FORMULA";
        case LOK_CALLBACK_DOCUMENT_PASSWORD:
            return "DOCUMENT_PASSWORD";
        case LOK_CALLBACK_DOCUMENT_PASSWORD_TO_MODIFY:
            return "DOCUMENT_PASSWORD_TO_MODIFY";
        }

        return std::to_string(nType);
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
