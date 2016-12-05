/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "ChildSession.hpp"
#include "config.h"

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
    LOOLSession(id, Kind::ToMaster, nullptr),
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

        LOOLSession::disconnect();
    }
}

bool ChildSession::_handleInput(const char *buffer, int length)
{
    const std::string firstLine = getFirstLine(buffer, length);
    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    if (LOOLProtocol::tokenIndicatesUserInteraction(tokens[0]))
    {
        // Keep track of timestamps of incoming client messages that indicate user activity.
        updateLastActivityTime();
    }

    if (tokens.count() > 0 && tokens[0] == "useractive" && getLOKitDocument() != nullptr)
    {
        LOG_DBG("Handling message after inactivity of " << getInactivityMS() << "ms.");
        setIsActive(true);

        // Client is getting active again.
        // Send invalidation and other sync-up messages.
        std::unique_lock<std::recursive_mutex> lock(Mutex); //TODO: Move to top of function?
        std::unique_lock<std::mutex> lockLokDoc(_docManager.getDocumentMutex());

        getLOKitDocument()->setView(_viewId);

        // Get the list of view ids from the core
        const int viewCount = getLOKitDocument()->getViewsCount();
        std::vector<int> viewIds(viewCount);
        getLOKitDocument()->getViewIds(viewIds.data(), viewCount);

        int curPart = 0;
        if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT)
            curPart = getLOKitDocument()->getPart();

        lockLokDoc.unlock();

        // Notify all views about updated view info
        _docManager.notifyViewInfo(viewIds);

        if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT)
        {
            sendTextFrame("curpart: part=" + std::to_string(curPart));
            sendTextFrame("setpart: part=" + std::to_string(curPart));
        }

        //TODO: Is the order of these important?
        for (const auto& pair : _lastDocEvents)
        {
            const auto typeName = LOKitHelper::kitCallbackTypeToString(pair.first);
            LOG_TRC("Replaying missed event: " << typeName << ": " << pair.second);
            loKitCallback(pair.first, pair.second);
        }

        for (const auto& pair : _lastDocStates)
        {
            LOG_TRC("Replaying missed state-change: STATE_CHANGED: " << pair.second);
            loKitCallback(LOK_CALLBACK_STATE_CHANGED, pair.second);
        }

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
    else if (tokens[0] == "partpagerectangles")
    {
        return getPartPageRectangles(buffer, length);
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
        // Be forgiving to these messages while we load.
        if (tokens[0] == "useractive" ||
            tokens[0] == "userinactive")
        {
            return true;
        }

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

bool ChildSession::loadDocument(const char * /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int part = -1;
    if (tokens.count() < 2)
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

    bool loaded = _docManager.onLoad(getId(), _jailedFilePath, _userName, _docPassword, renderOpts, _haveDocPassword);
    if (!loaded || _viewId < 0)
    {
        LOG_ERR("Failed to get LoKitDocument instance.");
        return false;
    }

    LOG_INF("Created new view with viewid: [" << _viewId << + "] for username: [" <<
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

    // Get the list of view ids from the core
    const int viewCount = getLOKitDocument()->getViewsCount();
    std::vector<int> viewIds(viewCount);
    getLOKitDocument()->getViewIds(viewIds.data(), viewCount);

    lockLokDoc.unlock();

    // Inform everyone (including this one) about updated view info
    _docManager.notifyViewInfo(viewIds);

    LOG_INF("Loaded session " << getId());
    return true;
}

bool ChildSession::sendFontRendering(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    std::string font, text, decodedFont;

    if (tokens.count() < 3 ||
        !getTokenString(tokens[1], "font", font))
    {
        sendTextFrame("error: cmd=renderfont kind=syntax");
        return false;
    }

    getTokenString(tokens[2], "char", text);

    URI::decode(font, decodedFont);
    std::string response = "renderfont: " + Poco::cat(std::string(" "), tokens.begin() + 1, tokens.end()) + "\n";

    std::vector<char> output;
    output.resize(response.size());
    std::memcpy(output.data(), response.data(), response.size());

    Timestamp timestamp;
    int width, height;
    unsigned char* ptrFont = nullptr;

    {
        std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

        getLOKitDocument()->setView(_viewId);

        ptrFont = getLOKitDocument()->renderFont(decodedFont.c_str(), text.c_str(), &width, &height);
    }

    LOG_TRC("renderFont [" << font << "] rendered in " << (timestamp.elapsed()/1000.) << "ms");

    if (!ptrFont ||
        !png::encodeBufferToPNG(ptrFont, width, height, output, LOK_TILEMODE_RGBA))
    {
        std::free(ptrFont);
        return sendTextFrame("error: cmd=renderfont kind=failure");
    }

    std::free(ptrFont);
    return sendTextFrame(output.data(), output.size());
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
                    action->set("userName", Poco::Dynamic::Var(it->second.username));
            }
        }
    }
    std::stringstream ss;
    root->stringify(ss);
    json = ss.str();
}

}

