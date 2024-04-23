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

#include <config.h>

#include "WopiStorage.hpp"

#include <Auth.hpp>
#include <CommandControl.hpp>
#include <Common.hpp>
#include <Exceptions.hpp>
#include <HostUtil.hpp>
#include <HttpRequest.hpp>
#include <Log.hpp>
#include <NetUtil.hpp>
#include <ProofKey.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include <common/FileUtil.hpp>
#include <common/JsonUtil.hpp>
#include <common/TraceEvent.hpp>

#include <Poco/Exception.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/Context.h>
#include <Poco/Net/DNS.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/KeyConsoleHandler.h>
#include <Poco/Net/NameValueCollection.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>

#include <cassert>
#include <chrono>
#include <iconv.h>
#include <memory>
#include <string>

bool isTemplate(const std::string& filename)
{
    std::vector<std::string> templateExtensions{ ".stw",  ".ott",  ".dot", ".dotx",
                                                 ".dotm", ".otm",  ".stc", ".ots",
                                                 ".xltx", ".xltm", ".sti", ".otp",
                                                 ".potx", ".potm", ".std", ".otg" };
    for (auto& extension : templateExtensions)
        if (filename.ends_with(extension))
            return true;
    return false;
}

namespace
{

static void addStorageDebugCookie(Poco::Net::HTTPRequest& request)
{
    (void)request;
#if ENABLE_DEBUG
    if (std::getenv("COOL_STORAGE_COOKIE"))
    {
        Poco::Net::NameValueCollection nvcCookies;
        StringVector cookieTokens =
            StringVector::tokenize(std::string(std::getenv("COOL_STORAGE_COOKIE")), ':');
        if (cookieTokens.size() == 2)
        {
            nvcCookies.add(cookieTokens[0], cookieTokens[1]);
            request.setCookies(nvcCookies);
            LOG_TRC("Added storage debug cookie [" << cookieTokens[0] << '=' << cookieTokens[1]
                                                   << "].");
        }
    }
#endif
}

// access_token must be decoded
void addWopiProof(Poco::Net::HTTPRequest& request, const Poco::URI& uri,
                  const std::string& access_token)
{
    assert(!uri.isRelative());
    for (const auto& header : GetProofHeaders(access_token, uri.toString()))
        request.set(header.first, header.second);
}

std::map<std::string, std::string> GetQueryParams(const Poco::URI& uri)
{
    std::map<std::string, std::string> result;
    for (const auto& param : uri.getQueryParameters())
        result.emplace(param);
    return result;
}

} // anonymous namespace

void WopiStorage::initHttpRequest(Poco::Net::HTTPRequest& request, const Poco::URI& uri,
                                  const Authorization& auth) const
{
    request.set("User-Agent", http::getAgentString());

    auth.authorizeRequest(request);

    addStorageDebugCookie(request);

    // TODO: Avoid repeated parsing.
    std::map<std::string, std::string> params = GetQueryParams(uri);
    const auto it = params.find("access_token");
    if (it != params.end())
        addWopiProof(request, uri, it->second);

    // Helps wrt. debugging cluster cases from the logs
    request.set("X-COOL-WOPI-ServerId", Util::getProcessIdentifier());
}

http::Request WopiStorage::initHttpRequest(const Poco::URI& uri, const Authorization& auth) const
{
    http::Request httpRequest(uri.getPathAndQuery());

    //FIXME: Hack Hack Hack! Use own version.
    Poco::Net::HTTPRequest request;
    initHttpRequest(request, uri, auth);

    // Copy the headers, including the cookies.
    for (const auto& pair : request)
    {
        httpRequest.header().set(pair.first, pair.second);
    }

    return httpRequest;
}

void WopiStorage::handleWOPIFileInfo(const WOPIFileInfo& wopiFileInfo, LockContext& lockCtx)
{
    setFileInfo(wopiFileInfo);

    if (COOLWSD::AnonymizeUserData)
        Util::mapAnonymized(Util::getFilenameFromURL(wopiFileInfo.getFilename()),
                            Util::getFilenameFromURL(getUri().toString()));

    if (wopiFileInfo.getSupportsLocks())
        lockCtx.initSupportsLocks();

    // If FileUrl is set, we use it for GetFile.
    _fileUrl = wopiFileInfo.getFileUrl();
}

