/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#import <string>

#import "AppDelegate.h"
#import "CODocument.h"
#import "COAppDocument.hpp"

COAppDocument::COAppDocument(std::shared_ptr<lok::Office> theLoKit, CODocument* aDocument)
    : AppDocument(theLoKit),
      document(aDocument)
{
}

void COAppDocument::sendMessageToJS(std::string message)
{
    [document send2JS:message];
}

void COAppDocument::sendMessageToJS(const char* buffer, int length)
{
    [document send2JS:buffer length:length];
}

std::string COAppDocument::getDocumentURL()
{
    return std::string([[document->copyFileURL absoluteString] UTF8String]);
}

std::string COAppDocument::getAppLocale()
{
    return [app_locale UTF8String];
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
