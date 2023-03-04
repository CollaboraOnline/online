/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "ChildSession.hpp"
#include "MobileApp.hpp"

#include <climits>
#include <fstream>
#include <memory>
#include <sstream>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
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

#ifdef __ANDROID__
#include <androidapp.hpp>
#endif

#include <common/ConfigUtil.hpp>
#include <common/FileUtil.hpp>
#include <common/JsonUtil.hpp>
#include <common/Authorization.hpp>
#include <common/TraceEvent.hpp>
#include <common/SpookyV2.h>
#include "KitHelper.hpp"
#include <Log.hpp>
#include <Png.hpp>
#include <Util.hpp>
#include <Unit.hpp>
#include <Clipboard.hpp>
#include <string>
#include <CommandControl.hpp>

using Poco::JSON::Object;
using Poco::JSON::Parser;
using Poco::URI;

using namespace COOLProtocol;

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

namespace {

/// Formats the uno command information for logging
std::string formatUnoCommandInfo(const std::string& sessionId, const std::string& unoCommand)
{
    std::string recorded_time = Util::getHttpTimeNow();

    std::string unoCommandInfo;

    // unoCommand(sessionId) : command - HttpTime
    unoCommandInfo.append("unoCommand");
    unoCommandInfo.push_back('(');
    unoCommandInfo.append(sessionId);
    unoCommandInfo.push_back(')');
    unoCommandInfo.append(" : ");
    unoCommandInfo.append(Util::eliminatePrefix(unoCommand,".uno:"));
    unoCommandInfo.append(" - ");
    unoCommandInfo.append(recorded_time);

    return unoCommandInfo;
}

}

ChildSession::ChildSession(
    const std::shared_ptr<ProtocolHandlerInterface> &protocol,
    const std::string& id,
    const std::string& jailId,
    const std::string& jailRoot,
    DocumentManagerInterface& docManager) :
    Session(protocol, "ToMaster-" + id, id, false),
    _jailId(jailId),
    _jailRoot(jailRoot),
    _docManager(&docManager),
    _viewId(-1),
    _isDocLoaded(false),
    _copyToClipboard(false)
{
    LOG_INF("ChildSession ctor [" << getName() << "]. JailRoot: [" << _jailRoot << ']');
}

ChildSession::~ChildSession()
{
    LOG_INF("~ChildSession dtor [" << getName() << ']');
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
            LOG_WRN("Skipping unload on incomplete view [" << getName()
                                                           << "], viewId: " << _viewId);
        }

// This shuts down the shared socket, which is not what we want.
//        Session::disconnect();
    }
}

bool ChildSession::_handleInput(const char *buffer, int length)
{
    LOG_TRC("handling [" << getAbbreviatedMessage(buffer, length) << ']');
    const std::string firstLine = getFirstLine(buffer, length);
    const StringVector tokens = StringVector::tokenize(firstLine.data(), firstLine.size());

    if (COOLProtocol::tokenIndicatesUserInteraction(tokens[0]))
    {
        // Keep track of timestamps of incoming client messages that indicate user activity.
        updateLastActivityTime();
    }

    if (tokens.size() > 0 && tokens.equals(0, "useractive") && getLOKitDocument() != nullptr)
    {
        LOG_DBG("Handling message after inactivity of " << getInactivityMS());
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
        return getCommandValues(tokens);
    }
    else if (tokens.equals(0, "dialogevent"))
    {
        return dialogEvent(tokens);
    }
    else if (tokens.equals(0, "load"))
    {
        if (_isDocLoaded)
        {
            sendTextFrameAndLogError("error: cmd=load kind=docalreadyloaded");
            return false;
        }

        // Disable processing of other messages while loading document
        InputProcessingManager processInput(getProtocol(), false);
        _isDocLoaded = loadDocument(tokens);

        LOG_TRC("isDocLoaded state after loadDocument: " << _isDocLoaded);
        return _isDocLoaded;
    }
    else if (!_isDocLoaded)
    {
        sendTextFrameAndLogError("error: cmd=" + tokens[0] + " kind=nodocloaded");
        return false;
    }
    else if (tokens.equals(0, "renderfont"))
    {
        sendFontRendering(tokens);
    }
    else if (tokens.equals(0, "setclientpart"))
    {
        return setClientPart(tokens);
    }
    else if (tokens.equals(0, "selectclientpart"))
    {
        return selectClientPart(tokens);
    }
    else if (tokens.equals(0, "moveselectedclientparts"))
    {
        return moveSelectedClientParts(tokens);
    }
    else if (tokens.equals(0, "setpage"))
    {
        return setPage(tokens);
    }
    else if (tokens.equals(0, "status"))
    {
        return getStatus();
    }
    else if (tokens.equals(0, "paintwindow"))
    {
        return renderWindow(tokens);
    }
    else if (tokens.equals(0, "resizewindow"))
    {
        return resizeWindow(tokens);
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
    else if (tokens.equals(0, "blockingcommandstatus"))
    {
#if ENABLE_FEATURE_LOCK || ENABLE_FEATURE_RESTRICTION
        return updateBlockingCommandStatus(tokens);
#endif
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
               tokens.equals(0, "exportas") ||
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
               tokens.equals(0, "completefunction")||
               tokens.equals(0, "formfieldevent") ||
               tokens.equals(0, "traceeventrecording") ||
               tokens.equals(0, "sallogoverride") ||
               tokens.equals(0, "rendersearchresult") ||
               tokens.equals(0, "contentcontrolevent"));

        std::string pzName("ChildSession::_handleInput:" + tokens[0]);
        ProfileZone pz(pzName.c_str());
        if (tokens.equals(0, "clientzoom"))
        {
            return clientZoom(tokens);
        }
        else if (tokens.equals(0, "clientvisiblearea"))
        {
            return clientVisibleArea(tokens);
        }
        else if (tokens.equals(0, "outlinestate"))
        {
            return outlineState(tokens);
        }
        else if (tokens.equals(0, "downloadas"))
        {
            return downloadAs(tokens);
        }
        else if (tokens.equals(0, "getchildid"))
        {
            return getChildId();
        }
        else if (tokens.equals(0, "gettextselection")) // deprecated.
        {
            return getTextSelection(tokens);
        }
        else if (tokens.equals(0, "getclipboard"))
        {
            return getClipboard(tokens);
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
            return insertFile(tokens);
        }
        else if (tokens.equals(0, "key"))
        {
            return keyEvent(tokens, LokEventTargetEnum::Document);
        }
        else if (tokens.equals(0, "textinput"))
        {
            return extTextInputEvent(tokens);
        }
        else if (tokens.equals(0, "windowkey"))
        {
            return keyEvent(tokens, LokEventTargetEnum::Window);
        }
        else if (tokens.equals(0, "mouse"))
        {
            return mouseEvent(tokens, LokEventTargetEnum::Document);
        }
        else if (tokens.equals(0, "windowmouse"))
        {
            return mouseEvent(tokens, LokEventTargetEnum::Window);
        }
        else if (tokens.equals(0, "windowgesture"))
        {
            return gestureEvent(tokens);
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
                return unoCommand(newTokens);
            }
            else if (tokens[1].find(".uno:Save") != std::string::npos)
            {
                // Disable processing of other messages while saving document
                InputProcessingManager processInput(getProtocol(), false);
                return unoCommand(tokens);
            }

            return unoCommand(tokens);
        }
        else if (tokens.equals(0, "selecttext"))
        {
            return selectText(tokens, LokEventTargetEnum::Document);
        }
        else if (tokens.equals(0, "windowselecttext"))
        {
            return selectText(tokens, LokEventTargetEnum::Window);
        }
        else if (tokens.equals(0, "selectgraphic"))
        {
            return selectGraphic(tokens);
        }
        else if (tokens.equals(0, "resetselection"))
        {
            return resetSelection(tokens);
        }
        else if (tokens.equals(0, "saveas"))
        {
            return saveAs(tokens);
        }
        else if (tokens.equals(0, "exportas"))
        {
            return exportAs(tokens);
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
            sendWindowCommand(tokens);
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
            return renderShapeSelection(tokens);
        }
        else if (tokens.equals(0, "removetextcontext"))
        {
            return removeTextContext(tokens);
        }
        else if (tokens.equals(0, "completefunction"))
        {
            return completeFunction(tokens);
        }
        else if (tokens.equals(0, "formfieldevent"))
        {
            return formFieldEvent(buffer, length, tokens);
        }
        else if (tokens.equals(0, "contentcontrolevent"))
        {
            return contentControlEvent(tokens);
        }
        else if (tokens.equals(0, "traceeventrecording"))
        {
            static const bool traceEventsEnabled = config::getBool("trace_event[@enable]", false);
            if (traceEventsEnabled)
            {
                if (tokens.size() > 0)
                {
                    if (tokens.equals(1, "start"))
                    {
                        getLOKit()->setOption("traceeventrecording", "start");
                        TraceEvent::startRecording();
                        LOG_INF("Trace Event recording in this Kit process turned on (might have been on already)");
                    }
                    else if (tokens.equals(1, "stop"))
                    {
                        getLOKit()->setOption("traceeventrecording", "stop");
                        TraceEvent::stopRecording();
                        LOG_INF("Trace Event recording in this Kit process turned off (might have been off already)");
                    }
                }
            }
        }
        else if (tokens.equals(0, "sallogoverride"))
        {
            if (tokens.empty() || tokens.equals(1, "default"))
            {
                getLOKit()->setOption("sallogoverride", nullptr);
            }
            else if (tokens.size() > 0 && tokens.equals(1, "off"))
            {
                getLOKit()->setOption("sallogoverride", "-WARN-INFO");
            }
            else if (tokens.size() > 0)
            {
                getLOKit()->setOption("sallogoverride", tokens[1].c_str());
            }
        }
        else if (tokens.equals(0, "rendersearchresult"))
        {
            return renderSearchResult(buffer, length, tokens);
        }
        else
        {
            assert(false && "Unknown command token.");
        }
    }

    return true;
}

