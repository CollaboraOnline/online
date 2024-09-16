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

#include "FileUtil.hpp"

#include <dirent.h>
#include <exception>
#include <ftw.h>
#include <grp.h>
#include <pwd.h>
#include <stdexcept>
#include <sys/time.h>
#ifdef __linux__
#include <sys/vfs.h>
#elif defined IOS
#import <Foundation/Foundation.h>
#elif defined __FreeBSD__
#include <sys/param.h>
#include <sys/mount.h>
#endif

#include <fcntl.h>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <mutex>
#include <string>

#include <Poco/File.h>
#include <Poco/Path.h>

#include "Log.hpp"
#include "Util.hpp"
#include "Unit.hpp"

namespace FileUtil
{
    std::string createRandomDir(const std::string& path)
    {
        std::string name = Util::rng::getFilename(64);
        std::filesystem::create_directory(path + '/' + name);
        return name;
    }

    bool copy(const std::string& fromPath, const std::string& toPath, bool log, bool throw_on_error)
    {
        int from = -1, to = -1;
        try
        {
            from = open(fromPath.c_str(), O_RDONLY);
            if (from < 0)
                throw std::runtime_error("Failed to open src " + anonymizeUrl(fromPath));

            struct stat st;
            if (fstat(from, &st) != 0)
                throw std::runtime_error("Failed to fstat src " + anonymizeUrl(fromPath));

            to = open(toPath.c_str(), O_CREAT | O_TRUNC | O_WRONLY, st.st_mode);
            if (to < 0)
                throw std::runtime_error("Failed to open dest " + anonymizeUrl(toPath));

            // Logging may be redundant and/or noisy.
            if (log)
                LOG_INF("Copying " << st.st_size << " bytes from " << anonymizeUrl(fromPath)
                                   << " to " << anonymizeUrl(toPath));

            char buffer[64 * 1024];

            int n;
            off_t bytesIn = 0;
            do
            {
                while ((n = ::read(from, buffer, sizeof(buffer))) < 0 && errno == EINTR)
                    LOG_TRC("EINTR reading from " << anonymizeUrl(fromPath));
                if (n < 0)
                    throw std::runtime_error("Failed to read from " + anonymizeUrl(fromPath)
                                             + " at " + std::to_string(bytesIn) + " bytes in");

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
                        throw std::runtime_error("Failed to write " + std::to_string(n)
                                                 + " bytes to " + anonymizeUrl(toPath) + " at "
                                                 + std::to_string(bytesIn) + " bytes into "
                                                 + anonymizeUrl(fromPath));
                    }
                    j += written;
                }
            } while (true);
            if (bytesIn != st.st_size)
            {
                LOG_WRN("Unusual: file " << anonymizeUrl(fromPath) << " changed size "
                        "during copy from " << st.st_size << " to " << bytesIn);
            }
            close(from);
            close(to);
            return true;
        }
        catch (const std::exception& ex)
        {
            std::ostringstream oss;
            oss << "Error while copying from " << anonymizeUrl(fromPath) << " to "
                << anonymizeUrl(toPath) << ": " << ex.what();
            const std::string err = oss.str();
            LOG_ERR(err);
            close(from);
            close(to);
            unlink(toPath.c_str());
            if (throw_on_error)
                throw std::runtime_error(err);
        }

        return false;
    }

    std::string getSysTempDirectoryPath()
    {
        // Don't const to allow for automatic move on return.
        std::string path = std::filesystem::temp_directory_path();

        if (!path.empty())
            return path;

        // Sensible fallback, though shouldn't be needed.
        const char *tmp = getenv("TMPDIR");
        if (!tmp)
            tmp = getenv("TEMP");
        if (!tmp)
            tmp = getenv("TMP");
        if (!tmp)
            tmp = "/tmp";
        return tmp;
    }

    std::string createRandomTmpDir(std::string root)
    {
        if (root.empty())
            root = getSysTempDirectoryPath();

        Poco::File(root).createDirectories();

        // Don't const to allow for automatic move on return.
        std::string newTmp = root + "/cool-" + Util::rng::getFilename(16);
        if (::mkdir(newTmp.c_str(), S_IRWXU) < 0)
        {
            LOG_SYS("Failed to create random temp directory [" << newTmp << ']');
            return root;
        }
        return newTmp;
    }

    std::string createTmpDir(const std::string& dirName, std::string root)
    {
        if (root.empty())
            root = getSysTempDirectoryPath();

        Poco::File(root).createDirectories();

        // Don't const to allow for automatic move on return.
        std::string newTmp = root + '/' + dirName;
        if (::mkdir(newTmp.c_str(), S_IRWXU) < 0)
        {
            LOG_SYS("Failed to create temp directory [" << newTmp << ']');
            return root;
        }
        return newTmp;
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
        LOG_DBG("Removing [" << path << "] " << (recursive ? "recursively." : "only."));

// Amazingly filesystem::remove_all silently fails to work on some
// systems. No real need to be using experimental API here either.
#if 0 // HAVE_STD_FILESYSTEM
        std::error_code ec;
        if (recursive)
            std::filesystem::remove_all(path, ec);
        else
            std::filesystem::remove(path, ec);

        // Already removed or we don't care about failures.
        (void) ec;
#else
        try
        {
            struct stat sb;
            errno = 0;
            if (!recursive || stat(path.c_str(), &sb) == -1 || S_ISREG(sb.st_mode))
            {
                // Non-recursive directories and files that exist.
                if (errno != ENOENT)
                    Poco::File(path).remove(recursive);
            }
            else
            {
                // Directories only.
                nftw(path.c_str(), nftw_cb, 128, FTW_DEPTH | FTW_PHYS);
            }
        }
        catch (const std::exception& e)
        {
            // Don't complain if already non-existant.
            if (FileUtil::Stat(path).exists())
            {
                // Error only if it still exists.
                LOG_ERR("Failed to remove ["
                        << path << "] " << (recursive ? "recursively: " : "only: ") << e.what());
            }
        }
#endif
    }

    /// Remove directories only, which must be empty for this to work.
    static int nftw_rmdir_cb(const char* fpath, const struct stat*, int type, struct FTW*)
    {
        if (type == FTW_DP)
        {
            rmdir(fpath);
        }

        // Always continue even when things go wrong.
        return 0;
    }

    void removeEmptyDirTree(const std::string& path)
    {
        LOG_DBG("Removing empty directories at [" << path << "] recursively");

        nftw(path.c_str(), nftw_rmdir_cb, 128, FTW_DEPTH | FTW_PHYS);
    }

    std::string realpath(const char* path)
    {
        char* resolved = ::realpath(path, nullptr);
        if (resolved)
        {
            std::string real = resolved;
            free(resolved);
            return real;
        }

        LOG_SYS("Failed to get the realpath of [" << path << ']');
        return path;
    }

    bool isEmptyDirectory(const char* path)
    {
        DIR* dir = opendir(path);
        if (dir == nullptr)
            return errno != EACCES; // Assume it's not empty when EACCES.

        int count = 0;
        while (readdir(dir) && ++count < 3)
            ;

        closedir(dir);
        return count <= 2; // Discounting . and ..
    }

    bool isWritable(const char* path)
    {
        if (access(path, W_OK) == 0)
            return true;

        LOG_INF("No write access to path [" << path << "]: " << strerror(errno));
        return false;
    }

    bool updateTimestamps(const std::string& filename, timespec tsAccess, timespec tsModified)
    {
        // The timestamp is in seconds and microseconds.
        timeval timestamps[2]
                          {
                              {
                                  tsAccess.tv_sec,
#ifdef IOS
                                  (__darwin_suseconds_t)
#endif
                                  (tsAccess.tv_nsec / 1000)
                              },
                              {
                                  tsModified.tv_sec,
#ifdef IOS
                                  (__darwin_suseconds_t)
#endif
                                  (tsModified.tv_nsec / 1000)
                              }
                          };
        if (utimes(filename.c_str(), timestamps) != 0)
        {
            LOG_SYS("Failed to update the timestamp of [" << filename << ']');
            return false;
        }

        return true;
    }

    bool copyAtomic(const std::string& fromPath, const std::string& toPath, bool preserveTimestamps)
    {
        const std::string randFilename = toPath + Util::rng::getFilename(12);
        if (copy(fromPath, randFilename, /*log=*/false, /*throw_on_error=*/false))
        {
            if (preserveTimestamps)
            {
                const Stat st(fromPath);
                updateTimestamps(randFilename,
#ifdef IOS
                                 st.sb().st_atimespec, st.sb().st_mtimespec
#else
                                 st.sb().st_atim, st.sb().st_mtim
#endif
                                 );
            }

            // Now rename atomically, replacing any existing files with the same name.
            if (rename(randFilename.c_str(), toPath.c_str()) == 0)
                return true;

            LOG_SYS("Failed to copy [" << fromPath << "] -> [" << toPath
                                       << "] while atomically renaming:");
            removeFile(randFilename, false); // Cleanup.
        }

        return false;
    }

    bool compareFileContents(const std::string& rhsPath, const std::string& lhsPath)
    {
        std::ifstream rhs(rhsPath, std::ifstream::binary | std::ifstream::ate);
        if (rhs.fail())
            return false;

        std::ifstream lhs(lhsPath, std::ifstream::binary | std::ifstream::ate);
        if (lhs.fail())
            return false;

        if (rhs.tellg() != lhs.tellg())
            return false;

        rhs.seekg(0, std::ifstream::beg);
        lhs.seekg(0, std::ifstream::beg);
        return std::equal(std::istreambuf_iterator<char>(rhs.rdbuf()),
                          std::istreambuf_iterator<char>(),
                          std::istreambuf_iterator<char>(lhs.rdbuf()));
    }

    std::unique_ptr<std::vector<char>> readFile(const std::string& path, int maxSize)
    {
        auto data = std::make_unique<std::vector<char>>(maxSize);
        return (readFile(path, *data, maxSize) >= 0) ? std::move(data) : nullptr;
    }

    std::string buildLocalPathToJail(bool usingMountNamespaces, std::string localStorePath, std::string localPath)
    {
        // Use where mountJail of kit/Kit.cpp mounts /tmp for this path *from* rather than
        // where it is mounted *to*, so this process doesn't need the mount visible to it
        if (usingMountNamespaces && !localPath.empty())
        {
            Poco::Path jailPath(localPath);
            const std::string jailPathDir = jailPath[0];
            if (jailPathDir == "tmp")
            {
                jailPath.popFrontDirectory();

                Poco::Path localStorageDir(localStorePath);
                localStorageDir.makeDirectory();
                const std::string jailId = localStorageDir[localStorageDir.depth() - 1];
                localStorageDir.popDirectory();

                localStorageDir.pushDirectory(jailPathDir);

                std::string tmpMapping("cool-");
                tmpMapping.append(jailId);

                localStorageDir.pushDirectory(tmpMapping);

                localStorePath = localStorageDir.toString();

                localPath = jailPath.toString();
            }
        }

        // /chroot/jailId/user/doc/childId
        const Poco::Path rootPath = Poco::Path(localStorePath, localPath);
        Poco::File(rootPath).createDirectories();

        return rootPath.toString();
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
            LOG_INF("Registering filesystem for space checks: [" << dirPath << ']');

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
        static std::string lastResult;
        std::chrono::steady_clock::time_point now(std::chrono::steady_clock::now());

        std::lock_guard<std::mutex> lock(fsmutex);

        if (cacheLastCheck)
        {
            // Don't check more often than once a minute
            if ((now - lastCheck) < std::chrono::minutes(1))
                return lastResult;

            lastCheck = now;
        }

        for (const auto& i: filesystems)
        {
            if (!checkDiskSpace(i.getPath()))
            {
                if (cacheLastCheck)
                    lastResult = i.getPath();
                return i.getPath();
            }
        }

        if (cacheLastCheck)
            lastResult = std::string();
        return std::string();
    }
