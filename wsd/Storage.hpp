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

// Storage abstraction.

#pragma once

#include <memory>
#include <string>
#include <chrono>

#include <Poco/URI.h>
#include <Poco/Util/Application.h>

#include "HttpRequest.hpp"
#include "COOLWSD.hpp"
#include "Log.hpp"
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
        FileInfo(std::size_t size, std::string filename, std::string ownerId,
                 std::string modifiedTime)
            : _size(size)
            , _filename(std::move(filename))
            , _ownerId(std::move(ownerId))
            , _modifiedTime(std::move(modifiedTime))
        {
        }

        FileInfo(const FileInfo& fileInfo)
            : _size(fileInfo._size)
            , _filename(fileInfo._filename)
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

        std::size_t getSize() const { return _size; }

        const std::string& getFilename() const { return _filename; }

        const std::string& getOwnerId() const { return _ownerId; }

        /// Set the last modified time as reported to the WOPI host.
        void setLastModifiedTime(const std::string& modifiedTime) { _modifiedTime = modifiedTime; }

        /// Get the last modified time as reported by the WOPI host, empty if unsafe to rely on
        const std::string& getLastModifiedTime() const { return _modifiedTime; }

        /// Sometimes an up-load fails, leaving our timestamp in an unknown state
        bool isLastModifiedTimeSafe() const { return !_modifiedTime.empty(); }

        /// Set last modified time as unsafe
        void setLastModifiedTimeUnSafe() { _modifiedTime.clear(); }

    private:
        std::size_t _size;
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
    StorageBase(const Poco::URI& uri, const std::string& localStorePath,
                const std::string& jailPath)
        : _localStorePath(localStorePath)
        , _jailPath(jailPath)
        , _fileInfo(/*size=*/0, /*filename=*/std::string(), /*ownerId=*/"cool",
                    /*modifiledTime=*/std::string())
        , _isDownloaded(false)
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
    void setLastModifiedTime(const std::string& modifiedTime) { _fileInfo.setLastModifiedTime(modifiedTime); }
    bool isLastModifiedTimeSafe() const { return _fileInfo.isLastModifiedTimeSafe(); }
    void setLastModifiedTimeUnSafe() { _fileInfo.setLastModifiedTimeUnSafe(); }

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
#if !MOBILEAPP
               Wopi //< WOPI-like storage.
#endif //!MOBILEAPP
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
    void sanitizeUri(Poco::URI& uri)
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
    }

    /// Saves new URI when resource was moved
    void setUri(const Poco::URI& uri)
    {
        _uri = uri;
        sanitizeUri(_uri);
    }

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
                 const std::string& jailPath, [[maybe_unused]] bool isTemporaryFile)
        : StorageBase(uri, localStorePath, jailPath)
#if !MOBILEAPP
        , _isTemporaryFile(isTemporaryFile)
#endif
        , _isCopy(false)
    {
        LOG_INF("LocalStorage ctor with localStorePath: ["
                << localStorePath << "], jailPath: [" << jailPath << "], uri: ["
                << COOLWSD::anonymizeUrl(uri.toString()) << "].");
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

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