WopiStorage::WOPIFileInfo::WOPIFileInfo(const FileInfo& fileInfo, Poco::JSON::Object::Ptr& object,
                                        const Poco::URI& uriObject)
    : FileInfo(fileInfo)
    , _hideUserList("false")
{
    JsonUtil::findJSONValue(object, "UserId", _userId);
    JsonUtil::findJSONValue(object, "UserFriendlyName", _username);
    JsonUtil::findJSONValue(object, "TemplateSaveAs", _templateSaveAs);
    JsonUtil::findJSONValue(object, "TemplateSource", _templateSource);

    // UserFriendlyName is used as the Author when loading the document.
    // If it's missing, document loading fails. Since the UserFriendlyName
    // field is optional in WOPI specs, it's often left out by integrators.
    if (_username.empty())
    {
        _username = "UnknownUser"; // Default to something sensible yet friendly.
        if (!_userId.empty())
            _username += '_' + _userId;

        LOG_ERR("WOPI::CheckFileInfo does not specify a valid UserFriendlyName for the current "
                "user. Temporarily ["
                << _username << "] will be used until a valid name is specified.");
    }

    std::ostringstream wopiResponse;

    // Anonymize key values.
    if (COOLWSD::AnonymizeUserData)
    {
        JsonUtil::findJSONValue(object, "ObfuscatedUserId", _obfuscatedUserId);
        if (!_obfuscatedUserId.empty())
        {
            Util::mapAnonymized(getOwnerId(), _obfuscatedUserId);
            Util::mapAnonymized(_userId, _obfuscatedUserId);
            Util::mapAnonymized(_username, _obfuscatedUserId);
        }

        // Set anonymized version of the above fields before logging.
        // Note: anonymization caches the result, so we don't need to store here.
        if (COOLWSD::AnonymizeUserData)
            object->set("BaseFileName", COOLWSD::anonymizeUrl(getFilename()));

        // If obfuscatedUserId is provided, then don't log the originals and use it.
        if (COOLWSD::AnonymizeUserData && _obfuscatedUserId.empty())
        {
            object->set("OwnerId", COOLWSD::anonymizeUsername(getOwnerId()));
            object->set("UserId", COOLWSD::anonymizeUsername(_userId));
            object->set("UserFriendlyName", COOLWSD::anonymizeUsername(_username));
        }
    }
    object->stringify(wopiResponse);

    LOG_DBG("WOPI::CheckFileInfo: " << wopiResponse.str());

    JsonUtil::findJSONValue(object, "UserExtraInfo", _userExtraInfo);
    JsonUtil::findJSONValue(object, "UserPrivateInfo", _userPrivateInfo);
    JsonUtil::findJSONValue(object, "WatermarkText", _watermarkText);
    JsonUtil::findJSONValue(object, "UserCanWrite", _userCanWrite);
    JsonUtil::findJSONValue(object, "PostMessageOrigin", _postMessageOrigin);
    JsonUtil::findJSONValue(object, "HidePrintOption", _hidePrintOption);
    JsonUtil::findJSONValue(object, "HideSaveOption", _hideSaveOption);
    JsonUtil::findJSONValue(object, "HideExportOption", _hideExportOption);
    JsonUtil::findJSONValue(object, "HideRepairOption", _hideRepairOption);
    JsonUtil::findJSONValue(object, "EnableOwnerTermination", _enableOwnerTermination);
    JsonUtil::findJSONValue(object, "DisablePrint", _disablePrint);
    JsonUtil::findJSONValue(object, "DisableExport", _disableExport);
    JsonUtil::findJSONValue(object, "DisableCopy", _disableCopy);
    JsonUtil::findJSONValue(object, "DisableInactiveMessages", _disableInactiveMessages);
    JsonUtil::findJSONValue(object, "DownloadAsPostMessage", _downloadAsPostMessage);
    JsonUtil::findJSONValue(object, "UserCanNotWriteRelative", _userCanNotWriteRelative);
    JsonUtil::findJSONValue(object, "EnableInsertRemoteImage", _enableInsertRemoteImage);
    JsonUtil::findJSONValue(object, "DisableInsertLocalImage", _disableInsertLocalImage);
    JsonUtil::findJSONValue(object, "EnableRemoteLinkPicker", _enableRemoteLinkPicker);
    JsonUtil::findJSONValue(object, "EnableShare", _enableShare);
    JsonUtil::findJSONValue(object, "HideUserList", _hideUserList);
    JsonUtil::findJSONValue(object, "SupportsLocks", _supportsLocks);
    JsonUtil::findJSONValue(object, "SupportsRename", _supportsRename);
    JsonUtil::findJSONValue(object, "UserCanRename", _userCanRename);
    JsonUtil::findJSONValue(object, "BreadcrumbDocName", _breadcrumbDocName);
    JsonUtil::findJSONValue(object, "FileUrl", _fileUrl);

    // Update the scheme to https if ssl or ssl termination is on
    if (_postMessageOrigin.starts_with("http://") &&
        (COOLWSD::isSSLEnabled() || COOLWSD::isSSLTermination()))
    {
        _postMessageOrigin.replace(0, 4, "https");
        LOG_DBG("Updating PostMessageOrigin scheme to HTTPS. Updated origin is now ["
                << _postMessageOrigin << ']');
    }

#if ENABLE_FEATURE_LOCK
    bool isUserLocked = false;
    JsonUtil::findJSONValue(object, "IsUserLocked", isUserLocked);

    if (config::getBool("feature_lock.locked_hosts[@allow]", false))
    {
        bool isReadOnly = false;
        isUserLocked = false;
        CommandControl::LockManager::setUnlockLink(uriObject.getHost());
        Poco::URI newUri(HostUtil::getNewLockedUri(uriObject));
        const std::string host = newUri.getHost();

        if (CommandControl::LockManager::hostExist(host))
        {
            isReadOnly = CommandControl::LockManager::isHostReadOnly(host);
            isUserLocked = CommandControl::LockManager::isHostCommandDisabled(host);
        }
        else
        {
            LOG_INF("Could not find matching locked_host: " << host
                                                            << ",applying fallback settings");
            isReadOnly = config::getBool("feature_lock.locked_hosts.fallback[@read_only]", false);
            isUserLocked =
                config::getBool("feature_lock.locked_hosts.fallback[@disabled_commands]", false);
        }

        if (isReadOnly)
        {
            isUserLocked = true;
            _userCanWrite = false;
            LOG_DBG("Feature lock is enabled and " << host
                                                   << " is in the list of read-only members. "
                                                      "Therefore, document is set to read-only.");
        }
        CommandControl::LockManager::setHostReadOnly(isReadOnly);
    }
    CommandControl::LockManager::setLockedUser(isUserLocked);
#else
    (void)uriObject;
#endif

    bool booleanFlag = false;
    JsonUtil::findJSONValue(object, "IsUserRestricted", booleanFlag);
    CommandControl::RestrictionManager::setRestrictedUser(booleanFlag);

    if (JsonUtil::findJSONValue(object, "DisableChangeTrackingRecord", booleanFlag))
        _disableChangeTrackingRecord =
            (booleanFlag ? WOPIFileInfo::TriState::True : WOPIFileInfo::TriState::False);
    if (JsonUtil::findJSONValue(object, "DisableChangeTrackingShow", booleanFlag))
        _disableChangeTrackingShow =
            (booleanFlag ? WOPIFileInfo::TriState::True : WOPIFileInfo::TriState::False);
    if (JsonUtil::findJSONValue(object, "HideChangeTrackingControls", booleanFlag))
        _hideChangeTrackingControls =
            (booleanFlag ? WOPIFileInfo::TriState::True : WOPIFileInfo::TriState::False);

    static const std::string overrideWatermarks =
        COOLWSD::getConfigValue<std::string>("watermark.text", "");
    if (!overrideWatermarks.empty())
        _watermarkText = overrideWatermarks;
    if (isTemplate(getFilename()))
        _disableExport = true;
}

