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
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>
#include <Poco/BinaryReader.h>
#include <Poco/Base64Decoder.h>
#include <Poco/Process.h>
#if !MOBILEAPP
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/Net/KeyConsoleHandler.h>
#include <Poco/Net/AcceptCertificateHandler.h>
#endif

#ifdef IOS
#import "DocumentViewController.h"
#endif

#include <common/FileUtil.hpp>
#include <common/JsonUtil.hpp>
#include <common/Authorization.hpp>
#include "KitHelper.hpp"
#include <Log.hpp>
#include <Png.hpp>
#include <Util.hpp>
#include <Unit.hpp>
#include <Clipboard.hpp>
#include <string>

using Poco::JSON::Object;
using Poco::JSON::Parser;
using Poco::URI;

using namespace LOOLProtocol;

bool ChildSession::NoCapsForKit = false;

namespace {

std::vector<unsigned char> decodeBase64(const std::string & inputBase64)
{
    std::istringstream stream(inputBase64);
    Poco::Base64Decoder base64Decoder(stream);
    std::istreambuf_iterator<char> eos;
    return std::vector<unsigned char>(std::istreambuf_iterator<char>(base64Decoder), eos);
}

}

ChildSession::ChildSession(
    const std::shared_ptr<ProtocolHandlerInterface> &protocol,
    const std::string& id,
    const std::string& jailId,
    DocumentManagerInterface& docManager) :
    Session(protocol, "ToMaster-" + id, id, false),
    _jailId(jailId),
    _docManager(&docManager),
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
        if (_viewId >= 0)
        {
            if (_docManager)
            {
                _docManager->onUnload(*this);
            }
        }
        else
        {
            LOG_WRN("Skipping unload on incomplete view.");
        }

// This shuts down the shared socket, which is not what we want.
//        Session::disconnect();
    }
}

