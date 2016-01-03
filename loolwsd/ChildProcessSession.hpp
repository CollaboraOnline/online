/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOOLCHILDPROCESSSESSION_HPP
#define INCLUDED_LOOLCHILDPROCESSSESSION_HPP

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>

#include <Poco/NotificationQueue.h>
#include "LOOLSession.hpp"

class ChildProcessSession final : public LOOLSession
{
public:
    /// Create a new ChildProcessSession
    /// ws The socket between master and kit (jailed).
    /// loKit The LOKit instance.
    /// loKitDocument The instance to an existing document (when opening
    ///                 a new view) or nullptr (when first view).
    /// childId The id of the lokit instance, used by downloadas to construct jailed path.
    ChildProcessSession(const std::string& id,
                        std::shared_ptr<Poco::Net::WebSocket> ws,
                        LibreOfficeKit *loKit,
                        LibreOfficeKitDocument * loKitDocument,
                        const std::string& childId);
    virtual ~ChildProcessSession();

    virtual bool getStatus(const char *buffer, int length);

    virtual bool getCommandValues(const char *buffer, int length, Poco::StringTokenizer& tokens);

    virtual bool getPartPageRectangles(const char *buffer, int length) override;

    int getViewId() const  { return _viewId; }

    LibreOfficeKitDocument *_loKitDocument;
    std::string _docType;
    static Poco::NotificationQueue _callbackQueue;
    static Poco::Mutex _mutex;

 protected:
    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens);

    virtual void sendFontRendering(const char *buffer, int length, Poco::StringTokenizer& tokens);

    bool clientZoom(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool downloadAs(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool getChildId();
    bool getTextSelection(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool paste(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool insertFile(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool keyEvent(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool mouseEvent(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool unoCommand(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool selectText(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool selectGraphic(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool resetSelection(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool saveAs(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool setClientPart(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool setPage(const char *buffer, int length, Poco::StringTokenizer& tokens);

    std::string _loSubPath;
    LibreOfficeKit *_loKit;
    const std::string _childId;

private:

    virtual bool _handleInput(const char *buffer, int length) override;

private:
    /// View ID, returned by createView() or 0 by default.
    int _viewId;
    int _clientPart;
};

class CallBackNotification: public Poco::Notification
{
public:
	typedef Poco::AutoPtr<CallBackNotification> Ptr;

    CallBackNotification(const int nType, const std::string& rPayload, void* pSession)
      : m_nType(nType),
        m_aPayload(rPayload),
        m_pSession(pSession)
    {
    }

    const int m_nType;
    const std::string m_aPayload;
    void* m_pSession;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