StorageBase::LockUpdateResult WopiStorage::updateLockState(const Authorization& auth,
                                                           LockContext& lockCtx, bool lock,
                                                           const Attributes& attribs)
{
    lockCtx._lockFailureReason.clear();
    if (!lockCtx._supportsLocks)
        return LockUpdateResult::UNSUPPORTED;

    Poco::URI uriObject(getUri());
    auth.authorizeURI(uriObject);

    Poco::URI uriObjectAnonym(getUri());
    uriObjectAnonym.setPath(COOLWSD::anonymizeUrl(uriObjectAnonym.getPath()));
    const std::string uriAnonym = uriObjectAnonym.toString();

    const std::string wopiLog(lock ? "WOPI::Lock" : "WOPI::Unlock");
    LOG_DBG(wopiLog << " requesting: " << uriAnonym);

    try
    {
        std::unique_ptr<Poco::Net::HTTPClientSession> psession(getHTTPClientSession(uriObject));

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST,
                                       uriObject.getPathAndQuery(),
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        initHttpRequest(request, uriObject, auth);

        request.set("X-WOPI-Override", lock ? "LOCK" : "UNLOCK");
        request.set("X-WOPI-Lock", lockCtx._lockToken);
        if (!attribs.getExtendedData().empty())
        {
            request.set("X-COOL-WOPI-ExtendedData", attribs.getExtendedData());
            if (isLegacyServer())
                request.set("X-LOOL-WOPI-ExtendedData", attribs.getExtendedData());
        }

        // IIS requires content-length for POST requests: see https://forums.iis.net/t/1119456.aspx
        request.setContentLength(0);

        psession->sendRequest(request);
        Poco::Net::HTTPResponse response;
        std::istream& rs = psession->receiveResponse(response);

        std::ostringstream oss;
        Poco::StreamCopier::copyStream(rs, oss);
        std::string responseString = oss.str();

        LOG_INF(wopiLog << " response: " << responseString << " status " << response.getStatus());

        if (response.getStatus() == Poco::Net::HTTPResponse::HTTP_OK)
        {
            lockCtx._isLocked = lock;
            lockCtx.bumpTimer();
            return LockUpdateResult::OK;
        }
        else
        {
            std::string sMoreInfo = response.get("X-WOPI-LockFailureReason", "");
            if (!sMoreInfo.empty())
            {
                lockCtx._lockFailureReason = sMoreInfo;
                sMoreInfo = ", failure reason: \"" + sMoreInfo + "\"";
            }

            if (response.getStatus() == Poco::Net::HTTPResponse::HTTP_UNAUTHORIZED ||
                response.getStatus() == Poco::Net::HTTPResponse::HTTP_FORBIDDEN ||
                response.getStatus() == Poco::Net::HTTPResponse::HTTP_NOT_FOUND)
            {
                LOG_ERR("Un-successful " << wopiLog << " with expired token, HTTP status "
                                         << response.getStatus() << sMoreInfo
                                         << " and response: " << responseString);

                return LockUpdateResult::UNAUTHORIZED;
            }

            LOG_ERR("Un-successful " << wopiLog << " with HTTP status " << response.getStatus()
                                     << sMoreInfo << " and response: " << responseString);
            return LockUpdateResult::FAILED;
        }
    }
    catch (const Poco::Exception& pexc)
    {
        LOG_ERR("Cannot " << wopiLog << " uri [" << uriAnonym << "]. Error: " << pexc.displayText()
                          << (pexc.nested() ? " (" + pexc.nested()->displayText() + ')' : ""));
    }
    catch (const BadRequestException& exc)
    {
        LOG_ERR("Cannot " << wopiLog << " uri [" << uriAnonym << "]. Error: " << exc.what());
    }

    lockCtx._lockFailureReason = "Request failed";
    return LockUpdateResult::FAILED;
}

