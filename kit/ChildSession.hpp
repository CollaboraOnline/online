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
#include <unordered_map>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.hxx>

#include <Poco/Thread.h>

#include "Common.hpp"
#include "Kit.hpp"
#include "Session.hpp"

class ChildSession;

/// An abstract interface that defines the
/// DocumentManager interface and functionality.
class IDocumentManager
{
public:
    /// Reqest loading a document, or a new view, if one exists.
    virtual bool onLoad(const std::string& sessionId,
                        const std::string& jailedFilePath,
                        const std::string& userName,
                        const std::string& docPassword,
                        const std::string& renderOpts,
                        const bool haveDocPassword,
                        const std::string& lang) = 0;

    /// Unload a client session, which unloads the document
    /// if it is the last and only.
    virtual void onUnload(const ChildSession& session) = 0;

    /// Access to the document instance.
    virtual std::shared_ptr<lok::Document> getLOKitDocument() = 0;

    /// Send updated view info to all active sessions
    virtual void notifyViewInfo(const std::vector<int>& viewIds) = 0;
    /// Get a view ID <-> UserInfo map.
    virtual std::map<int, UserInfo> getViewInfo() = 0;
    virtual std::mutex& getMutex() = 0;

    /// Mutex guarding the document - so that we can lock operations like
    /// setting a view followed by a tile render, etc.
    virtual std::mutex& getDocumentMutex() = 0;

    virtual std::shared_ptr<TileQueue>& getTileQueue() = 0;

    virtual bool sendTextFrame(const std::string& message) = 0;
};

struct RecordedEvent
{
    int _type;
    std::string _payload;
};

/// When the session is inactive, we need to record its state for a replay.
class StateRecorder
{
public:
    bool _invalidate;
    std::unordered_map<std::string, std::string> _recordedStates;
    std::unordered_map<int, std::unordered_map<int, RecordedEvent>> _recordedViewEvents;
    std::unordered_map<int, RecordedEvent> _recordedEvents;
    std::vector<RecordedEvent> _recordedEventsVector;

    StateRecorder() : _invalidate(false) {}

    // TODO Remember the maximal area we need to invalidate - grow it step by step.
    void recordInvalidate()
    {
        _invalidate = true;
    }

    void recordEvent(const int type, const std::string& payload)
    {
        _recordedEvents[type] = {type, payload};
    }

    void recordViewEvent(const int viewId, const int type, const std::string& payload)
    {
        _recordedViewEvents[viewId][type] = {type, payload};
    }

    void recordState(const std::string& name, const std::string& value)
    {
        _recordedStates[name] = value;
    }

    /// In the case we need to rememeber all the events that come, not just
    /// the final state.
    void recordEventSequence(const int type, const std::string& payload)
    {
        _recordedEventsVector.push_back({type, payload});
    }

    void clear()
    {
        _invalidate = false;
        _recordedEvents.clear();
        _recordedViewEvents.clear();
        _recordedStates.clear();
        _recordedEventsVector.clear();
    }
};

/// Represents a session to the WSD process, in a Kit process. Note that this is not a singleton.
class ChildSession final : public Session
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
                 const std::string& jailId,
                 IDocumentManager& docManager);
    virtual ~ChildSession();

    bool getStatus(const char* buffer, int length);
    int getViewId() const { return _viewId; }
    void setViewId(const int viewId) { _viewId = viewId; }
    const std::string& getViewUserId() const { return _userId; }
    const std::string& getViewUserName() const { return _userName; }

    void loKitCallback(const int type, const std::string& payload);

    bool sendTextFrame(const char* buffer, const int length) override
    {
        const auto msg = "client-" + getId() + ' ' + std::string(buffer, length);

        const auto lock = getLock();

        return _docManager.sendTextFrame(msg);
    }

    using Session::sendTextFrame;

private:
    bool loadDocument(const char* buffer, int length, const std::vector<std::string>& tokens);

    bool sendFontRendering(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool getCommandValues(const char* buffer, int length, const std::vector<std::string>& tokens);

    bool clientZoom(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool clientVisibleArea(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool downloadAs(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool getChildId();
    bool getTextSelection(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool paste(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool insertFile(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool keyEvent(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool mouseEvent(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool unoCommand(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool selectText(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool selectGraphic(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool resetSelection(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool saveAs(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool setClientPart(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool setPage(const char* buffer, int length, const std::vector<std::string>& tokens);

    void rememberEventsForInactiveUser(const int type, const std::string& payload);

    virtual void disconnect() override;
    virtual bool _handleInput(const char* buffer, int length) override;

    std::shared_ptr<lok::Document> getLOKitDocument()
    {
        return _docManager.getLOKitDocument();
    }

private:
    const std::string _jailId;
    IDocumentManager& _docManager;

    /// View ID, returned by createView() or 0 by default.
    int _viewId;

    /// Whether document has been opened succesfuly
    bool _isDocLoaded;

    std::string _docType;

    StateRecorder _stateRecorder;

    /// Synchronize _loKitDocument access.
    /// This should be owned by Document.
    static std::recursive_mutex Mutex;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
