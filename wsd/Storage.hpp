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
#include "HttpRequest.hpp"
#include "COOLWSD.hpp"
#include "Log.hpp"
#include "Util.hpp"
#include <common/Authorization.hpp>
#include <net/HttpRequest.hpp>

/// Limits number of HTTP redirections to prevent from redirection loops
static constexpr auto RedirectionLimit = 21;

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

    LockContext()
        : _supportsLocks(false)
        , _isLocked(false)
        , _refreshSeconds(COOLWSD::getConfigValue<int>("storage.wopi.locking.refresh", 900))
    {
    }

    /// one-time setup for supporting locks & create token
    void initSupportsLocks();

    /// wait another refresh cycle
    void bumpTimer()
    {
        _lastLockTime = std::chrono::steady_clock::now();
    }

    /// do we need to refresh our lock ?
    bool needsRefresh(const std::chrono::steady_clock::time_point &now) const;

    void dumpState(std::ostream& os) const;

private:
    const std::chrono::seconds _refreshSeconds;
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
        FileInfo(std::string filename, std::string ownerId, std::string modifiedTime)
            : _filename(std::move(filename))
            , _ownerId(std::move(ownerId))
            , _modifiedTime(std::move(modifiedTime))
        {
        }

        FileInfo(const FileInfo& fileInfo)
            : _filename(fileInfo._filename)
            , _ownerId(fileInfo._ownerId)
            , _modifiedTime(fileInfo._modifiedTime)
        {
        }

        FileInfo& operator=(const FileInfo& rhs)
        {
            if (this != &rhs)
            {
                _filename = rhs._filename;
                _ownerId = rhs._ownerId;
                _modifiedTime = rhs._modifiedTime;
            }

            return *this;
        }

        bool isValid() const
        {
            // 0-byte files are valid; LO will open them as new docs.
            return !_filename.empty();
        }

        const std::string& getFilename() const { return _filename; }

        const std::string& getOwnerId() const { return _ownerId; }

        /// Set the last modified time as reported to the WOPI host.
        void setLastModifiedTime(const std::string& modifiedTime) { _modifiedTime = modifiedTime; }

        /// Get the last modified time as reported by the WOPI host.
        const std::string& getLastModifiedTime() const { return _modifiedTime; }

    private:
        std::string _filename;
        std::string _ownerId;
        std::string _modifiedTime; //< Opaque modified timestamp as received from the server.
    };

    /// Represents attributes of interest to the storage.
    /// These are typically set in the PUT headers.
    /// They include flags to indicate auto-save, exit-save,
    /// forced-uploading, and whether or not the document
    /// had been modified, amongst others.
    /// The reason for this class is to avoid clobbering
    /// these attributes when uploading fails--or indeed
    /// racing with uploading.
    class Attributes
    {
    public:
        Attributes()
            : _forced(false)
            , _isUserModified(false)
            , _isAutosave(false)
            , _isExitSave(false)
        {}

        /// Reset the attributes to clear them after using them.
        void reset()
        {
            _forced = false;
            _isUserModified = false;
            _isAutosave = false;
            _isExitSave = false;
            _extendedData.clear();
        }

        void merge(const Attributes& lhs)
        {
            // Whichever is true.
            _forced = lhs._forced ? true : _forced;
            _isUserModified = lhs._isUserModified ? true : _isUserModified;
            _isAutosave = lhs._isAutosave ? true : _isAutosave;
            _isExitSave = lhs._isExitSave ? true : _isExitSave;

            // Clobber with the lhs, assuming it's newer.
            if (!lhs._extendedData.empty())
                _extendedData = lhs._extendedData;
        }

        /// Asks the storage object to force overwrite
        /// even if document turned out to be changed in storage.
        /// Used to resolve storage conflicts by clobbering.
        void setForced(bool forced = true) { _forced = forced; }
        bool isForced() const { return _forced; }

        /// To be able to set the WOPI extension header appropriately.
        void setUserModified(bool userModified) { _isUserModified = userModified; }
        bool isUserModified() const { return _isUserModified; }

        /// To be able to set the WOPI 'is autosave/is exitsave?' headers appropriately.
        void setIsAutosave(bool newIsAutosave) { _isAutosave = newIsAutosave; }
        bool isAutosave() const { return _isAutosave; }

        /// Set only when saving on exit.
        void setIsExitSave(bool exitSave) { _isExitSave = exitSave; }
        bool isExitSave() const { return _isExitSave; }

        /// Misc extended data.
        void setExtendedData(const std::string& extendedData) { _extendedData = extendedData; }
        const std::string& getExtendedData() const { return _extendedData; }

        /// Dump the internals of this instance.
        void dumpState(std::ostream& os, const std::string& indent = "\n  ") const
        {
            os << indent << "forced: " << std::boolalpha << isForced();
            os << indent << "user-modified: " << std::boolalpha << isUserModified();
            os << indent << "auto-save: " << std::boolalpha << isAutosave();
            os << indent << "exit-save: " << std::boolalpha << isExitSave();
            os << indent << "extended-data: " << getExtendedData();
        }

    private:
        /// Whether or not we want to force uploading.
        bool _forced;
        /// The document has been modified by the user.
        bool _isUserModified;
        /// This save operation is an autosave.
        bool _isAutosave;
        /// Saving on exit (when the document is cleaned up from memory)
        bool _isExitSave;
        /// The client-provided saving extended data to send to the WOPI host.
        std::string _extendedData;
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
            TOO_LARGE, //< 413
            UNAUTHORIZED, //< 401, 403, 404
            DOC_CHANGED, /**< Document changed in storage */
            CONFLICT, //< 409
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

    /// The state of an asynchronous upload request.
    class AsyncUpload final
    {
    public:
        enum class State
        {
            None, //< No async upload in progress or isn't supported.
            Running, //< An async upload request is in progress.
            Error, //< Failed to make an async upload request or timed out, no UploadResult.
            Complete //< The last async upload request completed (regardless of the server's response).
        };

        AsyncUpload(State state, UploadResult result)
            : _state(state)
            , _result(std::move(result))
        {
        }

        /// Returns the state of the async upload.
        State state() const { return _state; }

        /// Returns the result of the async upload.
        const UploadResult& result() const { return _result; }

    private:
        State _state;
        UploadResult _result;
    };

    enum class COOLStatusCode
    {
        DOC_CHANGED = 1010 // Document changed externally in storage
    };

    /// localStorePath the absolute root path of the chroot.
    /// jailPath the path within the jail that the child uses.
    StorageBase(const Poco::URI& uri,
                const std::string& localStorePath,
                const std::string& jailPath) :
        _localStorePath(localStorePath),
        _jailPath(jailPath),
        _fileInfo(std::string(), "cool", std::string()),
        _isDownloaded(false)
    {
        setUri(uri);
        LOG_DBG("Storage ctor: " << COOLWSD::anonymizeUrl(_uri.toString()));
    }

    virtual ~StorageBase() { LOG_TRC("~StorageBase " << _uri.toString()); }

    const Poco::URI& getUri() const { return _uri; }

    const std::string& getJailPath() const { return _jailPath; };

    /// Returns the root path to the jailed file.
    const std::string& getRootFilePath() const { return _jailedFilePath; };

    /// Returns the root path to the jailed file to be uploaded.
    std::string getRootFilePathToUpload() const { return _jailedFilePath + TO_UPLOAD_SUFFIX; };

    /// Returns the root path to the jailed file being uploaded.
    std::string getRootFilePathUploading() const
    {
        return _jailedFilePath + TO_UPLOAD_SUFFIX + UPLOADING_SUFFIX;
    };

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

    void setDownloaded(bool loaded) { _isDownloaded = loaded; }

    bool isDownloaded() const { return _isDownloaded; }

    void setFileInfo(const FileInfo& fileInfo) { _fileInfo = fileInfo; }

    /// Returns the basic information about the file.
    const FileInfo& getFileInfo() const { return _fileInfo; }

    const std::string& getLastModifiedTime() const { return _fileInfo.getLastModifiedTime(); }
    void setLastModifiedTime(const std::string& modifiedTime)
    {
        _fileInfo.setLastModifiedTime(modifiedTime);
    }

    std::string getFileExtension() const { return Poco::Path(_fileInfo.getFilename()).getExtension(); }

    STATE_ENUM(LockUpdateResult,
               UNSUPPORTED, //< Locking is not supported on this host.
               OK, //< Succeeded to either lock or unlock (see LockContext).
               UNAUTHORIZED, //< 401, 403, 404.
               FAILED //< Other failures.
    );

    /// Update the locking state (check-in/out) of the associated file
    virtual LockUpdateResult updateLockState(const Authorization& auth, LockContext& lockCtx,
                                             bool lock, const Attributes& attribs) = 0;

    /// Returns a local file path for the given URI.
    /// If necessary copies the file locally first.
    virtual std::string downloadStorageFileToLocal(const Authorization& auth, LockContext& lockCtx,
                                                   const std::string& templateUri) = 0;

    /// The asynchronous upload completion callback function.
    using AsyncUploadCallback = std::function<void(const AsyncUpload&)>;

    /// Writes the contents of the file back to the source asynchronously, if possible.
    /// @param savedFile When the operation was saveAs, this is the path to the file that was saved.
    /// @param asyncUploadCallback Used to communicate the result back to the caller.
    virtual void uploadLocalFileToStorageAsync(const Authorization& auth, LockContext& lockCtx,
                                               const std::string& saveAsPath,
                                               const std::string& saveAsFilename,
                                               const bool isRename, const Attributes&, SocketPoll&,
                                               const AsyncUploadCallback& asyncUploadCallback) = 0;

    /// Get the progress state of an asynchronous LocalFileToStorage upload.
    virtual AsyncUpload queryLocalFileToStorageAsyncUploadState()
    {
        // Unsupported.
        return AsyncUpload(AsyncUpload::State::None, UploadResult(UploadResult::Result::OK));
    }

    /// Cancels an active asynchronous LocalFileToStorage upload.
    virtual void cancelLocalFileToStorageAsyncUpload()
    {
        // By default, nothing to do.
    }

    /// Must be called at startup to configure.
    static void initialize();

    STATE_ENUM(StorageType,
               Unsupported, //< An unsupported type.
               Unauthorized, //< The host is not allowed by the admin.
               FileSystem, //< File-System storage. Only for testing.
               Wopi //< WOPI-like storage.
    );

    /// Validates the given URI.
    static StorageType validate(const Poco::URI& uri, bool takeOwnership);

    /// Storage object creation factory.
    /// @takeOwnership is for local files that are temporary,
    /// such as convert-to requests.
    static std::unique_ptr<StorageBase> create(const Poco::URI& uri, const std::string& jailRoot,
                                               const std::string& jailPath, bool takeOwnership);

    static Poco::Net::HTTPClientSession* getHTTPClientSession(const Poco::URI& uri);
    static std::shared_ptr<http::Session> getHttpSession(const Poco::URI& uri);

protected:

    /// Sanitize a URI by removing authorization tokens.
    Poco::URI sanitizeUri(Poco::URI uri)
    {
        static const std::string access_token("access_token");

        Poco::URI::QueryParameters queryParams = uri.getQueryParameters();
        for (auto& param : queryParams)
        {
            // Sanitize more params as needed.
            if (param.first == access_token)
            {
                // If access_token exists, clear it. But don't add it if not provided.
                param.second.clear();
                uri.setQueryParameters(queryParams);
                break;
            }
        }

        return uri;
    }

    /// Saves new URI when resource was moved
    void setUri(const Poco::URI& uri) { _uri = sanitizeUri(uri); }

    /// Returns the root path of the jail directory of docs.
    std::string getLocalRootPath() const;

private:
    Poco::URI _uri;
    const std::string _localStorePath;
    const std::string _jailPath;
    std::string _jailedFilePath;
    std::string _jailedFilePathAnonym;
    FileInfo _fileInfo;
    bool _isDownloaded;

    static bool FilesystemEnabled;
    /// If true, use only the WOPI URL for whether to use SSL to talk to storage server
    static bool SSLAsScheme;
    /// If true, force SSL communication with storage server
    static bool SSLEnabled;
};

