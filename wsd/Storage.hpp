/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Storage abstraction.

#pragma once

#include <set>
#include <string>
#include <chrono>

#include <Poco/URI.h>
#include <Poco/Util/Application.h>
#include <Poco/JSON/Object.h>

#include "Auth.hpp"
#include "LOOLWSD.hpp"
#include "Log.hpp"
#include "Util.hpp"
#include <common/Authorization.hpp>
#include <net/HttpRequest.hpp>

namespace Poco
{
namespace Net
{
class HTTPClientSession;
}

} // namespace Poco

/// Represents whether the underlying file is locked
/// and with what token.
struct LockContext
{
    /// Do we have support for locking for a storage.
    bool        _supportsLocks;
    /// Do we own the (leased) lock currently
    bool        _isLocked;
    /// Name if we need it to use consistently for locking
    std::string _lockToken;
    /// Time of last successful lock (re-)acquisition
    std::chrono::steady_clock::time_point _lastLockTime;
    /// Reason for unsuccessful locking request
    std::string _lockFailureReason;

    LockContext() : _supportsLocks(false), _isLocked(false) { }

    /// one-time setup for supporting locks & create token
    void initSupportsLocks();

    /// do we need to refresh our lock ?
    bool needsRefresh(const std::chrono::steady_clock::time_point &now) const;

    void dumpState(std::ostream& os) const;
};

/// Base class of all Storage abstractions.
class StorageBase
{
public:
    /// Represents basic file's attributes.
    /// Used for local and network files.
    class FileInfo
    {
    public:
        FileInfo(const std::string& filename,
                 const std::string& ownerId,
                 const std::chrono::system_clock::time_point& modifiedTime,
                 size_t /*size*/)
            : _filename(filename),
              _ownerId(ownerId),
              _modifiedTime(modifiedTime)
        {
        }

        bool isValid() const
        {
            // 0-byte files are valid; LO will open them as new docs.
            return !_filename.empty();
        }

        const std::string& getFilename() const { return _filename; }

        const std::string& getOwnerId() const { return _ownerId; }

        void setModifiedTime(const std::chrono::system_clock::time_point& modifiedTime) { _modifiedTime = modifiedTime; }

        const std::chrono::system_clock::time_point& getModifiedTime() const { return _modifiedTime; }

    private:
        std::string _filename;
        std::string _ownerId;
        std::chrono::system_clock::time_point _modifiedTime;
    };

    /// Represents the upload request result, with a Result code
    /// and a reason message (typically for errors).
    /// Note: the reason message may be displayed to the clients.
    class UploadResult final
    {
    public:
        enum class Result
        {
            OK = 0,
            DISKFULL,
            UNAUTHORIZED,
            DOC_CHANGED, /**< Document changed in storage */
            CONFLICT,
            FAILED
        };

        explicit UploadResult(Result result)
            : _result(result)
        {
        }

        UploadResult(Result result, std::string reason)
            : _result(result)
            , _reason(std::move(reason))
        {
        }

        void setResult(Result result) { _result = result; }

        Result getResult() const { return _result; }

        void setSaveAsResult(const std::string& name, const std::string& url)
        {
            _saveAsName = name;
            _saveAsUrl = url;
        }

        const std::string& getSaveAsName() const { return _saveAsName; }

        const std::string& getSaveAsUrl() const { return _saveAsUrl; }

        void setReason(const std::string& msg) { _reason = msg; }

        const std::string& getReason() const { return _reason; }

    private:
        Result _result;
        std::string _saveAsName;
        std::string _saveAsUrl;
        std::string _reason;
    };

    enum class LOOLStatusCode
    {
        DOC_CHANGED = 1010 // Document changed externally in storage
    };