#endif

    bool checkDiskSpace(const std::string& path)
    {
        assert(!path.empty());

        if (!Util::isMobileApp())
        {
            bool hookResult = true;
            if (UnitBase::get().filterCheckDiskSpace(path, hookResult))
                return hookResult;
        }

        // we should be able to run just OK with 5GB for production or 1GB for development
#if defined(__linux__) || defined(__FreeBSD__) || defined(IOS)
#if ENABLE_DEBUG
        constexpr int64_t gb(1);
#else
        constexpr int64_t gb(5);
#endif
        constexpr int64_t ENOUGH_SPACE = gb*1024*1024*1024;
#endif

#if defined(__linux__) || defined(__FreeBSD__)
        struct statfs sfs;
        if (statfs(path.c_str(), &sfs) == -1)
        {
            LOG_SYS("Failed to stat filesystem [" << path << ']');
            return true; // We assume the worst.
        }

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
    /// Will use the Obfuscated User ID if one is provided via WOPI.
    std::string anonymizeUsername(const std::string& username)
    {
        return AnonymizeUserData ? Util::anonymize(username, AnonymizationSalt) : username;
    }

    std::string extractFileExtension(const std::string& path)
    {
        return Util::splitLast(path, '.', true).second;
    }

    void lslr(const std::string& path)
    {
        std::cout << path << ":\n";

        DIR* dir = opendir(path.c_str());
        if (dir == nullptr)
        {
            std::cerr << "lslr: fail to open: " << dir << " error: " << std::strerror(errno) << std::endl;
            return;
        }

        struct sb
        {
            mode_t _mode;
            nlink_t _nlink;
            std::string _uid;
            std::string _gid;
            off_t _size;
            time_t _mtime;
            std::string _name;

            sb(mode_t mode, nlink_t nlink, std::string uid, std::string gid, off_t size, time_t mtime, std::string name)
                : _mode(mode)
                , _nlink(nlink)
                , _uid(std::move(uid))
                , _gid(std::move(gid))
                , _size(size)
                , _mtime(mtime)
                , _name(std::move(name))
            {
            }
        };

        std::vector<sb> entries;
        std::vector<std::string> subdirs;
        size_t nlink_len = 0;
        size_t size_len = 0;
        size_t uid_len = 0;
        size_t gid_len = 0;
        size_t blocks = 0;

        while (const dirent* f = readdir(dir))
        {
            std::string fullpath(path);
            if (!fullpath.ends_with("/"))
                fullpath.append("/");
            fullpath.append(f->d_name);

            struct stat statbuf;
            if (lstat(fullpath.c_str(), &statbuf) != 0)
            {
                std::cerr << "lslr: fail to lstat: " << fullpath << " error: " << std::strerror(errno) << std::endl;
                continue;
            }

            size_len = std::max(size_len, std::to_string(statbuf.st_size).size());
            nlink_len = std::max(nlink_len, std::to_string(statbuf.st_nlink).size());

            std::string uid;
            struct passwd *pwd = getpwuid(statbuf.st_uid);
            if (pwd && pwd->pw_name)
                uid = pwd->pw_name;
            else
                uid = std::to_string(statbuf.st_uid);
            uid_len = std::max(uid_len, uid.size());

            std::string gid;
            struct group *grp = getgrgid(statbuf.st_gid);
            if (grp && grp->gr_name)
                gid = grp->gr_name;
            else
                gid = std::to_string(statbuf.st_gid);

            entries.emplace_back(statbuf.st_mode, statbuf.st_nlink, uid, gid, statbuf.st_size, statbuf.st_mtime, f->d_name);

            if (strcmp(f->d_name, ".") != 0 && strcmp(f->d_name, "..") != 0 && (statbuf.st_mode & S_IFMT) == S_IFDIR)
                subdirs.push_back(fullpath);

            blocks += statbuf.st_blocks;
        }

        std::sort(entries.begin(), entries.end(), [](const auto& lhs, const auto& rhs)
                  { return strcasecmp(lhs._name.c_str(), rhs._name.c_str()) < 0; });
        std::sort(subdirs.begin(), subdirs.end(), [](const auto& lhs, const auto& rhs)
                  { return strcasecmp(lhs.c_str(), rhs.c_str()) < 0; });

        closedir(dir);

        // turn 512 blocks into ls-alike default 1024 byte blocks
        std::cout << "total " << (blocks + 1) / 2 << "\n";

        for (const auto& entry : entries)
        {
            bool symbolic_link = false;

            switch (entry._mode & S_IFMT)
            {
                case S_IFREG:
                    std::cout << '-';
                    break;
                case S_IFBLK:
                    std::cout << 'b';
                    break;
                case S_IFCHR:
                    std::cout << 'c';
                    break;
                case S_IFDIR:
                    std::cout << 'd';
                    break;
                case S_IFLNK:
                    std::cout << 'l';
                    symbolic_link = true;
                    break;
                case S_IFIFO:
                    std::cout << 'p';
                    break;
                case S_IFSOCK:
                    std::cout << 's';
                    break;
                default:
                    std::cout << '?';
                    break;
                break;
            }

            std::cout << ((entry._mode & S_IRUSR) ? "r" : "-");
            std::cout << ((entry._mode & S_IWUSR) ? "w" : "-");
            std::cout << ((entry._mode & S_IXUSR) ? "x" : "-");
            std::cout << ((entry._mode & S_IRGRP) ? "r" : "-");
            std::cout << ((entry._mode & S_IWGRP) ? "w" : "-");
            std::cout << ((entry._mode & S_IXGRP) ? "x" : "-");
            std::cout << ((entry._mode & S_IROTH) ? "r" : "-");
            std::cout << ((entry._mode & S_IWOTH) ? "w" : "-");
            std::cout << ((entry._mode & S_IXOTH) ? "x" : "-");

            std::cout << " " << std::right << std::setw(nlink_len) << entry._nlink;

            std::cout << " " << std::left << std::setw(uid_len) << entry._uid;

            std::cout << " " << std::left << std::setw(gid_len) << entry._gid;

            std::cout << " " << std::right << std::setw(size_len) << entry._size;

            struct tm tm;
            std::cout << " " << std::put_time(localtime_r(&entry._mtime, &tm), "%F %R");

            std::cout << " " << entry._name;

            if (symbolic_link)
            {
                std::string fullpath(path);
                fullpath.append("/").append(entry._name);

                const std::size_t size = entry._size;
                std::vector<char> target(size + 1);
                char* target_data = target.data();
                const ssize_t read = readlink(fullpath.c_str(), target_data, size);
                if (read <= 0 || static_cast<std::size_t>(read) > size)
                    std::cerr << "lslr: fail to read: " << fullpath << " error: " << std::strerror(errno) << std::endl;
                else
                {
                    target_data[read] = '\0';
                    std::cout << " -> " << target.data();
                }
            }

            std::cout << "\n";
        }

        for (const auto& subdir : subdirs)
        {
            std::cout << "\n";
            lslr(subdir);
        }
    }

    std::vector<std::string> getDirEntries(const std::string dirPath)
    {
        std::vector<std::string> names;
        DIR *dir = opendir(dirPath.c_str());
        if (!dir)
        {
            LOG_DBG("Read from non-existent directory " + dirPath);
            return names;
        }
        struct dirent *i;
        while ((i = readdir(dir)))
        {
            if (i->d_name[0] == '.')
                continue;
            names.push_back(i->d_name);
        }
        closedir(dir);
        return names;
    }
} // namespace FileUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