/// Trivial implementation of local storage that does not need do anything.
class LocalStorage : public StorageBase
{
public:
    LocalStorage(const Poco::URI& uri, const std::string& localStorePath,
                 const std::string& jailPath, bool isTemporaryFile)
        : StorageBase(uri, localStorePath, jailPath)
#if !MOBILEAPP
        , _isTemporaryFile(isTemporaryFile)
#endif
        , _isCopy(false)
    {
        LOG_INF("LocalStorage ctor with localStorePath: [" << localStorePath <<
                "], jailPath: [" << jailPath << "], uri: [" << COOLWSD::anonymizeUrl(uri.toString()) << "].");
#if MOBILEAPP
        (void) isTemporaryFile;
#endif
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

    LockUpdateResult updateLockState(const Authorization&, LockContext&, bool,
                                     const Attributes&) override
    {
        return LockUpdateResult::OK;
    }

    std::string downloadStorageFileToLocal(const Authorization& auth, LockContext& lockCtx,
                                           const std::string& templateUri) override;

    void uploadLocalFileToStorageAsync(const Authorization& auth, LockContext& lockCtx,
                                       const std::string& saveAsPath,
                                       const std::string& saveAsFilename, const bool isRename,
                                       const Attributes&, SocketPoll&,
                                       const AsyncUploadCallback& asyncUploadCallback) override;

private:
#if !MOBILEAPP
    /// True if we the source file a temporary that we own.
    /// Typically for convert-to requests.
    const bool _isTemporaryFile;
#endif
    /// True if the jailed file is not linked but copied.
    bool _isCopy;
    static std::atomic<unsigned> LastLocalStorageId;
};

/// WOPI protocol backed storage.
class WopiStorage : public StorageBase
{
public:
    WopiStorage(const Poco::URI& uri, const std::string& localStorePath,
                const std::string& jailPath)
        : StorageBase(uri, localStorePath, jailPath)
        , _wopiSaveDuration(std::chrono::milliseconds::zero())
    {
        LOG_INF("WopiStorage ctor with localStorePath: ["
                << localStorePath << "], jailPath: [" << jailPath << "], uri: ["
                << COOLWSD::anonymizeUrl(uri.toString()) << ']');
    }