    /// localStorePath the absolute root path of the chroot.
    /// jailPath the path within the jail that the child uses.
    StorageBase(const Poco::URI& uri,
                const std::string& localStorePath,
                const std::string& jailPath) :
        _uri(uri),
        _localStorePath(localStorePath),
        _jailPath(jailPath),
        _fileInfo("", "lool", std::chrono::system_clock::time_point(), 0),
        _isLoaded(false),
        _forceSave(false),
        _isUserModified(false),
        _isAutosave(false),
        _isExitSave(false)
    {
        LOG_DBG("Storage ctor: " << LOOLWSD::anonymizeUrl(uri.toString()));
    }

    virtual ~StorageBase() {}

    const Poco::URI& getUri() const { return _uri; }

    const std::string getUriString() const { return _uri.toString(); }

    const std::string& getJailPath() const { return _jailPath; };

    /// Returns the root path to the jailed file.
    const std::string& getRootFilePath() const { return _jailedFilePath; };

    /// Set the root path of the jailed file, only for use in cases where we actually have converted
    /// it to another format, in the same directory
    void setRootFilePath(const std::string& newPath)
    {
        // Could assert here that it is in the same directory?
        _jailedFilePath = newPath;
    }

    const std::string& getRootFilePathAnonym() const { return _jailedFilePathAnonym; };

    void setRootFilePathAnonym(const std::string& newPath)
    {
        _jailedFilePathAnonym = newPath;
    }

    void setLoaded(bool loaded) { _isLoaded = loaded; }

    bool isLoaded() const { return _isLoaded; }

    /// Asks the storage object to force overwrite to storage upon next save
    /// even if document turned out to be changed in storage
    void forceSave(bool newSave = true) { _forceSave = newSave; }

    bool getForceSave() const { return _forceSave; }

    /// To be able to set the WOPI extension header appropriately.
    void setUserModified(bool userModified) { _isUserModified = userModified; }

    bool isUserModified() const { return _isUserModified; }

    /// To be able to set the WOPI 'is autosave/is exitsave?' headers appropriately.
    void setIsAutosave(bool newIsAutosave) { _isAutosave = newIsAutosave; }
    bool isAutosave() const { return _isAutosave; }
    void setIsExitSave(bool exitSave) { _isExitSave = exitSave; }
    bool isExitSave() const { return _isExitSave; }
    void setExtendedData(const std::string& extendedData) { _extendedData = extendedData; }

    void setFileInfo(const FileInfo& fileInfo) { _fileInfo = fileInfo; }

    /// Returns the basic information about the file.
    FileInfo& getFileInfo() { return _fileInfo; }

    std::string getFileExtension() const { return Poco::Path(_fileInfo.getFilename()).getExtension(); }

    /// Update the locking state (check-in/out) of the associated file
    virtual bool updateLockState(const Authorization& auth, const std::string& cookies,
                                 LockContext& lockCtx, bool lock)
        = 0;

    /// Returns a local file path for the given URI.
    /// If necessary copies the file locally first.
    virtual std::string downloadStorageFileToLocal(const Authorization& auth,
                                                   const std::string& cookies, LockContext& lockCtx,
                                                   const std::string& templateUri)
        = 0;

    /// Writes the contents of the file back to the source.
    /// @param cookies A string representing key=value pairs that are set as cookies.
    /// @param savedFile When the operation was saveAs, this is the path to the file that was saved.
    virtual UploadResult
    uploadLocalFileToStorage(const Authorization& auth, const std::string& cookies,
                             LockContext& lockCtx, const std::string& saveAsPath,
                             const std::string& saveAsFilename, const bool isRename)
        = 0;

    /// Must be called at startup to configure.
    static void initialize();

    /// Storage object creation factory.
    static std::unique_ptr<StorageBase> create(const Poco::URI& uri,
                                               const std::string& jailRoot,
                                               const std::string& jailPath);

    static bool allowedWopiHost(const std::string& host);
    static Poco::Net::HTTPClientSession* getHTTPClientSession(const Poco::URI& uri);
    static std::shared_ptr<http::Session> getHttpSession(const Poco::URI& uri);

protected:

    /// Returns the root path of the jail directory of docs.
    std::string getLocalRootPath() const;

