/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_CHILDPROCESSSESSION_HPP
#define INCLUDED_CHILDPROCESSSESSION_HPP

#include <mutex>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include <Poco/Thread.h>
#include <Poco/NotificationQueue.h>

#include "Common.hpp"
#include "LOOLSession.hpp"

class CallbackWorker;
/// An abstract interface that defines the
/// DocumentManager interface and functionality.
class IDocumentManager
{
public:
    /// Reqest loading a document, or a new view, if one exists.
    virtual
    LibreOfficeKitDocument* onLoad(const std::string& sessionId,
                                   const std::string& jailedFilePath,
                                   const std::string& userName,
                                   const std::string& docPassword,
                                   const std::string& renderOpts,
                                   const bool haveDocPassword) = 0;
    /// Unload a client session, which unloads the document
    /// if it is the last and only.
    virtual
    void onUnload(const std::string& sessionId) = 0;

    /// Send updated view info to all active sessions
    virtual
    void notifyViewInfo() = 0;
};

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
                        LibreOfficeKitDocument * loKitDocument,
                        const std::string& jailId,
                        IDocumentManager& docManager);
    virtual ~ChildProcessSession();

    virtual bool getStatus(const char *buffer, int length) override;

    virtual bool getCommandValues(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual bool getPartPageRectangles(const char *buffer, int length) override;

    virtual void disconnect() override;

    int getViewId() const { return _viewId; }
    const std::string getViewUserName() const { return _userName; }

    const std::string& getDocType() const { return _docType; }

    LibreOfficeKitDocument *getLoKitDocument() const { return _loKitDocument; }

    void loKitCallback(const int nType, const char* pPayload);

    static std::unique_lock<std::recursive_mutex> getLock() { return std::unique_lock<std::recursive_mutex>(Mutex); }

    void setDocState(const int type, const std::string& payload) { _lastDocStates[type] = payload; }

 protected:
    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendFontRendering(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    bool clientZoom(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool clientVisibleArea(const char *buffer, int length, Poco::StringTokenizer& tokens);
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
    const bool _multiView;
    const std::string _jailId;
    /// View ID, returned by createView() or 0 by default.
    int _viewId;
    std::map<int, std::string> _lastDocStates;
    IDocumentManager& _docManager;

    std::unique_ptr<CallbackWorker> _callbackWorker;
    Poco::Thread _callbackThread;
    Poco::NotificationQueue _callbackQueue;

    /// Synchronize _loKitDocument acess.
    /// This should be owned by Document.
    static std::recursive_mutex Mutex;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
