/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "ChildSession.hpp"

#include <fstream>
#include <sstream>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/StringTokenizer.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>
#include <Poco/BinaryReader.h>
#include <Poco/Base64Decoder.h>
#if !MOBILEAPP
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/Net/KeyConsoleHandler.h>
#include <Poco/Net/AcceptCertificateHandler.h>
#endif

#include <common/FileUtil.hpp>
#include <common/JsonUtil.hpp>
#include <common/Authorization.hpp>
#include "KitHelper.hpp"
#include <Log.hpp>
#include <Png.hpp>
#include <Util.hpp>

using Poco::JSON::Object;
using Poco::JSON::Parser;
using Poco::StringTokenizer;
using Poco::Timestamp;
using Poco::URI;

using namespace LOOLProtocol;

std::recursive_mutex ChildSession::Mutex;

namespace {

std::vector<unsigned char> decodeBase64(const std::string & inputBase64)
{
    std::istringstream stream(inputBase64);
    Poco::Base64Decoder base64Decoder(stream);
    std::istreambuf_iterator<char> eos;
    return std::vector<unsigned char>(std::istreambuf_iterator<char>(base64Decoder), eos);
}

}

ChildSession::ChildSession(const std::string& id,
                           const std::string& jailId,
                           DocumentManagerInterface& docManager) :
    Session("ToMaster-" + id, id, false),
    _jailId(jailId),
    _docManager(docManager),
    _viewId(-1),
    _isDocLoaded(false),
    _copyToClipboard(false)
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
    const std::vector<std::string> tokens = LOOLProtocol::tokenize(firstLine.data(), firstLine.size());

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

        getLOKitDocument()->setView(_viewId);

        int curPart = 0;
        if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT)
            curPart = getLOKitDocument()->getPart();

        // Notify all views about updated view info
        _docManager.notifyViewInfo();

        if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT)
        {
            sendTextFrame("curpart: part=" + std::to_string(curPart));
            sendTextFrame("setpart: part=" + std::to_string(curPart));
        }

        // Invalidate if we have to
        // TODO instead just a "_invalidate" flag, we should remember / grow
        // the rectangle to invalidate; invalidating everything is sub-optimal
        if (_stateRecorder.isInvalidate())
        {
            std::string payload = "0, 0, " + std::to_string(INT_MAX) + ", " + std::to_string(INT_MAX) + ", " + std::to_string(curPart);
            loKitCallback(LOK_CALLBACK_INVALIDATE_TILES, payload);
        }

        for (const auto& viewPair : _stateRecorder.getRecordedViewEvents())
        {
            for (const auto& eventPair : viewPair.second)
            {
                const RecordedEvent& event = eventPair.second;
                LOG_TRC("Replaying missed view event: " <<  viewPair.first << " " << LOKitHelper::kitCallbackTypeToString(event.getType())
                                                        << ": " << event.getPayload());
                loKitCallback(event.getType(), event.getPayload());
            }
        }

        for (const auto& eventPair : _stateRecorder.getRecordedEvents())
        {
            const RecordedEvent& event = eventPair.second;
            LOG_TRC("Replaying missed event: " << LOKitHelper::kitCallbackTypeToString(event.getType()) << ": " << event.getPayload());
            loKitCallback(event.getType(), event.getPayload());
        }

        for (const auto& pair : _stateRecorder.getRecordedStates())
        {
            LOG_TRC("Replaying missed state-change: " << pair.second);
            loKitCallback(LOK_CALLBACK_STATE_CHANGED, pair.second);
        }

        for (const auto& event : _stateRecorder.getRecordedEventsVector())
        {
            LOG_TRC("Replaying missed event (part of sequence): " << LOKitHelper::kitCallbackTypeToString(event.getType()) << ": " << event.getPayload());
            loKitCallback(event.getType(), event.getPayload());
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
    else if (tokens[0] == "selectclientpart")
    {
        return selectClientPart(buffer, length, tokens);
    }
    else if (tokens[0] == "moveselectedclientparts")
    {
        return moveSelectedClientParts(buffer, length, tokens);
    }
    else if (tokens[0] == "setpage")
    {
        return setPage(buffer, length, tokens);
    }
    else if (tokens[0] == "status")
    {
        return getStatus(buffer, length);
    }
    else if (tokens[0] == "paintwindow")
    {
        return renderWindow(buffer, length, tokens);
    }
    else if (tokens[0] == "resizewindow")
    {
        return resizeWindow(buffer, length, tokens);
    }
    else if (tokens[0] == "tile" || tokens[0] == "tilecombine")
    {
        assert(false && "Tile traffic should go through the DocumentBroker-LoKit WS.");
    }
    else if (tokens[0] == "requestloksession" ||
             tokens[0] == "canceltiles")
    {
        // Just ignore these.
        // FIXME: We probably should do something for "canceltiles" at least?
    }
    else
    {
        // All other commands are such that they always require a LibreOfficeKitDocument session,
        // i.e. need to be handled in a child process.

        assert(tokens[0] == "clientzoom" ||
               tokens[0] == "clientvisiblearea" ||
               tokens[0] == "outlinestate" ||
               tokens[0] == "downloadas" ||
               tokens[0] == "getchildid" ||
               tokens[0] == "gettextselection" ||
               tokens[0] == "paste" ||
               tokens[0] == "insertfile" ||
               tokens[0] == "key" ||
               tokens[0] == "textinput" ||
               tokens[0] == "windowkey" ||
               tokens[0] == "mouse" ||
               tokens[0] == "windowmouse" ||
               tokens[0] == "windowgesture" ||
               tokens[0] == "uno" ||
               tokens[0] == "selecttext" ||
               tokens[0] == "selectgraphic" ||
               tokens[0] == "resetselection" ||
               tokens[0] == "saveas" ||
               tokens[0] == "useractive" ||
               tokens[0] == "userinactive" ||
               tokens[0] == "windowcommand" ||
               tokens[0] == "asksignaturestatus" ||
               tokens[0] == "signdocument" ||
               tokens[0] == "uploadsigneddocument" ||
               tokens[0] == "exportsignanduploaddocument" ||
               tokens[0] == "rendershapeselection");

        if (tokens[0] == "clientzoom")
        {
            return clientZoom(buffer, length, tokens);
        }
        else if (tokens[0] == "clientvisiblearea")
        {
            return clientVisibleArea(buffer, length, tokens);
        }
        else if (tokens[0] == "outlinestate")
        {
            return outlineState(buffer, length, tokens);
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
            return keyEvent(buffer, length, tokens, LokEventTargetEnum::Document);
        }
        else if (tokens[0] == "textinput")
        {
            return extTextInputEvent(buffer, length, tokens);
        }
        else if (tokens[0] == "windowkey")
        {
            return keyEvent(buffer, length, tokens, LokEventTargetEnum::Window);
        }
        else if (tokens[0] == "mouse")
        {
            return mouseEvent(buffer, length, tokens, LokEventTargetEnum::Document);
        }
        else if (tokens[0] == "windowmouse")
        {
            return mouseEvent(buffer, length, tokens, LokEventTargetEnum::Window);
        }
        else if (tokens[0] == "windowgesture")
        {
            return gestureEvent(buffer, length, tokens);
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
        else if (tokens[0] == "windowcommand")
        {
            sendWindowCommand(buffer, length, tokens);
        }
        else if (tokens[0] == "signdocument")
        {
            signDocumentContent(buffer, length, tokens);
        }
        else if (tokens[0] == "asksignaturestatus")
        {
            askSignatureStatus(buffer, length, tokens);
        }
#if !MOBILEAPP
        else if (tokens[0] == "uploadsigneddocument")
        {
            return uploadSignedDocument(buffer, length, tokens);
        }
        else if (tokens[0] == "exportsignanduploaddocument")
        {
            return exportSignAndUploadDocument(buffer, length, tokens);
        }
#endif
        else if (tokens[0] == "rendershapeselection")
        {
            return renderShapeSelection(buffer, length, tokens);
        }
        else
        {
            assert(false && "Unknown command token.");
        }
    }

    return true;
}

#if !MOBILEAPP

// add to common / tools
size_t getFileSize(const std::string& filename)
{
    return std::ifstream(filename, std::ifstream::ate | std::ifstream::binary).tellg();
}

std::string getMimeFromFileType(const std::string & fileType)
{
    if (fileType == "pdf")
        return "application/pdf";
    else if (fileType == "odt")
        return "application/vnd.oasis.opendocument.text";
    else if (fileType == "docx")
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    return std::string();
}

bool ChildSession::uploadSignedDocument(const char* buffer, int length, const std::vector<std::string>& /*tokens*/)
{
    std::string filename;
    std::string wopiUrl;
    std::string token;
    std::string filetype;

    { // parse JSON
        const std::string firstLine = getFirstLine(buffer, length);

        const char* data = buffer + firstLine.size() + 1;
        const int size = length - firstLine.size() - 1;
        std::string json(data, size);

        Poco::JSON::Parser parser;
        Poco::JSON::Object::Ptr root = parser.parse(json).extract<Poco::JSON::Object::Ptr>();

        filename = JsonUtil::getJSONValue<std::string>(root, "filename");
        wopiUrl = JsonUtil::getJSONValue<std::string>(root, "wopiUrl");
        token = JsonUtil::getJSONValue<std::string>(root, "token");
        filetype = JsonUtil::getJSONValue<std::string>(root, "type");
    }

    if (filetype.empty() || filename.empty() || wopiUrl.empty() || token.empty())
    {
        sendTextFrame("error: cmd=uploadsigneddocument kind=syntax");
        return false;
    }

    std::string mimetype = getMimeFromFileType(filetype);
    if (mimetype.empty())
    {
        sendTextFrame("error: cmd=uploadsigneddocument kind=syntax");
        return false;
    }
    const std::string tmpDir = FileUtil::createRandomDir(JAILED_DOCUMENT_ROOT);
    const Poco::Path filenameParam(filename);
    const std::string url = JAILED_DOCUMENT_ROOT + tmpDir + "/" + filenameParam.getFileName();

    getLOKitDocument()->saveAs(url.c_str(),
                               filetype.empty() ? nullptr : filetype.c_str(),
                               nullptr);

    Authorization authorization(Authorization::Type::Token, token);
    Poco::URI uriObject(wopiUrl + "/" + filename + "/contents");

    authorization.authorizeURI(uriObject);

    try
    {
        Poco::Net::initializeSSL();
        Poco::Net::Context::Params sslClientParams;
        sslClientParams.verificationMode = Poco::Net::Context::VERIFY_NONE;
        Poco::SharedPtr<Poco::Net::PrivateKeyPassphraseHandler> consoleClientHandler = new Poco::Net::KeyConsoleHandler(false);
        Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidClientCertHandler = new Poco::Net::AcceptCertificateHandler(false);
        Poco::Net::Context::Ptr sslClientContext = new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslClientParams);
        Poco::Net::SSLManager::instance().initializeClient(consoleClientHandler, invalidClientCertHandler, sslClientContext);

        std::unique_ptr<Poco::Net::HTTPClientSession> psession;
        psession.reset(new Poco::Net::HTTPSClientSession(
                        uriObject.getHost(),
                        uriObject.getPort(),
                        Poco::Net::SSLManager::instance().defaultClientContext()));

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, uriObject.getPathAndQuery(), Poco::Net::HTTPMessage::HTTP_1_1);
        request.set("User-Agent", WOPI_AGENT_STRING);
        authorization.authorizeRequest(request);

        request.set("X-WOPI-Override", "PUT");

        const size_t filesize = getFileSize(url);

        request.setContentType(mimetype);
        request.setContentLength(filesize);

        std::ostream& httpOutputStream = psession->sendRequest(request);

        std::ifstream inputFileStream(url);
        Poco::StreamCopier::copyStream(inputFileStream, httpOutputStream);

        Poco::Net::HTTPResponse response;
        std::istream& responseStream = psession->receiveResponse(response);

        std::ostringstream outputStringStream;
        Poco::StreamCopier::copyStream(responseStream, outputStringStream);
        std::string responseString = outputStringStream.str();

        if (response.getStatus() != Poco::Net::HTTPResponse::HTTP_OK &&
            response.getStatus() != Poco::Net::HTTPResponse::HTTP_CREATED)
        {
            LOG_ERR("Upload signed document HTTP Response Error: " << response.getStatus() << ' ' << response.getReason());

            sendTextFrame("error: cmd=uploadsigneddocument kind=httpresponse");

            return false;
        }
    }
    catch (const Poco::Exception& pocoException)
    {
        LOG_ERR("Upload signed document Exception: " + pocoException.displayText());

        sendTextFrame("error: cmd=uploadsigneddocument kind=failure");

        return false;
    }

    return true;
}