/// uri format: http://server/<...>/wopi*/files/<id>/content
std::string WopiStorage::downloadStorageFileToLocal(const Authorization& auth,
                                                    LockContext& /*lockCtx*/,
                                                    const std::string& templateUri)
{
    ProfileZone profileZone("WopiStorage::downloadStorageFileToLocal", { { "url", _fileUrl } });

    if (!templateUri.empty())
    {
        // Download the template file and load it normally.
        // The document will get saved once loading in Core is complete.
        const std::string templateUriAnonym = COOLWSD::anonymizeUrl(templateUri);
        try
        {
            LOG_INF("WOPI::GetFile template source: " << templateUriAnonym);
            return downloadDocument(Poco::URI(templateUri), templateUriAnonym, auth,
                                    RedirectionLimit);
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Could not download template from [" + templateUriAnonym + "]. Error: "
                    << ex.what());
            throw; // Bubble-up the exception.
        }
    }

    // First try the FileUrl, if provided.
    if (!_fileUrl.empty())
    {
        const std::string fileUrlAnonym = COOLWSD::anonymizeUrl(_fileUrl);
        try
        {
            LOG_INF("WOPI::GetFile using FileUrl: " << fileUrlAnonym);
            return downloadDocument(Poco::URI(_fileUrl), fileUrlAnonym, auth, RedirectionLimit);
        }
        catch (const StorageSpaceLowException&)
        {
            throw; // Bubble-up the exception.
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Could not download document from WOPI FileUrl [" + fileUrlAnonym +
                        "]. Will use default URL. Error: "
                    << ex.what());
        }
    }

    // Try the default URL, we either don't have FileUrl, or it failed.
    // WOPI URI to download files ends in '/contents'.
    // Add it here to get the payload instead of file info.
    Poco::URI uriObject(getUri());
    uriObject.setPath(uriObject.getPath() + "/contents");
    auth.authorizeURI(uriObject);

    Poco::URI uriObjectAnonym(getUri());
    uriObjectAnonym.setPath(COOLWSD::anonymizeUrl(uriObjectAnonym.getPath()) + "/contents");
    const std::string uriAnonym = uriObjectAnonym.toString();

    try
    {
        LOG_INF("WOPI::GetFile using default URI: " << uriAnonym);
        return downloadDocument(uriObject, uriAnonym, auth, RedirectionLimit);
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Cannot download document from WOPI storage uri [" + uriAnonym + "]. Error: "
                << ex.what());
        throw; // Bubble-up the exception.
    }
}

