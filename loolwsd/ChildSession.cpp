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

#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>

#include "LOKitHelper.hpp"
#include "Log.hpp"
#include "Png.hpp"
#include "Util.hpp"

using Poco::JSON::Object;
using Poco::JSON::Parser;
using Poco::Net::WebSocket;
using Poco::StringTokenizer;
using Poco::Timestamp;
using Poco::URI;

using namespace LOOLProtocol;

std::recursive_mutex ChildSession::Mutex;

ChildSession::ChildSession(const std::string& id,
                           std::shared_ptr<WebSocket> ws,
                           const std::string& jailId,
                           IDocumentManager& docManager) :
    LOOLSession(id, Kind::ToMaster, ws),
    _multiView(std::getenv("LOK_VIEW_CALLBACK")),
    _jailId(jailId),
    _viewId(-1),
    _docManager(docManager)
{
    Log::info("ChildSession ctor [" + getName() + "].");
}

ChildSession::~ChildSession()
{
    Log::info("~ChildSession dtor [" + getName() + "].");

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
            Log::warn("Skipping unload on incomplete view.");
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

    if (tokens.count() > 0 && tokens[0] == "useractive" && _loKitDocument != nullptr)
    {
        Log::debug("Handling message after inactivity of " + std::to_string(getInactivityMS()) + "ms.");
        setIsActive(true);

        // Client is getting active again.
        // Send invalidation and other sync-up messages.
        std::unique_lock<std::recursive_mutex> lock(Mutex); //TODO: Move to top of function?

        if (_multiView)
            _loKitDocument->setView(_viewId);

        // Refresh the viewIds.
        sendTextFrame("remallviews:");
        for (const auto viewId : _docManager.getViewIds())
        {
            sendTextFrame("addview: " + std::to_string(viewId));
        }

        const int curPart = _loKitDocument->getPart();
        sendTextFrame("curpart: part=" + std::to_string(curPart));
        sendTextFrame("setpart: part=" + std::to_string(curPart));

        //TODO: Is the order of these important?
        for (const auto& pair : _lastDocStates)
        {
            loKitCallback(pair.first, pair.second);
        }

        Log::debug("Finished replaying messages.");
    }

    if (tokens[0] == "dummymsg")
    {
        // Just to update the activity of a view-only client.
        return true;
    }
    else if (tokens[0] == "canceltiles")
    {
        // This command makes sense only on the command queue level.
        // Shouldn't get this here.
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
               tokens[0] == "userinactive" ||
               tokens[0] == "editlock:");

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
        else if (tokens[0] == "editlock:")
        {
            // Nothing for us to do but to let the
            // client know about the edit lock state.
            // Yes, this is echoed back because it's better
            // to do this on each child's queue and thread
            // than for WSD to potentially stall while notifying
            // each client with the edit lock state.
            Log::trace("Echoing back [" + firstLine + "].");
            return sendTextFrame(firstLine);
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
        renderOpts = object->get("rendering").toString();
    }

    assert(!_docURL.empty());
    assert(!_jailedFilePath.empty());

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    _loKitDocument = _docManager.onLoad(getId(), _jailedFilePath, _docPassword, renderOpts, _haveDocPassword);
    if (!_loKitDocument)
    {
        Log::error("Failed to get LoKitDocument instance.");
        return false;
    }

    if (_multiView)
    {
        _viewId = _loKitDocument->getView();
        const auto viewId = std::to_string(_viewId);
        Log::info("Created new view: " + viewId);
        sendTextFrame("addview: " + viewId);
    }

    _docType = LOKitHelper::getDocumentTypeAsString(_loKitDocument->get());
    if (_docType != "text" && part != -1)
    {
        _loKitDocument->setPart(part);
    }

    // Respond by the document status
    Log::debug("Sending status after loading view " + std::to_string(_viewId) + ".");
    const auto status = LOKitHelper::documentStatus(_loKitDocument->get());
    if (status.empty() || !sendTextFrame("status: " + status))
    {
        Log::error("Failed to get/forward document status [" + status + "].");
        return false;
    }

    Log::info("Loaded session " + getId());
    return true;
}

