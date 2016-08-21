/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_CHILDSESSION_HPP
#define INCLUDED_CHILDSESSION_HPP

#include <mutex>

#include <Poco/Thread.h>
#include <Poco/NotificationQueue.h>

#include "Common.hpp"
#include "LOOLSession.hpp"
#include "LibreOfficeKit.hpp"

class ChildSession;

/// An abstract interface that defines the
/// DocumentManager interface and functionality.
class IDocumentManager
{
public:
    /// Reqest loading a document, or a new view, if one exists.
    virtual
    std::shared_ptr<lok::Document> onLoad(const std::string& sessionId,
                                          const std::string& jailedFilePath,
                                          const std::string& docPassword,
                                          const std::string& renderOpts,
                                          const bool haveDocPassword) = 0;

    /// Unload a client session, which unloads the document
    /// if it is the last and only.
    virtual
    void onUnload(const ChildSession& session) = 0;

    /// Get a list of all current view IDs.
    virtual
    std::vector<unsigned> getViewIds() const = 0;
};

/// Represents a client session, with the socket end-point,
/// and handles all incoming UI traffic.
class ChildSession final : public LOOLSession
{
public:
    /// Create a new ChildSession
    /// ws The socket between master and kit (jailed).
    /// loKit The LOKit instance.
    /// loKitDocument The instance to an existing document (when opening
    ///                 a new view) or nullptr (when first view).
    /// jailId The JailID of the jail root directory,
    //         used by downloadas to construct jailed path.
    ChildSession(const std::string& id,
                 std::shared_ptr<Poco::Net::WebSocket> ws,
                 const std::string& jailId,
                 IDocumentManager& docManager);
    virtual ~ChildSession();

    bool getStatus(const char *buffer, int length);
    bool getPartPageRectangles(const char *buffer, int length);
    unsigned getViewId() const { return _viewId; }
    int getPart() const { return _loKitDocument->getPart(); }

    void loKitCallback(const int nType, const std::string& rPayload);

private:
    bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens);

    bool sendFontRendering(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool getCommandValues(const char *buffer, int length, Poco::StringTokenizer& tokens);

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

    virtual void disconnect() override;
    virtual bool _handleInput(const char *buffer, int length) override;

private:
    std::shared_ptr<lok::Document> _loKitDocument;
    std::string _docType;
    const bool _multiView;
    const std::string _jailId;
    /// View ID, returned by createView() or 0 by default.
    int _viewId;
    std::map<int, std::string> _lastDocStates;
    IDocumentManager& _docManager;

    /// Synchronize _loKitDocument acess.
    /// This should be owned by Document.
    static std::recursive_mutex Mutex;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
