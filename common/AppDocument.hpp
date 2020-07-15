/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <memory>
#include <string>
#include <thread>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.hxx>

#include "MessageQueue.hpp"
#include "TileDesc.hpp"

// The C++ document-specific data in the next-gen iOS (and Android?) app.
class AppDocument
{
public:
    AppDocument(std::shared_ptr<lok::Office> theLoKit);

    void handleProtocolMessage(const char* buffer, int length);
    std::shared_ptr<lok::Document> getLoKitDoc() const;
    std::shared_ptr<TileQueue> getTileQueue() const;
    int getAppDocId() const;

    virtual void sendMessageToJS(std::string) = 0;
    virtual void sendMessageToJS(const char* buffer, int length) = 0;

protected:
    virtual std::string getDocumentURL() = 0;
    virtual std::string getAppLocale() = 0;

private:
    std::shared_ptr<lok::Office> loKit;
    std::shared_ptr<lok::Document> loKitDoc;
    std::shared_ptr<TileQueue> tileQueue;

    static std::atomic<int> appDocIdCounter;
    const int appDocId;
    std::thread messageQueueThread;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
