/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Storage abstraction.
#ifndef INCLUDED_STORAGE_HPP
#define INCLUDED_STORAGE_HPP

#include <set>
#include <string>

#include <Poco/URI.h>
#include <Poco/Util/Application.h>

#include "Auth.hpp"
#include "LOOLWSD.hpp"
#include "Log.hpp"
#include "Util.hpp"

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
                 const Poco::Timestamp& modifiedTime,
                 size_t size)
            : _filename(filename),
              _ownerId(ownerId),
              _modifiedTime(modifiedTime),
              _size(size)
        {
        }

        bool isValid() const
        {
            // 0-byte files are valid; LO will open them as new docs.
            return !_filename.empty();
        }

        std::string _filename;
        std::string _ownerId;
        Poco::Timestamp _modifiedTime;
        size_t _size;
    };

    class SaveResult
    {
    public:
        enum Result
        {
            OK,
            DISKFULL,
            UNAUTHORIZED,
            DOC_CHANGED, /**< Document changed in storage */
            CONFLICT,
            FAILED
        };

        SaveResult(Result result) : _result(result)
        {
        }

        void setResult(Result result)
        {
            _result = result;
        }

        Result getResult() const
        {
            return _result;
        }

        void setSaveAsResult(const std::string& name, const std::string& url)
        {
            _saveAsName = name;
            _saveAsUrl = url;
        }

        const std::string& getSaveAsName() const
        {
            return _saveAsName;
        }

        const std::string& getSaveAsUrl() const
        {
            return _saveAsUrl;
        }

    private:
        Result _result;
        std::string _saveAsName;
        std::string _saveAsUrl;
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
        _fileInfo("", "lool", Poco::Timestamp::fromEpochTime(0), 0),
        _isLoaded(false),
        _forceSave(false),
        _isUserModified(false),
        _isAutosave(false)
    {
        LOG_DBG("Storage ctor: " << LOOLWSD::anonymizeUrl(uri.toString()));
    }

    virtual ~StorageBase() {}

    const std::string getUri() const { return _uri.toString(); }

    /// Returns the root path to the jailed file.
    const std::string& getRootFilePath() const { return _jailedFilePath; };

    /// Set the root path of the jailed file, only for use in cases where we actually have converted
    /// it to another format, in the same directory
    void setRootFilePath(const std::string& newPath)
    {
        // Could assert here that it is in the same directory?
        _jailedFilePath = newPath;
    }

    bool isLoaded() const { return _isLoaded; }

    /// Asks the storage object to force overwrite to storage upon next save
    /// even if document turned out to be changed in storage
    void forceSave() { _forceSave = true; }

    /// To be able to set the WOPI extension header appropriately.
    void setUserModified(bool isUserModified) { _isUserModified = isUserModified; }

    /// To be able to set the WOPI 'is autosave?' header appropriately.
    void setIsAutosave(bool isAutosave) { _isAutosave = isAutosave; }
    void setIsExitSave(bool isExitSave) { _isExitSave = isExitSave; }
    bool isExitSave() const { return _isExitSave; }

    /// Returns the basic information about the file.
    const FileInfo& getFileInfo() const { return _fileInfo; }

    std::string getFileExtension() const { return Poco::Path(_fileInfo._filename).getExtension(); }

    /// Returns a local file path for the given URI.
    /// If necessary copies the file locally first.
    virtual std::string loadStorageFileToLocal(const Authorization& auth) = 0;

    /// Writes the contents of the file back to the source.
    /// @param savedFile When the operation was saveAs, this is the path to the file that was saved.
    virtual SaveResult saveLocalFileToStorage(const Authorization& auth, const std::string& saveAsPath, const std::string& saveAsFilename) = 0;

    static size_t getFileSize(const std::string& filename);

    /// Must be called at startup to configure.
    static void initialize();

    /// Storage object creation factory.
    static std::unique_ptr<StorageBase> create(const Poco::URI& uri,
                                               const std::string& jailRoot,
                                               const std::string& jailPath);

    static bool allowedWopiHost(const std::string& host);
protected:

    /// Returns the root path of the jail directory of docs.
    std::string getLocalRootPath() const;

protected:
    const Poco::URI _uri;
    std::string _localStorePath;
    std::string _jailPath;
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

    static bool FilesystemEnabled;
    static bool WopiEnabled;
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

        std::string _userId;
        std::string _username;
    };

    /// Returns the URI specific file data
    /// Also stores the basic file information which can then be
    /// obtained using getFileInfo method
    std::unique_ptr<LocalFileInfo> getLocalFileInfo();

    std::string loadStorageFileToLocal(const Authorization& auth) override;

    SaveResult saveLocalFileToStorage(const Authorization& auth, const std::string& saveAsPath, const std::string& saveAsFilename) override;

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
        _wopiLoadDuration(0)
    {
        LOG_INF("WopiStorage ctor with localStorePath: [" << localStorePath <<
                "], jailPath: [" << jailPath << "], uri: [" << LOOLWSD::anonymizeUrl(uri.toString()) << "].");
    }

    class WOPIFileInfo
    {
    public:
        enum class TriState
        {
            False,
            True,
            Unset
        };

        WOPIFileInfo(const std::string& userid,
                     const std::string& obfuscatedUserId,
                     const std::string& username,
                     const std::string& userExtraInfo,
                     const std::string& watermarkText,
                     const bool userCanWrite,
                     const std::string& postMessageOrigin,
                     const bool hidePrintOption,
                     const bool hideSaveOption,
                     const bool hideExportOption,
                     const bool enableOwnerTermination,
                     const bool disablePrint,
                     const bool disableExport,
                     const bool disableCopy,
                     const bool disableInactiveMessages,
                     const bool userCanNotWriteRelative,
                     const bool enableInsertRemoteImage,
                     const bool enableShare,
                     const TriState disableChangeTrackingShow,
                     const TriState disableChangeTrackingRecord,
                     const TriState hideChangeTrackingControls,
                     const std::chrono::duration<double> callDuration)
            : _userId(userid),
              _obfuscatedUserId(obfuscatedUserId),
              _username(username),
              _watermarkText(watermarkText),
              _userCanWrite(userCanWrite),
              _postMessageOrigin(postMessageOrigin),
              _hidePrintOption(hidePrintOption),
              _hideSaveOption(hideSaveOption),
              _hideExportOption(hideExportOption),
              _enableOwnerTermination(enableOwnerTermination),
              _disablePrint(disablePrint),
              _disableExport(disableExport),
              _disableCopy(disableCopy),
              _disableInactiveMessages(disableInactiveMessages),
              _userCanNotWriteRelative(userCanNotWriteRelative),
              _enableInsertRemoteImage(enableInsertRemoteImage),
              _enableShare(enableShare),
              _disableChangeTrackingShow(disableChangeTrackingShow),
              _disableChangeTrackingRecord(disableChangeTrackingRecord),
              _hideChangeTrackingControls(hideChangeTrackingControls),
              _callDuration(callDuration)
            {
                _userExtraInfo = userExtraInfo;
            }

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
        /// If set to false, users can access the save-as functionality
        bool _userCanNotWriteRelative;
        /// if set to true, users can access the insert remote image functionality
        bool _enableInsertRemoteImage;
        /// if set to true, users can access the file share functionality
        bool _enableShare;
        /// If we should disable change-tracking visibility by default (meaningful at loading).
        TriState _disableChangeTrackingShow;
        /// If we should disable change-tracking ability by default (meaningful at loading).
        TriState _disableChangeTrackingRecord;
        /// If we should hide change-tracking commands for this user.
        TriState _hideChangeTrackingControls;

        /// Time it took to call WOPI's CheckFileInfo
        std::chrono::duration<double> _callDuration;
    };

    /// Returns the response of CheckFileInfo WOPI call for URI that was
    /// provided during the initial creation of the WOPI storage.
    /// Also extracts the basic file information from the response
    /// which can then be obtained using getFileInfo()
    std::unique_ptr<WOPIFileInfo> getWOPIFileInfo(const Authorization& auth);

    /// uri format: http://server/<...>/wopi*/files/<id>/content
    std::string loadStorageFileToLocal(const Authorization& auth) override;

    SaveResult saveLocalFileToStorage(const Authorization& auth, const std::string& saveAsPath, const std::string& saveAsFilename) override;

    /// Total time taken for making WOPI calls during load
    std::chrono::duration<double> getWopiLoadDuration() const { return _wopiLoadDuration; }

private:
    // Time spend in loading the file from storage
    std::chrono::duration<double> _wopiLoadDuration;
};

/// WebDAV protocol backed storage.
class WebDAVStorage : public StorageBase
{
public:
    WebDAVStorage(const Poco::URI& uri,
                  const std::string& localStorePath,
                  const std::string& jailPath,
                  std::unique_ptr<AuthBase> authAgent) :
        StorageBase(uri, localStorePath, jailPath),
        _authAgent(std::move(authAgent))
    {
        LOG_INF("WebDAVStorage ctor with localStorePath: [" << localStorePath <<
                "], jailPath: [" << jailPath << "], uri: [" << LOOLWSD::anonymizeUrl(uri.toString()) << "].");
    }

    // Implement me
    // WebDAVFileInfo getWebDAVFileInfo(const Poco::URI& uriPublic);

    std::string loadStorageFileToLocal(const Authorization& auth) override;

    SaveResult saveLocalFileToStorage(const Authorization& auth, const std::string& saveAsPath, const std::string& saveAsFilename) override;

private:
    std::unique_ptr<AuthBase> _authAgent;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
