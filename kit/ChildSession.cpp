/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include "ChildSession.hpp"

#include <sstream>

#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>

#include "common/FileUtil.hpp"
#include "KitHelper.hpp"
#include "Log.hpp"
#include "Png.hpp"
#include "Util.hpp"

using Poco::JSON::Object;
using Poco::JSON::Parser;
using Poco::StringTokenizer;
using Poco::Timestamp;
using Poco::URI;

using namespace LOOLProtocol;

std::recursive_mutex ChildSession::Mutex;

ChildSession::ChildSession(const std::string& id,
                           const std::string& jailId,
                           IDocumentManager& docManager) :
    Session("ToMaster-" + id, id, false),
    _jailId(jailId),
    _docManager(docManager),
    _viewId(-1),
    _isDocLoaded(false)
{
    LOG_INF("ChildSession ctor [" << getName() << "].");
}

ChildSession::~ChildSession()
{
    LOG_INF("~ChildSession dtor [" << getName() << "].");

    disconnect();
}

void ChildSession::disconnect()
{
    if (!isDisconnected())
    {
        std::unique_lock<std::recursive_mutex> lock(Mutex);

        if (_viewId >= 0)
        {
            _docManager.onUnload(*this);
        }
        else
        {
            LOG_WRN("Skipping unload on incomplete view.");
        }

        Session::disconnect();
    }
}

