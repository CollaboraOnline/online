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

#include <mutex>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include <Poco/Thread.h>
#include <Poco/NotificationQueue.h>
#include "LOOLSession.hpp"

// The client port number, which is changed via loolwsd args.
static int ClientPortNumber = DEFAULT_CLIENT_PORT_NUMBER;

class CallbackWorker;

class ChildProcessSession final : public LOOLSession
{
public:
    class Statistics
    {
    public:
        Statistics() :
            _lastActivityTime(std::chrono::steady_clock::now())
        {
        }

        void updateLastActivityTime()
        {
            _lastActivityTime = std::chrono::steady_clock::now();
        }

        double getInactivityMS() const
        {
            const auto duration = (std::chrono::steady_clock::now() - _lastActivityTime);
            return std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
        }

    private:
        std::chrono::steady_clock::time_point _lastActivityTime;
    };

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
                        std::function<LibreOfficeKitDocument*(const std::string&, const std::string&)> onLoad,
                        std::function<void(const std::string&)> onUnload);
    virtual ~ChildProcessSession();

    virtual bool getStatus(const char *buffer, int length) override;

    virtual bool getCommandValues(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual bool getPartPageRectangles(const char *buffer, int length) override;

    virtual void disconnect(const std::string& reason = "") override;
    virtual bool handleDisconnect(Poco::StringTokenizer& tokens) override;

    int getViewId() const  { return _viewId; }

    const std::string& getDocType() const { return _docType; }

    LibreOfficeKitDocument *getLoKitDocument() const { return _loKitDocument; }

    void loKitCallback(const int nType, const char* pPayload);

    std::unique_lock<std::recursive_mutex> getLock() { return std::unique_lock<std::recursive_mutex>(Mutex); }

    const Statistics& getStatistics() const { return _stats; }
    bool isInactive() const { return _stats.getInactivityMS() >= InactivityThresholdMS; }

    void setDocumentPassword(const int nPasswordType);

 protected:
    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendCombinedTiles(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

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
    LibreOfficeKit *_loKit;
    LibreOfficeKitDocument *_loKitDocument;
    std::string _docType;
    const bool _multiView;
    const std::string _jailId;
    /// View ID, returned by createView() or 0 by default.
    int _viewId;
    int _clientPart;
    std::function<LibreOfficeKitDocument*(const std::string&, const std::string&)> _onLoad;
    std::function<void(const std::string&)> _onUnload;
    /// Statistics and activity tracking.
    Statistics _stats;

    std::unique_ptr<CallbackWorker> _callbackWorker;
    Poco::Thread _callbackThread;
    Poco::NotificationQueue _callbackQueue;

    /// Synchronize _loKitDocument acess.
    /// This should be owned by Document.
    static std::recursive_mutex Mutex;

    static constexpr auto InactivityThresholdMS = 120 * 1000;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
