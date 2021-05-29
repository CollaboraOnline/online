/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <unordered_map>
#include <queue>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.hxx>

#include "Common.hpp"
#include "Kit.hpp"
#include "Session.hpp"
#include "Watermark.hpp"

class ChildSession;

enum class LokEventTargetEnum
{
    Document,
    Window
};

// An abstract interface.
class DocumentManagerInterface
{
public:
    virtual ~DocumentManagerInterface()  {}

    /// Request loading a document, or a new view, if one exists.
    virtual bool onLoad(const std::string& sessionId,
                        const std::string& uriAnonym,
                        const std::string& renderOpts) = 0;

    /// Unload a client session, which unloads the document
    /// if it is the last and only.
    virtual void onUnload(const ChildSession& session) = 0;

    /// Access to the Kit instance.
    virtual std::shared_ptr<lok::Office> getLOKit() = 0;

    /// Access to the document instance.
    virtual std::shared_ptr<lok::Document> getLOKitDocument() = 0;

    /// Send msg to all active sessions.
    virtual bool notifyAll(const std::string& msg) = 0;

    /// Send updated view info to all active sessions.
    virtual void notifyViewInfo() = 0;
    virtual void updateEditorSpeeds(int id, int speed) = 0;

    virtual int getEditorId() const = 0;

    /// Get a view ID <-> UserInfo map.
    virtual std::map<int, UserInfo> getViewInfo() = 0;

    virtual std::string getObfuscatedFileId() = 0;

    virtual std::shared_ptr<TileQueue>& getTileQueue() = 0;

    virtual bool sendFrame(const char* buffer, int length, WSOpCode opCode = WSOpCode::Text) = 0;

    virtual void alertAllUsers(const std::string& cmd, const std::string& kind) = 0;

    virtual unsigned getMobileAppDocId() const = 0;
};

struct RecordedEvent
{
private:
    int _type = 0;
    std::string _payload;

public:
    RecordedEvent()
    {
    }

    RecordedEvent(int type, const std::string& payload)
        : _type(type),
        _payload(payload)
    {
    }

    void setType(int type)
    {
        _type = type;
    }

    int getType() const
    {
        return _type;
    }

    void setPayload(const std::string& payload)
    {
        _payload = payload;
    }

    const std::string& getPayload() const
    {
        return _payload;
    }
};

/// When the session is inactive, we need to record its state for a replay.
class StateRecorder
{
private:
    bool _invalidate;
    std::unordered_map<std::string, std::string> _recordedStates;
    std::unordered_map<int, std::unordered_map<int, RecordedEvent>> _recordedViewEvents;
    std::unordered_map<int, RecordedEvent> _recordedEvents;
    std::vector<RecordedEvent> _recordedEventsVector;

public:
    StateRecorder() : _invalidate(false) {}

    // TODO Remember the maximal area we need to invalidate - grow it step by step.
    void recordInvalidate()
    {
        _invalidate = true;
    }

    bool isInvalidate() const
    {
        return _invalidate;
    }

    const std::unordered_map<std::string, std::string>& getRecordedStates() const
    {
        return _recordedStates;
    }

    const std::unordered_map<int, std::unordered_map<int, RecordedEvent>>& getRecordedViewEvents() const
    {
        return _recordedViewEvents;
    }

    const std::unordered_map<int, RecordedEvent>& getRecordedEvents() const
    {
        return _recordedEvents;
    }

    const std::vector<RecordedEvent>& getRecordedEventsVector() const
    {
        return _recordedEventsVector;
    }

    void recordEvent(const int type, const std::string& payload)
    {
        _recordedEvents[type] = RecordedEvent(type, payload);
    }

    void recordViewEvent(const int viewId, const int type, const std::string& payload)
    {
        _recordedViewEvents[viewId][type] = {type, payload};
    }

    void recordState(const std::string& name, const std::string& value)
    {
        _recordedStates[name] = value;
    }