bool ChildSession::_handleInput(const char *buffer, int length)
{
    LOG_TRC(getName() << ": handling [" << getAbbreviatedMessage(buffer, length) << "].");
    const std::string firstLine = getFirstLine(buffer, length);
    const auto tokens = LOOLProtocol::tokenize(firstLine.data(), firstLine.size());

    if (LOOLProtocol::tokenIndicatesUserInteraction(tokens[0]))
    {
        // Keep track of timestamps of incoming client messages that indicate user activity.
        updateLastActivityTime();
    }

    if (tokens.size() > 0 && tokens[0] == "useractive" && getLOKitDocument() != nullptr)
    {
        LOG_DBG("Handling message after inactivity of " << getInactivityMS() << "ms.");
        setIsActive(true);

        // Client is getting active again.
        // Send invalidation and other sync-up messages.
        std::unique_lock<std::recursive_mutex> lock(Mutex); //TODO: Move to top of function?
        std::unique_lock<std::mutex> lockLokDoc(_docManager.getDocumentMutex());

        getLOKitDocument()->setView(_viewId);

        int curPart = 0;
        if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT)
            curPart = getLOKitDocument()->getPart();

        // Notify all views about updated view info
        _docManager.notifyViewInfo();

        lockLokDoc.unlock();

        if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT)
        {
            sendTextFrame("curpart: part=" + std::to_string(curPart));
            sendTextFrame("setpart: part=" + std::to_string(curPart));
        }

        // Invalidate if we have to
        // TODO instead just a "_invalidate" flag, we should remember / grow
        // the rectangle to invalidate; invalidating everything is sub-optimal
        if (_stateRecorder._invalidate)
        {
            std::string payload = "0, 0, " + std::to_string(INT_MAX) + ", " + std::to_string(INT_MAX) + ", " + std::to_string(curPart);
            loKitCallback(LOK_CALLBACK_INVALIDATE_TILES, payload);
        }

        for (const auto& viewPair : _stateRecorder._recordedViewEvents)
        {
            for (const auto& eventPair : viewPair.second)
            {
                const RecordedEvent& event = eventPair.second;
                LOG_TRC("Replaying missed view event: " <<  viewPair.first << " " << LOKitHelper::kitCallbackTypeToString(event._type)
                                                        << ": " << event._payload);
                loKitCallback(event._type, event._payload);
            }
        }

        for (const auto& eventPair : _stateRecorder._recordedEvents)
        {
            const RecordedEvent& event = eventPair.second;
            LOG_TRC("Replaying missed event: " << LOKitHelper::kitCallbackTypeToString(event._type) << ": " << event._payload);
            loKitCallback(event._type, event._payload);
        }

        for (const auto& pair : _stateRecorder._recordedStates)
        {
            LOG_TRC("Replaying missed state-change: " << pair.second);
            loKitCallback(LOK_CALLBACK_STATE_CHANGED, pair.second);
        }

        for (const auto& event : _stateRecorder._recordedEventsVector)
        {
            LOG_TRC("Replaying missed event (part of sequence): " << LOKitHelper::kitCallbackTypeToString(event._type) << ": " << event._payload);
            loKitCallback(event._type, event._payload);
        }

        _stateRecorder.clear();

        LOG_TRC("Finished replaying messages.");
    }

    if (tokens[0] == "dummymsg")
    {
        // Just to update the activity of a view-only client.
        return true;
    }
    else if (tokens[0] == "commandvalues")
    {
        return getCommandValues(buffer, length, tokens);
    }
    else if (tokens[0] == "load")
    {
        if (_isDocLoaded)
        {
            sendTextFrame("error: cmd=load kind=docalreadyloaded");
            return false;
        }

        _isDocLoaded = loadDocument(buffer, length, tokens);
        if (!_isDocLoaded)
        {
            sendTextFrame("error: cmd=load kind=faileddocloading");
        }

        return _isDocLoaded;
    }
    else if (!_isDocLoaded)
    {
        sendTextFrame("error: cmd=" + tokens[0] + " kind=nodocloaded");
        return false;
    }
    else if (tokens[0] == "renderfont")
    {
        sendFontRendering(buffer, length, tokens);
    }
    else if (tokens[0] == "setclientpart")
    {
        return setClientPart(buffer, length, tokens);
    }
    else if (tokens[0] == "setpage")
    {
        return setPage(buffer, length, tokens);
    }
    else if (tokens[0] == "status")
    {
        return getStatus(buffer, length);
    }
    else if (tokens[0] == "tile" || tokens[0] == "tilecombine")
    {
        assert(false && "Tile traffic should go through the DocumentBroker-LoKit WS.");
    }
    else
    {
        // All other commands are such that they always require a LibreOfficeKitDocument session,
        // i.e. need to be handled in a child process.

        assert(tokens[0] == "clientzoom" ||
               tokens[0] == "clientvisiblearea" ||
               tokens[0] == "downloadas" ||
               tokens[0] == "getchildid" ||
               tokens[0] == "gettextselection" ||
               tokens[0] == "paste" ||
               tokens[0] == "insertfile" ||
               tokens[0] == "key" ||
               tokens[0] == "mouse" ||
               tokens[0] == "dialogmouse" ||
               tokens[0] == "uno" ||
               tokens[0] == "selecttext" ||
               tokens[0] == "selectgraphic" ||
               tokens[0] == "resetselection" ||
               tokens[0] == "saveas" ||
               tokens[0] == "useractive" ||
               tokens[0] == "userinactive");

        if (tokens[0] == "clientzoom")
        {
            return clientZoom(buffer, length, tokens);
        }
        else if (tokens[0] == "clientvisiblearea")
        {
            return clientVisibleArea(buffer, length, tokens);
        }
        else if (tokens[0] == "downloadas")
        {
            return downloadAs(buffer, length, tokens);
        }
        else if (tokens[0] == "getchildid")
        {
            return getChildId();
        }
        else if (tokens[0] == "gettextselection")
        {
            return getTextSelection(buffer, length, tokens);
        }
        else if (tokens[0] == "paste")
        {
            return paste(buffer, length, tokens);
        }
        else if (tokens[0] == "insertfile")
        {
            return insertFile(buffer, length, tokens);
        }
        else if (tokens[0] == "key")
        {
            return keyEvent(buffer, length, tokens);
        }
        else if (tokens[0] == "mouse")
        {
            return mouseEvent(buffer, length, tokens);
        }
        else if (tokens[0] == "dialogmouse")
        {
            return dialogMouseEvent(buffer, length, tokens);
        }
        else if (tokens[0] == "uno")
        {
            return unoCommand(buffer, length, tokens);
        }
        else if (tokens[0] == "selecttext")
        {
            return selectText(buffer, length, tokens);
        }
        else if (tokens[0] == "selectgraphic")
        {
            return selectGraphic(buffer, length, tokens);
        }
        else if (tokens[0] == "resetselection")
        {
            return resetSelection(buffer, length, tokens);
        }
        else if (tokens[0] == "saveas")
        {
            return saveAs(buffer, length, tokens);
        }
        else if (tokens[0] == "useractive")
        {
            setIsActive(true);
        }
        else if (tokens[0] == "userinactive")
        {
            setIsActive(false);
        }
        else
        {
            assert(false && "Unknown command token.");
        }
    }

    return true;
}