    class WOPIFileInfo : public FileInfo
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
        WOPIFileInfo(const FileInfo& fileInfo, const Poco::JSON::Object::Ptr& object,
                     const Poco::URI& uriObject);

        const std::string& getUserId() const { return _userId; }
        const std::string& getUsername() const { return _username; }
        const std::string& getUserExtraInfo() const { return _userExtraInfo; }
        const std::string& getUserPrivateInfo() const { return _userPrivateInfo; }
        const std::string& getWatermarkText() const { return _watermarkText; }
        const std::string& getTemplateSaveAs() const { return _templateSaveAs; }
        const std::string& getTemplateSource() const { return _templateSource; }
        const std::string& getBreadcrumbDocName() const { return _breadcrumbDocName; }
        const std::string& getFileUrl() const { return _fileUrl; }
        const std::string& getPostMessageOrigin() { return _postMessageOrigin; }
        const std::string& getHideUserList() { return _hideUserList; }

        bool getUserCanWrite() const { return _userCanWrite; }
        void setHidePrintOption(bool hidePrintOption) { _hidePrintOption = hidePrintOption; }
        bool getHidePrintOption() const { return _hidePrintOption; }
        bool getHideSaveOption() const { return _hideSaveOption; }
        void setHideExportOption(bool hideExportOption) { _hideExportOption = hideExportOption; }
        bool getHideExportOption() const { return _hideExportOption; }
        void setHideRepairOption(bool hideRepairOption) { _hideRepairOption = hideRepairOption; }
        bool getHideRepairOption() const { return _hideRepairOption; }
        bool getEnableOwnerTermination() const { return _enableOwnerTermination; }
        bool getDisablePrint() const { return _disablePrint; }
        bool getDisableExport() const { return _disableExport; }
        bool getDisableCopy() const { return _disableCopy; }
        bool getDisableInactiveMessages() const { return _disableInactiveMessages; }
        bool getDownloadAsPostMessage() const { return _downloadAsPostMessage; }
        bool getUserCanNotWriteRelative() const { return _userCanNotWriteRelative; }
        bool getEnableInsertRemoteImage() const { return _enableInsertRemoteImage; }
        bool getEnableRemoteLinkPicker() const { return _enableRemoteLinkPicker; }
        bool getEnableShare() const { return _enableShare; }
        bool getSupportsRename() const { return _supportsRename; }
        bool getSupportsLocks() const { return _supportsLocks; }
        bool getUserCanRename() const { return _userCanRename; }