#endif

bool ChildSession::loadDocument(const char * /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    int part = -1;
    if (tokens.size() < 2)
    {
        sendTextFrame("error: cmd=load kind=syntax");
        return false;
    }

    std::string timestamp, doctemplate;
    parseDocOptions(tokens, part, timestamp, doctemplate);

    std::string renderOpts;
    if (!getDocOptions().empty())
    {
        Parser parser;
        Poco::Dynamic::Var var = parser.parse(getDocOptions());
        Object::Ptr object = var.extract<Object::Ptr>();
        Poco::Dynamic::Var rendering = object->get("rendering");
        if (!rendering.isEmpty())
            renderOpts = rendering.toString();
    }

    assert(!getDocURL().empty());
    assert(!getJailedFilePath().empty());

    std::unique_lock<std::recursive_mutex> lock(Mutex);

    const bool loaded = _docManager.onLoad(getId(), getJailedFilePath(), getJailedFilePathAnonym(),
                                           getUserName(), getUserNameAnonym(),
                                           getDocPassword(), renderOpts, getHaveDocPassword(),
                                           getLang(), getWatermarkText(), doctemplate);
    if (!loaded || _viewId < 0)
    {
        LOG_ERR("Failed to get LoKitDocument instance for [" << getJailedFilePathAnonym() << "].");
        return false;
    }

    LOG_INF("Created new view with viewid: [" << _viewId << "] for username: [" <<
            getUserNameAnonym() << "] in session: [" << getId() << "].");

    if (!doctemplate.empty())
    {
        std::string url = getJailedFilePath();
        bool success = getLOKitDocument()->saveAs(url.c_str(), nullptr, "TakeOwnership");
        if (!success)
        {
            LOG_ERR("Failed to save template [" << getJailedFilePath() << "].");
            return false;
        }
    }

    getLOKitDocument()->setView(_viewId);

    _docType = LOKitHelper::getDocumentTypeAsString(getLOKitDocument()->get());
    if (_docType != "text" && part != -1)
    {
        getLOKitDocument()->setPart(part);
    }

    // Respond by the document status
    LOG_DBG("Sending status after loading view " << _viewId << ".");
    const std::string status = LOKitHelper::documentStatus(getLOKitDocument()->get());
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

    getLOKitDocument()->setView(_viewId);

    ptrFont = getLOKitDocument()->renderFont(decodedFont.c_str(), decodedChar.c_str(), &width, &height);

    LOG_TRC("renderFont [" << font << "] rendered in " << (timestamp.elapsed()/1000.) << "ms");

    if (!ptrFont)
    {
        return sendTextFrame(output.data(), output.size());
    }

    const auto mode = static_cast<LibreOfficeKitTileMode>(getLOKitDocument()->getTileMode());

    if (Png::encodeBufferToPNG(ptrFont, width, height, output, mode))
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

    getLOKitDocument()->setView(_viewId);

    status = LOKitHelper::documentStatus(getLOKitDocument()->get());

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
    const Poco::JSON::Object::Ptr root = parser.parse(json).extract<Poco::JSON::Object::Ptr>();
    std::vector<std::string> directions { "Undo", "Redo" };
    for (auto& directionName : directions)
    {
        Poco::JSON::Object::Ptr direction = root->get(directionName).extract<Poco::JSON::Object::Ptr>();
        if (direction->get("actions").type() == typeid(Poco::JSON::Array::Ptr))
        {
            Poco::JSON::Array::Ptr actions = direction->get("actions").extract<Poco::JSON::Array::Ptr>();
            for (auto& actionVar : *actions)
            {
                Poco::JSON::Object::Ptr action = actionVar.extract<Poco::JSON::Object::Ptr>();
                int viewId = action->getValue<int>("viewId");
                auto it = viewInfo.find(viewId);
                if (it != viewInfo.end())
                    action->set("userName", Poco::Dynamic::Var(it->second.getUserName()));
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
        success = sendTextFrame("commandvalues: " + std::string(values == nullptr ? "{}" : values));
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

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setClientVisibleArea(x, y, width, height);
    return true;
}

bool ChildSession::outlineState(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    std::string type, state;
    int level, index;

    if (tokens.size() != 5 ||
        !getTokenString(tokens[1], "type", type) ||
        (type != "column" && type != "row") ||
        !getTokenInteger(tokens[2], "level", level) ||
        !getTokenInteger(tokens[3], "index", index) ||
        !getTokenString(tokens[4], "state", state) ||
        (state != "visible" && state != "hidden"))
    {
        sendTextFrame("error: cmd=outlinestate kind=syntax");
        return false;
    }

    bool column = type == "column";
    bool hidden = state == "hidden";

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setOutlineState(column, level, index, hidden);
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

    // Obfuscate the new name.
    Util::mapAnonymized(Util::getFilenameFromURL(name), _docManager.getObfuscatedFileId());

    getTokenString(tokens[3], "format", format);

    if (getTokenString(tokens[4], "options", filterOptions))
    {
        if (tokens.size() > 5)
        {
            filterOptions += Poco::cat(std::string(" "), tokens.begin() + 5, tokens.end());
        }
        //HACK = add watermark to filteroptions
        filterOptions += std::string(",Watermark=") + getWatermarkText() + std::string("WATERMARKEND");
    }

    // The file is removed upon downloading.
    const std::string tmpDir = FileUtil::createRandomDir(JAILED_DOCUMENT_ROOT);
    // Prevent user inputting anything funny here.
    // A "name" should always be a name, not a path
    const Poco::Path filenameParam(name);
    const std::string url = JAILED_DOCUMENT_ROOT + tmpDir + "/" + filenameParam.getFileName();
    const std::string nameAnonym = anonymizeUrl(name);
    const std::string urlAnonym = JAILED_DOCUMENT_ROOT + tmpDir + "/" + Poco::Path(nameAnonym).getFileName();

    LOG_DBG("Calling LOK's downloadAs with: url='" << urlAnonym << "', format='" <<
            (format.empty() ? "(nullptr)" : format.c_str()) << "', ' filterOptions=" <<
            (filterOptions.empty() ? "(nullptr)" : filterOptions.c_str()) << "'.");

    getLOKitDocument()->saveAs(url.c_str(),
                               format.empty() ? nullptr : format.c_str(),
                               filterOptions.empty() ? nullptr : filterOptions.c_str());

    sendTextFrame("downloadas: jail=" + _jailId + " dir=" + tmpDir + " name=" + name +
                  " port=" + std::to_string(ClientPortNumber) + " id=" + id);
    return true;
}

bool ChildSession::getChildId()
{
    sendTextFrame("getchildid: id=" + _jailId);
    return true;
}

std::string ChildSession::getTextSelectionInternal(const std::string& mimeType)
{
    char* textSelection = nullptr;

    getLOKitDocument()->setView(_viewId);

    textSelection = getLOKitDocument()->getTextSelection(mimeType.c_str(), nullptr);

    std::string str(textSelection ? textSelection : "");
    free(textSelection);
    return str;
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

    sendTextFrame("textselectioncontent: " + getTextSelectionInternal(mimeType));
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
        getLOKitDocument()->setView(_viewId);

        getLOKitDocument()->paste(mimeType.c_str(), data, size);
    }

    return true;
}

bool ChildSession::insertFile(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    std::string name, type;

#if !MOBILEAPP
    if (tokens.size() != 3 ||
        !getTokenString(tokens[1], "name", name) ||
        !getTokenString(tokens[2], "type", type))
    {
        sendTextFrame("error: cmd=insertfile kind=syntax");
        return false;
    }
#else
    std::string data;
    if (tokens.size() != 4 ||
        !getTokenString(tokens[1], "name", name) ||
        !getTokenString(tokens[2], "type", type) ||
        !getTokenString(tokens[3], "data", data))
    {
        sendTextFrame("error: cmd=insertfile kind=syntax");
        return false;
    }
#endif

    if (type == "graphic" || type == "graphicurl")
    {
        std::string url;

#if !MOBILEAPP
        if (type == "graphic")
            url = "file://" + std::string(JAILED_DOCUMENT_ROOT) + "insertfile/" + name;
        else if (type == "graphicurl")
            URI::decode(name, url);
#else
        assert(type == "graphic");
        auto binaryData = decodeBase64(data);
        std::string tempFile = Util::createRandomTmpDir() + "/" + name;
        std::ofstream fileStream;
        fileStream.open(tempFile);
        fileStream.write(reinterpret_cast<char*>(binaryData.data()), binaryData.size());
        fileStream.close();
        url = "file://" + tempFile;
#endif

        std::string command = ".uno:InsertGraphic";
        std::string arguments = "{"
            "\"FileName\":{"
                "\"type\":\"string\","
                "\"value\":\"" + url + "\""
            "}}";

        getLOKitDocument()->setView(_viewId);

        LOG_TRC("Inserting graphic: '" << arguments.c_str() << "', '");

        getLOKitDocument()->postUnoCommand(command.c_str(), arguments.c_str(), false);
    }

    return true;
}

bool ChildSession::extTextInputEvent(const char* /*buffer*/, int /*length*/,
                                     const std::vector<std::string>& tokens)
{
    int id, type;
    std::string text;
    if (tokens.size() < 4 ||
        !getTokenInteger(tokens[1], "id", id) || id < 0 ||
        !getTokenKeyword(tokens[2], "type",
                        {{"input", LOK_EXT_TEXTINPUT}, {"end", LOK_EXT_TEXTINPUT_END}},
                         type) ||
        !getTokenString(tokens[3], "text", text))

    {
        sendTextFrame("error: cmd=" + std::string(tokens[0]) + " kind=syntax");
        return false;
    }

    std::string decodedText;
    URI::decode(text, decodedText);

    getLOKitDocument()->setView(_viewId);
    getLOKitDocument()->postWindowExtTextInputEvent(id, type, decodedText.c_str());

    return true;
}

bool ChildSession::keyEvent(const char* /*buffer*/, int /*length*/,
                            const std::vector<std::string>& tokens,
                            const LokEventTargetEnum target)
{
    int type, charcode, keycode;
    unsigned winId = 0;
    unsigned counter = 1;
    unsigned expectedTokens = 4; // cmdname(key), type, char, key are strictly required
    if (target == LokEventTargetEnum::Window)
    {
        if (tokens.size() <= counter ||
            !getTokenUInt32(tokens[counter++], "id", winId))
        {
            LOG_ERR("Window key event expects a valid id= attribute");
            sendTextFrame("error: cmd=" + std::string(tokens[0]) + " kind=syntax");
            return false;
        }
        else // id= attribute is found
            expectedTokens++;
    }

    if (tokens.size() != expectedTokens ||
        !getTokenKeyword(tokens[counter++], "type",
                         {{"input", LOK_KEYEVENT_KEYINPUT}, {"up", LOK_KEYEVENT_KEYUP}},
                         type) ||
        !getTokenInteger(tokens[counter++], "char", charcode) ||
        !getTokenInteger(tokens[counter++], "key", keycode))
    {
        sendTextFrame("error: cmd=" + std::string(tokens[0]) + "  kind=syntax");
        return false;
    }

    // Don't close LO window!
    constexpr int KEY_CTRL = 0x2000;
    constexpr int KEY_W = 0x0216;
    if (keycode == (KEY_CTRL | KEY_W))
    {
        return true;
    }

    // Ctrl+Tab switching browser tabs,
    // Doesn't insert tabs.
    constexpr int KEY_TAB = 0x0502;
    if (keycode == (KEY_CTRL | KEY_TAB))
    {
        return true;
    }

    getLOKitDocument()->setView(_viewId);
    if (target == LokEventTargetEnum::Document)
        getLOKitDocument()->postKeyEvent(type, charcode, keycode);
    else if (winId != 0)
        getLOKitDocument()->postWindowKeyEvent(winId, type, charcode, keycode);

    return true;
}

bool ChildSession::gestureEvent(const char* /*buffer*/, int /*length*/,
                              const std::vector<std::string>& tokens)
{
    bool success = true;

    unsigned int windowID = 0;
    int x;
    int y;
    int offset;
    std::string type;

    if (tokens.size() < 6)
        success = false;

    if (!success ||
        !getTokenUInt32(tokens[1], "id", windowID) ||
        !getTokenString(tokens[2], "type", type) ||
        !getTokenInteger(tokens[3], "x", x) ||
        !getTokenInteger(tokens[4], "y", y) ||
        !getTokenInteger(tokens[5], "offset", offset))
    {
        success = false;
    }

    if (!success)
    {
        sendTextFrame("error: cmd=" +  std::string(tokens[0]) + " kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->postWindowGestureEvent(windowID, type.c_str(), x, y, offset);

    return true;
}

bool ChildSession::mouseEvent(const char* /*buffer*/, int /*length*/,
                              const std::vector<std::string>& tokens,
                              const LokEventTargetEnum target)
{
    int type, x, y, count;
    bool success = true;

    // default values for compatibility reasons with older loleaflets
    int buttons = 1; // left button
    int modifier = 0;

    unsigned winId = 0;
    unsigned counter = 1;
    unsigned minTokens = 5; // cmdname(mouse), type, x, y, count are strictly required
    if (target == LokEventTargetEnum::Window)
    {
        if (tokens.size() <= counter ||
            !getTokenUInt32(tokens[counter++], "id", winId))
        {
            LOG_ERR("Window mouse event expects a valid id= attribute");
            success = false;
        }
        else // id= attribute is found
            minTokens++;
    }

    if (tokens.size() < minTokens ||
        !getTokenKeyword(tokens[counter++], "type",
                         {{"buttondown", LOK_MOUSEEVENT_MOUSEBUTTONDOWN},
                          {"buttonup", LOK_MOUSEEVENT_MOUSEBUTTONUP},
                          {"move", LOK_MOUSEEVENT_MOUSEMOVE}},
                         type) ||
        !getTokenInteger(tokens[counter++], "x", x) ||
        !getTokenInteger(tokens[counter++], "y", y) ||
        !getTokenInteger(tokens[counter++], "count", count))
    {
        success = false;
    }

    // compatibility with older loleaflets
    if (success && tokens.size() > counter && !getTokenInteger(tokens[counter++], "buttons", buttons))
        success = false;

    // compatibility with older loleaflets
    if (success && tokens.size() > counter && !getTokenInteger(tokens[counter++], "modifier", modifier))
        success = false;

    if (!success)
    {
        sendTextFrame("error: cmd=" +  std::string(tokens[0]) + " kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);
    switch (target)
    {
    case LokEventTargetEnum::Document:
        getLOKitDocument()->postMouseEvent(type, x, y, count, buttons, modifier);
        break;
    case LokEventTargetEnum::Window:
        getLOKitDocument()->postWindowMouseEvent(winId, type, x, y, count, buttons, modifier);
        break;
    default:
        assert(false && "Unsupported mouse target type");
    }

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
    const bool bNotify = (tokens[1] == ".uno:Save" ||
                          tokens[1] == ".uno:Undo" ||
                          tokens[1] == ".uno:Redo" ||
                          Util::startsWith(tokens[1], "vnd.sun.star.script:"));

    getLOKitDocument()->setView(_viewId);

    if (tokens.size() == 2)
    {
        if (tokens[1] == ".uno:fakeDiskFull")
        {
            Util::alertAllUsers("internal", "diskfull");
        }
        else
        {
            if (tokens[1] == ".uno:Copy")
                _copyToClipboard = true;

            getLOKitDocument()->postUnoCommand(tokens[1].c_str(), nullptr, bNotify);
        }
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

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setTextSelection(type, x, y);

    return true;
}

bool ChildSession::renderWindow(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    const unsigned winId = (tokens.size() > 1 ? std::stoul(tokens[1]) : 0);

    getLOKitDocument()->setView(_viewId);

    int startX = 0, startY = 0;
    int bufferWidth = 800, bufferHeight = 600;
    double dpiScale = 1.0;
    std::string paintRectangle;
    if (tokens.size() > 2 && getTokenString(tokens[2], "rectangle", paintRectangle))
    {
        const std::vector<std::string> rectParts = LOOLProtocol::tokenize(paintRectangle.c_str(), paintRectangle.length(), ',');
        startX = std::atoi(rectParts[0].c_str());
        startY = std::atoi(rectParts[1].c_str());
        bufferWidth = std::atoi(rectParts[2].c_str());
        bufferHeight = std::atoi(rectParts[3].c_str());

        std::string dpiScaleString;
        if (tokens.size() > 3 && getTokenString(tokens[3], "dpiscale", dpiScaleString))
        {
            dpiScale = std::stod(dpiScaleString);
            if (dpiScale < 0.001)
                dpiScale = 1.0;
        }
    }
    else
        LOG_WRN("windowpaint command doesn't specify a rectangle= attribute.");

    size_t pixmapDataSize = 4 * bufferWidth * bufferHeight;
    std::vector<unsigned char> pixmap(pixmapDataSize);
    int width = bufferWidth, height = bufferHeight;
    std::string response;
    Timestamp timestamp;
    getLOKitDocument()->paintWindow(winId, pixmap.data(), startX, startY, width, height, dpiScale);
    const double area = width * height;
    LOG_TRC("paintWindow for " << winId << " returned " << width << "X" << height
            << "@(" << startX << "," << startY << ")"
            << " with dpi scale: " << dpiScale
            << " and rendered in " << (timestamp.elapsed()/1000.)
            << "ms (" << area / (timestamp.elapsed()) << " MP/s).");

    response = "windowpaint: id=" + tokens[1] +
        " width=" + std::to_string(width) + " height=" + std::to_string(height);

    if (!paintRectangle.empty())
        response += " rectangle=" + paintRectangle;

    response += "\n";

    std::vector<char> output;
    output.reserve(response.size() + pixmapDataSize);
    output.resize(response.size());
    std::memcpy(output.data(), response.data(), response.size());

    const auto mode = static_cast<LibreOfficeKitTileMode>(getLOKitDocument()->getTileMode());

    // TODO: use png cache for dialogs too
    if (!Png::encodeSubBufferToPNG(pixmap.data(), 0, 0, width, height, bufferWidth, bufferHeight, output, mode))
    {
        LOG_ERR("Failed to encode into PNG.");
        return false;
    }

    LOG_TRC("Sending response (" << output.size() << " bytes) for: " << response);
    sendBinaryFrame(output.data(), output.size());
    return true;
}

bool ChildSession::resizeWindow(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    const unsigned winId = (tokens.size() > 1 ? std::stoul(tokens[1].c_str(), nullptr, 10) : 0);

    getLOKitDocument()->setView(_viewId);

    std::string size;
    if (tokens.size() > 2 && getTokenString(tokens[2], "size", size))
    {
        const std::vector<int> sizeParts = LOOLProtocol::tokenizeInts(size, ',');
        if (sizeParts.size() == 2)
        {
            getLOKitDocument()->resizeWindow(winId, sizeParts[0], sizeParts[1]);
            return true;
        }
    }

    LOG_WRN("resizewindow command doesn't specify sensible size= attribute.");
    return true;
}

bool ChildSession::sendWindowCommand(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    const unsigned winId = (tokens.size() > 1 ? std::stoul(tokens[1]) : 0);

    getLOKitDocument()->setView(_viewId);

    if (tokens.size() > 2 && tokens[2] == "close")
        getLOKitDocument()->postWindow(winId, LOK_WINDOW_CLOSE, nullptr);
    else if (tokens.size() > 3 && tokens[2] == "paste")
    {
        std::string data;
        try
        {
            URI::decode(tokens[3], data);
        }
        catch (Poco::SyntaxException& exc)
        {
            sendTextFrame("error: cmd=windowcommand kind=syntax");
            return false;
        }

        getLOKitDocument()->postWindow(winId, LOK_WINDOW_PASTE, data.c_str());
    }

    return true;
}

namespace
{

std::string extractCertificate(const std::string & certificate)
{
    const std::string header("-----BEGIN CERTIFICATE-----");
    const std::string footer("-----END CERTIFICATE-----");

    std::string result;

    size_t pos1 = certificate.find(header);
    if (pos1 == std::string::npos)
        return result;

    size_t pos2 = certificate.find(footer, pos1 + 1);
    if (pos2 == std::string::npos)
        return result;

    pos1 = pos1 + std::string(header).length();
    pos2 = pos2 - pos1;

    return certificate.substr(pos1, pos2);
}

std::string extractPrivateKey(const std::string & privateKey)
{
    const std::string header("-----BEGIN PRIVATE KEY-----");
    const std::string footer("-----END PRIVATE KEY-----");

    std::string result;

    size_t pos1 = privateKey.find(header);
    if (pos1 == std::string::npos)
        return result;

    size_t pos2 = privateKey.find(footer, pos1 + 1);
    if (pos2 == std::string::npos)
        return result;

    pos1 = pos1 + std::string(header).length();
    pos2 = pos2 - pos1;

    return privateKey.substr(pos1, pos2);
}

}

bool ChildSession::signDocumentContent(const char* buffer, int length, const std::vector<std::string>& /*tokens*/)
{
    bool bResult = true;

    const std::string firstLine = getFirstLine(buffer, length);
    const char* data = buffer + firstLine.size() + 1;
    const int size = length - firstLine.size() - 1;
    std::string json(data, size);

    Poco::JSON::Parser parser;
    Poco::JSON::Object::Ptr root = parser.parse(json).extract<Poco::JSON::Object::Ptr>();

    for (auto& rChainPtr : *root->getArray("chain"))
    {
        if (!rChainPtr.isString())
            return false;

        std::string chainCertificate = rChainPtr;
        std::vector<unsigned char> binaryChainCertificate = decodeBase64(extractCertificate(chainCertificate));

        bResult = getLOKitDocument()->addCertificate(
            binaryChainCertificate.data(),
            binaryChainCertificate.size());

        if (!bResult)
            return false;
    }

    std::string x509Certificate = JsonUtil::getJSONValue<std::string>(root, "x509Certificate");
    std::vector<unsigned char> binaryCertificate = decodeBase64(extractCertificate(x509Certificate));

    std::string privateKey = JsonUtil::getJSONValue<std::string>(root, "privateKey");
    std::vector<unsigned char> binaryPrivateKey = decodeBase64(extractPrivateKey(privateKey));

    bResult = getLOKitDocument()->insertCertificate(
                    binaryCertificate.data(), binaryCertificate.size(),
                    binaryPrivateKey.data(), binaryPrivateKey.size());

    return bResult;
}

#if !MOBILEAPP

bool ChildSession::exportSignAndUploadDocument(const char* buffer, int length, const std::vector<std::string>& /*tokens*/)
{
    bool bResult = false;

    std::string filename;
    std::string wopiUrl;
    std::string token;
    std::string filetype;
    std::string x509Certificate;
    std::string privateKey;
    std::vector<std::string> certificateChain;

    { // parse JSON
        const std::string firstLine = getFirstLine(buffer, length);
        const char* data = buffer + firstLine.size() + 1;
        const int size = length - firstLine.size() - 1;
        std::string json(data, size);

        Poco::JSON::Parser parser;
        Poco::JSON::Object::Ptr root = parser.parse(json).extract<Poco::JSON::Object::Ptr>();

        filename = JsonUtil::getJSONValue<std::string>(root, "filename");
        wopiUrl = JsonUtil::getJSONValue<std::string>(root, "wopiUrl");
        token = JsonUtil::getJSONValue<std::string>(root, "token");
        filetype = JsonUtil::getJSONValue<std::string>(root, "type");
        x509Certificate = JsonUtil::getJSONValue<std::string>(root, "x509Certificate");
        privateKey = JsonUtil::getJSONValue<std::string>(root, "privateKey");

        for (auto& rChainPtr : *root->getArray("chain"))
        {
            if (!rChainPtr.isString())
            {
                sendTextFrame("error: cmd=exportsignanduploaddocument kind=syntax");
                return false;
            }
            std::string chainCertificate = rChainPtr;
            certificateChain.push_back(chainCertificate);
        }
    }

    if (filetype.empty() || filename.empty() || wopiUrl.empty() || token.empty() || x509Certificate.empty() || privateKey.empty())
    {
        sendTextFrame("error: cmd=exportsignanduploaddocument kind=syntax");
        return false;
    }

    std::string mimetype = getMimeFromFileType(filetype);
    if (mimetype.empty())
    {
        sendTextFrame("error: cmd=exportsignanduploaddocument kind=syntax");
        return false;
    }

    // add certificate chain
    for (auto const & certificate : certificateChain)
    {
        std::vector<unsigned char> binaryChainCertificate = decodeBase64(extractCertificate(certificate));

        bResult = getLOKitDocument()->addCertificate(
            binaryChainCertificate.data(),
            binaryChainCertificate.size());

        if (!bResult)
        {
            sendTextFrame("error: cmd=exportsignanduploaddocument kind=syntax");
            return false;
        }
    }

    // export document to a temp file
    const std::string aTempDir = FileUtil::createRandomDir(JAILED_DOCUMENT_ROOT);
    const Poco::Path filenameParam(filename);
    const std::string aTempDocumentURL = JAILED_DOCUMENT_ROOT + aTempDir + "/" + filenameParam.getFileName();

    getLOKitDocument()->saveAs(aTempDocumentURL.c_str(), filetype.c_str(), nullptr);

    // sign document
    {
        std::vector<unsigned char> binaryCertificate = decodeBase64(extractCertificate(x509Certificate));
        std::vector<unsigned char> binaryPrivateKey = decodeBase64(extractPrivateKey(privateKey));

        bResult = _docManager.getLOKit()->signDocument(aTempDocumentURL.c_str(),
                        binaryCertificate.data(), binaryCertificate.size(),
                        binaryPrivateKey.data(), binaryPrivateKey.size());

        if (!bResult)
        {
            sendTextFrame("error: cmd=exportsignanduploaddocument kind=syntax");
            return false;
        }
    }

    // upload
    Authorization authorization(Authorization::Type::Token, token);
    Poco::URI uriObject(wopiUrl + "/" + filename + "/contents");

    authorization.authorizeURI(uriObject);

    try
    {
        Poco::Net::initializeSSL();
        Poco::Net::Context::Params sslClientParams;
        sslClientParams.verificationMode = Poco::Net::Context::VERIFY_NONE;
        Poco::SharedPtr<Poco::Net::PrivateKeyPassphraseHandler> consoleClientHandler = new Poco::Net::KeyConsoleHandler(false);
        Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidClientCertHandler = new Poco::Net::AcceptCertificateHandler(false);
        Poco::Net::Context::Ptr sslClientContext = new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslClientParams);
        Poco::Net::SSLManager::instance().initializeClient(consoleClientHandler, invalidClientCertHandler, sslClientContext);

        std::unique_ptr<Poco::Net::HTTPClientSession> psession;
        psession.reset(new Poco::Net::HTTPSClientSession(
                        uriObject.getHost(),
                        uriObject.getPort(),
                        Poco::Net::SSLManager::instance().defaultClientContext()));

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, uriObject.getPathAndQuery(), Poco::Net::HTTPMessage::HTTP_1_1);
        request.set("User-Agent", WOPI_AGENT_STRING);
        authorization.authorizeRequest(request);

        request.set("X-WOPI-Override", "PUT");

        const size_t filesize = getFileSize(aTempDocumentURL);

        request.setContentType(mimetype);
        request.setContentLength(filesize);

        std::ostream& httpOutputStream = psession->sendRequest(request);

        std::ifstream inputFileStream(aTempDocumentURL);
        Poco::StreamCopier::copyStream(inputFileStream, httpOutputStream);

        Poco::Net::HTTPResponse response;
        std::istream& responseStream = psession->receiveResponse(response);

        std::ostringstream outputStringStream;
        Poco::StreamCopier::copyStream(responseStream, outputStringStream);
        std::string responseString = outputStringStream.str();

        if (response.getStatus() != Poco::Net::HTTPResponse::HTTP_OK &&
            response.getStatus() != Poco::Net::HTTPResponse::HTTP_CREATED)
        {
            LOG_ERR("Upload signed document HTTP Response Error: " << response.getStatus() << ' ' << response.getReason());

            sendTextFrame("error: cmd=exportsignanduploaddocument kind=httpresponse");

            return false;
        }
    }
    catch (const Poco::Exception& pocoException)
    {
        LOG_ERR("Upload signed document Exception: " + pocoException.displayText());

        sendTextFrame("error: cmd=exportsignanduploaddocument kind=failure");

        return false;
    }

    sendTextFrame("signeddocumentuploadstatus: OK");

    return true;
}

#endif

bool ChildSession::askSignatureStatus(const char* buffer, int length, const std::vector<std::string>& /*tokens*/)
{
    bool bResult = true;

    const std::string firstLine = getFirstLine(buffer, length);
    const char* data = buffer + firstLine.size() + 1;
    const int size = length - firstLine.size() - 1;
    std::string json(data, size);

    Poco::JSON::Parser parser;
    Poco::JSON::Object::Ptr root = parser.parse(json).extract<Poco::JSON::Object::Ptr>();

    if (root)
    {
        for (auto& rChainPtr : *root->getArray("certificates"))
        {
            if (!rChainPtr.isString())
                return false;

            std::string chainCertificate = rChainPtr;
            std::vector<unsigned char> binaryChainCertificate = decodeBase64(extractCertificate(chainCertificate));

            bResult = getLOKitDocument()->addCertificate(
                binaryChainCertificate.data(),
                binaryChainCertificate.size());

            if (!bResult)
                return false;
        }
    }

    int nStatus = getLOKitDocument()->getSignatureState();

    sendTextFrame("signaturestatus: " + std::to_string(nStatus));
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

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->resetSelection();

    return true;
}

bool ChildSession::saveAs(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    std::string wopiFilename, url, format, filterOptions;

    if (tokens.size() <= 1 ||
        !getTokenString(tokens[1], "url", url))
    {
        sendTextFrame("error: cmd=saveas kind=syntax");
        return false;
    }

    // if the url is a 'wopi:///something/blah.odt', then save to a temporary
    Poco::URI wopiURL(url);
    if (wopiURL.getScheme() == "wopi")
    {
        std::vector<std::string> pathSegments;
        wopiURL.getPathSegments(pathSegments);

        if (pathSegments.size() == 0)
        {
            sendTextFrame("error: cmd=saveas kind=syntax");
            return false;
        }

        // TODO do we need a tempdir here?
        url = std::string("file://") + JAILED_DOCUMENT_ROOT + pathSegments[pathSegments.size() - 1];
        wopiFilename = wopiURL.getPath();
    }

    if (tokens.size() > 2)
        getTokenString(tokens[2], "format", format);

    if (tokens.size() > 3 && getTokenString(tokens[3], "options", filterOptions))
    {
        if (tokens.size() > 4)
        {
            filterOptions += Poco::cat(std::string(" "), tokens.begin() + 4, tokens.end());
        }
    }

    bool success = false;

    if (filterOptions.empty() && format == "html")
    {
        // Opt-in to avoid linked images, those would not leave the chroot.
        filterOptions = "EmbedImages";
    }

    // We don't have the FileId at this point, just a new filename to save-as.
    // So here the filename will be obfuscated with some hashing, which later will
    // get a proper FileId that we will use going forward.
    LOG_DBG("Calling LOK's saveAs with: '" << anonymizeUrl(wopiFilename) << "', '" <<
            (format.size() == 0 ? "(nullptr)" : format.c_str()) << "', '" <<
            (filterOptions.size() == 0 ? "(nullptr)" : filterOptions.c_str()) << "'.");

    getLOKitDocument()->setView(_viewId);

    success = getLOKitDocument()->saveAs(url.c_str(),
                                         format.empty() ? nullptr : format.c_str(),
                                         filterOptions.empty() ? nullptr : filterOptions.c_str());

    if (!success)
    {
        // a desperate try - add an extension hoping that it'll help
        bool retry = true;
        switch (getLOKitDocument()->getDocumentType())
        {
            case LOK_DOCTYPE_TEXT:         url += ".odt"; wopiFilename += ".odt"; break;
            case LOK_DOCTYPE_SPREADSHEET:  url += ".ods"; wopiFilename += ".ods"; break;
            case LOK_DOCTYPE_PRESENTATION: url += ".odp"; wopiFilename += ".odp"; break;
            case LOK_DOCTYPE_DRAWING:      url += ".odg"; wopiFilename += ".odg"; break;
            default:                       retry = false; break;
        }

        if (retry)
        {
            LOG_DBG("Retry: calling LOK's saveAs with: '" << url.c_str() << "', '" <<
                    (format.size() == 0 ? "(nullptr)" : format.c_str()) << "', '" <<
                    (filterOptions.size() == 0 ? "(nullptr)" : filterOptions.c_str()) << "'.");

            success = getLOKitDocument()->saveAs(url.c_str(),
                    format.size() == 0 ? nullptr :format.c_str(),
                    filterOptions.size() == 0 ? nullptr : filterOptions.c_str());
        }
    }

    std::string encodedURL, encodedWopiFilename;
    Poco::URI::encode(url, "", encodedURL);
    Poco::URI::encode(wopiFilename, "", encodedWopiFilename);

    if (success)
        sendTextFrame("saveas: url=" + encodedURL + " filename=" + encodedWopiFilename);
    else
        sendTextFrame("error: cmd=storage kind=savefailed");

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

    getLOKitDocument()->setView(_viewId);

    if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT && part != getLOKitDocument()->getPart())
    {
        getLOKitDocument()->setPart(part);
    }

    return true;
}

bool ChildSession::selectClientPart(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    int nPart;
    int nSelect;
    if (tokens.size() < 3 ||
        !getTokenInteger(tokens[1], "part", nPart) ||
        !getTokenInteger(tokens[2], "how", nSelect))
    {
        sendTextFrame("error: cmd=selectclientpart kind=invalid");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT)
    {
        if (nPart != getLOKitDocument()->getPart())
        {
            getLOKitDocument()->selectPart(nPart, nSelect);

            // Notify the client of the selection update.
            const std::string status = LOKitHelper::documentStatus(getLOKitDocument()->get());
            if (!status.empty())
                return sendTextFrame("statusupdate: " + status);
        }
    }
    else
    {
        LOG_WRN("ChildSession::selectClientPart[" << getName() << "]: error selecting part on text documents.");
    }

    return true;
}

bool ChildSession::moveSelectedClientParts(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    int nPosition;
    if (tokens.size() < 2 ||
        !getTokenInteger(tokens[1], "position", nPosition))
    {
        sendTextFrame("error: cmd=moveselectedclientparts kind=invalid");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT)
    {
        getLOKitDocument()->moveSelectedParts(nPosition, false); // Move, don't duplicate.

        // Get the status to notify clients of the reordering and selection change.
        const std::string status = LOKitHelper::documentStatus(getLOKitDocument()->get());
        if (!status.empty())
            return _docManager.notifyAll("statusupdate: " + status);
    }
    else
    {
        LOG_WRN("ChildSession::moveSelectedClientParts[" << getName() << "]: error moving parts on text documents.");
    }

    return true; // Non-fatal to fail.
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

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setPart(page);
    return true;
}

bool ChildSession::renderShapeSelection(const char* /*buffer*/, int /*length*/, const std::vector<std::string>& tokens)
{
    std::string mimeType;
    if (tokens.size() != 2 ||
        !getTokenString(tokens[1], "mimetype", mimeType) ||
        mimeType != "image/svg+xml")
    {
        sendTextFrame("error: cmd=rendershapeselection kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    char* pOutput = nullptr;
    const std::size_t nOutputSize = getLOKitDocument()->renderShapeSelection(&pOutput);
    if (pOutput != nullptr && nOutputSize > 0)
    {
        static const std::string header = "shapeselectioncontent:\n";
        std::vector<char> response(header.size() + nOutputSize);
        std::memcpy(response.data(), header.data(), header.size());
        std::memcpy(response.data() + header.size(), pOutput, nOutputSize);
        free(pOutput);

        LOG_TRC("Sending response (" << response.size() << " bytes) for shapeselectioncontent on view #" << _viewId);
        sendBinaryFrame(response.data(), response.size());
    }
    else
    {
        LOG_ERR("Failed to renderShapeSelection for view #" << _viewId);
    }

    return true;
}

/* If the user is inactive we have to remember important events so that when
 * the user becomes active again, we can replay the events.
 */
void ChildSession::rememberEventsForInactiveUser(const int type, const std::string& payload)
{
    if (type == LOK_CALLBACK_INVALIDATE_TILES)
    {
        std::unique_lock<std::mutex> lock(getLock());
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
        std::unique_lock<std::mutex> lock(getLock());
        _stateRecorder.recordEvent(type, payload);
    }
    else if (type == LOK_CALLBACK_INVALIDATE_VIEW_CURSOR ||
             type == LOK_CALLBACK_TEXT_VIEW_SELECTION ||
             type == LOK_CALLBACK_CELL_VIEW_CURSOR ||
             type == LOK_CALLBACK_GRAPHIC_VIEW_SELECTION ||
             type == LOK_CALLBACK_VIEW_CURSOR_VISIBLE ||
             type == LOK_CALLBACK_VIEW_LOCK)
    {
        std::unique_lock<std::mutex> lock(getLock());
        Poco::JSON::Parser parser;

        Poco::JSON::Object::Ptr root = parser.parse(payload).extract<Poco::JSON::Object::Ptr>();
        int viewId = root->getValue<int>("viewId");
        _stateRecorder.recordViewEvent(viewId, type, payload);
    }
    else if (type == LOK_CALLBACK_STATE_CHANGED)
    {
        std::string name;
        std::string value;
        if (LOOLProtocol::parseNameValuePair(payload, name, value, '='))
        {
            std::unique_lock<std::mutex> lock(getLock());
            _stateRecorder.recordState(name, payload);
        }
    }
    else if (type == LOK_CALLBACK_REDLINE_TABLE_SIZE_CHANGED ||
             type == LOK_CALLBACK_REDLINE_TABLE_ENTRY_MODIFIED ||
             type == LOK_CALLBACK_COMMENT)
    {
        std::unique_lock<std::mutex> lock(getLock());
        _stateRecorder.recordEventSequence(type, payload);
    }
}

void ChildSession::updateSpeed()
{
    std::chrono::steady_clock::time_point now(std::chrono::steady_clock::now());

    while (_cursorInvalidatedEvent.size() != 0 &&
           std::chrono::duration_cast<std::chrono::milliseconds>(now - _cursorInvalidatedEvent.front()).count() > _eventStorageIntervalMs)
    {
        _cursorInvalidatedEvent.pop();
    }

    _cursorInvalidatedEvent.push(now);
    _docManager.updateEditorSpeeds(_viewId, _cursorInvalidatedEvent.size());
}

int ChildSession::getSpeed()
{
    std::chrono::steady_clock::time_point now(std::chrono::steady_clock::now());

    while (_cursorInvalidatedEvent.size() > 0 &&
           std::chrono::duration_cast<std::chrono::milliseconds>(now - _cursorInvalidatedEvent.front()).count() > _eventStorageIntervalMs)
    {
        _cursorInvalidatedEvent.pop();
    }

    return _cursorInvalidatedEvent.size();
}

void ChildSession::loKitCallback(const int type, const std::string& payload)
{
    const std::string typeName = LOKitHelper::kitCallbackTypeToString(type);
    LOG_TRC("ChildSession::loKitCallback [" << getName() << "]: " <<
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

    switch (static_cast<LibreOfficeKitCallbackType>(type))
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
    case LOK_CALLBACK_WINDOW:
        sendTextFrame("window: " + payload);
        break;
    case LOK_CALLBACK_VALIDITY_LIST_BUTTON:
        sendTextFrame("validitylistbutton: " + payload);
        break;
    case LOK_CALLBACK_CLIPBOARD_CHANGED:
    {
        std::string selection;
        if (_copyToClipboard)
        {
            _copyToClipboard = false;
            selection = getTextSelectionInternal("");
        }

        sendTextFrame("clipboardchanged: " + selection);
        break;
    }
    case LOK_CALLBACK_CONTEXT_CHANGED:
        sendTextFrame("context: " + payload);
        break;
    case LOK_CALLBACK_SIGNATURE_STATUS:
        sendTextFrame("signaturestatus: " + payload);
        break;

    case LOK_CALLBACK_PROFILE_FRAME:
    case LOK_CALLBACK_DOCUMENT_PASSWORD:
    case LOK_CALLBACK_DOCUMENT_PASSWORD_TO_MODIFY:
        // these are not handled here.
        break;
    case LOK_CALLBACK_CELL_SELECTION_AREA:
        sendTextFrame("cellselectionarea: " + payload);
        break;
    case LOK_CALLBACK_CELL_AUTO_FILL_AREA:
        sendTextFrame("cellautofillarea: " + payload);
        break;

#if !ENABLE_DEBUG
    // we want a compilation-time failure in the debug builds; but ERR in the
    // log in the release ones
    default:
        LOG_ERR("Unknown callback event (" << LOKitHelper::kitCallbackTypeToString(type) << "): " << payload);
#endif
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
