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

// The client port number, which is changed via loolwsd args.
static int ClientPortNumber = DEFAULT_CLIENT_PORT_NUMBER;

class ChildProcessSession final : public LOOLSession
{
public:
    /// Create a new ChildProcessSession
    /// ws The socket between master and kit (jailed).
    /// loKit The LOKit instance.
    /// loKitDocument The instance to an existing document (when opening
    ///                 a new view) or nullptr (when first view).
    /// jailId The JailID of the jail root directory,
    //         used by downloadas to construct jailed path.
    ChildProcessSession(const std::string& id,
                        std::shared_ptr<Poco::Net::WebSocket> ws,
                        LibreOfficeKit *loKit,
                        LibreOfficeKitDocument * loKitDocument,
                        const std::string& jailId,
                        std::function<void(LibreOfficeKitDocument*, int)> onLoad,
                        std::function<void(int)> onUnload);
    virtual ~ChildProcessSession();

    virtual bool getStatus(const char *buffer, int length) override;

    virtual bool getCommandValues(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual bool getPartPageRectangles(const char *buffer, int length) override;

    int getViewId() const  { return _viewId; }

    const std::string& getDocType() const { return _docType; }

    LibreOfficeKitDocument *getLoKitDocument() const { return _loKitDocument; }

    static Poco::NotificationQueue _callbackQueue;

 protected:
    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendFontRendering(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

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

private:

    virtual bool _handleInput(const char *buffer, int length) override;

private:
    LibreOfficeKitDocument *_loKitDocument;
    std::string _docType;
    static Poco::Mutex _mutex;
    const bool _multiView;
    LibreOfficeKit *_loKit;
    const std::string _jailId;
    /// View ID, returned by createView() or 0 by default.
    int _viewId;
    int _clientPart;
    std::function<void(LibreOfficeKitDocument*, int)> _onLoad;
    std::function<void(int)> _onUnload;
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
