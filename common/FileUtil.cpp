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

#include <Poco/TemporaryFile.h>

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
}

namespace FileUtil
{
    std::string createRandomDir(const std::string& path)
    {
        const std::string name = Util::rng::getFilename(64);
        Poco::File(Poco::Path(path, name)).createDirectories();
        return name;
    }

    std::string getTempFilePath(const std::string& srcDir, const std::string& srcFilename, const std::string& dstFilenamePrefix)
    {
        const std::string srcPath = srcDir + '/' + srcFilename;
        const std::string dstFilename = dstFilenamePrefix + Util::encodeId(Util::rng::getNext()) + '_' + srcFilename;
        const std::string dstPath = Poco::Path(Poco::Path::temp(), dstFilename).toString();
        Poco::File(srcPath).copyTo(dstPath);
        Poco::TemporaryFile::registerForDeletion(dstPath);
        return dstPath;
    }

    std::string getTempFilePath(const std::string& srcDir, const std::string& srcFilename)
    {
        return getTempFilePath(srcDir, srcFilename, "");
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

    void removeFile(const std::string& path, const bool recursive)
    {
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
        catch (const std::exception&)
        {
            // Already removed or we don't care about failures.
        }
    }


} // namespace FileUtil

namespace
{

    struct fs
    {
        fs(const std::string& p, dev_t d)
            : path(p), dev(d)
        {
        }

        std::string path;
        dev_t dev;
    };

    struct fsComparator
    {
        bool operator() (const fs& lhs, const fs& rhs) const
        {
            return (lhs.dev < rhs.dev);
        }
    };

    static std::mutex fsmutex;
    static std::set<fs, fsComparator> filesystems;

} // anonymous namespace

namespace FileUtil
{
#ifndef MOBILEAPP
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
            if (!checkDiskSpace(i.path))
            {
                return i.path;
            }
        }

        return std::string();
    }
#endif

    bool checkDiskSpace(const std::string& path)
    {
        assert(!path.empty());

#ifndef MOBILEAPP
        bool hookResult;
        if (UnitBase::get().filterCheckDiskSpace(path, hookResult))
            return hookResult;
#endif

        // we should be able to run just OK with 5GB
        constexpr int64_t ENOUGH_SPACE = int64_t(5)*1024*1024*1024;

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

} // namespace FileUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