        TriState getDisableChangeTrackingShow() const { return _disableChangeTrackingShow; }
        TriState getDisableChangeTrackingRecord() const { return _disableChangeTrackingRecord; }
        TriState getHideChangeTrackingControls() const { return _hideChangeTrackingControls; }

    private:
        /// User id of the user accessing the file
        std::string _userId;
        /// Obfuscated User id used for logging the UserId.
        std::string _obfuscatedUserId;
        /// Display Name of user accessing the file
        std::string _username;
        /// Extra public info per user, typically mail and other links, as json, shared with everyone.
        std::string _userExtraInfo;
        /// Private info per user, for API keys and other non-public information.
        std::string _userPrivateInfo;
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
        /// WOPI Post message property
        std::string _postMessageOrigin;
        /// If set to "true", user list on the status bar will be hidden
        /// If set to "mobile" | "tablet" | "desktop", will be hidden on a specified device
        /// (may be joint, delimited by commas eg. "mobile,tablet")
        std::string _hideUserList;
        /// If we should disable change-tracking visibility by default (meaningful at loading).
        TriState _disableChangeTrackingShow = WOPIFileInfo::TriState::Unset;
        /// If we should disable change-tracking ability by default (meaningful at loading).
        TriState _disableChangeTrackingRecord = WOPIFileInfo::TriState::Unset;
        /// If we should hide change-tracking commands for this user.
        TriState _hideChangeTrackingControls = WOPIFileInfo::TriState::Unset;
        /// If user accessing the file has write permission
        bool _userCanWrite = false;
        /// Hide print button from UI
        bool _hidePrintOption = false;
        /// Hide save button from UI
        bool _hideSaveOption = false;
        /// Hide 'Download as' button/menubar item from UI
        bool _hideExportOption = false;
        /// Hide the 'Repair' button/item from the UI
        bool _hideRepairOption = false;
        /// If WOPI host has enabled owner termination feature on
        bool _enableOwnerTermination = false;
        /// If WOPI host has allowed the user to print the document
        bool _disablePrint = false;
        /// If WOPI host has allowed the user to export the document
        bool _disableExport = false;
        /// If WOPI host has allowed the user to copy to/from the document
        bool _disableCopy = false;
        /// If WOPI host has allowed the cool to show texts on the overlay informing about
        /// inactivity, or if the integration is handling that.
        bool _disableInactiveMessages = false;
        /// For the (mobile) integrations, to indicate that the downloading for printing, exporting,
        /// or slideshows should be intercepted and sent as a postMessage instead of handling directly.
        bool _downloadAsPostMessage = false;
        /// If set to false, users can access the save-as functionality
        bool _userCanNotWriteRelative = true;
        /// If set to true, users can access the insert remote image functionality
        bool _enableInsertRemoteImage = false;
        /// If set to true, users can access the remote link picker functionality
        bool _enableRemoteLinkPicker = false;
        /// If set to true, users can access the file share functionality
        bool _enableShare = false;
        /// If WOPI host supports locking
        bool _supportsLocks = false;
        /// If WOPI host supports rename
        bool _supportsRename = false;
        /// If user is allowed to rename the document
        bool _userCanRename = false;
    };