    /// Returns the client-provided extended data to send to the WOPI host.
    const std::string& getExtendedData() const { return _extendedData; }

private:
    const Poco::URI _uri;
    const std::string _localStorePath;
    const std::string _jailPath;
    std::string _jailedFilePath;
    std::string _jailedFilePathAnonym;
    FileInfo _fileInfo;
    bool _isLoaded;
    bool _forceSave;

    /// The document has been modified by the user.
    bool _isUserModified;

    /// This save operation is an autosave.
    bool _isAutosave;
    /// Saving on exit (when the document is cleaned up from memory)
    bool _isExitSave;
    /// The client-provided saving extended data to send to the WOPI host.
    std::string _extendedData;

    static bool FilesystemEnabled;
    static bool WopiEnabled;
    /// If true, use only the WOPI URL for whether to use SSL to talk to storage server
    static bool SSLAsScheme;
    /// If true, force SSL communication with storage server
    static bool SSLEnabled;
    /// Allowed/denied WOPI hosts, if any and if WOPI is enabled.
    static Util::RegexListMatcher WopiHosts;
};

/// Trivial implementation of local storage that does not need do anything.
class LocalStorage : public StorageBase
{
public:
    LocalStorage(const Poco::URI& uri,
                 const std::string& localStorePath,
                 const std::string& jailPath) :
        StorageBase(uri, localStorePath, jailPath),
        _isCopy(false)
    {
        LOG_INF("LocalStorage ctor with localStorePath: [" << localStorePath <<
                "], jailPath: [" << jailPath << "], uri: [" << LOOLWSD::anonymizeUrl(uri.toString()) << "].");
    }

    class LocalFileInfo
    {
    public:
        LocalFileInfo(const std::string& userId,
                      const std::string& username)
            : _userId(userId),
              _username(username)
        {
        }

        const std::string& getUserId() const { return _userId; }
        const std::string& getUsername() const { return _username; }

    private:
        std::string _userId;
        std::string _username;
    };

    /// Returns the URI specific file data
    /// Also stores the basic file information which can then be
    /// obtained using getFileInfo method
    std::unique_ptr<LocalFileInfo> getLocalFileInfo();

    bool updateLockState(const Authorization&, const std::string&, LockContext&, bool) override
    {
        return true;
    }

    std::string downloadStorageFileToLocal(const Authorization& auth,
                                           const std::string& /*cookies*/, LockContext& lockCtx,
                                           const std::string& templateUri) override;

    UploadResult uploadLocalFileToStorage(const Authorization& auth, const std::string& /*cookies*/,
                                          LockContext& lockCtx, const std::string& saveAsPath,
                                          const std::string& saveAsFilename,
                                          const bool isRename) override;

private:
    /// True if the jailed file is not linked but copied.
    bool _isCopy;
    static std::atomic<unsigned> LastLocalStorageId;
};

/// WOPI protocol backed storage.
class WopiStorage : public StorageBase
{
public:
    WopiStorage(const Poco::URI& uri,
                const std::string& localStorePath,
                const std::string& jailPath) :
        StorageBase(uri, localStorePath, jailPath),
        _reuseCookies(false)
    {
        const auto& app = Poco::Util::Application::instance();
        _reuseCookies = app.config().getBool("storage.wopi.reuse_cookies", false);
        LOG_INF("WopiStorage ctor with localStorePath: ["
                << localStorePath << "], jailPath: [" << jailPath << "], uri: ["
                << LOOLWSD::anonymizeUrl(uri.toString()) << "], reuseCookies: [" << _reuseCookies
                << "].");
    }

    class WOPIFileInfo
    {
        void init();
    public:
        enum class TriState
        {
            False,
            True,
            Unset
        };

        /// warning - removes items from object.
        WOPIFileInfo(const FileInfo& fileInfo, std::chrono::milliseconds callDurationMs,
                     Poco::JSON::Object::Ptr& object);