bool ChildSession::loadDocument(const char * /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    int part = -1;
    if (tokens.size() < 2)
    {
        sendTextFrame("error: cmd=load kind=syntax");
        return false;
    }

    std::string timestamp;
    parseDocOptions(tokens, part, timestamp);

    std::string renderOpts;
    if (!_docOptions.empty())
    {
        Parser parser;
        Poco::Dynamic::Var var = parser.parse(_docOptions);
        Object::Ptr object = var.extract<Object::Ptr>();
        Poco::Dynamic::Var rendering = object->get("rendering");
        if (!rendering.isEmpty())
            renderOpts = rendering.toString();
    }

    assert(!_docURL.empty());
    assert(!_jailedFilePath.empty());

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    bool loaded = _docManager.onLoad(getId(), _jailedFilePath, _userName,
            _docPassword, renderOpts, _haveDocPassword, _lang, _watermarkText);
    if (!loaded || _viewId < 0)
    {
        LOG_ERR("Failed to get LoKitDocument instance.");
        return false;
    }

    LOG_INF("Created new view with viewid: [" << _viewId << "] for username: [" <<
            _userName << "] in session: [" << getId() << "].");

    std::unique_lock<std::mutex> lockLokDoc(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    _docType = LOKitHelper::getDocumentTypeAsString(getLOKitDocument()->get());
    if (_docType != "text" && part != -1)
    {
        getLOKitDocument()->setPart(part);
    }

    // Respond by the document status
    LOG_DBG("Sending status after loading view " << _viewId << ".");
    const auto status = LOKitHelper::documentStatus(getLOKitDocument()->get());
    if (status.empty() || !sendTextFrame("status: " + status))
    {
        LOG_ERR("Failed to get/forward document status [" << status << "].");
        return false;
    }

    // Inform everyone (including this one) about updated view info
    _docManager.notifyViewInfo();
    sendTextFrame("editor: " + std::to_string(_docManager.getEditorId()));


    LOG_INF("Loaded session " << getId());
    return true;
}

bool ChildSession::sendFontRendering(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    std::string font, text, decodedFont, decodedChar;
    bool bSuccess;

    if (tokens.size() < 3 ||
        !getTokenString(tokens[1], "font", font))
    {
        sendTextFrame("error: cmd=renderfont kind=syntax");
        return false;
    }

    getTokenString(tokens[2], "char", text);

    try
    {
        URI::decode(font, decodedFont);
        URI::decode(text, decodedChar);
    }
    catch (Poco::SyntaxException& exc)
    {
        LOG_DBG(exc.message());
        sendTextFrame("error: cmd=renderfont kind=syntax");
        return false;
    }

    const std::string response = "renderfont: " + Poco::cat(std::string(" "), tokens.begin() + 1, tokens.end()) + "\n";

    std::vector<char> output;
    output.resize(response.size());
    std::memcpy(output.data(), response.data(), response.size());

    Timestamp timestamp;
    // renderFont use a default font size (25) when width and height are 0
    int width = 0, height = 0;
    unsigned char* ptrFont = nullptr;

    {
        std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

        getLOKitDocument()->setView(_viewId);

        ptrFont = getLOKitDocument()->renderFont(decodedFont.c_str(), decodedChar.c_str(), &width, &height);
    }

    LOG_TRC("renderFont [" << font << "] rendered in " << (timestamp.elapsed()/1000.) << "ms");

    if (!ptrFont)
    {
        return sendTextFrame(output.data(), output.size());
    }

    if (Png::encodeBufferToPNG(ptrFont, width, height, output, LOK_TILEMODE_RGBA))
    {
        bSuccess = sendTextFrame(output.data(), output.size());
    }
    else
    {
        bSuccess = sendTextFrame("error: cmd=renderfont kind=failure");
    }

    std::free(ptrFont);
    return bSuccess;
}

bool ChildSession::getStatus(const char* /*buffer*/, int /*length*/)
{
    std::string status;
    {
        std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

        getLOKitDocument()->setView(_viewId);

        status = LOKitHelper::documentStatus(getLOKitDocument()->get());
    }

    if (status.empty())
    {
        LOG_ERR("Failed to get document status.");
        return false;
    }

    return sendTextFrame("status: " + status);
}

namespace
{

/// Given a view ID <-> user name map and a .uno:DocumentRepair result, annotate with user names.
void insertUserNames(const std::map<int, UserInfo>& viewInfo, std::string& json)
{
    Poco::JSON::Parser parser;
    auto root = parser.parse(json).extract<Poco::JSON::Object::Ptr>();
    std::vector<std::string> directions { "Undo", "Redo" };
    for (auto& directionName : directions)
    {
        auto direction = root->get(directionName).extract<Poco::JSON::Object::Ptr>();
        if (direction->get("actions").type() == typeid(Poco::JSON::Array::Ptr))
        {
            auto actions = direction->get("actions").extract<Poco::JSON::Array::Ptr>();
            for (auto& actionVar : *actions)
            {
                auto action = actionVar.extract<Poco::JSON::Object::Ptr>();
                int viewId = action->getValue<int>("viewId");
                auto it = viewInfo.find(viewId);
                if (it != viewInfo.end())
                    action->set("userName", Poco::Dynamic::Var(it->second.Username));
            }
        }
    }
    std::stringstream ss;
    root->stringify(ss);
    json = ss.str();
}

}

bool ChildSession::getCommandValues(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    bool success;
    char* values;
    std::string command;
    if (tokens.size() != 2 || !getTokenString(tokens[1], "command", command))
    {
        sendTextFrame("error: cmd=commandvalues kind=syntax");
        return false;
    }

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    if (command == ".uno:DocumentRepair")
    {
        char* undo;
        const std::string jsonTemplate("{\"commandName\":\".uno:DocumentRepair\",\"Redo\":%s,\"Undo\":%s}");
        values = getLOKitDocument()->getCommandValues(".uno:Redo");
        undo = getLOKitDocument()->getCommandValues(".uno:Undo");
        std::string json = Poco::format(jsonTemplate,
                                        std::string(values == nullptr ? "" : values),
                                        std::string(undo == nullptr ? "" : undo));
        // json only contains view IDs, insert matching user names.
        std::map<int, UserInfo> viewInfo = _docManager.getViewInfo();
        insertUserNames(viewInfo, json);
        success = sendTextFrame("commandvalues: " + json);
        std::free(values);
        std::free(undo);
    }
    else
    {
        values = getLOKitDocument()->getCommandValues(command.c_str());
        success = sendTextFrame("commandvalues: " + std::string(values == nullptr ? "" : values));
        std::free(values);
    }

    return success;
}

bool ChildSession::clientZoom(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    int tilePixelWidth, tilePixelHeight, tileTwipWidth, tileTwipHeight;

    if (tokens.size() != 5 ||
        !getTokenInteger(tokens[1], "tilepixelwidth", tilePixelWidth) ||
        !getTokenInteger(tokens[2], "tilepixelheight", tilePixelHeight) ||
        !getTokenInteger(tokens[3], "tiletwipwidth", tileTwipWidth) ||
        !getTokenInteger(tokens[4], "tiletwipheight", tileTwipHeight))
    {
        sendTextFrame("error: cmd=clientzoom kind=syntax");
        return false;
    }

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setClientZoom(tilePixelWidth, tilePixelHeight, tileTwipWidth, tileTwipHeight);
    return true;
}

bool ChildSession::clientVisibleArea(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    int x;
    int y;
    int width;
    int height;

    if (tokens.size() != 5 ||
        !getTokenInteger(tokens[1], "x", x) ||
        !getTokenInteger(tokens[2], "y", y) ||
        !getTokenInteger(tokens[3], "width", width) ||
        !getTokenInteger(tokens[4], "height", height))
    {
        sendTextFrame("error: cmd=clientvisiblearea kind=syntax");
        return false;
    }

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setClientVisibleArea(x, y, width, height);
    return true;
}

bool ChildSession::downloadAs(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    std::string name, id, format, filterOptions;

    if (tokens.size() < 5 ||
        !getTokenString(tokens[1], "name", name) ||
        !getTokenString(tokens[2], "id", id))
    {
        sendTextFrame("error: cmd=downloadas kind=syntax");
        return false;
    }

    getTokenString(tokens[3], "format", format);

    if (getTokenString(tokens[4], "options", filterOptions))
    {
        if (tokens.size() > 5)
        {
            filterOptions += Poco::cat(std::string(" "), tokens.begin() + 5, tokens.end());
        }
    }

    // The file is removed upon downloading.
    const auto tmpDir = FileUtil::createRandomDir(JAILED_DOCUMENT_ROOT);
    // Prevent user inputting anything funny here.
    // A "name" should always be a name, not a path
    const Poco::Path filenameParam(name);
    const auto url = JAILED_DOCUMENT_ROOT + tmpDir + "/" + filenameParam.getFileName();

    {
        std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

        getLOKitDocument()->saveAs(url.c_str(),
                format.size() == 0 ? nullptr :format.c_str(),
                filterOptions.size() == 0 ? nullptr : filterOptions.c_str());
    }

    sendTextFrame("downloadas: jail=" + _jailId + " dir=" + tmpDir + " name=" + name +
                  " port=" + std::to_string(ClientPortNumber) + " id=" + id);
    return true;
}

bool ChildSession::getChildId()
{
    sendTextFrame("getchildid: id=" + _jailId);
    return true;
}

bool ChildSession::getTextSelection(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    std::string mimeType;

    if (tokens.size() != 2 ||
        !getTokenString(tokens[1], "mimetype", mimeType))
    {
        sendTextFrame("error: cmd=gettextselection kind=syntax");
        return false;
    }

    char* textSelection = nullptr;
    {
        std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

        getLOKitDocument()->setView(_viewId);

        textSelection = getLOKitDocument()->getTextSelection(mimeType.c_str(), nullptr);
    }

    sendTextFrame("textselectioncontent: " + std::string(textSelection));
    free(textSelection);
    return true;
}

bool ChildSession::paste(const char* buffer, int length, const std::vector<std::string>& tokens)
{
    std::string mimeType;
    if (tokens.size() < 2 || !getTokenString(tokens[1], "mimetype", mimeType) ||
        mimeType.empty())
    {
        sendTextFrame("error: cmd=paste kind=syntax");
        return false;
    }

    const std::string firstLine = getFirstLine(buffer, length);
    const char* data = buffer + firstLine.size() + 1;
    const int size = length - firstLine.size() - 1;
    if (size > 0)
    {
        std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

        getLOKitDocument()->setView(_viewId);

        getLOKitDocument()->paste(mimeType.c_str(), data, size);
    }

    return true;
}

bool ChildSession::insertFile(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    std::string name, type;
    if (tokens.size() != 3 ||
        !getTokenString(tokens[1], "name", name) ||
        !getTokenString(tokens[2], "type", type))
    {
        sendTextFrame("error: cmd=insertfile kind=syntax");
        return false;
    }

    if (type == "graphic")
    {
        std::string fileName = "file://" + std::string(JAILED_DOCUMENT_ROOT) + "insertfile/" + name;
        std::string command = ".uno:InsertGraphic";
        std::string arguments = "{"
            "\"FileName\":{"
                "\"type\":\"string\","
                "\"value\":\"" + fileName + "\""
            "}}";

        std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

        getLOKitDocument()->setView(_viewId);

        getLOKitDocument()->postUnoCommand(command.c_str(), arguments.c_str(), false);
    }

    return true;
}

bool ChildSession::keyEvent(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    int type, charcode, keycode;
    if (tokens.size() != 4 ||
        !getTokenKeyword(tokens[1], "type",
                         {{"input", LOK_KEYEVENT_KEYINPUT}, {"up", LOK_KEYEVENT_KEYUP}},
                         type) ||
        !getTokenInteger(tokens[2], "char", charcode) ||
        !getTokenInteger(tokens[3], "key", keycode))
    {
        sendTextFrame("error: cmd=key kind=syntax");
        return false;
    }

    // Don't close LO window!
    constexpr auto KEY_CTRL = 0x2000;
    constexpr auto KEY_W = 0x0216;
    if (keycode == (KEY_CTRL | KEY_W))
    {
        return true;
    }

    // Ctrl+Tab switching browser tabs,
    // Doesn't insert tabs.
    constexpr auto KEY_TAB = 0x0502;
    if (keycode == (KEY_CTRL | KEY_TAB))
    {
        return true;
    }

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->postKeyEvent(type, charcode, keycode);

    return true;
}

bool ChildSession::mouseEvent(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    int type, x, y, count;
    bool success = true;

    // default values for compatibility reasons with older loleaflets
    int buttons = 1; // left button
    int modifier = 0;

    if (tokens.size() < 5 ||
        !getTokenKeyword(tokens[1], "type",
                         {{"buttondown", LOK_MOUSEEVENT_MOUSEBUTTONDOWN},
                          {"buttonup", LOK_MOUSEEVENT_MOUSEBUTTONUP},
                          {"move", LOK_MOUSEEVENT_MOUSEMOVE}},
                         type) ||
        !getTokenInteger(tokens[2], "x", x) ||
        !getTokenInteger(tokens[3], "y", y) ||
        !getTokenInteger(tokens[4], "count", count))
    {
        success = false;
    }

    // compatibility with older loleaflets
    if (success && tokens.size() > 5 && !getTokenInteger(tokens[5], "buttons", buttons))
        success = false;

    // compatibility with older loleaflets
    if (success && tokens.size() > 6 && !getTokenInteger(tokens[6], "modifier", modifier))
        success = false;

    if (!success)
    {
        sendTextFrame("error: cmd=mouse kind=syntax");
        return false;
    }

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->postMouseEvent(type, x, y, count, buttons, modifier);

    return true;
}

bool ChildSession::dialogMouseEvent(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    int type, x, y, count;
    bool success = true;

    // default values for compatibility reasons with older loleaflets
    int buttons = 1; // left button
    int modifier = 0;
    std::string dialogId;
    if (tokens.size() < 6 ||
        !getTokenString(tokens[1], "dialogid", dialogId) ||
        !getTokenKeyword(tokens[2], "type",
                         {{"buttondown", LOK_MOUSEEVENT_MOUSEBUTTONDOWN},
                          {"buttonup", LOK_MOUSEEVENT_MOUSEBUTTONUP},
                          {"move", LOK_MOUSEEVENT_MOUSEMOVE}},
                         type) ||
        !getTokenInteger(tokens[3], "x", x) ||
        !getTokenInteger(tokens[4], "y", y) ||
        !getTokenInteger(tokens[5], "count", count) ||
        !getTokenInteger(tokens[6], "buttons", buttons) ||
        !getTokenInteger(tokens[7], "modifier", modifier))
    {
        success = false;
    }

    if (!success)
    {
        sendTextFrame("error: cmd=dialogmouse kind=syntax");
        return false;
    }

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->postDialogMouseEvent(dialogId.c_str(), type, x, y, count, buttons, modifier);

    return true;
}

bool ChildSession::unoCommand(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    if (tokens.size() <= 1)
    {
        sendTextFrame("error: cmd=uno kind=syntax");
        return false;
    }

    // we need to get LOK_CALLBACK_UNO_COMMAND_RESULT callback when saving
    const bool bNotify = (tokens[1] == ".uno:Save" || tokens[1] == ".uno:Undo" || tokens[1] == ".uno:Redo");

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    if (tokens.size() == 2 && tokens[1] == ".uno:fakeDiskFull")
    {
        Util::alertAllUsers("internal", "diskfull");
    }
    else if (tokens.size() == 2)
    {
        getLOKitDocument()->postUnoCommand(tokens[1].c_str(), nullptr, bNotify);
    }
    else
    {
        getLOKitDocument()->postUnoCommand(tokens[1].c_str(),
                                       Poco::cat(std::string(" "), tokens.begin() + 2, tokens.end()).c_str(),
                                       bNotify);
    }

    return true;
}

bool ChildSession::selectText(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    int type, x, y;
    if (tokens.size() != 4 ||
        !getTokenKeyword(tokens[1], "type",
                         {{"start", LOK_SETTEXTSELECTION_START},
                          {"end", LOK_SETTEXTSELECTION_END},
                          {"reset", LOK_SETTEXTSELECTION_RESET}},
                         type) ||
        !getTokenInteger(tokens[2], "x", x) ||
        !getTokenInteger(tokens[3], "y", y))
    {
        sendTextFrame("error: cmd=selecttext kind=syntax");
        return false;
    }

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setTextSelection(type, x, y);

    return true;
}

bool ChildSession::selectGraphic(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    int type, x, y;
    if (tokens.size() != 4 ||
        !getTokenKeyword(tokens[1], "type",
                         {{"start", LOK_SETGRAPHICSELECTION_START},
                          {"end", LOK_SETGRAPHICSELECTION_END}},
                         type) ||
        !getTokenInteger(tokens[2], "x", x) ||
        !getTokenInteger(tokens[3], "y", y))
    {
        sendTextFrame("error: cmd=selectgraphic kind=syntax");
        return false;
    }

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setGraphicSelection(type, x, y);

    return true;
}

bool ChildSession::resetSelection(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    if (tokens.size() != 1)
    {
        sendTextFrame("error: cmd=resetselection kind=syntax");
        return false;
    }

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->resetSelection();

    return true;
}

bool ChildSession::saveAs(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    std::string url, format, filterOptions;

    if (tokens.size() < 4 ||
        !getTokenString(tokens[1], "url", url))
    {
        sendTextFrame("error: cmd=saveas kind=syntax");
        return false;
    }

    getTokenString(tokens[2], "format", format);

    if (getTokenString(tokens[3], "options", filterOptions))
    {
        if (tokens.size() > 4)
        {
            filterOptions += Poco::cat(std::string(" "), tokens.begin() + 4, tokens.end());
        }
    }

    bool success = false;
    {
        std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

        getLOKitDocument()->setView(_viewId);

        success = getLOKitDocument()->saveAs(url.c_str(),
                format.size() == 0 ? nullptr :format.c_str(),
                filterOptions.size() == 0 ? nullptr : filterOptions.c_str());
    }

    sendTextFrame("saveas: url=" + url);
    std::string successStr = success ? "true" : "false";
    sendTextFrame("unocommandresult: {"
            "\"commandName\":\"saveas\","
            "\"success\":\"" + successStr + "\"}");

    return true;
}

bool ChildSession::setClientPart(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    int part;
    if (tokens.size() < 2 ||
        !getTokenInteger(tokens[1], "part", part))
    {
        sendTextFrame("error: cmd=setclientpart kind=invalid");
        return false;
    }

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT && part != getLOKitDocument()->getPart())
    {
        getLOKitDocument()->setPart(part);
    }

    return true;
}

