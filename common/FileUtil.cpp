/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "FileUtil.hpp"

#include <ftw.h>
#include <sys/stat.h>
#ifdef __linux
#include <sys/vfs.h>
#elif defined IOS
#import <Foundation/Foundation.h>
#endif

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <mutex>
#include <string>

#if HAVE_STD_FILESYSTEM
# if HAVE_STD_FILESYSTEM_EXPERIMENTAL
#  include <experimental/filesystem>
namespace filesystem = ::std::experimental::filesystem;
# else
#  include <filesystem>
namespace filesystem = ::std::filesystem;
# endif
#else
# include <Poco/TemporaryFile.h>
#endif

#include "Log.hpp"
#include "Util.hpp"
#include "Unit.hpp"

namespace
{
    void alertAllUsersAndLog(const std::string& message, const std::string& cmd, const std::string& kind)
    {
        LOG_ERR(message);
        Util::alertAllUsers(cmd, kind);
    }

#if HAVE_STD_FILESYSTEM
/// Class to delete files when the process ends.
class FileDeleter
{
    std::vector<std::string> _filesToDelete;
    std::mutex _lock;
public:
    FileDeleter() {}
    ~FileDeleter()
    {
        std::unique_lock<std::mutex> guard(_lock);
        for (const std::string& file: _filesToDelete)
            filesystem::remove(file);
    }

    void registerForDeletion(const std::string& file)
    {
        std::unique_lock<std::mutex> guard(_lock);
        _filesToDelete.push_back(file);
    }
};
#endif
}

namespace FileUtil
{
    std::string createRandomDir(const std::string& path)
    {
        const std::string name = Util::rng::getFilename(64);
#if HAVE_STD_FILESYSTEM
        filesystem::create_directory(path + '/' + name);
#else
        Poco::File(Poco::Path(path, name)).createDirectories();
#endif
        return name;
    }

    void copyFileTo(const std::string &fromPath, const std::string &toPath)
    {
        int from = -1, to = -1;
        try {
            from = open(fromPath.c_str(), O_RDONLY);
            if (from < 0)
            {
                LOG_SYS("Failed to open src " << anonymizeUrl(fromPath));
                throw;
            }

            struct stat st;
            if (fstat(from, &st) != 0)
            {
                LOG_SYS("Failed to fstat src " << anonymizeUrl(fromPath));
                throw;
            }

            to = open(toPath.c_str(), O_CREAT | O_TRUNC | O_WRONLY, st.st_mode);
            if (to < 0)
            {
                LOG_SYS("Failed to fstat dest " << anonymizeUrl(toPath));
                throw;
            }

            LOG_INF("Copying " << st.st_size << " bytes from " << anonymizeUrl(fromPath) << " to " << anonymizeUrl(toPath));

            char buffer[64 * 1024];

            int n;
            off_t bytesIn = 0;
            do {
                while ((n = ::read(from, buffer, sizeof(buffer))) < 0 && errno == EINTR)
                    LOG_TRC("EINTR reading from " << anonymizeUrl(fromPath));
                if (n < 0)
                {
                    LOG_SYS("Failed to read from " << anonymizeUrl(fromPath) << " at " << bytesIn << " bytes in");
                    throw;
                }
                bytesIn += n;
                if (n == 0) // EOF
                    break;
                assert (off_t(sizeof (buffer)) >= n);
                // Handle short writes and EINTR
                for (int j = 0; j < n;)
                {
                    int written;
                    while ((written = ::write(to, buffer + j, n - j)) < 0 && errno == EINTR)
                        LOG_TRC("EINTR writing to " << anonymizeUrl(toPath));
                    if (written < 0)
                    {
                        LOG_SYS("Failed to write " << n << " bytes to " << anonymizeUrl(toPath) << " at " <<
                                bytesIn << " bytes into " << anonymizeUrl(fromPath));
                        throw;
                    }
                    j += written;
                }
            } while(true);
            if (bytesIn != st.st_size)
            {
                LOG_WRN("Unusual: file " << anonymizeUrl(fromPath) << " changed size "
                        "during copy from " << st.st_size << " to " << bytesIn);
            }
        }
        catch (...)
        {
            LOG_SYS("Failed to copy from " << anonymizeUrl(fromPath) << " to " << anonymizeUrl(toPath));
            close(from);
            close(to);
            unlink(toPath.c_str());
            throw Poco::Exception("failed to copy");
        }
    }

