/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#import "CODocument.h"
#import "AppDocument.hpp"

class COAppDocument : public AppDocument
{
public:
    COAppDocument(std::shared_ptr<lok::Office> theLoKit, CODocument* aDocument);

    void sendMessageToJS(std::string message) override;
    void sendMessageToJS(const char* buffer, int length) override;

protected:
    std::string getDocumentURL() override;
    std::string getAppLocale() override;

private:
    // Objective-C pointer to the Objective-C document object.
    CODocument* __weak document;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