bool ChildSession::_handleInput(const char *buffer, int length)
{
    LOG_TRC(getName() << ": handling [" << getAbbreviatedMessage(buffer, length) << "].");
    const std::string firstLine = getFirstLine(buffer, length);
    const StringVector tokens = LOOLProtocol::tokenize(firstLine.data(), firstLine.size());

    if (LOOLProtocol::tokenIndicatesUserInteraction(tokens[0]))
    {
        // Keep track of timestamps of incoming client messages that indicate user activity.
        updateLastActivityTime();
    }

    if (tokens.size() > 0 && tokens.equals(0, "useractive") && getLOKitDocument() != nullptr)
    {
        LOG_DBG("Handling message after inactivity of " << getInactivityMS() << "ms.");
        setIsActive(true);

        // Client is getting active again.
        // Send invalidation and other sync-up messages.
        getLOKitDocument()->setView(_viewId);

        int curPart = 0;
        if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT)
            curPart = getLOKitDocument()->getPart();

        // Notify all views about updated view info
        _docManager->notifyViewInfo();

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
            const std::string payload = "0, 0, 1000000000, 1000000000, " + std::to_string(curPart);
            loKitCallback(LOK_CALLBACK_INVALIDATE_TILES, payload);
        }

        for (const auto& viewPair : _stateRecorder.getRecordedViewEvents())
        {
            for (const auto& eventPair : viewPair.second)
            {
                const RecordedEvent& event = eventPair.second;
                LOG_TRC("Replaying missed view event: " << viewPair.first << ' '
                                                        << lokCallbackTypeToString(event.getType())
                                                        << ": " << event.getPayload());
                loKitCallback(event.getType(), event.getPayload());
            }
        }

        for (const auto& eventPair : _stateRecorder.getRecordedEvents())
        {
            const RecordedEvent& event = eventPair.second;
            LOG_TRC("Replaying missed event: " << lokCallbackTypeToString(event.getType()) << ": "
                                               << event.getPayload());
            loKitCallback(event.getType(), event.getPayload());
        }

        for (const auto& pair : _stateRecorder.getRecordedStates())
        {
            LOG_TRC("Replaying missed state-change: " << pair.second);
            loKitCallback(LOK_CALLBACK_STATE_CHANGED, pair.second);
        }

        for (const auto& event : _stateRecorder.getRecordedEventsVector())
        {
            LOG_TRC("Replaying missed event (part of sequence): " <<
                    lokCallbackTypeToString(event.getType()) << ": " << event.getPayload());
            loKitCallback(event.getType(), event.getPayload());
        }

        _stateRecorder.clear();

        LOG_TRC("Finished replaying messages.");
    }

    if (tokens.equals(0, "dummymsg"))
    {
        // Just to update the activity of a view-only client.
        return true;
    }
    else if (tokens.equals(0, "commandvalues"))
    {
        return getCommandValues(buffer, length, tokens);
    }
    else if (tokens.equals(0, "load"))
    {
        if (_isDocLoaded)
        {
            sendTextFrameAndLogError("error: cmd=load kind=docalreadyloaded");
            return false;
        }

        _isDocLoaded = loadDocument(buffer, length, tokens);
        if (!_isDocLoaded)
        {
            sendTextFrameAndLogError("error: cmd=load kind=faileddocloading");
        }

        LOG_TRC("isDocLoaded state after loadDocument: " << _isDocLoaded << '.');
        return _isDocLoaded;
    }
    else if (!_isDocLoaded)
    {
        sendTextFrameAndLogError("error: cmd=" + tokens[0] + " kind=nodocloaded");
        return false;
    }
    else if (tokens.equals(0, "renderfont"))
    {
        sendFontRendering(buffer, length, tokens);
    }
    else if (tokens.equals(0, "setclientpart"))
    {
        return setClientPart(buffer, length, tokens);
    }
    else if (tokens.equals(0, "selectclientpart"))
    {
        return selectClientPart(buffer, length, tokens);
    }
    else if (tokens.equals(0, "moveselectedclientparts"))
    {
        return moveSelectedClientParts(buffer, length, tokens);
    }
    else if (tokens.equals(0, "setpage"))
    {
        return setPage(buffer, length, tokens);
    }
    else if (tokens.equals(0, "status"))
    {
        return getStatus(buffer, length);
    }
    else if (tokens.equals(0, "paintwindow"))
    {
        return renderWindow(buffer, length, tokens);
    }
    else if (tokens.equals(0, "resizewindow"))
    {
        return resizeWindow(buffer, length, tokens);
    }
    else if (tokens.equals(0, "tile") || tokens.equals(0, "tilecombine"))
    {
        assert(false && "Tile traffic should go through the DocumentBroker-LoKit WS.");
    }
    else if (tokens.equals(0, "requestloksession") ||
             tokens.equals(0, "canceltiles"))
    {
        // Just ignore these.
        // FIXME: We probably should do something for "canceltiles" at least?
    }
    else
    {
        // All other commands are such that they always require a LibreOfficeKitDocument session,
        // i.e. need to be handled in a child process.

        assert(tokens.equals(0, "clientzoom") ||
               tokens.equals(0, "clientvisiblearea") ||
               tokens.equals(0, "outlinestate") ||
               tokens.equals(0, "downloadas") ||
               tokens.equals(0, "getchildid") ||
               tokens.equals(0, "gettextselection") ||
               tokens.equals(0, "getclipboard") ||
               tokens.equals(0, "setclipboard") ||
               tokens.equals(0, "paste") ||
               tokens.equals(0, "insertfile") ||
               tokens.equals(0, "key") ||
               tokens.equals(0, "textinput") ||
               tokens.equals(0, "windowkey") ||
               tokens.equals(0, "mouse") ||
               tokens.equals(0, "windowmouse") ||
               tokens.equals(0, "windowgesture") ||
               tokens.equals(0, "uno") ||
               tokens.equals(0, "selecttext") ||
               tokens.equals(0, "windowselecttext") ||
               tokens.equals(0, "selectgraphic") ||
               tokens.equals(0, "resetselection") ||
               tokens.equals(0, "saveas") ||
               tokens.equals(0, "useractive") ||
               tokens.equals(0, "userinactive") ||
               tokens.equals(0, "windowcommand") ||
               tokens.equals(0, "asksignaturestatus") ||
               tokens.equals(0, "signdocument") ||
               tokens.equals(0, "uploadsigneddocument") ||
               tokens.equals(0, "exportsignanduploaddocument") ||
               tokens.equals(0, "rendershapeselection") ||
               tokens.equals(0, "removetextcontext") ||
               tokens.equals(0, "dialogevent") ||
               tokens.equals(0, "completefunction"));

        if (tokens.equals(0, "clientzoom"))
        {
            return clientZoom(buffer, length, tokens);
        }
        else if (tokens.equals(0, "clientvisiblearea"))
        {
            return clientVisibleArea(buffer, length, tokens);
        }
        else if (tokens.equals(0, "outlinestate"))
        {
            return outlineState(buffer, length, tokens);
        }
        else if (tokens.equals(0, "downloadas"))
        {
            return downloadAs(buffer, length, tokens);
        }
        else if (tokens.equals(0, "getchildid"))
        {
            return getChildId();
        }
        else if (tokens.equals(0, "gettextselection")) // deprecated.
        {
            return getTextSelection(buffer, length, tokens);
        }
        else if (tokens.equals(0, "getclipboard"))
        {
            return getClipboard(buffer, length, tokens);
        }
        else if (tokens.equals(0, "setclipboard"))
        {
            return setClipboard(buffer, length, tokens);
        }
        else if (tokens.equals(0, "paste"))
        {
            return paste(buffer, length, tokens);
        }
        else if (tokens.equals(0, "insertfile"))
        {
            return insertFile(buffer, length, tokens);
        }
        else if (tokens.equals(0, "key"))
        {
            return keyEvent(buffer, length, tokens, LokEventTargetEnum::Document);
        }
        else if (tokens.equals(0, "textinput"))
        {
            return extTextInputEvent(buffer, length, tokens);
        }
        else if (tokens.equals(0, "windowkey"))
        {
            return keyEvent(buffer, length, tokens, LokEventTargetEnum::Window);
        }
        else if (tokens.equals(0, "mouse"))
        {
            return mouseEvent(buffer, length, tokens, LokEventTargetEnum::Document);
        }
        else if (tokens.equals(0, "windowmouse"))
        {
            return mouseEvent(buffer, length, tokens, LokEventTargetEnum::Window);
        }
        else if (tokens.equals(0, "windowgesture"))
        {
            return gestureEvent(buffer, length, tokens);
        }
        else if (tokens.equals(0, "uno"))
        {
            // SpellCheckApplySuggestion might contain non separator spaces
            if (tokens[1].find(".uno:SpellCheckApplySuggestion") != std::string::npos ||
                tokens[1].find(".uno:LanguageStatus") != std::string::npos)
            {
                StringVector newTokens;
                newTokens.push_back(tokens[0]);
                newTokens.push_back(firstLine.substr(4)); // Copy the remaining part.
                return unoCommand(buffer, length, newTokens);
            }
            return unoCommand(buffer, length, tokens);
        }
        else if (tokens.equals(0, "selecttext"))
        {
            return selectText(buffer, length, tokens, LokEventTargetEnum::Document);
        }
        else if (tokens.equals(0, "windowselecttext"))
        {
            return selectText(buffer, length, tokens, LokEventTargetEnum::Window);
        }
        else if (tokens.equals(0, "selectgraphic"))
        {
            return selectGraphic(buffer, length, tokens);
        }
        else if (tokens.equals(0, "resetselection"))
        {
            return resetSelection(buffer, length, tokens);
        }
        else if (tokens.equals(0, "saveas"))
        {
            return saveAs(buffer, length, tokens);
        }
        else if (tokens.equals(0, "useractive"))
        {
            setIsActive(true);
        }
        else if (tokens.equals(0, "userinactive"))
        {
            setIsActive(false);
        }
        else if (tokens.equals(0, "windowcommand"))
        {
            sendWindowCommand(buffer, length, tokens);
        }
        else if (tokens.equals(0, "signdocument"))
        {
            signDocumentContent(buffer, length, tokens);
        }
        else if (tokens.equals(0, "asksignaturestatus"))
        {
            askSignatureStatus(buffer, length, tokens);
        }
#if !MOBILEAPP
        else if (tokens.equals(0, "uploadsigneddocument"))
        {
            return uploadSignedDocument(buffer, length, tokens);
        }
        else if (tokens.equals(0, "exportsignanduploaddocument"))
        {
            return exportSignAndUploadDocument(buffer, length, tokens);
        }
#endif
        else if (tokens.equals(0, "rendershapeselection"))
        {
            return renderShapeSelection(buffer, length, tokens);
        }
        else if (tokens.equals(0, "removetextcontext"))
        {
            return removeTextContext(buffer, length, tokens);
        }
        else if (tokens.equals(0, "dialogevent"))
        {
            return dialogEvent(buffer, length, tokens);
        }
        else if (tokens.equals(0, "completefunction"))
        {
            return completeFunction(buffer, length, tokens);
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

bool ChildSession::uploadSignedDocument(const char* buffer, int length, const StringVector& /*tokens*/)
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
        sendTextFrameAndLogError("error: cmd=uploadsigneddocument kind=syntax");
        return false;
    }

    std::string mimetype = getMimeFromFileType(filetype);
    if (mimetype.empty())
    {
        sendTextFrameAndLogError("error: cmd=uploadsigneddocument kind=syntax");
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

            sendTextFrameAndLogError("error: cmd=uploadsigneddocument kind=httpresponse");

            return false;
        }
    }
    catch (const Poco::Exception& pocoException)
    {
        LOG_ERR("Upload signed document Exception: " + pocoException.displayText());

        sendTextFrameAndLogError("error: cmd=uploadsigneddocument kind=failure");

        return false;
    }

    return true;
}

