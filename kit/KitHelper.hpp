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

#include <sstream>
#include <string>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

namespace LOKitHelper
{
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

    inline std::string kitCallbackTypeToString(const int type)
    {
        // Keep in the same order as in LibreOfficeKitEnums.h
        switch (type)
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
        case LOK_CALLBACK_ERROR:
            return "ERROR";
        case LOK_CALLBACK_CONTEXT_MENU:
            return "CONTEXT_MENU";
        case LOK_CALLBACK_INVALIDATE_VIEW_CURSOR:
            return "INVALIDATE_VIEW_CURSOR";
        case LOK_CALLBACK_TEXT_VIEW_SELECTION:
            return "TEXT_VIEW_SELECTION";
        case LOK_CALLBACK_CELL_VIEW_CURSOR:
            return "CELL_VIEW_CURSOR";
        case LOK_CALLBACK_GRAPHIC_VIEW_SELECTION:
            return "GRAPHIC_VIEW_SELECTION";
        case LOK_CALLBACK_VIEW_CURSOR_VISIBLE:
            return "VIEW_CURSOR_VISIBLE";
        case LOK_CALLBACK_VIEW_LOCK:
            return "VIEW_LOCK";
        case LOK_CALLBACK_COMMENT:
            return "COMMENT";
        case LOK_CALLBACK_INVALIDATE_HEADER:
            return "INVALIDATE_HEADER";
        case LOK_CALLBACK_CELL_ADDRESS:
            return "CELL_ADDRESS";

       }

        return std::to_string(type);
    }

    inline std::string documentStatus(LibreOfficeKitDocument *loKitDocument)
    {
        char *ptrValue;
        assert(loKitDocument && "null loKitDocument");
        const auto type = static_cast<LibreOfficeKitDocumentType>(loKitDocument->pClass->getDocumentType(loKitDocument));

        const auto parts = loKitDocument->pClass->getParts(loKitDocument);
        std::ostringstream oss;
        oss << "type=" << documentTypeToString(type)
            << " parts=" << parts
            << " current=" << loKitDocument->pClass->getPart(loKitDocument);

        long width, height;
        loKitDocument->pClass->getDocumentSize(loKitDocument, &width, &height);
        oss << " width=" << width
            << " height=" << height
            << " viewid=" << loKitDocument->pClass->getView(loKitDocument);

        if (type == LOK_DOCTYPE_SPREADSHEET || type == LOK_DOCTYPE_PRESENTATION)
        {
            for (auto i = 0; i < parts; ++i)
            {
                oss << "\n";
                ptrValue = loKitDocument->pClass->getPartName(loKitDocument, i);
                oss << ptrValue;
                std::free(ptrValue);
            }

            if (type == LOK_DOCTYPE_PRESENTATION)
            {
                for (auto i = 0; i < parts; ++i)
                {
                    oss << "\n";
                    ptrValue = loKitDocument->pClass->getPartHash(loKitDocument, i);
                    oss << ptrValue;
                    std::free(ptrValue);
                }
            }
        }

        return oss.str();
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