        const std::string& getUserId() const { return _userId; }
        const std::string& getUsername() const { return _username; }
        const std::string& getUserExtraInfo() const { return _userExtraInfo; }
        const std::string& getWatermarkText() const { return _watermarkText; }
        const std::string& getTemplateSaveAs() const { return _templateSaveAs; }
        const std::string& getTemplateSource() const { return _templateSource; }
        const std::string& getBreadcrumbDocName() const { return _breadcrumbDocName; }
        const std::string& getFileUrl() const { return _fileUrl; }

        bool getUserCanWrite() const { return _userCanWrite; }
        std::string& getPostMessageOrigin() { return _postMessageOrigin; }
        void setHidePrintOption(bool hidePrintOption) { _hidePrintOption = hidePrintOption; }
        bool getHidePrintOption() const { return _hidePrintOption; }
        bool getHideSaveOption() const { return _hideSaveOption; }
        void setHideExportOption(bool hideExportOption) { _hideExportOption = hideExportOption; }
        bool getHideExportOption() const { return _hideExportOption; }
        bool getEnableOwnerTermination() const { return _enableOwnerTermination; }
        bool getDisablePrint() const { return _disablePrint; }
        bool getDisableExport() const { return _disableExport; }
        bool getDisableCopy() const { return _disableCopy; }
        bool getDisableInactiveMessages() const { return _disableInactiveMessages; }
        bool getDownloadAsPostMessage() const { return _downloadAsPostMessage; }
        bool getUserCanNotWriteRelative() const { return _userCanNotWriteRelative; }
        bool getEnableInsertRemoteImage() const { return _enableInsertRemoteImage; }
        bool getEnableShare() const { return _enableShare; }
        bool getSupportsRename() const { return _supportsRename; }
        bool getSupportsLocks() const { return _supportsLocks; }
        bool getUserCanRename() const { return _userCanRename; }
        std::string& getHideUserList() { return _hideUserList; }
        TriState getDisableChangeTrackingShow() const { return _disableChangeTrackingShow; }
        TriState getDisableChangeTrackingRecord() const { return _disableChangeTrackingRecord; }
        TriState getHideChangeTrackingControls() const { return _hideChangeTrackingControls; }
        std::chrono::milliseconds getCallDurationMs() const { return _callDurationMs; }
    private:
        /// User id of the user accessing the file
        std::string _userId;
        /// Obfuscated User id used for logging the UserId.
        std::string _obfuscatedUserId;
        /// Display Name of user accessing the file
        std::string _username;
        /// Extra info per user, typically mail and other links, as json.
        std::string _userExtraInfo;
        /// In case a watermark has to be rendered on each tile.
        std::string _watermarkText;
        /// In case we want to use this file as a template, it should be first re-saved under this name (using PutRelativeFile).
        std::string _templateSaveAs;
        /// In case we want to use this file as a template.
        std::string _templateSource;
        /// User readable string of document name to show in UI, if present.
        std::string _breadcrumbDocName;
        /// The optional FileUrl, used to download the document if provided.
        std::string _fileUrl;
        /// If user accessing the file has write permission
        bool _userCanWrite;
        /// WOPI Post message property
        std::string _postMessageOrigin;
        /// Hide print button from UI
        bool _hidePrintOption;
        /// Hide save button from UI
        bool _hideSaveOption;
        /// Hide 'Download as' button/menubar item from UI
        bool _hideExportOption;
        /// If WOPI host has enabled owner termination feature on
        bool _enableOwnerTermination;
        /// If WOPI host has allowed the user to print the document
        bool _disablePrint;
        /// If WOPI host has allowed the user to export the document
        bool _disableExport;
        /// If WOPI host has allowed the user to copy to/from the document
        bool _disableCopy;
        /// If WOPI host has allowed the loleaflet to show texts on the overlay informing about inactivity, or if the integration is handling that.
        bool _disableInactiveMessages;
        /// For the (mobile) integrations, to indicate that the downloading for printing, exporting or slideshows should be intercepted and sent as a postMessage instead of handling directly.
        bool _downloadAsPostMessage;
        /// If set to false, users can access the save-as functionality
        bool _userCanNotWriteRelative;
        /// If set to true, users can access the insert remote image functionality
        bool _enableInsertRemoteImage;
        /// If set to true, users can access the file share functionality
        bool _enableShare;
        /// If set to "true", user list on the status bar will be hidden
        /// If set to "mobile" | "tablet" | "desktop", will be hidden on a specified device
        /// (may be joint, delimited by commas eg. "mobile,tablet")
        std::string _hideUserList;
        /// If we should disable change-tracking visibility by default (meaningful at loading).
        TriState _disableChangeTrackingShow;
        /// If we should disable change-tracking ability by default (meaningful at loading).
        TriState _disableChangeTrackingRecord;
        /// If we should hide change-tracking commands for this user.
        TriState _hideChangeTrackingControls;
        /// If WOPI host supports locking
        bool _supportsLocks;
        /// If WOPI host supports rename
        bool _supportsRename;
        /// If user is allowed to rename the document
        bool _userCanRename;