#if !MOBILEAPP

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
    const std::string url = JAILED_DOCUMENT_ROOT + tmpDir + '/' + filenameParam.getFileName();

    getLOKitDocument()->saveAs(url.c_str(),
                               filetype.empty() ? nullptr : filetype.c_str(),
                               nullptr);

    Authorization authorization(Authorization::Type::Token, token);
    Poco::URI uriObject(wopiUrl + '/' + filename + "/contents");

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

        std::unique_ptr<Poco::Net::HTTPClientSession> psession
            = Util::make_unique<Poco::Net::HTTPSClientSession>(
                        uriObject.getHost(),
                        uriObject.getPort(),
                        Poco::Net::SSLManager::instance().defaultClientContext());

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, uriObject.getPathAndQuery(), Poco::Net::HTTPMessage::HTTP_1_1);
        request.set("User-Agent", WOPI_AGENT_STRING);
        authorization.authorizeRequest(request);

        request.set("X-WOPI-Override", "PUT");

        // If we can't access the file, reading it will throw.
        const FileUtil::Stat fileStat(url);
        const std::size_t filesize = (fileStat.good() ? fileStat.size() : 0);

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
            LOG_ERR("Upload signed document HTTP Response Error: " << response.getStatus() << ' '
                                                                   << response.getReason());

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

bool ChildSession::loadDocument(const StringVector& tokens)
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

#if ENABLE_DEBUG && !MOBILEAPP
    if (std::getenv("PAUSEFORDEBUGGER"))
    {
        std::cerr << getDocURL() << " paused waiting for a debugger to attach: " << getpid() << std::endl;
        SigUtil::setDebuggerSignal();
        pause();
    }
#endif

    SigUtil::addActivity("load view: " + getId() + " doc: " + getJailedFilePathAnonym());

    const bool loaded = _docManager->onLoad(getId(), getJailedFilePathAnonym(), renderOpts);
    if (!loaded || _viewId < 0)
    {
        LOG_ERR("Failed to get LoKitDocument instance for [" << getJailedFilePathAnonym() << ']');
        return false;
    }

    LOG_INF("Created new view with viewid: [" << _viewId << "] for username: ["
                                              << getUserNameAnonym() << "] in session: [" << getId()
                                              << ']');

    if (!doctemplate.empty())
    {
        static constexpr auto Protocol = "file://";

        // If we aren't chroot-ed, we need to use the absolute path.
        // Because that's where Storage in WSD expects the document.
        std::string url;
        if (!_jailRoot.empty())
        {
            url = Protocol + _jailRoot;
            if (Util::startsWith(getJailedFilePath(), Protocol))
                url += getJailedFilePath().substr(sizeof(Protocol) - 1);
            else
                url += getJailedFilePath();
        }
        else
            url += getJailedFilePath();

        LOG_INF("Saving the template document after loading to [" << url << ']');

        const bool success = getLOKitDocument()->saveAs(url.c_str(), nullptr, "TakeOwnership");
        if (!success)
        {
            LOG_ERR("Failed to save template [" << url << ']');
            return false;
        }

#if !MOBILEAPP
            // Create the 'upload' file so DocBroker picks up and uploads.
            const std::string oldName = Poco::URI(url).getPath();
            const std::string newName = oldName + TO_UPLOAD_SUFFIX;
            if (rename(oldName.c_str(), newName.c_str()) < 0)
            {
                // It's not an error if there was no file to rename, when the document isn't modified.
                LOG_TRC("Failed to renamed [" << oldName << "] to [" << newName << ']');
            }
            else
            {
                LOG_TRC("Renamed [" << oldName << "] to [" << newName << ']');
            }
#endif //!MOBILEAPP
    }

    getLOKitDocument()->setView(_viewId);

    _docType = LOKitHelper::getDocumentTypeAsString(getLOKitDocument()->get());
    if (_docType != "text" && part != -1)
    {
        getLOKitDocument()->setPart(part);
    }

    // Respond by the document status
    LOG_DBG("Sending status after loading view " << _viewId);
    const std::string status = LOKitHelper::documentStatus(getLOKitDocument()->get());
    if (status.empty() || !sendTextFrame("status: " + status))
    {
        LOG_ERR("Failed to get/forward document status [" << status << ']');
        return false;
    }

    // Inform everyone (including this one) about updated view info
    _docManager->notifyViewInfo();
    sendTextFrame("editor: " + std::to_string(_docManager->getEditorId()));

    LOG_INF("Loaded session " << getId());
    return true;
}