std::string WopiStorage::downloadDocument(const Poco::URI& uriObject, const std::string& uriAnonym,
                                          const Authorization& auth, unsigned redirectLimit)
{
    const auto startTime = std::chrono::steady_clock::now();
    std::shared_ptr<http::Session> httpSession = getHttpSession(uriObject);

    http::Request httpRequest = initHttpRequest(uriObject, auth);

    setRootFilePath(Poco::Path(getLocalRootPath(), getFileInfo().getFilename()).toString());
    setRootFilePathAnonym(COOLWSD::anonymizeUrl(getRootFilePath()));

    if (!FileUtil::checkDiskSpace(getRootFilePath()))
    {
        throw StorageSpaceLowException("Low disk space for " + getRootFilePathAnonym());
    }

    LOG_TRC("Downloading from [" << uriAnonym << "] to [" << getRootFilePath()
                                 << "]: " << httpRequest.header());
    const std::shared_ptr<const http::Response> httpResponse =
        httpSession->syncDownload(httpRequest, getRootFilePath());

    const std::chrono::milliseconds diff = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - startTime);

    const http::StatusCode statusCode = httpResponse->statusLine().statusCode();
    if (statusCode == http::StatusCode::OK)
    {
        // Log the response header.
        LOG_TRC("WOPI::GetFile response header for URI [" << uriAnonym << "]:\n"
                                                          << httpResponse->header());
    }
    else if (statusCode == http::StatusCode::MovedPermanently ||
             statusCode == http::StatusCode::Found ||
             statusCode == http::StatusCode::TemporaryRedirect ||
             statusCode == http::StatusCode::PermanentRedirect)
    {
        if (redirectLimit)
        {
            const std::string& location = httpResponse->get("Location");
            LOG_TRC("WOPI::GetFile redirect to URI [" << COOLWSD::anonymizeUrl(location) << ']');

            Poco::URI redirectUriObject(location);
            return downloadDocument(redirectUriObject, uriAnonym, auth, redirectLimit - 1);
        }
        else
        {
            throw StorageConnectionException("WOPI::GetFile [" + uriAnonym +
                                             "] failed: redirected too many times");
        }
    }
    else
    {
        const std::string responseString = httpResponse->getBody();
        LOG_ERR("WOPI::GetFile [" << uriAnonym << "] failed with Status Code: "
                                  << httpResponse->statusLine().statusCode());
        throw StorageConnectionException("WOPI::GetFile [" + uriAnonym +
                                         "] failed: " + responseString);
    }

    // Successful
    const FileUtil::Stat fileStat(getRootFilePath());
    const std::size_t filesize = (fileStat.good() ? fileStat.size() : 0);
    LOG_INF("WOPI::GetFile downloaded " << filesize << " bytes from [" << uriAnonym << "] -> "
                                        << getRootFilePathAnonym() << " in " << diff);
    setDownloaded(true);

    // Now return the jailed path.
    if (COOLWSD::NoCapsForKit)
        return getRootFilePath();
    else
        return Poco::Path(getJailPath(), getFileInfo().getFilename()).toString();
}

/// A helper class to invoke the AsyncUploadCallback
/// when it exits its scope.
/// By default it invokes the callback with a failure state.
class ScopedInvokeAsyncUploadCallback
{
public:
    ScopedInvokeAsyncUploadCallback(StorageBase::AsyncUploadCallback asyncUploadCallback)
        : _asyncUploadCallback(std::move(asyncUploadCallback))
        , _arg(StorageBase::AsyncUpload(
              StorageBase::AsyncUpload::State::Error,
              StorageBase::UploadResult(StorageBase::UploadResult::Result::FAILED)))
    {
    }

    ~ScopedInvokeAsyncUploadCallback()
    {
        if (_asyncUploadCallback)
            _asyncUploadCallback(_arg);
    }

    /// Set a new callback argument.
    void setArg(StorageBase::AsyncUpload arg) { _arg = std::move(arg); }

private:
    StorageBase::AsyncUploadCallback _asyncUploadCallback;
    StorageBase::AsyncUpload _arg;
};