bool ChildSession::getCommandValues(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    bool success;
    char* pValues;
    std::string command;
    if (tokens.count() != 2 || !getTokenString(tokens[1], "command", command))
    {
        sendTextFrame("error: cmd=commandvalues kind=syntax");
        return false;
    }

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    if (command == ".uno:DocumentRepair")
    {
        char* pUndo;
        const std::string jsonTemplate("{\"commandName\":\".uno:DocumentRepair\",\"Redo\":%s,\"Undo\":%s}");
        pValues = getLOKitDocument()->getCommandValues(".uno:Redo");
        pUndo = getLOKitDocument()->getCommandValues(".uno:Undo");
        std::string json = Poco::format(jsonTemplate,
                                        std::string(pValues == nullptr ? "" : pValues),
                                        std::string(pUndo == nullptr ? "" : pUndo));
        // json only contains view IDs, insert matching user names.
        std::map<int, UserInfo> viewInfo = _docManager.getViewInfo();
        insertUserNames(viewInfo, json);
        success = sendTextFrame("commandvalues: " + json);
        std::free(pValues);
        std::free(pUndo);
    }
    else
    {
        pValues = getLOKitDocument()->getCommandValues(command.c_str());
        success = sendTextFrame("commandvalues: " + std::string(pValues == nullptr ? "" : pValues));
        std::free(pValues);
    }

    return success;
}

bool ChildSession::getPartPageRectangles(const char* /*buffer*/, int /*length*/)
{
    // We don't support partpagerectangles any more, will be removed in the
    // next version
    sendTextFrame("partpagerectangles: ");
    return true;
}