bool ChildSession::setPage(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    int page;
    if (tokens.size() < 2 ||
        !getTokenInteger(tokens[1], "page", page))
    {
        sendTextFrame("error: cmd=setpage kind=invalid");
        return false;
    }

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setPart(page);
    return true;
}

/* If the user is inactive we have to remember important events so that when
 * the user becomes active again, we can replay the events.
 */
void ChildSession::rememberEventsForInactiveUser(const int type, const std::string& payload)
{
    if (type == LOK_CALLBACK_INVALIDATE_TILES)
    {
        auto lock(getLock());
        _stateRecorder.recordInvalidate(); // TODO remember the area, not just a bool ('true' invalidates everything)
    }
    else if (type == LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR ||
             type == LOK_CALLBACK_CURSOR_VISIBLE ||
             type == LOK_CALLBACK_TEXT_SELECTION ||
             type == LOK_CALLBACK_TEXT_SELECTION_START ||
             type == LOK_CALLBACK_TEXT_SELECTION_END ||
             type == LOK_CALLBACK_CELL_FORMULA ||
             type == LOK_CALLBACK_CELL_CURSOR ||
             type == LOK_CALLBACK_GRAPHIC_SELECTION ||
             type == LOK_CALLBACK_DOCUMENT_SIZE_CHANGED ||
             type == LOK_CALLBACK_INVALIDATE_HEADER ||
             type == LOK_CALLBACK_CELL_ADDRESS)
    {
        auto lock(getLock());
        _stateRecorder.recordEvent(type, payload);
    }
    else if (type == LOK_CALLBACK_INVALIDATE_VIEW_CURSOR ||
             type == LOK_CALLBACK_TEXT_VIEW_SELECTION ||
             type == LOK_CALLBACK_CELL_VIEW_CURSOR ||
             type == LOK_CALLBACK_GRAPHIC_VIEW_SELECTION ||
             type == LOK_CALLBACK_VIEW_CURSOR_VISIBLE ||
             type == LOK_CALLBACK_VIEW_LOCK)
    {
        auto lock(getLock());
        Poco::JSON::Parser parser;

        auto root = parser.parse(payload).extract<Poco::JSON::Object::Ptr>();
        int viewId = root->getValue<int>("viewId");
        _stateRecorder.recordViewEvent(viewId, type, payload);
    }
    else if (type == LOK_CALLBACK_STATE_CHANGED)
    {
        std::string name;
        std::string value;
        if (LOOLProtocol::parseNameValuePair(payload, name, value, '='))
        {
            auto lock(getLock());
            _stateRecorder.recordState(name, payload);
        }
    }
    else if (type == LOK_CALLBACK_REDLINE_TABLE_SIZE_CHANGED ||
             type == LOK_CALLBACK_REDLINE_TABLE_ENTRY_MODIFIED ||
             type == LOK_CALLBACK_COMMENT)
    {
        auto lock(getLock());
        _stateRecorder.recordEventSequence(type, payload);
    }
}

