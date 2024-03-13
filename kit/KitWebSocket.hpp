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
/*
 * The main entry point for the LibreOfficeKit process serving
 * a document editing session.
 */

#include <net/WebSocketHandler.hpp>

class Document;
class TileQueue;
class KitSocketPoll;

class KitWebSocketHandler final : public WebSocketHandler
{
    std::shared_ptr<TileQueue> _queue;
    std::string _socketName;
    std::shared_ptr<lok::Office> _loKit;
    std::string _jailId;
    std::string _docKey; //< When we get it while creating a new view.
    std::shared_ptr<Document> _document;
    std::shared_ptr<KitSocketPoll> _ksPoll;
    const unsigned _mobileAppDocId;
    bool _backgroundSaver;

public:
    KitWebSocketHandler(const std::string& socketName, const std::shared_ptr<lok::Office>& loKit,
                        const std::string& jailId, std::shared_ptr<KitSocketPoll> ksPoll,
                        unsigned mobileAppDocId)
        : WebSocketHandler(/* isClient = */ true, /* isMasking */ false)
        , _queue(std::make_shared<TileQueue>())
        , _socketName(socketName)
        , _loKit(loKit)
        , _jailId(jailId)
        , _ksPoll(std::move(ksPoll))
        , _mobileAppDocId(mobileAppDocId)
        , _backgroundSaver(false)
    {
    }

    ~KitWebSocketHandler()
    {
        // Just to make it easier to set a breakpoint
    }

    void shutdownForBackgroundSave();

    int getKitId() const { return _mobileAppDocId; }

protected:
    virtual void handleMessage(const std::vector<char>& data) override;
    virtual void enableProcessInput(bool enable = true) override;
    virtual void onDisconnect() override;
};