#endif

bool ChildSession::loadDocument(const char * /*buffer*/, int /*length*/, const StringVector& tokens)
{
    int part = -1;
    if (tokens.size() < 2)
    {
        sendTextFrameAndLogError("error: cmd=load kind=syntax");
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

#if defined(ENABLE_DEBUG) && !MOBILEAPP
    if (std::getenv("PAUSEFORDEBUGGER"))
    {
        std::cerr << getDocURL() << " paused waiting for a debugger to attach: " << Poco::Process::id() << std::endl;
        SigUtil::setDebuggerSignal();
        pause();
    }
#endif

    const bool loaded = _docManager->onLoad(getId(), getJailedFilePathAnonym(), renderOpts, doctemplate);
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
    _docManager->notifyViewInfo();
    sendTextFrame("editor: " + std::to_string(_docManager->getEditorId()));


    LOG_INF("Loaded session " << getId());
    return true;
}

bool ChildSession::sendFontRendering(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    std::string font, text, decodedFont, decodedChar;
    bool bSuccess;

    if (tokens.size() < 3 ||
        !getTokenString(tokens[1], "font", font))
    {
        sendTextFrameAndLogError("error: cmd=renderfont kind=syntax");
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
        sendTextFrameAndLogError("error: cmd=renderfont kind=syntax");
        return false;
    }

    const std::string response = "renderfont: " + tokens.cat(std::string(" "), 1) + "\n";

    std::vector<char> output;
    output.resize(response.size());
    std::memcpy(output.data(), response.data(), response.size());

    const auto start = std::chrono::system_clock::now();
    // renderFont use a default font size (25) when width and height are 0
    int width = 0, height = 0;
    unsigned char* ptrFont = nullptr;

    getLOKitDocument()->setView(_viewId);

    ptrFont = getLOKitDocument()->renderFont(decodedFont.c_str(), decodedChar.c_str(), &width, &height);

    const auto duration = std::chrono::system_clock::now() - start;
    const auto elapsed = std::chrono::duration_cast<std::chrono::microseconds>(duration).count();
    LOG_TRC("renderFont [" << font << "] rendered in " << elapsed << "ms");

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
        bSuccess = sendTextFrameAndLogError("error: cmd=renderfont kind=failure");
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

bool ChildSession::getCommandValues(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    bool success;
    char* values;
    std::string command;
    if (tokens.size() != 2 || !getTokenString(tokens[1], "command", command))
    {
        sendTextFrameAndLogError("error: cmd=commandvalues kind=syntax");
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
        std::map<int, UserInfo> viewInfo = _docManager->getViewInfo();
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

bool ChildSession::clientZoom(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    int tilePixelWidth, tilePixelHeight, tileTwipWidth, tileTwipHeight;

    if (tokens.size() != 5 ||
        !getTokenInteger(tokens[1], "tilepixelwidth", tilePixelWidth) ||
        !getTokenInteger(tokens[2], "tilepixelheight", tilePixelHeight) ||
        !getTokenInteger(tokens[3], "tiletwipwidth", tileTwipWidth) ||
        !getTokenInteger(tokens[4], "tiletwipheight", tileTwipHeight))
    {
        sendTextFrameAndLogError("error: cmd=clientzoom kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setClientZoom(tilePixelWidth, tilePixelHeight, tileTwipWidth, tileTwipHeight);
    return true;
}

bool ChildSession::clientVisibleArea(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
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
        sendTextFrameAndLogError("error: cmd=clientvisiblearea kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setClientVisibleArea(x, y, width, height);
    return true;
}

bool ChildSession::outlineState(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
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
        sendTextFrameAndLogError("error: cmd=outlinestate kind=syntax");
        return false;
    }

    bool column = type == "column";
    bool hidden = state == "hidden";

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setOutlineState(column, level, index, hidden);
    return true;
}

bool ChildSession::downloadAs(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    std::string name, id, format, filterOptions;

    if (tokens.size() < 5 ||
        !getTokenString(tokens[1], "name", name) ||
        !getTokenString(tokens[2], "id", id))
    {
        sendTextFrameAndLogError("error: cmd=downloadas kind=syntax");
        return false;
    }

    // Obfuscate the new name.
    Util::mapAnonymized(Util::getFilenameFromURL(name), _docManager->getObfuscatedFileId());

    getTokenString(tokens[3], "format", format);

    if (getTokenString(tokens[4], "options", filterOptions))
    {
        if (tokens.size() > 5)
        {
            filterOptions += tokens.cat(std::string(" "), 5);
        }
    }

    // Hack pass watermark by filteroptions to saveas
    if ( getWatermarkText().length() > 0) {
        filterOptions += std::string(",Watermark=") + getWatermarkText() + std::string("WATERMARKEND");
    }

#ifdef IOS
    NSLog(@"We should never come here, aborting");
    std::abort();
#else
    // Prevent user inputting anything funny here.
    // A "name" should always be a name, not a path
    const Poco::Path filenameParam(name);
    const std::string nameAnonym = anonymizeUrl(name);

    std::string jailDoc = JAILED_DOCUMENT_ROOT;
    if (NoCapsForKit)
    {
        jailDoc = Poco::URI(getJailedFilePath()).getPath();
        jailDoc = jailDoc.substr(0, jailDoc.find(JAILED_DOCUMENT_ROOT)) + JAILED_DOCUMENT_ROOT;
    }

    // The file is removed upon downloading.
    const std::string tmpDir = FileUtil::createRandomDir(jailDoc);
    const std::string url = jailDoc + tmpDir + "/" + filenameParam.getFileName();
    const std::string urlAnonym = jailDoc + tmpDir + "/" + Poco::Path(nameAnonym).getFileName();

    LOG_DBG("Calling LOK's downloadAs with: url='" << urlAnonym << "', format='" <<
            (format.empty() ? "(nullptr)" : format.c_str()) << "', ' filterOptions=" <<
            (filterOptions.empty() ? "(nullptr)" : filterOptions.c_str()) << "'.");

    getLOKitDocument()->saveAs(url.c_str(),
                               format.empty() ? nullptr : format.c_str(),
                               filterOptions.empty() ? nullptr : filterOptions.c_str());

    sendTextFrame("downloadas: jail=" + _jailId + " dir=" + tmpDir + " name=" + name +
                  " port=" + std::to_string(ClientPortNumber) + " id=" + id);
#endif
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

bool ChildSession::getTextSelection(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    std::string mimeType;

    if (tokens.size() != 2 ||
        !getTokenString(tokens[1], "mimetype", mimeType))
    {
        sendTextFrameAndLogError("error: cmd=gettextselection kind=syntax");
        return false;
    }

    if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT &&
        getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_SPREADSHEET)
    {
        const std::string selection = getTextSelectionInternal(mimeType);
        if (selection.size() >= 1024 * 1024) // Don't return huge data.
        {
            // Flag complex data so the client will download async.
            sendTextFrame("complexselection:");
            return true;
        }

        sendTextFrame("textselectioncontent: " + selection);
        return true;
    }

    std::string selection;
    const int selectionType = getLOKitDocument()->getSelectionType();
    if (selectionType == LOK_SELTYPE_LARGE_TEXT || selectionType == LOK_SELTYPE_COMPLEX ||
        (selection = getTextSelectionInternal(mimeType)).size() >= 1024 * 1024) // Don't return huge data.
    {
        // Flag complex data so the client will download async.
        sendTextFrame("complexselection:");
        return true;
    }

    sendTextFrame("textselectioncontent: " + selection);
    return true;
}

bool ChildSession::getClipboard(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    const char **pMimeTypes = nullptr; // fetch all for now.
    const char  *pOneType[2];
    size_t       nOutCount = 0;
    char       **pOutMimeTypes = nullptr;
    size_t      *pOutSizes = nullptr;
    char       **pOutStreams = nullptr;

    bool hasMimeRequest = tokens.size() > 1;
    if (hasMimeRequest)
    {
        pMimeTypes = pOneType;
        pMimeTypes[0] = tokens[1].c_str();
        pMimeTypes[1] = nullptr;
    }

    bool success = false;
    getLOKitDocument()->setView(_viewId);

    success = getLOKitDocument()->getClipboard(pMimeTypes, &nOutCount, &pOutMimeTypes,
                                               &pOutSizes, &pOutStreams);

    if (!success || nOutCount == 0)
    {
        LOG_WRN("Get clipboard failed " << getLOKitLastError());
        sendTextFrame("clipboardcontent: error");
        return false;
    }

    size_t outGuess = 32;
    for (size_t i = 0; i < nOutCount; ++i)
        outGuess += pOutSizes[i] + strlen(pOutMimeTypes[i]) + 10;

    std::vector<char> output;
    output.reserve(outGuess);

    // FIXME: extra 'content' is necessary for Message parsing.
    Util::vectorAppend(output, "clipboardcontent: content\n");
    LOG_TRC("Building clipboardcontent: " << nOutCount << " items");
    for (size_t i = 0; i < nOutCount; ++i)
    {
        LOG_TRC("\t[" << i << " - type " << pOutMimeTypes[i] << " size " << pOutSizes[i]);
        Util::vectorAppend(output, pOutMimeTypes[i]);
        free(pOutMimeTypes[i]);
        Util::vectorAppend(output, "\n", 1);
        Util::vectorAppendHex(output, pOutSizes[i]);
        Util::vectorAppend(output, "\n", 1);
        Util::vectorAppend(output, pOutStreams[i], pOutSizes[i]);
        free(pOutStreams[i]);
        Util::vectorAppend(output, "\n", 1);
    }
    free(pOutSizes);
    free(pOutMimeTypes);
    free(pOutStreams);

    LOG_TRC("Sending clipboardcontent of size " << output.size() << " bytes");
    sendBinaryFrame(output.data(), output.size());

    return true;
}

bool ChildSession::setClipboard(const char* buffer, int length, const StringVector& /* tokens */)
{
    try {
        ClipboardData data;
        Poco::MemoryInputStream stream(buffer, length);

        std::string command; // skip command
        std::getline(stream, command, '\n');

        data.read(stream);
//        data.dumpState(std::cerr);

        size_t nInCount = data.size();
        size_t pInSizes[nInCount];
        const char *pInMimeTypes[nInCount];
        const char *pInStreams[nInCount];

        for (size_t i = 0; i < nInCount; ++i)
        {
            pInSizes[i] = data._content[i].length();
            pInStreams[i] = data._content[i].c_str();
            pInMimeTypes[i] = data._mimeTypes[i].c_str();
        }

        getLOKitDocument()->setView(_viewId);

        if (!getLOKitDocument()->setClipboard(nInCount, pInMimeTypes, pInSizes, pInStreams))
            LOG_ERR("set clipboard returned failure");
        else
            LOG_TRC("set clipboard succeeded");
    } catch (const std::exception& ex) {
        LOG_ERR("set clipboard failed with exception: " << ex.what());
    } catch (...) {
        LOG_ERR("set clipboard failed with exception");
    }
    // FIXME: implement me [!] ...
    return false;
}

bool ChildSession::paste(const char* buffer, int length, const StringVector& tokens)
{
    std::string mimeType;
    if (tokens.size() < 2 || !getTokenString(tokens[1], "mimetype", mimeType) ||
        mimeType.empty())
    {
        sendTextFrameAndLogError("error: cmd=paste kind=syntax");
        return false;
    }

    if (mimeType.find("application/x-openoffice-embed-source-xml") == 0)
    {
        LOG_TRC("Re-writing garbled mime-type " << mimeType);
        mimeType = "application/x-openoffice-embed-source-xml;windows_formatname=\"Star Embed Source (XML)\"";
    }

    const std::string firstLine = getFirstLine(buffer, length);
    const char* data = buffer + firstLine.size() + 1;
    const int size = length - firstLine.size() - 1;
    bool success = false;
    std::string result = "pasteresult: ";
    if (size > 0)
    {
        getLOKitDocument()->setView(_viewId);

        if (Log::logger().trace())
        {
            // Ensure 8 byte alignment for the start of the data, SpookyHash needs it.
            std::vector<char> toHash(data, data + size);
            LOG_TRC("Paste data of size " << size << " bytes and hash " << SpookyHash::Hash64(toHash.data(), toHash.size(), 0));
        }
        success = getLOKitDocument()->paste(mimeType.c_str(), data, size);
        if (!success)
            LOG_WRN("Paste failed " << getLOKitLastError());
    }
    if (success)
        result += "success";
    else
        result += "fallback";
    sendTextFrame(result);

    return true;
}

bool ChildSession::insertFile(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    std::string name, type;

#if !MOBILEAPP
    if (tokens.size() != 3 ||
        !getTokenString(tokens[1], "name", name) ||
        !getTokenString(tokens[2], "type", type))
    {
        sendTextFrameAndLogError("error: cmd=insertfile kind=syntax");
        return false;
    }
#else
    std::string data;
    if (tokens.size() != 4 ||
        !getTokenString(tokens[1], "name", name) ||
        !getTokenString(tokens[2], "type", type) ||
        !getTokenString(tokens[3], "data", data))
    {
        sendTextFrameAndLogError("error: cmd=insertfile kind=syntax");
        return false;
    }
#endif

    if (type == "graphic" || type == "graphicurl" || type == "selectbackground")
    {
        std::string url;

#if !MOBILEAPP
        if (type == "graphic" || type == "selectbackground")
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

        const std::string command = (type == "selectbackground" ? ".uno:SelectBackground" : ".uno:InsertGraphic");
        const std::string arguments = "{"
            "\"FileName\":{"
                "\"type\":\"string\","
                "\"value\":\"" + url + "\""
            "}}";

        getLOKitDocument()->setView(_viewId);

        LOG_TRC("Inserting " << type << ": " << command << ' ' << arguments.c_str());

        getLOKitDocument()->postUnoCommand(command.c_str(), arguments.c_str(), false);
    }

    return true;
}

bool ChildSession::extTextInputEvent(const char* /*buffer*/, int /*length*/,
                                     const StringVector& tokens)
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
        sendTextFrameAndLogError("error: cmd=" + std::string(tokens[0]) + " kind=syntax");
        return false;
    }

    std::string decodedText;
    URI::decode(text, decodedText);

    getLOKitDocument()->setView(_viewId);
    getLOKitDocument()->postWindowExtTextInputEvent(id, type, decodedText.c_str());

    return true;
}

bool ChildSession::keyEvent(const char* /*buffer*/, int /*length*/,
                            const StringVector& tokens,
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
            sendTextFrameAndLogError("error: cmd=" + std::string(tokens[0]) + " kind=syntax");
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
        sendTextFrameAndLogError("error: cmd=" + std::string(tokens[0]) + "  kind=syntax");
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
                              const StringVector& tokens)
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
        sendTextFrameAndLogError("error: cmd=" +  std::string(tokens[0]) + " kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->postWindowGestureEvent(windowID, type.c_str(), x, y, offset);

    return true;
}

bool ChildSession::mouseEvent(const char* /*buffer*/, int /*length*/,
                              const StringVector& tokens,
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
        sendTextFrameAndLogError("error: cmd=" +  std::string(tokens[0]) + " kind=syntax");
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

bool ChildSession::dialogEvent(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    if (tokens.size() <= 2)
    {
        sendTextFrameAndLogError("error: cmd=dialogevent kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    unsigned nLOKWindowId = std::stoi(tokens[1].c_str());
    getLOKitDocument()->sendDialogEvent(nLOKWindowId,
        tokens.cat(std::string(" "), 2).c_str());

    return true;
}

bool ChildSession::completeFunction(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    int index;

    if (tokens.size() != 2 ||
        !getTokenInteger(tokens[1], "index", index))
    {
        sendTextFrameAndLogError("error: cmd=completefunction kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->completeFunction(index);
    return true;
}

bool ChildSession::unoCommand(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    if (tokens.size() <= 1)
    {
        sendTextFrameAndLogError("error: cmd=uno kind=syntax");
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
                                       tokens.cat(std::string(" "), 2).c_str(),
                                       bNotify);
    }

    return true;
}

bool ChildSession::selectText(const char* /*buffer*/, int /*length*/,
                              const StringVector& tokens,
                              const LokEventTargetEnum target)
{
    std::string swap;
    unsigned winId = 0;
    int type, x, y;
    if (target == LokEventTargetEnum::Window)
    {
        if (tokens.size() != 5 ||
            !getTokenUInt32(tokens[1], "id", winId) ||
            !getTokenString(tokens[2], "swap", swap) ||
            (swap != "true" && swap != "false") ||
            !getTokenInteger(tokens[3], "x", x) ||
            !getTokenInteger(tokens[4], "y", y))
        {
            LOG_ERR("error: cmd=windowselecttext kind=syntax");
            return false;
        }
    }
    else if (target == LokEventTargetEnum::Document)
    {
        if (tokens.size() != 4 ||
            !getTokenKeyword(tokens[1], "type",
                             {{"start", LOK_SETTEXTSELECTION_START},
                              {"end", LOK_SETTEXTSELECTION_END},
                              {"reset", LOK_SETTEXTSELECTION_RESET}},
                             type) ||
            !getTokenInteger(tokens[2], "x", x) ||
            !getTokenInteger(tokens[3], "y", y))
        {
            sendTextFrameAndLogError("error: cmd=selecttext kind=syntax");
            return false;
        }
    }

    getLOKitDocument()->setView(_viewId);

    switch (target)
    {
    case LokEventTargetEnum::Document:
        getLOKitDocument()->setTextSelection(type, x, y);
        break;
    case LokEventTargetEnum::Window:
        getLOKitDocument()->setWindowTextSelection(winId, swap == "true", x, y);
        break;
    default:
        assert(false && "Unsupported select text target type");
    }

    return true;
}

bool ChildSession::renderWindow(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    const unsigned winId = (tokens.size() > 1 ? std::stoul(tokens[1]) : 0);

    int startX = 0, startY = 0;
    int bufferWidth = 800, bufferHeight = 600;
    double dpiScale = 1.0;
    std::string paintRectangle;
    if (tokens.size() > 2 && getTokenString(tokens[2], "rectangle", paintRectangle)
        && paintRectangle != "undefined")
    {
        const StringVector rectParts
            = LOOLProtocol::tokenize(paintRectangle.c_str(), paintRectangle.length(), ',');
        if (rectParts.size() == 4)
        {
            startX = std::atoi(rectParts[0].c_str());
            startY = std::atoi(rectParts[1].c_str());
            bufferWidth = std::atoi(rectParts[2].c_str());
            bufferHeight = std::atoi(rectParts[3].c_str());
        }
    }
    else
        LOG_WRN("windowpaint command doesn't specify a rectangle= attribute.");

    std::string dpiScaleString;
    if (tokens.size() > 3 && getTokenString(tokens[3], "dpiscale", dpiScaleString))
    {
        dpiScale = std::stod(dpiScaleString);
        if (dpiScale < 0.001)
            dpiScale = 1.0;
    }

    size_t pixmapDataSize = 4 * bufferWidth * bufferHeight;
    std::vector<unsigned char> pixmap(pixmapDataSize);
    int width = bufferWidth, height = bufferHeight;
    std::string response;
    const auto start = std::chrono::system_clock::now();
    getLOKitDocument()->paintWindow(winId, pixmap.data(), startX, startY, width, height, dpiScale, _viewId);
    const double area = width * height;

    const auto duration = std::chrono::system_clock::now() - start;
    const auto elapsed = std::chrono::duration_cast<std::chrono::microseconds>(duration).count();
    const double totalTime = elapsed/1000.;
    LOG_TRC("paintWindow for " << winId << " returned " << width << "X" << height
            << "@(" << startX << "," << startY << ")"
            << " with dpi scale: " << dpiScale
            << " and rendered in " << totalTime
            << "ms (" << area / elapsed << " MP/s).");

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

bool ChildSession::resizeWindow(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
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

bool ChildSession::sendWindowCommand(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    const unsigned winId = (tokens.size() > 1 ? std::stoul(tokens[1]) : 0);

    getLOKitDocument()->setView(_viewId);

    if (tokens.size() > 2 && tokens[2] == "close")
        getLOKitDocument()->postWindow(winId, LOK_WINDOW_CLOSE, nullptr);
    else if (tokens.size() > 3 && tokens[2] == "paste")
        getLOKitDocument()->postWindow(winId, LOK_WINDOW_PASTE, tokens[3].c_str());

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

bool ChildSession::signDocumentContent(const char* buffer, int length, const StringVector& /*tokens*/)
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

bool ChildSession::exportSignAndUploadDocument(const char* buffer, int length, const StringVector& /*tokens*/)
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
                sendTextFrameAndLogError("error: cmd=exportsignanduploaddocument kind=syntax");
                return false;
            }
            std::string chainCertificate = rChainPtr;
            certificateChain.push_back(chainCertificate);
        }
    }

    if (filetype.empty() || filename.empty() || wopiUrl.empty() || token.empty() || x509Certificate.empty() || privateKey.empty())
    {
        sendTextFrameAndLogError("error: cmd=exportsignanduploaddocument kind=syntax");
        return false;
    }

    std::string mimetype = getMimeFromFileType(filetype);
    if (mimetype.empty())
    {
        sendTextFrameAndLogError("error: cmd=exportsignanduploaddocument kind=syntax");
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
            sendTextFrameAndLogError("error: cmd=exportsignanduploaddocument kind=syntax");
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

        bResult = _docManager->getLOKit()->signDocument(aTempDocumentURL.c_str(),
                        binaryCertificate.data(), binaryCertificate.size(),
                        binaryPrivateKey.data(), binaryPrivateKey.size());

        if (!bResult)
        {
            sendTextFrameAndLogError("error: cmd=exportsignanduploaddocument kind=syntax");
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

            sendTextFrameAndLogError("error: cmd=exportsignanduploaddocument kind=httpresponse");

            return false;
        }
    }
    catch (const Poco::Exception& pocoException)
    {
        LOG_ERR("Upload signed document Exception: " + pocoException.displayText());

        sendTextFrameAndLogError("error: cmd=exportsignanduploaddocument kind=failure");

        return false;
    }

    sendTextFrame("signeddocumentuploadstatus: OK");

    return true;
}

#endif

bool ChildSession::askSignatureStatus(const char* buffer, int length, const StringVector& /*tokens*/)
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

bool ChildSession::selectGraphic(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
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
        sendTextFrameAndLogError("error: cmd=selectgraphic kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setGraphicSelection(type, x, y);

    return true;
}

bool ChildSession::resetSelection(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    if (tokens.size() != 1)
    {
        sendTextFrameAndLogError("error: cmd=resetselection kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->resetSelection();

    return true;
}

bool ChildSession::saveAs(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    std::string wopiFilename, url, format, filterOptions;

    if (tokens.size() <= 1 ||
        !getTokenString(tokens[1], "url", url))
    {
        sendTextFrameAndLogError("error: cmd=saveas kind=syntax");
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
            sendTextFrameAndLogError("error: cmd=saveas kind=syntax");
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
            filterOptions += tokens.cat(std::string(" "), 4);
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
        sendTextFrameAndLogError("error: cmd=storage kind=savefailed");

    return true;
}

bool ChildSession::setClientPart(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    int part;
    if (tokens.size() < 2 ||
        !getTokenInteger(tokens[1], "part", part))
    {
        sendTextFrameAndLogError("error: cmd=setclientpart kind=invalid");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT && part != getLOKitDocument()->getPart())
    {
        getLOKitDocument()->setPart(part);
    }

    return true;
}

bool ChildSession::selectClientPart(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    int nPart;
    int nSelect;
    if (tokens.size() < 3 ||
        !getTokenInteger(tokens[1], "part", nPart) ||
        !getTokenInteger(tokens[2], "how", nSelect))
    {
        sendTextFrameAndLogError("error: cmd=selectclientpart kind=invalid");
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

bool ChildSession::moveSelectedClientParts(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    int nPosition;
    if (tokens.size() < 2 ||
        !getTokenInteger(tokens[1], "position", nPosition))
    {
        sendTextFrameAndLogError("error: cmd=moveselectedclientparts kind=invalid");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    if (getLOKitDocument()->getDocumentType() != LOK_DOCTYPE_TEXT)
    {
        getLOKitDocument()->moveSelectedParts(nPosition, false); // Move, don't duplicate.

        // Get the status to notify clients of the reordering and selection change.
        const std::string status = LOKitHelper::documentStatus(getLOKitDocument()->get());
        if (!status.empty())
            return _docManager->notifyAll("statusupdate: " + status);
    }
    else
    {
        LOG_WRN("ChildSession::moveSelectedClientParts[" << getName() << "]: error moving parts on text documents.");
    }

    return true; // Non-fatal to fail.
}

bool ChildSession::setPage(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    int page;
    if (tokens.size() < 2 ||
        !getTokenInteger(tokens[1], "page", page))
    {
        sendTextFrameAndLogError("error: cmd=setpage kind=invalid");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->setPart(page);
    return true;
}

bool ChildSession::renderShapeSelection(const char* /*buffer*/, int /*length*/, const StringVector& tokens)
{
    std::string mimeType;
    if (tokens.size() != 2 ||
        !getTokenString(tokens[1], "mimetype", mimeType) ||
        mimeType != "image/svg+xml")
    {
        sendTextFrameAndLogError("error: cmd=rendershapeselection kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    char* pOutput = nullptr;
    const std::size_t nOutputSize = getLOKitDocument()->renderShapeSelection(&pOutput);
    if (pOutput != nullptr && nOutputSize > 0)
    {
        static const std::string header = "shapeselectioncontent:\n";
        size_t responseSize = header.size() + nOutputSize;
        std::unique_ptr<char[]> response(new char[responseSize]);
        std::memcpy(response.get(), header.data(), header.size());
        std::memcpy(response.get() + header.size(), pOutput, nOutputSize);
        free(pOutput);

        LOG_TRC("Sending response (" << responseSize << " bytes) for shapeselectioncontent on view #" << _viewId);
        sendBinaryFrame(response.get(), responseSize);
    }
    else
    {
        LOG_ERR("Failed to renderShapeSelection for view #" << _viewId);
    }

    return true;
}

bool ChildSession::removeTextContext(const char* /*buffer*/, int /*length*/,
                                     const StringVector& tokens)
{
    int id, before, after;
    std::string text;
    if (tokens.size() < 4 ||
        !getTokenInteger(tokens[1], "id", id) || id < 0 ||
        !getTokenInteger(tokens[2], "before", before) ||
        !getTokenInteger(tokens[3], "after", after))
    {
        sendTextFrameAndLogError("error: cmd=" + std::string(tokens[0]) + " kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);
    getLOKitDocument()->removeTextContext(id, before, after);

    return true;
}

/* If the user is inactive we have to remember important events so that when
 * the user becomes active again, we can replay the events.
 */
void ChildSession::rememberEventsForInactiveUser(const int type, const std::string& payload)
{
    if (type == LOK_CALLBACK_INVALIDATE_TILES)
    {
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
             type == LOK_CALLBACK_CELL_ADDRESS ||
             type == LOK_CALLBACK_REFERENCE_MARKS)
    {
        _stateRecorder.recordEvent(type, payload);
    }
    else if (type == LOK_CALLBACK_INVALIDATE_VIEW_CURSOR ||
             type == LOK_CALLBACK_TEXT_VIEW_SELECTION ||
             type == LOK_CALLBACK_CELL_VIEW_CURSOR ||
             type == LOK_CALLBACK_GRAPHIC_VIEW_SELECTION ||
             type == LOK_CALLBACK_VIEW_CURSOR_VISIBLE ||
             type == LOK_CALLBACK_VIEW_LOCK)
    {
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
            _stateRecorder.recordState(name, payload);
        }
    }
    else if (type == LOK_CALLBACK_REDLINE_TABLE_SIZE_CHANGED ||
             type == LOK_CALLBACK_REDLINE_TABLE_ENTRY_MODIFIED ||
             type == LOK_CALLBACK_COMMENT)
    {
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
    _docManager->updateEditorSpeeds(_viewId, _cursorInvalidatedEvent.size());
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
    const char* const typeName = lokCallbackTypeToString(type);
    LOG_TRC("ChildSession::loKitCallback [" << getName() << "]: " <<
            typeName << " [" << payload << "].");

    if (UnitKit::get().filterLoKitCallback(type, payload))
        return;

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
            StringVector tokens(LOOLProtocol::tokenize(payload, ','));
            if (tokens.size() == 5)
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
            else if (tokens.size() == 2 && tokens.equals(0, "EMPTY"))
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
        getStatus("", 0);
        break;
    case LOK_CALLBACK_SET_PART:
        sendTextFrame("setpart: " + payload);
        break;
    case LOK_CALLBACK_UNO_COMMAND_RESULT:
        sendTextFrame("unocommandresult: " + payload);
#ifdef IOS
        {
            // After the document has been saved (into the temporary copy that we set up in
            // -[CODocument loadFromContents:ofType:error:]), save it also using the system API so
            // that file provider extensions notice.

            Parser parser;
            Poco::Dynamic::Var var = parser.parse(payload);
            Object::Ptr object = var.extract<Object::Ptr>();

            auto commandName = object->get("commandName");
            auto success = object->get("success");

            if (!commandName.isEmpty() && commandName.toString() == ".uno:Save" && !success.isEmpty() && success.toString() == "true")
            {
                CODocument *document = [[DocumentViewController singleton] document];

                [document saveToURL:[document fileURL]
                 forSaveOperation:UIDocumentSaveForOverwriting
                 completionHandler:^(BOOL success) {
                        LOG_TRC("ChildSession::loKitCallback() save completion handler gets " << (success?"YES":"NO"));
                    }];
            }
        }
#endif
        break;
    case LOK_CALLBACK_ERROR:
        {
            LOG_ERR("CALLBACK_ERROR: " << payload);
            Parser parser;
            Poco::Dynamic::Var var = parser.parse(payload);
            Object::Ptr object = var.extract<Object::Ptr>();

            sendTextFrameAndLogError("error: cmd=" + object->get("cmd").toString() +
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
    case LOK_CALLBACK_TABLE_SELECTED:
        sendTextFrame("tableselected: " + payload);
        break;
    case LOK_CALLBACK_REFERENCE_MARKS:
        sendTextFrame("referencemarks: " + payload);
        break;
    case LOK_CALLBACK_JSDIALOG:
        sendTextFrame("jsdialog: " + payload);
        break;
    case LOK_CALLBACK_CALC_FUNCTION_LIST:
        sendTextFrame("calcfunctionlist: " + payload);
        break;
    case LOK_CALLBACK_TAB_STOP_LIST:
        sendTextFrame("tabstoplistupdate: " + payload);
        break;

#if !ENABLE_DEBUG
    // we want a compilation-time failure in the debug builds; but ERR in the
    // log in the release ones
    default:
        LOG_ERR("Unknown callback event (" << lokCallbackTypeToString(type) << "): " << payload);
#endif
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