void ChildSession::updateSpeed() {

    std::chrono::steady_clock::time_point now(std::chrono::steady_clock::now());

    while(_cursorInvalidatedEvent.size() != 0 &&
        std::chrono::duration_cast<std::chrono::milliseconds>(now - _cursorInvalidatedEvent.front()).count() > _eventStorageIntervalMs)
    {
        _cursorInvalidatedEvent.pop();
    }
    _cursorInvalidatedEvent.push(now);
    _docManager.updateEditorSpeeds(_viewId, _cursorInvalidatedEvent.size());
}

int ChildSession::getSpeed() {

    std::chrono::steady_clock::time_point now(std::chrono::steady_clock::now());

    while(_cursorInvalidatedEvent.size() > 0 &&
        std::chrono::duration_cast<std::chrono::milliseconds>(now - _cursorInvalidatedEvent.front()).count() > _eventStorageIntervalMs)
    {
        _cursorInvalidatedEvent.pop();
    }
    return _cursorInvalidatedEvent.size();
}

void ChildSession::loKitCallback(const int type, const std::string& payload)
{
    const auto typeName = LOKitHelper::kitCallbackTypeToString(type);
    LOG_TRC("CallbackWorker::callback [" << getName() << "]: " <<
            typeName << " [" << payload << "].");

    if (isCloseFrame())
    {
        LOG_TRC("Skipping callback [" << typeName << "] on closing session " << getName());
        return;
    }
    else if (isDisconnected())
    {
        LOG_TRC("Skipping callback [" << typeName << "] on disconnected session " << getName());
        return;
    }
    else if (!isActive())
    {
        rememberEventsForInactiveUser(type, payload);

        // Pass save notifications through.
        if (type != LOK_CALLBACK_UNO_COMMAND_RESULT || payload.find(".uno:Save") == std::string::npos)
        {
            LOG_TRC("Skipping callback [" << typeName << "] on inactive session " << getName());
            return;
        }
    }

    switch (type)
    {
    case LOK_CALLBACK_INVALIDATE_TILES:
        {
            StringTokenizer tokens(payload, ",", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            if (tokens.count() == 5)
            {
                int part, x, y, width, height;
                try
                {
                    x = std::stoi(tokens[0]);
                    y = std::stoi(tokens[1]);
                    width = std::stoi(tokens[2]);
                    height = std::stoi(tokens[3]);
                    part = (_docType != "text" ? std::stoi(tokens[4]) : 0); // Writer renders everything as part 0.
                }
                catch (const std::out_of_range&)
                {
                    // We might get INT_MAX +/- some delta that
                    // can overflow signed int and we end up here.
                    x = 0;
                    y = 0;
                    width = INT_MAX;
                    height = INT_MAX;
                    part = 0;
                }

                sendTextFrame("invalidatetiles:"
                              " part=" + std::to_string(part) +
                              " x=" + std::to_string(x) +
                              " y=" + std::to_string(y) +
                              " width=" + std::to_string(width) +
                              " height=" + std::to_string(height));
            }
            else if (tokens.count() == 2 && tokens[0] == "EMPTY")
            {
                const std::string part = (_docType != "text" ? tokens[1].c_str() : "0"); // Writer renders everything as part 0.
                sendTextFrame("invalidatetiles: EMPTY, " + part);
            }
            else
            {
                sendTextFrame("invalidatetiles: " + payload);
            }
        }
        break;
    case LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR:
        updateSpeed();
        sendTextFrame("invalidatecursor: " + payload);
        break;
    case LOK_CALLBACK_TEXT_SELECTION:
        sendTextFrame("textselection: " + payload);
        break;
    case LOK_CALLBACK_TEXT_SELECTION_START:
        sendTextFrame("textselectionstart: " + payload);
        break;
    case LOK_CALLBACK_TEXT_SELECTION_END:
        sendTextFrame("textselectionend: " + payload);
        break;
    case LOK_CALLBACK_CURSOR_VISIBLE:
        sendTextFrame("cursorvisible: " + payload);
        break;
    case LOK_CALLBACK_GRAPHIC_SELECTION:
        sendTextFrame("graphicselection: " + payload);
        break;
    case LOK_CALLBACK_CELL_CURSOR:
        sendTextFrame("cellcursor: " + payload);
        break;
    case LOK_CALLBACK_CELL_FORMULA:
        sendTextFrame("cellformula: " + payload);
        break;
    case LOK_CALLBACK_MOUSE_POINTER:
        sendTextFrame("mousepointer: " + payload);
        break;
    case LOK_CALLBACK_HYPERLINK_CLICKED:
        sendTextFrame("hyperlinkclicked: " + payload);
        break;
    case LOK_CALLBACK_STATE_CHANGED:
        sendTextFrame("statechanged: " + payload);
        break;
    case LOK_CALLBACK_SEARCH_NOT_FOUND:
        sendTextFrame("searchnotfound: " + payload);
        break;
    case LOK_CALLBACK_SEARCH_RESULT_SELECTION:
        sendTextFrame("searchresultselection: " + payload);
        break;
    case LOK_CALLBACK_DOCUMENT_SIZE_CHANGED:
        {
            //TODO: clenaup and merge.

            std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());
            const int parts = getLOKitDocument()->getParts();
            for (int i = 0; i < parts; ++i)
            {
                sendTextFrame("invalidatetiles:"
                              " part=" + std::to_string(i) +
                              " x=0" +
                              " y=0" +
                              " width=" + std::to_string(INT_MAX) +
                              " height=" + std::to_string(INT_MAX));
            }

            lock.unlock();

            getStatus("", 0);
        }
        break;
    case LOK_CALLBACK_SET_PART:
        sendTextFrame("setpart: " + payload);
        break;
    case LOK_CALLBACK_UNO_COMMAND_RESULT:
        sendTextFrame("unocommandresult: " + payload);
        break;
    case LOK_CALLBACK_ERROR:
        {
            LOG_ERR("CALLBACK_ERROR: " << payload);
            Parser parser;
            Poco::Dynamic::Var var = parser.parse(payload);
            Object::Ptr object = var.extract<Object::Ptr>();

            sendTextFrame("error: cmd=" + object->get("cmd").toString() +
                    " kind=" + object->get("kind").toString() + " code=" + object->get("code").toString());
        }
        break;
    case LOK_CALLBACK_CONTEXT_MENU:
        sendTextFrame("contextmenu: " + payload);
        break;
    case LOK_CALLBACK_STATUS_INDICATOR_START:
        sendTextFrame("statusindicatorstart:");
        break;
    case LOK_CALLBACK_STATUS_INDICATOR_SET_VALUE:
        sendTextFrame("statusindicatorsetvalue: " + payload);
        break;
    case LOK_CALLBACK_STATUS_INDICATOR_FINISH:
        sendTextFrame("statusindicatorfinish:");
        break;
    case LOK_CALLBACK_INVALIDATE_VIEW_CURSOR:
        sendTextFrame("invalidateviewcursor: " + payload);
        break;
    case LOK_CALLBACK_TEXT_VIEW_SELECTION:
        sendTextFrame("textviewselection: " + payload);
        break;
    case LOK_CALLBACK_CELL_VIEW_CURSOR:
        sendTextFrame("cellviewcursor: " + payload);
        break;
    case LOK_CALLBACK_GRAPHIC_VIEW_SELECTION:
        sendTextFrame("graphicviewselection: " + payload);
        break;
    case LOK_CALLBACK_VIEW_CURSOR_VISIBLE:
        sendTextFrame("viewcursorvisible: " + payload);
        break;
    case LOK_CALLBACK_VIEW_LOCK:
        sendTextFrame("viewlock: " + payload);
        break;
    case LOK_CALLBACK_REDLINE_TABLE_SIZE_CHANGED:
        sendTextFrame("redlinetablechanged: " + payload);
        break;
    case LOK_CALLBACK_REDLINE_TABLE_ENTRY_MODIFIED:
        sendTextFrame("redlinetablemodified: " + payload);
        break;
    case LOK_CALLBACK_COMMENT:
        sendTextFrame("comment: " + payload);
        break;
    case LOK_CALLBACK_INVALIDATE_HEADER:
        sendTextFrame("invalidateheader: " + payload);
        break;
    case LOK_CALLBACK_CELL_ADDRESS:
        sendTextFrame("celladdress: " + payload);
        break;
    case LOK_CALLBACK_RULER_UPDATE:
        sendTextFrame("rulerupdate: " + payload);
        break;
    case LOK_CALLBACK_DIALOG:
        sendTextFrame("dialog: " + payload);
        break;
    case LOK_CALLBACK_DIALOG_CHILD:
        sendTextFrame("dialogchild: " + payload);
        break;
    default:
        LOG_ERR("Unknown callback event (" << type << "): " << payload);
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