bool ChildSession::sendFontRendering(const StringVector& tokens)
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
        LOG_ERR(exc.message());
        sendTextFrameAndLogError("error: cmd=renderfont kind=syntax");
        return false;
    }

    const std::string response = "renderfont: " + tokens.cat(' ', 1) + '\n';

    std::vector<char> output;
    output.resize(response.size());
    std::memcpy(output.data(), response.data(), response.size());

    const auto start = std::chrono::steady_clock::now();
    // renderFont use a default font size (25) when width and height are 0
    int width = 0, height = 0;
    unsigned char* ptrFont = nullptr;

    getLOKitDocument()->setView(_viewId);

    ptrFont = getLOKitDocument()->renderFont(decodedFont.c_str(), decodedChar.c_str(), &width, &height);

    const auto duration = std::chrono::steady_clock::now() - start;
    const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(duration);
    LOG_TRC("renderFont [" << font << "] rendered in " << elapsed);

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

bool ChildSession::getStatus()
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

bool ChildSession::getCommandValues(const StringVector& tokens)
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

bool ChildSession::clientZoom(const StringVector& tokens)
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

bool ChildSession::clientVisibleArea(const StringVector& tokens)
{
    int x;
    int y;
    int width;
    int height;

    if ((tokens.size() != 5 && tokens.size() != 7) ||
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

bool ChildSession::outlineState(const StringVector& tokens)
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

bool ChildSession::downloadAs(const StringVector& tokens)
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
            filterOptions += tokens.cat(' ', 5);
        }
    }

    if (filterOptions.empty() && format == "html")
    {
        // Opt-in to avoid linked images, those would not leave the chroot.
        filterOptions = "EmbedImages";
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
    const std::string urlToSend = tmpDir + '/' + filenameParam.getFileName();
    const std::string url = jailDoc + urlToSend;
    const std::string urlAnonym = jailDoc + tmpDir + '/' + Poco::Path(nameAnonym).getFileName();

    LOG_DBG("Calling LOK's saveAs with URL: ["
            << urlAnonym << "], Format: [" << (format.empty() ? "(nullptr)" : format.c_str())
            << "], Filter Options: ["
            << (filterOptions.empty() ? "(nullptr)" : filterOptions.c_str()) << ']');

    bool success = getLOKitDocument()->saveAs(url.c_str(),
                               format.empty() ? nullptr : format.c_str(),
                               filterOptions.empty() ? nullptr : filterOptions.c_str());

    if (!success)
    {
        LOG_ERR("SaveAs Failed for id=" << id << " [" << url << "]. error= " << getLOKitLastError());
        sendTextFrameAndLogError("error: cmd=downloadas kind=saveasfailed");
        return false;
    }

    // Register download id -> URL mapping in the DocumentBroker
    const std::string docBrokerMessage =
        "registerdownload: downloadid=" + tmpDir + " url=" + urlToSend + " clientid=" + getId();
    _docManager->sendFrame(docBrokerMessage.c_str(), docBrokerMessage.length());

    // Send download id to the client
    sendTextFrame("downloadas: downloadid=" + tmpDir +
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

bool ChildSession::getTextSelection(const StringVector& tokens)
{
    std::string mimeType;

    if (tokens.size() != 2 ||
        !getTokenString(tokens[1], "mimetype", mimeType))
    {
        sendTextFrameAndLogError("error: cmd=gettextselection kind=syntax");
        return false;
    }

    SigUtil::addActivity("getTextSelection");

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

    getLOKitDocument()->setView(_viewId);
    char* textSelection = nullptr;
    const int selectionType = getLOKitDocument()->getSelectionTypeAndText(mimeType.c_str(), &textSelection);
    std::string selection(textSelection ? textSelection : "");
    free(textSelection);
    if (selectionType == LOK_SELTYPE_LARGE_TEXT || selectionType == LOK_SELTYPE_COMPLEX)
    {
        // Flag complex data so the client will download async.
        sendTextFrame("complexselection:");
        return true;
    }

    sendTextFrame("textselectioncontent: " + selection);
    return true;
}

bool ChildSession::getClipboard(const StringVector& tokens)
{
    const char **pMimeTypes = nullptr; // fetch all for now.
    const char  *pOneType[2];
    size_t       nOutCount = 0;
    char       **pOutMimeTypes = nullptr;
    size_t      *pOutSizes = nullptr;
    char       **pOutStreams = nullptr;

    bool hasMimeRequest = tokens.size() > 1;
    std::string token;
    if (hasMimeRequest)
    {
        pMimeTypes = pOneType;
        token = tokens[1];
        pMimeTypes[0] = token.c_str();
        pMimeTypes[1] = nullptr;
    }

    SigUtil::addActivity("getClipboard");

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

        SigUtil::addActivity("setClipboard " + std::to_string(length) + " bytes");

        std::string command; // skip command
        std::getline(stream, command, '\n');

        data.read(stream);
//        data.dumpState(std::cerr);

        const size_t nInCount = data.size();
        std::vector<size_t> pInSizes(nInCount);
        std::vector<const char*> pInMimeTypes(nInCount);
        std::vector<const char*> pInStreams(nInCount);

        for (size_t i = 0; i < nInCount; ++i)
        {
            pInSizes[i] = data._content[i].length();
            pInStreams[i] = data._content[i].c_str();
            pInMimeTypes[i] = data._mimeTypes[i].c_str();
        }

        getLOKitDocument()->setView(_viewId);

        if (!getLOKitDocument()->setClipboard(nInCount, pInMimeTypes.data(), pInSizes.data(),
                                              pInStreams.data()))
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

bool ChildSession::insertFile(const StringVector& tokens)
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

    SigUtil::addActivity("insertFile " + type);

    if (type == "graphic" || type == "graphicurl" || type == "selectbackground")
    {
        std::string url;

#if !MOBILEAPP
        if (type == "graphic" || type == "selectbackground")
        {
            std::string jailDoc = JAILED_DOCUMENT_ROOT;
            if (NoCapsForKit)
            {
                jailDoc = Poco::URI(getJailedFilePath()).getPath();
                jailDoc = jailDoc.substr(0, jailDoc.find(JAILED_DOCUMENT_ROOT)) + JAILED_DOCUMENT_ROOT;
            }
            url = "file://" + jailDoc + "insertfile/" + name;
        }
        else if (type == "graphicurl")
            URI::decode(name, url);
#else
        assert(type == "graphic");
        auto binaryData = decodeBase64(data);
        const std::string tempFile = FileUtil::createRandomTmpDir() + '/' + name;
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

bool ChildSession::extTextInputEvent(const StringVector& tokens)
{
    int id = -1;
    std::string text;
    bool error = false;

    if (tokens.size() < 3)
        error = true;
    else if (!getTokenInteger(tokens[1], "id", id) || id < 0)
        error = true;
    else {
        error = !getTokenString(tokens[2], "text", text);
    }

    if (error)
    {
        sendTextFrameAndLogError("error: cmd=" + std::string(tokens[0]) + " kind=syntax");
        return false;
    }

    std::string decodedText;
    URI::decode(text, decodedText);

    getLOKitDocument()->setView(_viewId);
    getLOKitDocument()->postWindowExtTextInputEvent(id, LOK_EXT_TEXTINPUT, decodedText.c_str());
    getLOKitDocument()->postWindowExtTextInputEvent(id, LOK_EXT_TEXTINPUT_END, decodedText.c_str());

    return true;
}

bool ChildSession::keyEvent(const StringVector& tokens,
                            const LokEventTargetEnum target)
{
    int type = 0;
    int charcode = 0;
    int keycode = 0;
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

bool ChildSession::gestureEvent(const StringVector& tokens)
{
    bool success = true;

    unsigned int windowID = 0;
    int x = 0;
    int y = 0;
    int offset = 0;
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

bool ChildSession::mouseEvent(const StringVector& tokens,
                              const LokEventTargetEnum target)
{
    bool success = true;

    // default values for compatibility reasons with older cools
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

    int type = 0;
    int x = 0;
    int y = 0;
    int count = 0;
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

    // compatibility with older cools
    if (success && tokens.size() > counter && !getTokenInteger(tokens[counter++], "buttons", buttons))
        success = false;

    // compatibility with older cools
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

bool ChildSession::dialogEvent(const StringVector& tokens)
{
    if (tokens.size() <= 2)
    {
        sendTextFrameAndLogError("error: cmd=dialogevent kind=syntax");
        return false;
    }

    unsigned long long int nLOKWindowId = 0;

    try
    {
        nLOKWindowId = std::stoull(tokens[1].c_str());
    }
    catch (const std::exception&)
    {
        sendTextFrameAndLogError("error: cmd=dialogevent kind=syntax");
        return false;
    }

    if (_isDocLoaded)
    {
        getLOKitDocument()->setView(_viewId);
        getLOKitDocument()->sendDialogEvent(nLOKWindowId,
                                            tokens.cat(' ', 2).c_str());
    }
    else
    {
        getLOKit()->sendDialogEvent(nLOKWindowId, tokens.cat(' ', 2).c_str());
    }

    return true;
}

bool ChildSession::formFieldEvent(const char* buffer, int length, const StringVector& /*tokens*/)
{
    std::string sFirstLine = getFirstLine(buffer, length);
    std::string sArguments = sFirstLine.substr(std::string("formfieldevent ").size());

    if (sArguments.empty())
    {
        sendTextFrameAndLogError("error: cmd=formfieldevent kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);
    getLOKitDocument()->sendFormFieldEvent(sArguments.c_str());

    return true;
}

bool ChildSession::contentControlEvent(const StringVector& tokens)
{
    std::string type;
    if (tokens.size() != 3 || !getTokenString(tokens[1], "type", type))
    {
        sendTextFrameAndLogError("error: cmd=contentcontrolevent kind=syntax");
        return false;
    }
    std::string arguments = "{\"type\":\"" + type + "\",";

    if (type == "picture")
    {
        std::string name;
        if (getTokenString(tokens[2], "name", name))
        {
            std::string jailDoc = JAILED_DOCUMENT_ROOT;
            if (NoCapsForKit)
            {
                jailDoc = Poco::URI(getJailedFilePath()).getPath();
                jailDoc =
                    jailDoc.substr(0, jailDoc.find(JAILED_DOCUMENT_ROOT)) + JAILED_DOCUMENT_ROOT;
            }
            std::string url = "file://" + jailDoc + "insertfile/" + name;
            arguments += "\"changed\":\"" + url + "\"}";
        }
    }
    else if (type == "pictureurl")
    {
        std::string name;
        if (getTokenString(tokens[2], "name", name))
        {
            std::string url;
            URI::decode(name, url);
            arguments = "{\"type\":\"picture\",\"changed\":\"" + url + "\"}";
        }
    }
    else if (type == "date" || type == "drop-down")
    {
        std::string data;
        getTokenString(tokens[2], "selected", data);
        arguments += "\"selected\":\"" + data + "\"" + "}";
    }

    getLOKitDocument()->setView(_viewId);
    getLOKitDocument()->sendContentControlEvent(arguments.c_str());

    return true;
}

bool ChildSession::renderSearchResult(const char* buffer, int length, const StringVector& /*tokens*/)
{
    std::string sContent(buffer, length);
    std::string sCommand("rendersearchresult ");
    std::string sArguments = sContent.substr(sCommand.size());

    if (sArguments.empty())
    {
        sendTextFrameAndLogError("error: cmd=rendersearchresult kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    const auto eTileMode = static_cast<LibreOfficeKitTileMode>(getLOKitDocument()->getTileMode());

    unsigned char* pBitmapBuffer = nullptr;

    int nWidth = 0;
    int nHeight = 0;
    size_t nByteSize = 0;

    bool bSuccess = getLOKitDocument()->renderSearchResult(sArguments.c_str(), &pBitmapBuffer, &nWidth, &nHeight, &nByteSize);

    if (bSuccess && nByteSize > 0)
    {
        std::vector<char> aOutput;
        aOutput.reserve(nByteSize * 3 / 4); // reserve 75% of original size

        if (Png::encodeBufferToPNG(pBitmapBuffer, nWidth, nHeight, aOutput, eTileMode))
        {
            static const std::string aHeader = "rendersearchresult:\n";
            size_t nResponseSize = aHeader.size() + aOutput.size();
            std::vector<char> aResponse(nResponseSize);
            std::copy(aHeader.begin(), aHeader.end(), aResponse.begin());
            std::copy(aOutput.begin(), aOutput.end(), aResponse.begin() + aHeader.size());
            sendBinaryFrame(aResponse.data(), aResponse.size());
        }
        else
        {
            sendTextFrameAndLogError("error: cmd=rendersearchresult kind=failure");
        }
    }
    else
    {
        sendTextFrameAndLogError("error: cmd=rendersearchresult kind=failure");
    }

    if (pBitmapBuffer)
        free(pBitmapBuffer);

    return true;
}


bool ChildSession::completeFunction(const StringVector& tokens)
{
    std::string functionName;

    if (tokens.size() != 2 ||
        !getTokenString(tokens[1], "name", functionName) ||
        functionName.empty())
    {
        sendTextFrameAndLogError("error: cmd=completefunction kind=syntax");
        return false;
    }

    getLOKitDocument()->setView(_viewId);

    getLOKitDocument()->completeFunction(functionName.c_str());
    return true;
}

bool ChildSession::unoCommand(const StringVector& tokens)
{
    if (tokens.size() <= 1)
    {
        sendTextFrameAndLogError("error: cmd=uno kind=syntax");
        return false;
    }

    SigUtil::addActivity(formatUnoCommandInfo(getId(), tokens[1]));

    // we need to get LOK_CALLBACK_UNO_COMMAND_RESULT callback when saving
    const bool bNotify = (tokens.equals(1, ".uno:Save") ||
                          tokens.equals(1, ".uno:Undo") ||
                          tokens.equals(1, ".uno:Redo") ||
                          tokens.startsWith(1, "vnd.sun.star.script:"));

    getLOKitDocument()->setView(_viewId);

    if (tokens.size() == 2)
    {
        if (tokens.equals(1, ".uno:fakeDiskFull"))
        {
            _docManager->alertAllUsers("internal", "diskfull");
        }
        else
        {
            if (tokens.equals(1, ".uno:Copy") || tokens.equals(1, ".uno:CopyHyperlinkLocation"))
                _copyToClipboard = true;

            getLOKitDocument()->postUnoCommand(tokens[1].c_str(), nullptr, bNotify);
        }
    }
    else
    {
        getLOKitDocument()->postUnoCommand(tokens[1].c_str(), tokens.cat(' ', 2).c_str(), bNotify);
    }

    return true;
}

bool ChildSession::selectText(const StringVector& tokens,
                              const LokEventTargetEnum target)
{
    std::string swap;
    unsigned winId = 0;
    int type = 0, x = 0, y = 0;
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

// FIXME: remove SpookyHash et. al.

namespace {
inline
uint64_t hashSubBuffer(unsigned char* pixmap, size_t startX, size_t startY,
                       long width, long height, int bufferWidth, int bufferHeight)
{
    if (bufferWidth < width || bufferHeight < height)
        return 0; // magic invalid hash.

    // assume a consistent mode - RGBA vs. BGRA for process
    SpookyHash hash;
    hash.Init(1073741789, 1073741789); // Seeds can be anything.
    for (long y = 0; y < height; ++y)
    {
        const size_t position = ((startY + y) * bufferWidth * 4) + (startX * 4);
        hash.Update(pixmap + position, width * 4);
    }

    uint64_t hash1;
    uint64_t hash2;
    hash.Final(&hash1, &hash2);
    return hash1;
}
}

bool ChildSession::renderWindow(const StringVector& tokens)
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
            = StringVector::tokenize(paintRectangle.c_str(), paintRectangle.length(), ',');
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

    const size_t pixmapDataSize = 4 * bufferWidth * bufferHeight;
    std::vector<unsigned char> pixmap(pixmapDataSize);
    const int width = bufferWidth;
    const int height = bufferHeight;
    const auto start = std::chrono::steady_clock::now();
    getLOKitDocument()->paintWindow(winId, pixmap.data(), startX, startY, width, height, dpiScale,
                                    _viewId);
    const double area = width * height;

    const auto elapsedMs = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - start);
    const double elapsedMics = elapsedMs.count() * 1000.; // Need MPixels/second, use Pixels/mics.
    LOG_TRC("paintWindow for " << winId << " returned " << width << 'X' << height << "@(" << startX
                               << ',' << startY << ',' << " with dpi scale: " << dpiScale
                               << " and rendered in " << elapsedMs << " (" << area / elapsedMics
                               << " MP/s).");

    uint64_t pixmapHash = hashSubBuffer(pixmap.data(), 0, 0, width, height, bufferWidth, bufferHeight) + getViewId();

    auto found = std::find(_pixmapCache.begin(), _pixmapCache.end(), pixmapHash);

    assert(_pixmapCache.size() <= LOKitHelper::tunnelledDialogImageCacheSize);

    // If not found in cache, we need to encode to PNG and send to client

    // To artificially induce intentional cache inconsistency between server and client, to be able
    // to test error handling, you can do something like:
    // const bool doPng = (found == _pixmapCache.end() || (time(NULL) % 10 == 0)) && ((time(NULL) % 10) < 8);

    const bool doPng = (found == _pixmapCache.end());

    LOG_DBG("Pixmap hash: " << pixmapHash << (doPng ? " NOT in cache, doing PNG" : " in cache, not encoding to PNG") << ", cache size now:" << _pixmapCache.size());

    // If it is already the first in the cache, no need to do anything. Otherwise, if in cache, move
    // to beginning. If not in cache, add it as first. Keep cache size limited.
    if (_pixmapCache.size() > 0)
    {
        if (found != _pixmapCache.begin())
        {
            if (found != _pixmapCache.end())
            {
                LOG_DBG("Erasing found entry");
                _pixmapCache.erase(found);
            }
            else if (_pixmapCache.size() == LOKitHelper::tunnelledDialogImageCacheSize)
            {
                LOG_DBG("Popping last entry");
                _pixmapCache.pop_back();
            }
            _pixmapCache.insert(_pixmapCache.begin(), pixmapHash);
        }
    }
    else
        _pixmapCache.insert(_pixmapCache.begin(), pixmapHash);

    LOG_DBG("Pixmap cache size now:" << _pixmapCache.size());

    assert(_pixmapCache.size() <= LOKitHelper::tunnelledDialogImageCacheSize);

    std::string response = "windowpaint: id=" + std::to_string(winId) + " width=" + std::to_string(width)
                           + " height=" + std::to_string(height);

    if (!paintRectangle.empty())
        response += " rectangle=" + paintRectangle;

    response += " hash=" + std::to_string(pixmapHash);

    if (!doPng)
    {
        // Just so that we might see in the client console log that no PNG was included.
        response += " nopng";
        sendTextFrame(response.c_str());
        return true;
    }

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

#if 0
    {
        static const std::string tempDir = FileUtil::createRandomTmpDir();
        static int pngDumpCounter = 0;
        std::stringstream ss;
        ss << tempDir << "/" << "renderwindow-" << pngDumpCounter++ << ".png";
        LOG_INF("Dumping PNG to '"<< ss.str() << "'");
        FILE *f = fopen(ss.str().c_str(), "w");
        fwrite(output.data() + response.size(), output.size() - response.size(), 1, f);
        fclose(f);
    }
#endif

    LOG_TRC("Sending response (" << output.size() << " bytes) for: " << std::string(output.data(), response.size() - 1));
    sendBinaryFrame(output.data(), output.size());
    return true;
}

bool ChildSession::resizeWindow(const StringVector& tokens)
{
    const unsigned winId = (tokens.size() > 1 ? std::stoul(tokens[1], nullptr, 10) : 0);

    getLOKitDocument()->setView(_viewId);

    std::string size;
    if (tokens.size() > 2 && getTokenString(tokens[2], "size", size))
    {
        const std::vector<int> sizeParts = COOLProtocol::tokenizeInts(size, ',');
        if (sizeParts.size() == 2)
        {
            getLOKitDocument()->resizeWindow(winId, sizeParts[0], sizeParts[1]);
            return true;
        }
    }

    LOG_WRN("resizewindow command doesn't specify sensible size= attribute.");
    return true;
}

bool ChildSession::sendWindowCommand(const StringVector& tokens)
{
    const unsigned winId = (tokens.size() > 1 ? std::stoul(tokens[1]) : 0);

    getLOKitDocument()->setView(_viewId);

    if (tokens.size() > 2 && tokens.equals(2, "close"))
        getLOKitDocument()->postWindow(winId, LOK_WINDOW_CLOSE, nullptr);
    else if (tokens.size() > 3 && tokens.equals(2, "paste"))
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
    const std::string aTempDocumentURL
        = JAILED_DOCUMENT_ROOT + aTempDir + '/' + filenameParam.getFileName();

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
    Poco::URI uriObject(wopiUrl + '/' + filename + "/contents");

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

        std::unique_ptr<Poco::Net::HTTPClientSession> psession
            = Util::make_unique<Poco::Net::HTTPSClientSession>(
                        uriObject.getHost(),
                        uriObject.getPort(),
                        Poco::Net::SSLManager::instance().defaultClientContext());

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, uriObject.getPathAndQuery(), Poco::Net::HTTPMessage::HTTP_1_1);
        request.set("User-Agent", WOPI_AGENT_STRING);
        authorization.authorizeRequest(request);

        request.set("X-WOPI-Override", "PUT");

        // If we can't access the file, reading it will throw.
        const FileUtil::Stat fileStat(aTempDocumentURL);
        const std::size_t filesize = (fileStat.good() ? fileStat.size() : 0);

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

bool ChildSession::selectGraphic(const StringVector& tokens)
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

bool ChildSession::resetSelection(const StringVector& tokens)
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

bool ChildSession::saveAs(const StringVector& tokens)
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
    bool encodeURL = false;
    if (wopiURL.getScheme() == "wopi")
    {
        std::vector<std::string> pathSegments;
        wopiURL.getPathSegments(pathSegments);

        if (pathSegments.empty())
        {
            sendTextFrameAndLogError("error: cmd=saveas kind=syntax");
            return false;
        }

        std::string jailDoc = JAILED_DOCUMENT_ROOT;
        if (NoCapsForKit)
        {
            jailDoc = Poco::URI(getJailedFilePath()).getPath();
            jailDoc = jailDoc.substr(0, jailDoc.find(JAILED_DOCUMENT_ROOT)) + JAILED_DOCUMENT_ROOT;
        }

        const std::string tmpDir = FileUtil::createRandomDir(jailDoc);
        const Poco::Path filenameParam(pathSegments[pathSegments.size() - 1]);
        url = std::string("file://") + jailDoc + tmpDir + '/' + filenameParam.getFileName();
        // url becomes decoded at this stage
        // on saveAs we should send encoded!
        encodeURL = true;
        wopiFilename = wopiURL.getPath();
    }

    if (tokens.size() > 2)
        getTokenString(tokens[2], "format", format);

    if (tokens.size() > 3 && getTokenString(tokens[3], "options", filterOptions))
    {
        if (tokens.size() > 4)
        {
            filterOptions += tokens.cat(' ', 4);
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
    LOG_DBG("Calling LOK's saveAs with URL: ["
            << anonymizeUrl(wopiFilename) << "], Format: ["
            << (format.empty() ? "(nullptr)" : format.c_str()) << "], Filter Options: ["
            << (filterOptions.empty() ? "(nullptr)" : filterOptions.c_str()) << ']');

    getLOKitDocument()->setView(_viewId);

    std::string encodedURL;
    if (encodeURL)
        Poco::URI::encode(url, "", encodedURL);
    else
        // url is already encoded
        encodedURL = url;

    std::string encodedWopiFilename;
    Poco::URI::encode(wopiFilename, "", encodedWopiFilename);

    success = getLOKitDocument()->saveAs(encodedURL.c_str(),
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
            LOG_DBG("Retry: calling LOK's saveAs with URL: ["
                    << url << "], Format: [" << (format.empty() ? "(nullptr)" : format.c_str())
                    << "], Filter Options: ["
                    << (filterOptions.empty() ? "(nullptr)" : filterOptions.c_str()) << ']');

            success = getLOKitDocument()->saveAs(
                encodedURL.c_str(), format.empty() ? nullptr : format.c_str(),
                filterOptions.empty() ? nullptr : filterOptions.c_str());
        }
    }

    if (success)
        sendTextFrame("saveas: url=" + encodedURL + " filename=" + encodedWopiFilename);
    else
        sendTextFrameAndLogError("error: cmd=saveas kind=savefailed");

    return true;
}

bool ChildSession::exportAs(const StringVector& tokens)
{
    std::string wopiFilename, url;

    if (tokens.size() <= 1 ||
        !getTokenString(tokens[1], "url", url))
    {
        sendTextFrameAndLogError("error: cmd=exportas kind=syntax");
        return false;
    }

    Poco::URI wopiURL(url);
    if (wopiURL.getScheme() == "wopi")
    {
        std::vector<std::string> pathSegments;
        wopiURL.getPathSegments(pathSegments);

        if (pathSegments.empty())
        {
            sendTextFrameAndLogError("error: cmd=exportas kind=syntax");
            return false;
        }

        wopiFilename = wopiURL.getPath();
    }
    else
    {
        sendTextFrameAndLogError("error: cmd=exportas kind=syntax");
        return false;
    }

    // for PDF and EPUB show dialog with export options first
    // when options will be chosen and file exported we will
    // receive LOK_CALLBACK_EXPORT_FILE message
    std::string extension = FileUtil::extractFileExtension(wopiFilename);

    const bool isPDF = extension == "pdf";
    const bool isEPUB = extension == "epub";
    if (isPDF || isEPUB)
    {
        // We don't have the FileId at this point, just a new filename to save-as.
        // So here the filename will be obfuscated with some hashing, which later will
        // get a proper FileId that we will use going forward.
        LOG_DBG("Calling LOK's exportAs with: [" << anonymizeUrl(wopiFilename) << ']');

        getLOKitDocument()->setView(_viewId);

        std::string encodedWopiFilename;
        Poco::URI::encode(wopiFilename, "", encodedWopiFilename);

        _exportAsWopiUrl = encodedWopiFilename;

        const std::string arguments = "{"
            "\"SynchronMode\":{"
                "\"type\":\"boolean\","
                "\"value\": false"
            "}}";

        if (isPDF)
            getLOKitDocument()->postUnoCommand(".uno:ExportToPDF", arguments.c_str(), false);
        else if (isEPUB)
            getLOKitDocument()->postUnoCommand(".uno:ExportToEPUB", arguments.c_str(), false);

        return true;
    }

    sendTextFrameAndLogError("error: cmd=exportas kind=unsupported");
    return false;
}

bool ChildSession::setClientPart(const StringVector& tokens)
{
    int part = 0;
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

bool ChildSession::selectClientPart(const StringVector& tokens)
{
    int nPart = 0;
    int nSelect = 0;
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

bool ChildSession::moveSelectedClientParts(const StringVector& tokens)
{
    int nPosition = 0;
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

bool ChildSession::setPage(const StringVector& tokens)
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

bool ChildSession::renderShapeSelection(const StringVector& tokens)
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

bool ChildSession::removeTextContext(const StringVector& tokens)
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
             type == LOK_CALLBACK_INVALIDATE_SHEET_GEOMETRY ||
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
        if (COOLProtocol::parseNameValuePair(payload, name, value, '='))
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

#if ENABLE_FEATURE_LOCK || ENABLE_FEATURE_RESTRICTION
bool ChildSession::updateBlockingCommandStatus(const StringVector& tokens)
{
    std::string lockStatus, restrictedStatus;
    if (tokens.size() < 2 || !getTokenString(tokens[1], "isRestrictedUser", restrictedStatus))
    {
        sendTextFrameAndLogError("error: cmd=restrictionstatus kind=failure");
        return false;
    }
    else if (tokens.size() < 2 || !getTokenString(tokens[2], "isLockedUser", lockStatus))
    {
        sendTextFrameAndLogError("error: cmd=lockstatus kind=failure");
        return false;
    }
    std::string blockedCommands = "";
    if (restrictedStatus == "true")
        blockedCommands += CommandControl::RestrictionManager::getRestrictedCommandListString();
    if (lockStatus == "true")
        blockedCommands += blockedCommands.empty()
                               ? CommandControl::LockManager::getLockedCommandListString()
                               : " " + CommandControl::LockManager::getLockedCommandListString();

    getLOKitDocument()->setBlockedCommandList(_viewId, blockedCommands.c_str());
    return true;
}

std::string ChildSession::getBlockedCommandType(std::string command)
{
    if(CommandControl::RestrictionManager::getRestrictedCommandList().find(command)
    != CommandControl::RestrictionManager::getRestrictedCommandList().end())
        return "restricted";

    if (CommandControl::LockManager::getLockedCommandList().find(command) !=
        CommandControl::LockManager::getLockedCommandList().end())
        return "locked";

    return "";
}
#endif

void ChildSession::loKitCallback(const int type, const std::string& payload)
{
    const char* const typeName = lokCallbackTypeToString(type);
    LOG_TRC("ChildSession::loKitCallback [" << getName() << "]: " << typeName << " [" << payload
                                            << ']');

#if !MOBILEAPP
    if (UnitKit::get().filterLoKitCallback(type, payload))
        return;
#endif
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

        // Pass save and ModifiedStatus notifications through, block others.
        if (type != LOK_CALLBACK_UNO_COMMAND_RESULT || payload.find(".uno:Save") == std::string::npos)
        {
            if (payload.find(".uno:ModifiedStatus") == std::string::npos)
            {
                LOG_TRC("Skipping callback [" << typeName << "] on inactive session " << getName());
                return;
            }
        }
    }

    switch (static_cast<LibreOfficeKitCallbackType>(type))
    {
    case LOK_CALLBACK_INVALIDATE_TILES:
        {
            StringVector tokens(StringVector::tokenize(payload, ','));
            if (tokens.size() == 5 || tokens.size() == 6)
            {
                int part, x, y, width, height, mode = 0;
                try
                {
                    x = std::stoi(tokens[0]);
                    y = std::stoi(tokens[1]);
                    width = std::stoi(tokens[2]);
                    height = std::stoi(tokens[3]);
                    part = (_docType != "text" ? std::stoi(tokens[4]) : 0); // Writer renders everything as part 0.
                    if (tokens.size() == 6)
                        mode = std::stoi(tokens[5]);
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
                    mode = 0;
                }

                sendTextFrame("invalidatetiles:"
                              " part=" + std::to_string(part) +
                              ((mode > 0) ? (" mode=" + std::to_string(mode)) : "") +
                              " x=" + std::to_string(x) +
                              " y=" + std::to_string(y) +
                              " width=" + std::to_string(width) +
                              " height=" + std::to_string(height));
            }
            else if (tokens.size() == 2 && tokens.equals(0, "EMPTY"))
            {
                // without mode: "EMPTY, <part>"
                const std::string part = (_docType != "text" ? tokens[1].c_str() : "0"); // Writer renders everything as part 0.
                sendTextFrame("invalidatetiles: EMPTY, " + part);
            }
            else if (tokens.size() == 3 && tokens.equals(0, "EMPTY"))
            {
                // with mode:    "EMPTY, <part>, <mode>"
                const std::string part = (_docType != "text" ? tokens[1].c_str() : "0"); // Writer renders everything as part 0.
                const std::string mode = (_docType != "text" ? tokens[2].c_str() : "0"); // Writer is not using mode.
                sendTextFrame("invalidatetiles: EMPTY, " + part + ", " + mode);
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
        if (Util::startsWith(payload, ".uno:SlideMasterPage"))
        {
            std::string status = LOKitHelper::documentStatus(getLOKitDocument()->get());
            sendTextFrame("status: " + status);
        }
        break;
    case LOK_CALLBACK_SEARCH_NOT_FOUND:
        sendTextFrame("searchnotfound: " + payload);
        break;
    case LOK_CALLBACK_SEARCH_RESULT_SELECTION:
        sendTextFrame("searchresultselection: " + payload);
        break;
    case LOK_CALLBACK_DOCUMENT_SIZE_CHANGED:
        getStatus();
        break;
    case LOK_CALLBACK_SET_PART:
        sendTextFrame("setpart: " + payload);
        break;
    case LOK_CALLBACK_UNO_COMMAND_RESULT:
    {
        Parser parser;
        Poco::Dynamic::Var var = parser.parse(payload);
        Object::Ptr object = var.extract<Object::Ptr>();

        auto commandName = object->get("commandName");
        auto success = object->get("success");

        if (!commandName.isEmpty() && commandName.toString() == ".uno:Save")
        {
#if !MOBILEAPP
            // Create the 'upload' file regardless of success or failure,
            // because we don't know if the last upload worked or not.
            // DocBroker will have to decide to upload or skip.
            const std::string oldName = Poco::URI(getJailedFilePath()).getPath();
            const std::string newName = oldName + TO_UPLOAD_SUFFIX;
            if (rename(oldName.c_str(), newName.c_str()) < 0)
            {
                // It's not an error if there was no file to rename, when the document isn't modified.
                const auto onrre = errno;
                LOG_TRC("Failed to renamed [" << oldName << "] to [" << newName << "] ("
                                              << Util::symbolicErrno(onrre) << ": "
                                              << std::strerror(onrre) << ')');
            }
            else
            {
                LOG_TRC("Renamed [" << oldName << "] to [" << newName << ']');
            }

#else // MOBILEAPP
            // After the document has been saved (into the temporary copy that we set up in
            // -[CODocument loadFromContents:ofType:error:]), save it also using the system API so
            // that file provider extensions notice.
            if (!success.isEmpty() && success.toString() == "true")
            {
#if defined(IOS)
                CODocument *document = DocumentData::get(_docManager->getMobileAppDocId()).coDocument;
                [document saveToURL:[document fileURL]
                   forSaveOperation:UIDocumentSaveForOverwriting
                  completionHandler:^(BOOL success) {
                        LOG_TRC("ChildSession::loKitCallback() save completion handler gets " << (success?"YES":"NO"));
                        if (![[NSFileManager defaultManager] removeItemAtURL:document->copyFileURL error:nil]) {
                            LOG_SYS("Could not remove copy of document at " << [[document->copyFileURL path] UTF8String]);
                        }
                    }];
#elif defined(__ANDROID__)
                postDirectMessage("SAVE " + payload);
#endif
            }
#endif
        }

        sendTextFrame("unocommandresult: " + payload);
    }
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
        sendTextFrame("statusindicatorstart: " + payload);
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
    {
        sendTextFrame("comment: " + payload);
        getStatus();
        break;
    }
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
    case LOK_CALLBACK_VALIDITY_INPUT_HELP:
        sendTextFrame("validityinputhelp: " + payload);
        break;
    case LOK_CALLBACK_CLIPBOARD_CHANGED:
    {
        if (_copyToClipboard)
        {
            _copyToClipboard = false;
            if (payload.empty())
                getTextSelectionInternal("");
            else
                sendTextFrame("clipboardchanged: " + payload);
        }

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
    case LOK_CALLBACK_FORM_FIELD_BUTTON:
        sendTextFrame("formfieldbutton: " + payload);
        break;
    case LOK_CALLBACK_INVALIDATE_SHEET_GEOMETRY:
        sendTextFrame("invalidatesheetgeometry: " + payload);
        break;
    case LOK_CALLBACK_DOCUMENT_BACKGROUND_COLOR:
        sendTextFrame("documentbackgroundcolor: " + payload);
        break;
    case LOK_CALLBACK_MEDIA_SHAPE:
        sendTextFrame("mediashape: " + payload);
        break;
    case LOK_CALLBACK_CONTENT_CONTROL:
        sendTextFrame("contentcontrol: " + payload);
        break;
    case LOK_COMMAND_BLOCKED:
        {
#if ENABLE_FEATURE_LOCK || ENABLE_FEATURE_RESTRICTION
            LOG_INF("COMMAND_BLOCKED: " << payload);
            Parser parser;
            Poco::Dynamic::Var var = parser.parse(payload);
            Object::Ptr object = var.extract<Object::Ptr>();

            std::string cmd = object->get("cmd").toString();
            sendTextFrame("blockedcommand: cmd=" + cmd +
                    " kind=" + getBlockedCommandType(cmd) + " code=" + object->get("code").toString());
#endif
        }
        break;
    case LOK_CALLBACK_PRINT_RANGES:
        sendTextFrame("printranges: " + payload);
        break;
    case LOK_CALLBACK_FONTS_MISSING:
#if !MOBILEAPP
        {
            // This environment variable is always set in COOLWSD::innerInitialize().
            static std::string fontsMissingHandling = std::string(std::getenv("FONTS_MISSING_HANDLING"));
            if (fontsMissingHandling == "report" || fontsMissingHandling == "both")
                sendTextFrame("fontsmissing: " + payload);
            if (fontsMissingHandling == "log" || fontsMissingHandling == "both")
            {
#if 0
                Poco::JSON::Parser parser;
                Poco::JSON::Object::Ptr root = parser.parse(payload).extract<Poco::JSON::Object::Ptr>();

                const Poco::Dynamic::Var fontsMissing = root->get("fontsmissing");
                if (fontsMissing.isArray())
                    for (const auto &f : fontsMissing)
                        LOG_INF("Font missing: " << f.convert<std::string>());
#else
                LOG_INF("Fonts missing: " << payload);
#endif
            }
        }
#endif
        break;
    case LOK_CALLBACK_EXPORT_FILE:
    {
        bool isAbort = payload == "ABORT";
        bool isError = payload == "ERROR";
        bool isPending = payload == "PENDING";
        bool exportWasRequested = !_exportAsWopiUrl.empty();

        if (isPending) // dialog ret=ok, local save has been started
        {
            sendTextFrame("blockui: ");
            return;
        }
        else if (isAbort) // dialog ret=cancel, local save was aborted
        {
            _exportAsWopiUrl.clear();
            return;
        }

        // this is export status message
        sendTextFrame("unblockui: ");

        if (isError) // local save failed
        {
            _exportAsWopiUrl.clear();
            sendTextFrameAndLogError("error: cmd=exportas kind=failure");
            return;
        }

        // local save was successful

        if (exportWasRequested)
        {
            std::string encodedURL;
            Poco::URI::encode(payload, "", encodedURL);

            sendTextFrame("exportas: url=" + encodedURL + " filename=" + _exportAsWopiUrl);

            _exportAsWopiUrl.clear();
            return;
        }

        // it was download request

        // Register download id -> URL mapping in the DocumentBroker
        auto url = std::string("../../") + payload.substr(strlen("file:///tmp/"));
        auto downloadId = Util::rng::getFilename(64);
        std::string docBrokerMessage = "registerdownload: downloadid=" + downloadId + " url=" + url + " clientid=" + getId();
        _docManager->sendFrame(docBrokerMessage.c_str(), docBrokerMessage.length());
        std::string message = "downloadas: downloadid=" + downloadId + " port=" + std::to_string(ClientPortNumber) + " id=export";
        sendTextFrame(message);
        break;
    }
    default:
        LOG_ERR("Unknown callback event (" << lokCallbackTypeToString(type) << "): " << payload);
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