    std::string getTempFilePath(const std::string& srcDir, const std::string& srcFilename, const std::string& dstFilenamePrefix)
    {
        const std::string srcPath = srcDir + '/' + srcFilename;
        const std::string dstFilename = dstFilenamePrefix + Util::encodeId(Util::rng::getNext()) + '_' + srcFilename;
#if HAVE_STD_FILESYSTEM
        const std::string dstPath = filesystem::temp_directory_path() / dstFilename;
        filesystem::copy(srcPath, dstPath);

        static FileDeleter fileDeleter;
        fileDeleter.registerForDeletion(dstPath);
#else
        const std::string dstPath = Poco::Path(Poco::Path::temp(), dstFilename).toString();
        copyFileTo(srcPath, dstPath);
        Poco::TemporaryFile::registerForDeletion(dstPath);
#endif

        return dstPath;
    }

    bool saveDataToFileSafely(const std::string& fileName, const char *data, size_t size)
    {
        const auto tempFileName = fileName + ".temp";
        std::fstream outStream(tempFileName, std::ios::out);

        // If we can't create the file properly, just remove it
        if (!outStream.good())
        {
            alertAllUsersAndLog("Creating " + tempFileName + " failed, disk full?", "internal", "diskfull");
            // Try removing both just in case
            std::remove(tempFileName.c_str());
            std::remove(fileName.c_str());
            return false;
        }
        else
        {
            outStream.write(data, size);
            if (!outStream.good())
            {
                alertAllUsersAndLog("Writing to " + tempFileName + " failed, disk full?", "internal", "diskfull");
                outStream.close();
                std::remove(tempFileName.c_str());
                std::remove(fileName.c_str());
                return false;
            }
            else
            {
                outStream.close();
                if (!outStream.good())
                {
                    alertAllUsersAndLog("Closing " + tempFileName + " failed, disk full?", "internal", "diskfull");
                    std::remove(tempFileName.c_str());
                    std::remove(fileName.c_str());
                    return false;
                }
                else
                {
                    // Everything OK, rename the file to its proper name
                    if (std::rename(tempFileName.c_str(), fileName.c_str()) == 0)
                    {
                        LOG_DBG("Renaming " << tempFileName << " to " << fileName << " OK.");
                        return true;
                    }
                    else
                    {
                        alertAllUsersAndLog("Renaming " + tempFileName + " to " + fileName + " failed, disk full?", "internal", "diskfull");
                        std::remove(tempFileName.c_str());
                        std::remove(fileName.c_str());
                        return false;
                    }
                }
            }
        }
    }

#if 1 // !HAVE_STD_FILESYSTEM
    static int nftw_cb(const char *fpath, const struct stat*, int type, struct FTW*)
    {
        if (type == FTW_DP)
        {
            rmdir(fpath);
        }
        else if (type == FTW_F || type == FTW_SL)
        {
            unlink(fpath);
        }

        // Always continue even when things go wrong.
        return 0;
    }
#endif

    void removeFile(const std::string& path, const bool recursive)
    {
// Amazingly filesystem::remove_all silently fails to work on some
// systems. No real need to be using experimental API here either.
#if 0 // HAVE_STD_FILESYSTEM
        std::error_code ec;
        if (recursive)
            filesystem::remove_all(path, ec);
        else
            filesystem::remove(path, ec);

        // Already removed or we don't care about failures.
        (void) ec;
#else
        try
        {
            struct stat sb;
            if (!recursive || stat(path.c_str(), &sb) == -1 || S_ISREG(sb.st_mode))
            {
                // Non-recursive directories, and files.
                Poco::File(path).remove(recursive);
            }
            else
            {
                // Directories only.
                nftw(path.c_str(), nftw_cb, 128, FTW_DEPTH | FTW_PHYS);
            }
        }
        catch (const std::exception&e)
        {
            // Already removed or we don't care about failures.
            LOG_DBG("Exception removing " << path << " " << recursive << " : " << e.what());
        }
#endif
    }


} // namespace FileUtil

namespace
{

    struct fs
    {
        fs(const std::string& path, dev_t dev)
            : _path(path), _dev(dev)
        {
        }

        const std::string& getPath() const { return _path; }

