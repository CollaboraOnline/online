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

#pragma once

#include <chrono>
#include <unordered_map>
#include <queue>

#include <atomic>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.hxx>

#include "Common.hpp"
#include "Kit.hpp"
#include "Session.hpp"
#include "Watermark.hpp"
#include "StateRecorder.hpp"

class Document;
class ChildSession;

enum class LokEventTargetEnum
{
    Document,
    Window
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
        Document& document);
    virtual ~ChildSession();

    bool getStatus();
    int getViewId() const { return _viewId; }
    void setViewId(const int viewId) { _viewId = viewId; }
    const std::string& getViewUserId() const { return getUserId(); }
    const std::string& getViewUserName() const { return getUserName(); }
    const std::string& getViewUserExtraInfo() const { return getUserExtraInfo(); }
    const std::string& getViewUserPrivateInfo() const { return getUserPrivateInfo(); }
    void updateSpeed();
    int getSpeed();

    void loKitCallback(const int type, const std::string& payload);

    /// Initializes the watermark support, if enabled and required.
    /// Returns true if watermark is enabled and initialized.
    bool initWatermark()
    {
        if (hasWatermark())
        {
            _docWatermark = std::make_shared<Watermark>(getLOKitDocument(), getWatermarkText(),
                                                        getWatermarkOpacity());
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

    bool sendProgressFrame(const char* id, const std::string& jsonProps,
                           const std::string& forcedID = "");

    using Session::sendTextFrame;

    bool getClipboard(const StringVector& tokens);

    void resetDocManager()
    {
        disconnect();
        _docManager = nullptr;
    }

    // Only called by kit.
    void setCanonicalViewId(int viewId) { _canonicalViewId = viewId; }

    int  getCanonicalViewId() { return _canonicalViewId; }

    void setViewRenderState(const std::string& state) { _viewRenderState = state; }

    bool getDumpTiles() { return _isDumpingTiles; }

    void setDumpTiles(bool dumpTiles) { _isDumpingTiles = dumpTiles; }

    std::string getViewRenderState() { return _viewRenderState; }

    bool isTileInsideVisibleArea(const TileDesc& tile) const;

private:
    bool loadDocument(const StringVector& tokens);
    bool saveDocumentBackground(const StringVector &tokens);

    bool sendFontRendering(const StringVector& tokens);
    bool getCommandValues(const StringVector& tokens);

    bool clientZoom(const StringVector& tokens);
    bool clientVisibleArea(const StringVector& tokens);
    bool outlineState(const StringVector& tokens);
    bool downloadAs(const StringVector& tokens);
    bool getChildId();
    bool getTextSelection(const StringVector& tokens);
    bool setClipboard(const char* buffer, int length, const StringVector& tokens);
    std::string getTextSelectionInternal(const std::string& mimeType);
    bool paste(const char* buffer, int length, const StringVector& tokens);
    bool insertFile(const StringVector& tokens);
    bool keyEvent(const StringVector& tokens, const LokEventTargetEnum target);
    bool extTextInputEvent(const StringVector& tokens);
    bool dialogKeyEvent(const char* buffer, int length, const std::vector<std::string>& tokens);
    bool mouseEvent(const StringVector& tokens, const LokEventTargetEnum target);
    bool gestureEvent(const StringVector& tokens);
    bool dialogEvent(const StringVector& tokens);
    bool completeFunction(const StringVector& tokens);
    bool unoCommand(const StringVector& tokens);
    bool selectText(const StringVector& tokens, const LokEventTargetEnum target);
    bool selectGraphic(const StringVector& tokens);
    bool renderNextSlideLayer(const unsigned width, const unsigned height, bool& done);
    bool renderSlide(const StringVector& tokens);
    bool renderWindow(const StringVector& tokens);
    bool resizeWindow(const StringVector& tokens);
    bool resetSelection(const StringVector& tokens);
    bool saveAs(const StringVector& tokens);
    bool exportAs(const StringVector& tokens);
    bool setClientPart(const StringVector& tokens);
    bool selectClientPart(const StringVector& tokens);
    bool moveSelectedClientParts(const StringVector& tokens);
    bool setPage(const StringVector& tokens);
    bool sendWindowCommand(const StringVector& tokens);
    bool askSignatureStatus(const char* buffer, int length, const StringVector& tokens);
    bool renderShapeSelection(const StringVector& tokens);
    bool removeTextContext(const StringVector& tokens);
#if ENABLE_FEATURE_LOCK || ENABLE_FEATURE_RESTRICTION
    bool updateBlockingCommandStatus(const StringVector& tokens);
    std::string getBlockedCommandType(std::string command);
#endif
    bool handleZoteroMessage(const StringVector& tokens);
    bool formFieldEvent(const char* buffer, int length, const StringVector& tokens);
    bool contentControlEvent(const StringVector& tokens);
    bool renderSearchResult(const char* buffer, int length, const StringVector& tokens);
    bool setAccessibilityState(bool enable);
    bool getA11yFocusedParagraph();
    bool getA11yCaretPosition();
    bool getPresentationInfo();

    void rememberEventsForInactiveUser(const int type, const std::string& payload);

    virtual void disconnect() override;
    virtual bool _handleInput(const char* buffer, int length) override;

    static void dumpRecordedUnoCommands();

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
    // simple one line for priming
    std::string getActivityState()
    {
        std::stringstream ss;
        ss << "view: " << _viewId
           << ", session " << getId()
           << (isReadOnly() ? ", ro": ", rw")
           << ", user: '" << getUserNameAnonym() << "'"
           << ", load" << (_isDocLoaded ? "ed" : "ing")
           << ", type: " << _docType
           << ", lang: " << getLang();
        return ss.str();
    }

    void dumpState(std::ostream& oss) override
    {
        Session::dumpState(oss);

        oss << "\n\tviewId: " << _viewId
            << "\n\tcanonicalViewId: " << _canonicalViewId
            << "\n\tisDocLoaded: " << _isDocLoaded
            << "\n\tdocType: " << _docType
            << "\n\tcopyingToClipboard: " << _copyToClipboard
            << "\n\tdocType: " << _docType
            // FIXME: _pixmapCache
            << "\n\texportAsWopiUrl: " << _exportAsWopiUrl
            << "\n\tviewRenderedState: " << _viewRenderState
            << "\n\tisDumpingTiles: " << _isDocLoaded
            << "\n\tclientVisibleArea: " << _clientVisibleArea.toString()
            << "\n\thasURP: " << _hasURP
            << "\n\tURPContext?: " << (_URPContext == nullptr)
            << '\n';

        _stateRecorder.dumpState(oss);
    }

private:
    const std::string _jailId;
    const std::string _jailRoot;
    Document* _docManager;

    std::shared_ptr<Watermark> _docWatermark;

    std::queue<std::chrono::steady_clock::time_point> _cursorInvalidatedEvent;
    static constexpr std::chrono::seconds EventStorageInterval{ 15 };

    /// View ID, returned by createView() or 0 by default.
    int _viewId;

    /// Whether document has been opened successfully
    bool _isDocLoaded;

    std::string _docType;

    StateRecorder _stateRecorder;

    /// If we are copying to clipboard.
    bool _copyToClipboard;

    std::vector<uint64_t> _pixmapCache;

    /// How many sessions / clients we have
    static size_t NumSessions;

    /// stores wopi url for export as operation
    std::string _exportAsWopiUrl;

    /// stores info about the view
    std::string _viewRenderState;

    /// the canonical id unique to the set of rendering properties of this session
    int _canonicalViewId;

    /// whether we are dumping tiles as they are being drawn
    bool _isDumpingTiles;

    Util::Rectangle _clientVisibleArea;

    void* _URPContext;

    /// whether there is a URP session created for this ChildSession
    bool _hasURP;

    // When state is added - please update dumpState above.
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