        /// Time it took to call WOPI's CheckFileInfo
        std::chrono::milliseconds _callDurationMs;
    };

    /// Returns the response of CheckFileInfo WOPI call for URI that was
    /// provided during the initial creation of the WOPI storage.
    /// Also extracts the basic file information from the response
    /// which can then be obtained using getFileInfo()
    /// Also sets up the locking context for future operations.
    std::unique_ptr<WOPIFileInfo> getWOPIFileInfo(const Authorization& auth,
                                                  const std::string& cookies, LockContext& lockCtx);

    /// Update the locking state (check-in/out) of the associated file
    bool updateLockState(const Authorization& auth, const std::string& cookies,
                         LockContext& lockCtx, bool lock) override;

    /// uri format: http://server/<...>/wopi*/files/<id>/content
    std::string downloadStorageFileToLocal(const Authorization& auth,
                                           const std::string& /*cookies*/, LockContext& lockCtx,
                                           const std::string& templateUri) override;

    UploadResult uploadLocalFileToStorage(const Authorization& auth, const std::string& /*cookies*/,
                                          LockContext& lockCtx, const std::string& saveAsPath,
                                          const std::string& saveAsFilename,
                                          const bool isRename) override;

    /// Total time taken for making WOPI calls during load
    std::chrono::milliseconds getWopiLoadDuration() const { return _wopiLoadDuration; }
    std::chrono::milliseconds getWopiSaveDuration() const { return _wopiSaveDuration; }

protected:
    struct WopiUploadDetails
    {
        const std::string filePathAnonym;
        const std::string uriAnonym;
        const std::string httpResponseReason;
        const long httpResponseCode;
        const std::size_t size;
        const bool isSaveAs;
        const bool isRename;
    };

    /// Handles the response from the server when uploading the document.
    UploadResult handleUploadToStorageResponse(const WopiUploadDetails& details,
                                             std::string responseString);

private:
    /// Initialize an HTTPRequest instance with the common settings and headers.
    /// Older Poco versions don't support copying HTTPRequest objects, so we can't generate them.
    void initHttpRequest(Poco::Net::HTTPRequest& request, const Poco::URI& uri,
                         const Authorization& auth, const std::string& cookies) const;

    /// Create an http::Request with the common headers.
    http::Request initHttpRequest(const Poco::URI& uri, const Authorization& auth,
                                  const std::string& cookies) const;

    /// Download the document from the given URI.
    /// Does not add authorization tokens or any other logic.
    std::string downloadDocument(const Poco::URI& uriObject, const std::string& uriAnonym,
                                 const Authorization& auth, const std::string& cookies);

private:
    /// A URl provided by the WOPI host to use for GetFile.
    std::string _fileUrl;

    // Time spend in loading the file from storage
    std::chrono::milliseconds _wopiLoadDuration;
    std::chrono::milliseconds _wopiSaveDuration;
    /// Whether or not to re-use cookies from the browser for the WOPI requests.
    bool _reuseCookies;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