        dev_t getDev() const { return _dev; }

    private:
        std::string _path;
        dev_t _dev;
    };

    struct fsComparator
    {
        bool operator() (const fs& lhs, const fs& rhs) const
        {
            return (lhs.getDev() < rhs.getDev());
        }
    };

    static std::mutex fsmutex;
    static std::set<fs, fsComparator> filesystems;

} // anonymous namespace

namespace FileUtil
{
#if !MOBILEAPP
    void registerFileSystemForDiskSpaceChecks(const std::string& path)
    {
        const std::string::size_type lastSlash = path.rfind('/');
        assert(path.empty() || lastSlash != std::string::npos);
        if (lastSlash != std::string::npos)
        {
            const std::string dirPath = path.substr(0, lastSlash + 1) + '.';
            LOG_INF("Registering filesystem for space checks: [" << dirPath << "]");

            std::lock_guard<std::mutex> lock(fsmutex);

            struct stat s;
            if (stat(dirPath.c_str(), &s) == 0)
            {
                filesystems.insert(fs(dirPath, s.st_dev));
            }
        }
    }

    std::string checkDiskSpaceOnRegisteredFileSystems(const bool cacheLastCheck)
    {
        static std::chrono::steady_clock::time_point lastCheck;
        std::chrono::steady_clock::time_point now(std::chrono::steady_clock::now());

        std::lock_guard<std::mutex> lock(fsmutex);

        // Don't check more often than once a minute
        if (std::chrono::duration_cast<std::chrono::seconds>(now - lastCheck).count() < 60)
            return std::string();

        if (cacheLastCheck)
            lastCheck = now;

        for (const auto& i: filesystems)
        {
            if (!checkDiskSpace(i.getPath()))
            {
                return i.getPath();
            }
        }

        return std::string();
    }
#endif

    bool checkDiskSpace(const std::string& path)
    {
        assert(!path.empty());

#if !MOBILEAPP
        bool hookResult;
        if (UnitBase::get().filterCheckDiskSpace(path, hookResult))
            return hookResult;
#endif

        // we should be able to run just OK with 5GB for production or 1GB for development
#if ENABLE_DEBUG
        const int64_t gb(1);
#else
        const int64_t gb(5);
#endif
        constexpr int64_t ENOUGH_SPACE = gb*1024*1024*1024;

#ifdef __linux
        struct statfs sfs;
        if (statfs(path.c_str(), &sfs) == -1)
            return true;

        const int64_t freeBytes = static_cast<int64_t>(sfs.f_bavail) * sfs.f_bsize;

        LOG_INF("Filesystem [" << path << "] has " << (freeBytes / 1024 / 1024) <<
                " MB free (" << (sfs.f_bavail * 100. / sfs.f_blocks) << "%).");

        if (freeBytes > ENOUGH_SPACE)
            return true;

        if (static_cast<double>(sfs.f_bavail) / sfs.f_blocks <= 0.05)
            return false;
#elif defined IOS
        NSDictionary *atDict = [[NSFileManager defaultManager] attributesOfFileSystemForPath:@"/" error:NULL];
        long long freeSpace = [[atDict objectForKey:NSFileSystemFreeSize] longLongValue];
        long long totalSpace = [[atDict objectForKey:NSFileSystemSize] longLongValue];

        if (freeSpace > ENOUGH_SPACE)
            return true;

        if (static_cast<double>(freeSpace) / totalSpace <= 0.05)
            return false;
#endif

        return true;
    }

    namespace {
        bool AnonymizeUserData = false;
        std::uint64_t AnonymizationSalt = 82589933;
    }

    void setUrlAnonymization(bool anonymize, const std::uint64_t salt)
    {
        AnonymizeUserData = anonymize;
        AnonymizationSalt = salt;
    }

    /// Anonymize the basename of filenames, preserving the path and extension.
    std::string anonymizeUrl(const std::string& url)
    {
        return AnonymizeUserData ? Util::anonymizeUrl(url, AnonymizationSalt) : url;
    }

    /// Anonymize user names and IDs.
    /// Will use the Obfuscated User ID if one is provied via WOPI.
    std::string anonymizeUsername(const std::string& username)
    {
        return AnonymizeUserData ? Util::anonymize(username, AnonymizationSalt) : username;
    }

} // namespace FileUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