    /// Returns the response of CheckFileInfo WOPI call for URI that was
    /// provided during the initial creation of the WOPI storage.
    /// Also extracts the basic file information from the response
    /// which can then be obtained using getFileInfo()
    /// Also sets up the locking context for future operations.
    std::unique_ptr<WOPIFileInfo> getWOPIFileInfo(const Authorization& auth, LockContext& lockCtx);
    /// Implementation of getWOPIFileInfo for specific URI
    std::unique_ptr<WOPIFileInfo> getWOPIFileInfoForUri(Poco::URI uriObject,
                                                        const Authorization& auth,
                                                        LockContext& lockCtx,
                                                        unsigned redirectLimit);

    /// Update the locking state (check-in/out) of the associated file
    LockUpdateResult updateLockState(const Authorization& auth, LockContext& lockCtx, bool lock,
                                     const Attributes& attribs) override;

    /// uri format: http://server/<...>/wopi*/files/<id>/content
    std::string downloadStorageFileToLocal(const Authorization& auth, LockContext& lockCtx,
                                           const std::string& templateUri) override;

    void uploadLocalFileToStorageAsync(const Authorization& auth, LockContext& lockCtx,
                                       const std::string& saveAsPath,
                                       const std::string& saveAsFilename, const bool isRename,
                                       const Attributes&, SocketPoll& socketPoll,
                                       const AsyncUploadCallback& asyncUploadCallback) override;

    /// Total time taken for making WOPI calls during uploading.
    std::chrono::milliseconds getWopiSaveDuration() const { return _wopiSaveDuration; }

    virtual AsyncUpload queryLocalFileToStorageAsyncUploadState() override
    {
        if (_uploadHttpSession)
            return AsyncUpload(AsyncUpload::State::Running, UploadResult(UploadResult::Result::OK));
        else
            return AsyncUpload(AsyncUpload::State::None, UploadResult(UploadResult::Result::OK));
    }

protected:
    struct WopiUploadDetails
    {
        const std::string filePathAnonym;
        const std::string uriAnonym;
        const std::string httpResponseReason;
        const http::StatusCode httpResponseCode;
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
                         const Authorization& auth) const;

    /// Create an http::Request with the common headers.
    http::Request initHttpRequest(const Poco::URI& uri, const Authorization& auth) const;

    /// Download the document from the given URI.
    /// Does not add authorization tokens or any other logic.
    std::string downloadDocument(const Poco::URI& uriObject, const std::string& uriAnonym,
                                 const Authorization& auth, unsigned redirectLimit);

private:
    /// A URl provided by the WOPI host to use for GetFile.
    std::string _fileUrl;

    // Time spend in saving the file from storage
    std::chrono::milliseconds _wopiSaveDuration;

    /// The http::Session used for uploading asynchronously.
    std::shared_ptr<http::Session> _uploadHttpSession;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