bool ChildSession::clientZoom(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int tilePixelWidth, tilePixelHeight, tileTwipWidth, tileTwipHeight;

    if (tokens.count() != 5 ||
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

bool ChildSession::clientVisibleArea(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int x;
    int y;
    int width;
    int height;

    if (tokens.count() != 5 ||
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

bool ChildSession::downloadAs(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    std::string name, id, format, filterOptions;

    if (tokens.count() < 5 ||
        !getTokenString(tokens[1], "name", name) ||
        !getTokenString(tokens[2], "id", id))
    {
        sendTextFrame("error: cmd=downloadas kind=syntax");
        return false;
    }

    getTokenString(tokens[3], "format", format);

    if (getTokenString(tokens[4], "options", filterOptions))
    {
        if (tokens.count() > 5)
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

bool ChildSession::getTextSelection(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    std::string mimeType;

    if (tokens.count() != 2 ||
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

bool ChildSession::paste(const char* buffer, int length, StringTokenizer& tokens)
{
    std::string mimeType;

    if (tokens.count() < 2 || !getTokenString(tokens[1], "mimetype", mimeType))
    {
        sendTextFrame("error: cmd=paste kind=syntax");
        return false;
    }

    const std::string firstLine = getFirstLine(buffer, length);
    const char* data = buffer + firstLine.size() + 1;
    const size_t size = length - firstLine.size() - 1;

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->paste(mimeType.c_str(), data, size);

    return true;
}

bool ChildSession::insertFile(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    std::string name, type;
    if (tokens.count() != 3 ||
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

bool ChildSession::keyEvent(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int type, charcode, keycode;
    if (tokens.count() != 4 ||
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

bool ChildSession::mouseEvent(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int type, x, y, count;
    bool success = true;

    // default values for compatibility reasons with older loleaflets
    int buttons = 1; // left button
    int modifier = 0;

    if (tokens.count() < 5 ||
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
    if (success && tokens.count() > 5 && !getTokenInteger(tokens[5], "buttons", buttons))
        success = false;

    // compatibility with older loleaflets
    if (success && tokens.count() > 6 && !getTokenInteger(tokens[6], "modifier", modifier))
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

bool ChildSession::unoCommand(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    if (tokens.count() <= 1)
    {
        sendTextFrame("error: cmd=uno kind=syntax");
        return false;
    }

    // we need to get LOK_CALLBACK_UNO_COMMAND_RESULT callback when saving
    const bool bNotify = (tokens[1] == ".uno:Save");

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    if (tokens.count() == 2 && tokens[1] == ".uno:fakeDiskFull")
    {
        Util::alertAllUsers("internal", "diskfull");
    }
    else if (tokens.count() == 2)
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

bool ChildSession::selectText(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int type, x, y;
    if (tokens.count() != 4 ||
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

bool ChildSession::selectGraphic(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int type, x, y;
    if (tokens.count() != 4 ||
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

bool ChildSession::resetSelection(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    if (tokens.count() != 1)
    {
        sendTextFrame("error: cmd=resetselection kind=syntax");
        return false;
    }

    std::unique_lock<std::mutex> lock(_docManager.getDocumentMutex());

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->resetSelection();

    return true;
}

bool ChildSession::saveAs(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    std::string url, format, filterOptions;

    if (tokens.count() < 4 ||
        !getTokenString(tokens[1], "url", url))
    {
        sendTextFrame("error: cmd=saveas kind=syntax");
        return false;
    }

    getTokenString(tokens[2], "format", format);

    if (getTokenString(tokens[3], "options", filterOptions))
    {
        if (tokens.count() > 4)
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

bool ChildSession::setClientPart(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int part;
    if (tokens.count() < 2 ||
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

bool ChildSession::setPage(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    int page;
    if (tokens.count() < 2 ||
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

void ChildSession::loKitCallback(const int nType, const std::string& rPayload)
{
    const auto typeName = LOKitHelper::kitCallbackTypeToString(nType);
    LOG_TRC("CallbackWorker::callback [" << getName() << "]: " <<
            typeName << " [" << rPayload << "].");

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
        // Cache important notifications to replay them when our client
        // goes inactive and loses them.
        if (nType == LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR ||
            nType == LOK_CALLBACK_CURSOR_VISIBLE ||
            nType == LOK_CALLBACK_CELL_CURSOR ||
            nType == LOK_CALLBACK_CELL_FORMULA ||
            nType == LOK_CALLBACK_GRAPHIC_SELECTION ||
            nType == LOK_CALLBACK_TEXT_SELECTION ||
            nType == LOK_CALLBACK_TEXT_SELECTION_START ||
            nType == LOK_CALLBACK_TEXT_SELECTION_END ||
            nType == LOK_CALLBACK_DOCUMENT_SIZE_CHANGED ||
            nType == LOK_CALLBACK_INVALIDATE_VIEW_CURSOR ||
            nType == LOK_CALLBACK_TEXT_VIEW_SELECTION ||
            nType == LOK_CALLBACK_CELL_VIEW_CURSOR ||
            nType == LOK_CALLBACK_GRAPHIC_VIEW_SELECTION ||
            nType == LOK_CALLBACK_VIEW_CURSOR_VISIBLE ||
            nType == LOK_CALLBACK_VIEW_LOCK)
        {
            auto lock(getLock());

            _lastDocEvents[nType] = rPayload;
        }

        if (nType == LOK_CALLBACK_STATE_CHANGED)
        {
            std::string name;
            std::string value;
            if (LOOLProtocol::parseNameValuePair(rPayload, name, value, '='))
            {
                auto lock(getLock());

                _lastDocStates[name] = rPayload;
            }
        }

        // Pass save notifications through.
        if (nType != LOK_CALLBACK_UNO_COMMAND_RESULT || rPayload.find(".uno:Save") == std::string::npos)
        {
            LOG_TRC("Skipping callback [" << typeName << "] on inactive session " << getName());
            return;
        }
    }

    switch (nType)
    {
    case LOK_CALLBACK_INVALIDATE_TILES:
        {
            StringTokenizer tokens(rPayload, ",", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
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
            else
            {
                sendTextFrame("invalidatetiles: " + rPayload);
            }
        }
        break;
    case LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR:
        sendTextFrame("invalidatecursor: " + rPayload);
        break;
    case LOK_CALLBACK_TEXT_SELECTION:
        sendTextFrame("textselection: " + rPayload);
        break;
    case LOK_CALLBACK_TEXT_SELECTION_START:
        sendTextFrame("textselectionstart: " + rPayload);
        break;
    case LOK_CALLBACK_TEXT_SELECTION_END:
        sendTextFrame("textselectionend: " + rPayload);
        break;
    case LOK_CALLBACK_CURSOR_VISIBLE:
        sendTextFrame("cursorvisible: " + rPayload);
        break;
    case LOK_CALLBACK_GRAPHIC_SELECTION:
        sendTextFrame("graphicselection: " + rPayload);
        break;
    case LOK_CALLBACK_CELL_CURSOR:
        sendTextFrame("cellcursor: " + rPayload);
        break;
    case LOK_CALLBACK_CELL_FORMULA:
        sendTextFrame("cellformula: " + rPayload);
        break;
    case LOK_CALLBACK_MOUSE_POINTER:
        sendTextFrame("mousepointer: " + rPayload);
        break;
    case LOK_CALLBACK_HYPERLINK_CLICKED:
        sendTextFrame("hyperlinkclicked: " + rPayload);
        break;
    case LOK_CALLBACK_STATE_CHANGED:
        sendTextFrame("statechanged: " + rPayload);
        break;
    case LOK_CALLBACK_SEARCH_NOT_FOUND:
        sendTextFrame("searchnotfound: " + rPayload);
        break;
    case LOK_CALLBACK_SEARCH_RESULT_SELECTION:
        sendTextFrame("searchresultselection: " + rPayload);
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
            getPartPageRectangles("", 0);
        }
        break;
    case LOK_CALLBACK_SET_PART:
        sendTextFrame("setpart: " + rPayload);
        break;
    case LOK_CALLBACK_UNO_COMMAND_RESULT:
        sendTextFrame("unocommandresult: " + rPayload);
        break;
    case LOK_CALLBACK_ERROR:
        {
            LOG_ERR("CALLBACK_ERROR: " << rPayload);
            Parser parser;
            Poco::Dynamic::Var var = parser.parse(rPayload);
            Object::Ptr object = var.extract<Object::Ptr>();

            sendTextFrame("error: cmd=" + object->get("cmd").toString() +
                    " kind=" + object->get("kind").toString() + " code=" + object->get("code").toString());
        }
        break;
    case LOK_CALLBACK_CONTEXT_MENU:
        sendTextFrame("contextmenu: " + rPayload);
        break;
    case LOK_CALLBACK_STATUS_INDICATOR_START:
        sendTextFrame("statusindicatorstart:");
        break;
    case LOK_CALLBACK_STATUS_INDICATOR_SET_VALUE:
        sendTextFrame("statusindicatorsetvalue: " + rPayload);
        break;
    case LOK_CALLBACK_STATUS_INDICATOR_FINISH:
        sendTextFrame("statusindicatorfinish:");
        break;
    case LOK_CALLBACK_INVALIDATE_VIEW_CURSOR:
        sendTextFrame("invalidateviewcursor: " + rPayload);
        break;
    case LOK_CALLBACK_TEXT_VIEW_SELECTION:
        sendTextFrame("textviewselection: " + rPayload);
        break;
    case LOK_CALLBACK_CELL_VIEW_CURSOR:
        sendTextFrame("cellviewcursor: " + rPayload);
        break;
    case LOK_CALLBACK_GRAPHIC_VIEW_SELECTION:
        sendTextFrame("graphicviewselection: " + rPayload);
        break;
    case LOK_CALLBACK_VIEW_CURSOR_VISIBLE:
        sendTextFrame("viewcursorvisible: " + rPayload);
        break;
    case LOK_CALLBACK_VIEW_LOCK:
        sendTextFrame("viewlock: " + rPayload);
        break;
    case LOK_CALLBACK_REDLINE_TABLE_SIZE_CHANGED:
        sendTextFrame("redlinetablechanged: " + rPayload);
        break;
    case LOK_CALLBACK_REDLINE_TABLE_ENTRY_MODIFIED:
        sendTextFrame("redlinetablemodified: " + rPayload);
        break;
    default:
        LOG_ERR("Unknown callback event (" << nType << "): " << rPayload);
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