bool ChildSession::sendFontRendering(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    std::string font, decodedFont;

    if (tokens.count() < 2 ||
        !getTokenString(tokens[1], "font", font))
    {
        sendTextFrame("error: cmd=renderfont kind=syntax");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
       _loKitDocument->setView(_viewId);

    URI::decode(font, decodedFont);
    std::string response = "renderfont: " + Poco::cat(std::string(" "), tokens.begin() + 1, tokens.end()) + "\n";

    std::vector<char> output;
    output.resize(response.size());
    std::memcpy(output.data(), response.data(), response.size());

    Timestamp timestamp;
    int width, height;
    unsigned char* ptrFont = _loKitDocument->renderFont(decodedFont.c_str(), &width, &height);
    Log::trace("renderFont [" + font + "] rendered in " + std::to_string(timestamp.elapsed()/1000.) + "ms");

    if (!ptrFont ||
        !png::encodeBufferToPNG(ptrFont, width, height, output, LOK_TILEMODE_RGBA))
    {
        std::free(ptrFont);
        return sendTextFrame("error: cmd=renderfont kind=failure");
    }

    std::free(ptrFont);
    return sendBinaryFrame(output.data(), output.size());
}

bool ChildSession::getStatus(const char* /*buffer*/, int /*length*/)
{
    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    const auto status = LOKitHelper::documentStatus(_loKitDocument->get());
    if (status.empty())
    {
        Log::error("Failed to get document status.");
        return false;
    }

    return sendTextFrame("status: " + status);
}

bool ChildSession::getCommandValues(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    std::string command;
    if (tokens.count() != 2 || !getTokenString(tokens[1], "command", command))
    {
        sendTextFrame("error: cmd=commandvalues kind=syntax");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    char* ptrValues = _loKitDocument->getCommandValues(command.c_str());
    bool success = sendTextFrame("commandvalues: " + std::string(ptrValues));
    std::free(ptrValues);
    return success;
}

bool ChildSession::getPartPageRectangles(const char* /*buffer*/, int /*length*/)
{
    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    char* partPage = _loKitDocument->getPartPageRectangles();
    sendTextFrame("partpagerectangles: " + std::string(partPage));
    std::free(partPage);
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

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    _loKitDocument->setClientZoom(tilePixelWidth, tilePixelHeight, tileTwipWidth, tileTwipHeight);
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

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    _loKitDocument->setClientVisibleArea(x, y, width, height);
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
    const auto tmpDir = Util::createRandomDir(JAILED_DOCUMENT_ROOT);
    // Prevent user inputting anything funny here.
    // A "name" should always be a name, not a path
    const Poco::Path filenameParam(name);
    const auto url = JAILED_DOCUMENT_ROOT + tmpDir + "/" + filenameParam.getFileName();

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    _loKitDocument->saveAs(url.c_str(),
            format.size() == 0 ? nullptr :format.c_str(),
            filterOptions.size() == 0 ? nullptr : filterOptions.c_str());

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

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    char *textSelection = _loKitDocument->getTextSelection(mimeType.c_str(), nullptr);

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
    size_t size = length - firstLine.size() - 1;

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    Log::info("Calling _loKit->paste()");
    _loKitDocument->paste(mimeType.c_str(), data, size);
    Log::info("paste() returned");

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

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (type == "graphic")
    {
        std::string fileName = "file://" + std::string(JAILED_DOCUMENT_ROOT) + "insertfile/" + name;
        std::string command = ".uno:InsertGraphic";
        std::string arguments = "{"
            "\"FileName\":{"
                "\"type\":\"string\","
                "\"value\":\"" + fileName + "\""
            "}}";
        if (_multiView)
            _loKitDocument->setView(_viewId);

        _loKitDocument->postUnoCommand(command.c_str(), arguments.c_str(), false);
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

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    _loKitDocument->postKeyEvent(type, charcode, keycode);

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

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    _loKitDocument->postMouseEvent(type, x, y, count, buttons, modifier);

    return true;
}

bool ChildSession::unoCommand(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    if (tokens.count() <= 1)
    {
        sendTextFrame("error: cmd=uno kind=syntax");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    // we need to get LOK_CALLBACK_UNO_COMMAND_RESULT callback when saving
    const bool bNotify = (tokens[1] == ".uno:Save");

    if (tokens.count() == 2)
    {
        _loKitDocument->postUnoCommand(tokens[1].c_str(), nullptr, bNotify);
    }
    else
    {
        _loKitDocument->postUnoCommand(tokens[1].c_str(),
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

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    _loKitDocument->setTextSelection(type, x, y);

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

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    _loKitDocument->setGraphicSelection(type, x, y);

    return true;
}

bool ChildSession::resetSelection(const char* /*buffer*/, int /*length*/, StringTokenizer& tokens)
{
    if (tokens.count() != 1)
    {
        sendTextFrame("error: cmd=resetselection kind=syntax");
        return false;
    }

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    _loKitDocument->resetSelection();

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

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    bool success = _loKitDocument->saveAs(url.c_str(),
            format.size() == 0 ? nullptr :format.c_str(),
            filterOptions.size() == 0 ? nullptr : filterOptions.c_str());

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

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (part != _loKitDocument->getPart())
    {
        if (_multiView)
            _loKitDocument->setView(_viewId);

        _loKitDocument->setPart(part);
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

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    if (_multiView)
        _loKitDocument->setView(_viewId);

    _loKitDocument->setPart(page);
    return true;
}

void ChildSession::loKitCallback(const int nType, const std::string& rPayload)
{
    std::unique_lock<std::recursive_mutex> lock(Mutex);

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
        _lastDocStates[nType] = rPayload;
    }

    const auto typeName = LOKitHelper::kitCallbackTypeToString(nType);
    if (isCloseFrame())
    {
        Log::trace("Skipping callback [" + typeName + "] on closing session " + getName());
        return;
    }
    else if (isDisconnected())
    {
        Log::trace("Skipping callback [" + typeName + "] on disconnected session " + getName());
        return;
    }
    else if (!isActive())
    {
        // Pass save notifications through.
        if (nType != LOK_CALLBACK_UNO_COMMAND_RESULT || rPayload.find(".uno:Save") == std::string::npos)
        {
            Log::trace("Skipping callback [" + typeName + "] on inactive session " + getName());
            return;
        }
    }

    Log::trace() << "CallbackWorker::callback [" << getName() << "]: "
                 << typeName << " [" << rPayload << "]." << Log::end;
    switch (nType)
    {
    case LOK_CALLBACK_INVALIDATE_TILES:
        {
            const auto curPart = getPart();

            StringTokenizer tokens(rPayload, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            if (tokens.count() == 4)
            {
                int x, y, width, height;
                try
                {
                    x = std::stoi(tokens[0]);
                    y = std::stoi(tokens[1]);
                    width = std::stoi(tokens[2]);
                    height = std::stoi(tokens[3]);
                }
                catch (const std::out_of_range&)
                {
                    // something went wrong, invalidate everything
                    Log::warn("Ignoring integer values out of range: " + rPayload);
                    x = 0;
                    y = 0;
                    width = INT_MAX;
                    height = INT_MAX;
                }

                sendTextFrame("invalidatetiles:"
                                       " part=" + std::to_string(curPart) +
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
        getStatus("", 0);
        getPartPageRectangles("", 0);
        break;
    case LOK_CALLBACK_SET_PART:
        sendTextFrame("setpart: " + rPayload);
        break;
    case LOK_CALLBACK_UNO_COMMAND_RESULT:
        sendTextFrame("unocommandresult: " + rPayload);
        break;
    case LOK_CALLBACK_ERROR:
        {
            Log::error("CALLBACK_ERROR: " + rPayload);
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
    default:
        Log::error("Unknown callback event (" + std::to_string(nType) + "): " + rPayload);
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