    /// In the case we need to remember all the events that come, not just
    /// the final state.
    void recordEventSequence(const int type, const std::string& payload)
    {
        _recordedEventsVector.emplace_back(type, payload);
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
    static bool NoCapsForKit;

    /// Create a new ChildSession
    /// jailId The JailID of the jail root directory,
    //         used by downloadas to construct jailed path.
    ChildSession(
        const std::shared_ptr<ProtocolHandlerInterface> &protocol,
        const std::string& id,
        const std::string& jailId,
        const std::string& jailRoot,
        DocumentManagerInterface& docManager);
    virtual ~ChildSession();

    bool getStatus(const char* buffer, int length);
    int getViewId() const { return _viewId; }
    void setViewId(const int viewId) { _viewId = viewId; }
    const std::string& getViewUserId() const { return getUserId(); }
    const std::string& getViewUserName() const { return getUserName(); }
    const std::string& getViewUserExtraInfo() const { return getUserExtraInfo(); }
    void updateSpeed();
    int getSpeed();

    void loKitCallback(const int type, const std::string& payload);

    /// Initializes the watermark support, if enabled and required.
    /// Returns true if watermark is enabled and initialized.
    bool initWatermark()
    {
        if (hasWatermark())
        {
            _docWatermark.reset(
                new Watermark(getLOKitDocument(), getWatermarkText(), getWatermarkOpacity()));
        }

        return _docWatermark != nullptr;
    }

    const std::shared_ptr<Watermark>& watermark() const { return _docWatermark; };

    bool sendTextFrame(const char* buffer, int length) override
    {
        if (!_docManager)
        {
            LOG_TRC("ERR dropping - client-" + getId() + ' ' + std::string(buffer, length));
            return false;
        }
        const auto msg = "client-" + getId() + ' ' + std::string(buffer, length);
        return _docManager->sendFrame(msg.data(), msg.size(), WSOpCode::Text);
    }

    bool sendBinaryFrame(const char* buffer, int length) override
    {
        if (!_docManager)
        {
            LOG_TRC("ERR dropping binary - client-" + getId());
            return false;
        }
        const auto msg = "client-" + getId() + ' ' + std::string(buffer, length);
        return _docManager->sendFrame(msg.data(), msg.size(), WSOpCode::Binary);
    }

    using Session::sendTextFrame;

    bool getClipboard(const char* buffer, int length, const StringVector& tokens);

    void resetDocManager()
    {
        disconnect();
        _docManager = nullptr;
    }

private:
    bool loadDocument(const char* buffer, int length, const StringVector& tokens);

    bool sendFontRendering(const char* buffer, int length, const StringVector& tokens);
    bool getCommandValues(const char* buffer, int length, const StringVector& tokens);

    bool clientZoom(const char* buffer, int length, const StringVector& tokens);
    bool clientVisibleArea(const char* buffer, int length, const StringVector& tokens);
    bool outlineState(const char* buffer, int length, const StringVector& tokens);
    bool downloadAs(const char* buffer, int length, const StringVector& tokens);
    bool getChildId();
    bool getTextSelection(const char* buffer, int length, const StringVector& tokens);
    bool setClipboard(const char* buffer, int length, const StringVector& tokens);
    std::string getTextSelectionInternal(const std::string& mimeType);
    bool paste(const char* buffer, int length, const StringVector& tokens);
    bool insertFile(const char* buffer, int length, const StringVector& tokens);
    bool keyEvent(const char* buffer, int length, const StringVector& tokens, const LokEventTargetEnum target);
    bool extTextInputEvent(const char* /*buffer*/, int /*length*/, const StringVector& tokens);
    bool dialogKeyEvent(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool mouseEvent(const char* buffer, int length, const StringVector& tokens, const LokEventTargetEnum target);
    bool gestureEvent(const char* buffer, int length, const StringVector& tokens);
    bool dialogEvent(const char* buffer, int length, const StringVector& tokens);
    bool completeFunction(const char* buffer, int length, const StringVector& tokens);
    bool unoCommand(const char* buffer, int length, const StringVector& tokens);
    bool selectText(const char* buffer, int length, const StringVector& tokens, const LokEventTargetEnum target);
    bool selectGraphic(const char* buffer, int length, const StringVector& tokens);
    bool renderWindow(const char* buffer, int length, const StringVector& tokens);
    bool resizeWindow(const char* buffer, int length, const StringVector& tokens);
    bool resetSelection(const char* buffer, int length, const StringVector& tokens);
    bool saveAs(const char* buffer, int length, const StringVector& tokens);
    bool setClientPart(const char* buffer, int length, const StringVector& tokens);
    bool selectClientPart(const char* buffer, int length, const StringVector& tokens);
    bool moveSelectedClientParts(const char* buffer, int length, const StringVector& tokens);
    bool setPage(const char* buffer, int length, const StringVector& tokens);
    bool sendWindowCommand(const char* buffer, int length, const StringVector& tokens);
    bool signDocumentContent(const char* buffer, int length, const StringVector& tokens);
    bool askSignatureStatus(const char* buffer, int length, const StringVector& tokens);
    bool uploadSignedDocument(const char* buffer, int length, const StringVector& tokens);
    bool exportSignAndUploadDocument(const char* buffer, int length, const StringVector& tokens);
    bool renderShapeSelection(const char* buffer, int length, const StringVector& tokens);
    bool removeTextContext(const char* /*buffer*/, int /*length*/, const StringVector& tokens);
    bool updateFreemiumStatus(const char* buffer, int length, const StringVector& tokens);

    void rememberEventsForInactiveUser(const int type, const std::string& payload);
    bool formFieldEvent(const char* buffer, int length, const StringVector& tokens);

    virtual void disconnect() override;
    virtual bool _handleInput(const char* buffer, int length) override;

    std::shared_ptr<lok::Document> getLOKitDocument() const
    {
        return _docManager->getLOKitDocument();
    }

    std::shared_ptr<lok::Office> getLOKit() const
    {
        return _docManager->getLOKit();
    }

    std::string getLOKitLastError() const
    {
        char *lastErr = _docManager->getLOKit()->getError();
        std::string ret;
        if (lastErr)
        {
            ret = std::string(lastErr, strlen(lastErr));
            free (lastErr);
        }
        return ret;
    }

public:
    void dumpState(std::ostream& oss) override
    {
        Session::dumpState(oss);
        // TODO: the rest ...
    }

private:
    const std::string _jailId;
    const std::string _jailRoot;
    DocumentManagerInterface* _docManager;

    std::shared_ptr<Watermark> _docWatermark;

    std::queue<std::chrono::steady_clock::time_point> _cursorInvalidatedEvent;
    const unsigned _eventStorageIntervalMs = 15*1000;

    /// View ID, returned by createView() or 0 by default.
    int _viewId;

    /// Whether document has been opened successfully
    bool _isDocLoaded;

    std::string _docType;

    StateRecorder _stateRecorder;

    /// If we are copying to clipboard.
    bool _copyToClipboard;

    std::vector<uint64_t> _pixmapCache;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