void WopiStorage::uploadLocalFileToStorageAsync(const Authorization& auth, LockContext& lockCtx,
                                                const std::string& saveAsPath,
                                                const std::string& saveAsFilename,
                                                const bool isRename, const Attributes& attribs,
                                                SocketPoll& socketPoll,
                                                const AsyncUploadCallback& asyncUploadCallback)
{
    auto profileZone =
        std::make_shared<ProfileZone>(std::string("WopiStorage::uploadLocalFileToStorage"),
                                      std::map<std::string, std::string>({ { "url", _fileUrl } }));

    // TODO: Check if this URI has write permission (canWrite = true)

    // Always invoke the callback with the result of the async upload.
    ScopedInvokeAsyncUploadCallback scopedInvokeCallback(asyncUploadCallback);

    //TODO: replace with state machine.
    if (_uploadHttpSession)
    {
        LOG_WRN("Upload is already in progress.");
        return;
    }

    const bool isSaveAs = !saveAsPath.empty() && !saveAsFilename.empty();
    const std::string filePath(isSaveAs ? saveAsPath : getRootFilePathUploading());
    const std::string filePathAnonym = COOLWSD::anonymizeUrl(filePath);

    const FileUtil::Stat fileStat(filePath);
    if (!fileStat.good())
    {
        LOG_ERR("Cannot access file [" << filePathAnonym << "] to upload to wopi storage.");
        scopedInvokeCallback.setArg(
            AsyncUpload(AsyncUpload::State::Error,
                        UploadResult(UploadResult::Result::FAILED, "File not found.")));
        return;
    }

    const std::size_t size = (fileStat.good() ? fileStat.size() : 0);

    Poco::URI uriObject(getUri());
    uriObject.setPath(isSaveAs || isRename ? uriObject.getPath()
                                           : uriObject.getPath() + "/contents");
    auth.authorizeURI(uriObject);

    const std::string uriAnonym = COOLWSD::anonymizeUrl(uriObject.toString());

    const std::string wopiLog(isSaveAs ? "WOPI::PutRelativeFile"
                                       : (isRename ? "WOPI::RenameFile" : "WOPI::PutFile"));
    LOG_INF(wopiLog << " uploading " << size << " bytes from [" << filePathAnonym
                    << "] to URI via WOPI [" << uriAnonym << ']');

    const auto startTime = std::chrono::steady_clock::now();
    try
    {
        assert(!_uploadHttpSession && "Unexpected to have an upload http::session");
        _uploadHttpSession = getHttpSession(uriObject);

        http::Request httpRequest = initHttpRequest(uriObject, auth);
        httpRequest.setVerb(http::Request::VERB_POST);

        http::Header& httpHeader = httpRequest.header();

        // must include this header except for SaveAs
        if (!isSaveAs && lockCtx._supportsLocks)
            httpHeader.set("X-WOPI-Lock", lockCtx._lockToken);

        if (!isSaveAs && !isRename)
        {
            // normal save
            httpHeader.set("X-WOPI-Override", "PUT");
            httpHeader.set("X-COOL-WOPI-IsModifiedByUser",
                           attribs.isUserModified() ? "true" : "false");
            httpHeader.set("X-COOL-WOPI-IsAutosave", attribs.isAutosave() ? "true" : "false");
            httpHeader.set("X-COOL-WOPI-IsExitSave", attribs.isExitSave() ? "true" : "false");
            if (isLegacyServer())
            {
                httpHeader.set("X-LOOL-WOPI-IsModifiedByUser",
                               attribs.isUserModified() ? "true" : "false");
                httpHeader.set("X-LOOL-WOPI-IsAutosave", attribs.isAutosave() ? "true" : "false");
                httpHeader.set("X-LOOL-WOPI-IsExitSave", attribs.isExitSave() ? "true" : "false");
            }

            if (attribs.isExitSave())
                httpHeader.set("Connection",
                               "close"); // Don't maintain the socket if we are exiting.
            if (!attribs.getExtendedData().empty())
            {
                httpHeader.set("X-COOL-WOPI-ExtendedData", attribs.getExtendedData());
                if (isLegacyServer())
                    httpHeader.set("X-LOOL-WOPI-ExtendedData", attribs.getExtendedData());
            }

            if (!attribs.isForced() && isLastModifiedTimeSafe())
            {
                // Request WOPI host to not overwrite if timestamps mismatch
                httpHeader.set("X-COOL-WOPI-Timestamp", getLastModifiedTime());
                if (isLegacyServer())
                    httpHeader.set("X-LOOL-WOPI-Timestamp", getLastModifiedTime());
            }
        }
        else
        {
            // the suggested target has to be in UTF-7; default to extension
            // only when the conversion fails
            std::string suggestedTarget = '.' + Poco::Path(saveAsFilename).getExtension();

            //TODO: Perhaps we should cache this descriptor and reuse, as iconv_open might be expensive.
            iconv_t cd = iconv_open("UTF-7", "UTF-8");
            if (cd == (iconv_t)-1)
                LOG_ERR(wopiLog << " failed to initialize iconv for UTF-7 conversion, using ["
                                << suggestedTarget << ']');
            else
            {
                std::vector<char> input(saveAsFilename.begin(), saveAsFilename.end());
                std::vector<char> buffer(8 * saveAsFilename.size());

                char* in = &input[0];
                std::size_t in_left = input.size();
                char* out = &buffer[0];
                std::size_t out_left = buffer.size();

                if (iconv(cd, &in, &in_left, &out, &out_left) == (size_t)-1)
                    LOG_ERR(wopiLog << " failed to convert [" << saveAsFilename
                                    << "] to UTF-7, using [" << suggestedTarget << ']');
                else
                {
                    // conversion succeeded
                    suggestedTarget = std::string(&buffer[0], buffer.size() - out_left);
                    LOG_TRC(wopiLog << " converted [" << saveAsFilename << "] to UTF-7 as ["
                                    << suggestedTarget << ']');
                }

                iconv_close(cd);
            }

            if (isRename)
            {
                // rename file
                httpHeader.set("X-WOPI-Override", "RENAME_FILE");
                httpHeader.set("X-WOPI-RequestedName", suggestedTarget);
            }
            else
            {
                // save as
                httpHeader.set("X-WOPI-Override", "PUT_RELATIVE");
                httpHeader.set("X-WOPI-Size", std::to_string(size));
                LOG_TRC("Save as: suggested target is '" << suggestedTarget << "'.");
                httpHeader.set("X-WOPI-SuggestedTarget", suggestedTarget);
            }
        }

        httpHeader.setContentType("application/octet-stream");
        httpHeader.setContentLength(size);

        httpRequest.setBodyFile(filePath);

        http::Session::FinishedCallback finishedCallback =
            [this, startTime, wopiLog, filePathAnonym, uriAnonym, size, isSaveAs, isRename,
             asyncUploadCallback, profileZone = std::move(profileZone)](
                const std::shared_ptr<http::Session>& httpSession)
        {
            profileZone->end();

            // Retire.
            _uploadHttpSession.reset();

            assert(httpSession && "Expected a valid http::Session");
            const std::shared_ptr<const http::Response> httpResponse = httpSession->response();

            _wopiSaveDuration = std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::steady_clock::now() - startTime);
            LOG_TRC(wopiLog << " finished async uploading in " << _wopiSaveDuration);

            WopiUploadDetails details = { filePathAnonym,
                                          uriAnonym,
                                          httpResponse->statusLine().reasonPhrase(),
                                          httpResponse->statusLine().statusCode(),
                                          size,
                                          isSaveAs,
                                          isRename };

            // Handle the response.
            const StorageBase::UploadResult res =
                handleUploadToStorageResponse(details, httpResponse->getBody());

            // Fire the callback to our client (DocBroker, typically).
            asyncUploadCallback(AsyncUpload(AsyncUpload::State::Complete, res));
        };

        _uploadHttpSession->setFinishedHandler(std::move(finishedCallback));

        LOG_DBG(wopiLog << " async upload request: " << httpRequest.header().toString());

        // Make the request.
        _uploadHttpSession->asyncRequest(httpRequest, socketPoll);

        scopedInvokeCallback.setArg(
            AsyncUpload(AsyncUpload::State::Running, UploadResult(UploadResult::Result::OK)));
        return;
    }
    catch (const Poco::Exception& ex)
    {
        LOG_ERR(wopiLog << " cannot upload file to WOPI storage uri [" << uriAnonym
                        << "]. Error: " << ex.displayText()
                        << (ex.nested() ? " (" + ex.nested()->displayText() + ')' : ""));
    }
    catch (const std::exception& ex)
    {
        LOG_ERR(wopiLog << " cannot upload file to WOPI storage uri [" + uriAnonym + "]. Error: "
                        << ex.what());
    }

    scopedInvokeCallback.setArg(AsyncUpload(
        AsyncUpload::State::Error, UploadResult(UploadResult::Result::FAILED, "Internal error.")));
}

