/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <string>

#include "AppDocument.hpp"
#include "KitHelper.hpp"
#include "Log.hpp"
#include "Protocol.hpp"
#include "RenderTiles.hpp"
#include "Util.hpp"

static void messageQueueThreadFunction(AppDocument *document)
{
    PngCache pngCache;
    ThreadPool pngPool;

    LOG_ERR("messageQueueThreadFunction " << document->getAppDocId() << " started");

    Util::setThreadName("message_queue_" + std::to_string(document->getAppDocId()));

    while (true) {
        TileQueue::Payload message = document->getTileQueue()->get();
        if (std::strcmp(message.data(), "closedocument") == 0)
            break;

        const std::string firstLine = LOOLProtocol::getFirstLine(message.data(), message.size());
        const StringVector tokens = Util::tokenize(firstLine.data(), firstLine.size());
        LOG_INF("Handling " << tokens[0]);
        if (tokens.equals(0, "tile") ||
            tokens.equals(0, "tilecombine"))
        {
            TileCombined tileCombined(TileCombined::parse(tokens));
            if (!RenderTiles::doRender(document->getLoKitDoc(), tileCombined, pngCache, pngPool, false,
                                       [&](unsigned char *,
                                           int, int,
                                           size_t, size_t,
                                           int, int,
                                           LibreOfficeKitTileMode) {
                                           // Nothing
                                       },
                                       [&](const char *buffer, size_t length) {
                                           document->sendMessageToJS(buffer, length);
                                       }
                                       ))
            {
                LOG_ERR("Rendering tiles failed");
            }
        }
        else
        {
            LOG_ERR("Unhandled " << tokens[0]);
        }
    }
    LOG_ERR("messageQueueThreadFunction " << document->getAppDocId() << " finishing");
}

std::atomic<int> AppDocument::appDocIdCounter(1);

AppDocument::AppDocument(std::shared_ptr<lok::Office> theLoKit)
    : loKit(theLoKit),
      tileQueue(std::make_shared<TileQueue>()),
      appDocId(appDocIdCounter++),
      messageQueueThread(std::thread(messageQueueThreadFunction, this))
{
}

static void docCallback(const int type, const char* p, void* data)
{
    LOG_INF("docCallback: " << lokCallbackTypeToString(type) << (p ? p : "(null"));

    AppDocument* document = (AppDocument*)data;

    switch (type) {
    case LOK_CALLBACK_INVALIDATE_TILES:
        break;
    }        
}

void AppDocument::handleProtocolMessage(const char* buffer, int length)
{
    const std::string firstLine = LOOLProtocol::getFirstLine(buffer, length);
    const StringVector tokens = Util::tokenize(firstLine.data(), firstLine.size());

    if (tokens.equals(0, "loolclient"))
    {
        if (tokens.size() < 2)
        {
            sendMessageToJS("error: cmd=loolclient kind=badprotocolversion");
            return;
        }

        const std::tuple<int, int, std::string> versionTuple = LOOLProtocol::ParseVersion(tokens[1]);
        if (std::get<0>(versionTuple) != LOOLProtocol::ProtocolMajorVersionNumber ||
            std::get<1>(versionTuple) != LOOLProtocol::ProtocolMinorVersionNumber)
        {
            sendMessageToJS("error: cmd=loolclient kind=badprotocolversion");
            return;
        }

        // Send LOOL version information
        sendMessageToJS("loolserver " + Util::getVersionJSON());
        // Send LOKit version information
        sendMessageToJS("lokitversion " + std::string(loKit->getVersionInfo()));
    }
    else if (tokens.equals(0, "jserror"))
    {
        LOG_ERR(std::string(buffer, length));
        return;
    }
    else if (tokens.equals(0, "load"))
    {
        loKitDoc.reset(loKit->documentLoad(getDocumentURL().c_str(), ""));
        sendMessageToJS("statusindicator: find");
        sendMessageToJS("statusindicator: connect");
        sendMessageToJS("statusindicator: ready");
        sendMessageToJS("loolserver " + Util::getVersionJSON());
        sendMessageToJS("lokitversion " + std::string(loKit->getVersionInfo()));
        sendMessageToJS("statusindicatorsetvalue: 100");
        sendMessageToJS("statusindicatorstart:");
        sendMessageToJS("status: " + LOKitHelper::documentStatus(loKitDoc->get()));
        sendMessageToJS("statusindicatorfinish:");

        loKitDoc->initializeForRendering("");
        int viewId = loKitDoc->getView();
        loKitDoc->setViewLanguage(viewId, getAppLocale().c_str());
        loKitDoc->registerCallback(docCallback, this);
    }
    else if (tokens.equals(0, "closedocument") ||
             tokens.equals(0, "tile") ||
             tokens.equals(0, "tilecombine"))
    {
        tileQueue->put(std::string(buffer));
    }
    else if (tokens.equals(0, "canceltiles") ||
             tokens.equals(0, "clientvisiblearea") ||
             tokens.equals(0, "clientzoom") ||
             tokens.equals(0, "renderfont") ||
             tokens.equals(0, "save") ||
             tokens.equals(0, "status") ||
             tokens.equals(0, "statusupdate"))
    {
        LOG_WRN("Not yet implemented: " << tokens[0]);
    }
    else if (tokens.equals(0, "xxx"))
    {
        LOG_WRN("Ignoring: " << tokens[0]);
    }
    else
    {
        LOG_ERR("Unrecognized: " << tokens[0]);
    }
}

std::shared_ptr<lok::Document> AppDocument::getLoKitDoc() const
{
    return loKitDoc;
}

std::shared_ptr<TileQueue> AppDocument::getTileQueue() const
{
    return tileQueue;
}

int AppDocument::getAppDocId() const
{
    return appDocId;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