StorageBase::UploadResult
WopiStorage::handleUploadToStorageResponse(const WopiUploadDetails& details,
                                           std::string responseString)
{
    // Assume we failed, unless we have confirmation of success.
    StorageBase::UploadResult result(UploadResult::Result::FAILED, responseString);
    try
    {
        // Save a copy of the response because we might need to anonymize.
        const std::string origResponseString = responseString;

        const std::string wopiLog(details.isSaveAs
                                      ? "WOPI::PutRelativeFile"
                                      : (details.isRename ? "WOPI::RenameFile" : "WOPI::PutFile"));

        if (Log::isEnabled(Log::Level::INF))
        {
            if (COOLWSD::AnonymizeUserData)
            {
                Poco::JSON::Object::Ptr object;
                if (JsonUtil::parseJSON(responseString, object))
                {
                    // Anonymize the filename
                    std::string url;
                    std::string filename;
                    if (JsonUtil::findJSONValue(object, "Url", url) &&
                        JsonUtil::findJSONValue(object, "Name", filename))
                    {
                        // Get the FileId form the URL, which we use as the anonymized filename.
                        std::string decodedUrl;
                        Poco::URI::decode(url, decodedUrl);
                        const std::string obfuscatedFileId = Util::getFilenameFromURL(decodedUrl);
                        Util::mapAnonymized(obfuscatedFileId,
                                            obfuscatedFileId); // Identity, to avoid re-anonymizing.

                        const std::string filenameOnly = Util::getFilenameFromURL(filename);
                        Util::mapAnonymized(filenameOnly, obfuscatedFileId);
                        object->set("Name", COOLWSD::anonymizeUrl(filename));
                    }

                    // Stringify to log.
                    std::ostringstream ossResponse;
                    object->stringify(ossResponse);
                    responseString = ossResponse.str();
                }
            }

            LOG_INF(wopiLog << " uploaded " << details.size << " bytes in " << _wopiSaveDuration
                            << " from [" << details.filePathAnonym << "] -> [" << details.uriAnonym
                            << "]: " << details.httpResponseCode << ' '
                            << details.httpResponseReason << ": " << responseString);
        }

        if (details.httpResponseCode == http::StatusCode::OK)
        {
            result.setResult(StorageBase::UploadResult::Result::OK);
            Poco::JSON::Object::Ptr object;
            if (JsonUtil::parseJSON(origResponseString, object))
            {
                const std::string lastModifiedTime =
                    JsonUtil::getJSONValue<std::string>(object, "LastModifiedTime");
                LOG_TRC(wopiLog << " returns LastModifiedTime [" << lastModifiedTime << "].");
                setLastModifiedTime(lastModifiedTime);

                if (details.isSaveAs || details.isRename)
                {
                    const std::string name = JsonUtil::getJSONValue<std::string>(object, "Name");
                    LOG_TRC(wopiLog << " returns Name [" << COOLWSD::anonymizeUrl(name) << "].");

                    const std::string url = JsonUtil::getJSONValue<std::string>(object, "Url");
                    LOG_TRC(wopiLog << " returns Url [" << COOLWSD::anonymizeUrl(url) << "].");

                    result.setSaveAsResult(name, url);
                }
            }
            else
            {
                LOG_WRN("Invalid or missing JSON in " << wopiLog << " HTTP_OK response. Expected json object with a LastModifiedTime value");
            }
        }
        else if (details.httpResponseCode == http::StatusCode::PayloadTooLarge)
        {
            result.setResult(StorageBase::UploadResult::Result::TOO_LARGE);
        }
        else if (details.httpResponseCode == http::StatusCode::Unauthorized ||
                 details.httpResponseCode == http::StatusCode::Forbidden ||
                 details.httpResponseCode == http::StatusCode::NotFound)
        {
            // The ms-wopi specs recognizes 401 and 404 for invalid token
            // and file unknown/user unauthorized, respectively.
            // We also handle 403 that some implementation use.
            result.setResult(StorageBase::UploadResult::Result::UNAUTHORIZED);
        }
        else if (details.httpResponseCode == http::StatusCode::Conflict)
        {
            result.setResult(StorageBase::UploadResult::Result::CONFLICT);
            Poco::JSON::Object::Ptr object;
            if (JsonUtil::parseJSON(origResponseString, object))
            {
                const unsigned coolStatusCode =
                    JsonUtil::getJSONValue<unsigned>(object, "COOLStatusCode");
                if (coolStatusCode == static_cast<unsigned>(COOLStatusCode::DOC_CHANGED) ||
                    JsonUtil::getJSONValue<unsigned>(object, "LOOLStatusCode") ==
                        static_cast<unsigned>(COOLStatusCode::DOC_CHANGED))
                {
                    result.setResult(StorageBase::UploadResult::Result::DOC_CHANGED);
                }
            }
            else
            {
                LOG_ERR("Invalid or missing JSON in " << wopiLog << " HTTP_CONFLICT response.");
            }
        }
        else
        {
            // Internal server error, and other failures.
            if (responseString.empty())
            {
                responseString = "No response received. Connection terminated or timed-out.";
            }

            LOG_ERR("Unexpected response to "
                    << wopiLog << ". Cannot upload file to WOPI storage uri [" << details.uriAnonym
                    << "]: " << details.httpResponseCode << ' ' << details.httpResponseReason
                    << ": " << responseString);
            result.setResult(StorageBase::UploadResult::Result::FAILED);

            // If we cannot be sure whether we up-loaded successfully eg. we got
            // a timeout then be tolerant of subsequent timestamp mismatch problems
            setLastModifiedTimeUnSafe();
        }
    }
    catch (const Poco::Exception& pexc)
    {
        LOG_ERR("Cannot upload file to WOPI storage uri ["
                << details.uriAnonym << "]. Error: " << pexc.displayText()
                << (pexc.nested() ? " (" + pexc.nested()->displayText() + ')' : ""));
        result.setResult(StorageBase::UploadResult::Result::FAILED);
    }
    catch (const BadRequestException& exc)
    {
        LOG_ERR("Cannot upload file to WOPI storage uri [" + details.uriAnonym + "]. Error: "
                << exc.what());
        result.setResult(StorageBase::UploadResult::Result::FAILED);
    }

    return result;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
