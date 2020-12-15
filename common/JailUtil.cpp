/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "FileUtil.hpp"
#include "JailUtil.hpp"

#include <sys/types.h>
#include <sysexits.h>
#include <fcntl.h>
#include <utime.h>
#include <unistd.h>
#ifdef __linux__
#include <ftw.h>
#include <sys/sysmacros.h>
#endif
#ifdef __FreeBSD__
#include <ftw.h>
#define FTW_CONTINUE 0
#define FTW_STOP (-1)
#define FTW_SKIP_SUBTREE 0
#define FTW_ACTIONRETVAL 0
#endif

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

#include "Log.hpp"

namespace JailUtil
{
#ifndef BUILDING_TESTS
class LinkOrCopy
{
public:
    enum class OperationType
    {
        All,
        LO
    };

private:
    static OperationType Type;
    static std::string SourcePath;
    static std::string DestPath;
    static std::chrono::steady_clock::time_point StartTime;
    static bool VerboseLogging;
    /// Track to help quantify the link-or-copy performance.
    static unsigned FileCount;
    /// After this many seconds, start spamming the logs.
    static constexpr unsigned SlowLinkOrCopyLimitInSecs = 2;

    /// Returns the OperationType as a human-readable string (for logging).
    static std::string linkOrCopyTypeString(OperationType type)
    {
        switch (type)
        {
            case OperationType::LO:
                return "LibreOffice";
            case OperationType::All:
                return "all";
            default:
                assert(!"Unknown OperationType.");
                return "unknown";
        }
    }

    static bool shouldCopyDir(const char* path)
    {
        switch (Type)
        {
            case OperationType::LO:
                return strcmp(path, "program/wizards") != 0 && strcmp(path, "sdk") != 0
                       && strcmp(path, "debugsource") != 0 && strcmp(path, "share/basic") != 0
                       && strcmp(path, "share/Scripts/java") != 0
                       && strcmp(path, "share/Scripts/javascript") != 0
                       && strcmp(path, "share/config/wizard") != 0 && strcmp(path, "readmes") != 0;
            default: // Type::All
                return true;
        }
    }

    static bool shouldLinkFile(const char* path)
    {
        switch (Type)
        {
            case OperationType::LO:
            {
                const char* dot = strrchr(path, '.');
                if (!dot)
                    return true;

                if (!strcmp(dot, ".dbg"))
                    return false;

                if (!strcmp(dot, ".so"))
                {
                    // NSS is problematic ...
                    if (strstr(path, "libnspr4") || strstr(path, "libplds4")
                        || strstr(path, "libplc4") || strstr(path, "libnss3")
                        || strstr(path, "libnssckbi") || strstr(path, "libnsutil3")
                        || strstr(path, "libssl3") || strstr(path, "libsoftokn3")
                        || strstr(path, "libsqlite3") || strstr(path, "libfreeblpriv3"))
                        return true;

                    // As is Python ...
                    if (strstr(path, "python-core"))
                        return true;

                    // otherwise drop the rest of the code.
                    return false;
                }
                const char* vers;
                if ((vers = strstr(path, ".so."))) // .so.[digit]+
                {
                    for (int i = sizeof(".so."); vers[i] != '\0'; ++i)
                        if (!isdigit(vers[i]) && vers[i] != '.')
                            return true;
                    return false;
                }
                return true;
            }
            default: // Type::All
                return true;
        }
    }

    static void linkOrCopyFile(const char* fpath, const std::string& newPath)
    {
        ++FileCount;
        if (VerboseLogging)
            LOG_INF("Linking file \"" << fpath << "\" to \"" << newPath << '"');

        if (!FileUtil::linkOrCopyFile(fpath, newPath.c_str()))
        {
            LOG_FTL("Failed to copy or link [" << fpath << "] to [" << newPath << "]. Exiting.");
            Log::shutdown();
            std::_Exit(EX_SOFTWARE);
        }
    }

    static int linkOrCopyFunction(const char* fpath, const struct stat* sb, int typeflag,
                                  struct FTW* /*ftwbuf*/)
    {
        if (strcmp(fpath, SourcePath.c_str()) == 0)
        {
            LOG_TRC("nftw: Skipping redundant path: " << fpath);
            return FTW_CONTINUE;
        }

        if (!VerboseLogging)
        {
            const auto durationInSecs = std::chrono::duration_cast<std::chrono::seconds>(
                std::chrono::steady_clock::now() - StartTime);
            if (durationInSecs.count() > SlowLinkOrCopyLimitInSecs)
            {
                LOG_WRN("Linking/copying files from "
                        << SourcePath << " to " << DestPath
                        << " is taking too much time. Enabling verbose link/copy logging.");
                VerboseLogging = true;
            }
        }

        assert(fpath[strlen(SourcePath.c_str())] == '/');
        const char* relativeOldPath = fpath + strlen(SourcePath.c_str()) + 1;
        const Poco::Path newPath(DestPath, Poco::Path(relativeOldPath));

        switch (typeflag)
        {
            case FTW_F:
            case FTW_SLN:
                Poco::File(newPath.parent()).createDirectories();

                if (shouldLinkFile(relativeOldPath))
                    linkOrCopyFile(fpath, newPath.toString());
                break;
            case FTW_D:
            {
                if (!shouldCopyDir(relativeOldPath))
                {
                    LOG_TRC("nftw: Skipping redundant path: " << relativeOldPath);
                    return FTW_SKIP_SUBTREE;
                }

                Poco::File(newPath).createDirectories();
                struct utimbuf ut;
                ut.actime = sb->st_atime;
                ut.modtime = sb->st_mtime;
                if (utime(newPath.toString().c_str(), &ut) == -1)
                {
                    LOG_SYS("nftw: utime(\"" << newPath.toString() << "\") failed");
                    return FTW_STOP;
                }
            }
            break;
            case FTW_SL:
            {
                const std::size_t size = sb->st_size;
                char target[size + 1];
                const ssize_t written = readlink(fpath, target, size);
                if (written <= 0 || static_cast<std::size_t>(written) > size)
                {
                    LOG_SYS("nftw: readlink(\"" << fpath << "\") failed");
                    Log::shutdown();
                    std::_Exit(EX_SOFTWARE);
                }
                target[written] = '\0';

                Poco::File(newPath.parent()).createDirectories();
                if (symlink(target, newPath.toString().c_str()) == -1)
                {
                    LOG_SYS("nftw: symlink(\"" << target << "\", \"" << newPath.toString()
                                               << "\") failed");
                    return FTW_STOP;
                }
            }
            break;
            case FTW_DNR:
                LOG_ERR("nftw: Cannot read directory '" << fpath << '\'');
                return FTW_STOP;
            case FTW_NS:
                LOG_ERR("nftw: stat failed for '" << fpath << '\'');
                return FTW_STOP;
            default:
                LOG_FTL("nftw: unexpected typeflag: " << typeflag);
                assert(!"nftw: unexpected typeflag.");
                break;
        }

        return FTW_CONTINUE;
    }

public:
    static void linkOrCopy(std::string source, const std::string& destination, OperationType type)
    {
        std::string resolved = FileUtil::realpath(source);
        if (resolved != source)
        {
            LOG_DBG("linkOrCopy: Using real path [" << resolved << "] instead of original link ["
                                                    << source << "].");
            source = std::move(resolved);
        }

        LOG_INF("linkOrCopy " << linkOrCopyTypeString(type) << " from [" << source << "] to ["
                              << destination << "].");

        Type = type;
        SourcePath = source;
        if (SourcePath.back() == '/')
            SourcePath.pop_back();
        DestPath = destination;
        FileCount = 0;
        StartTime = std::chrono::steady_clock::now();

        if (nftw(source.c_str(), linkOrCopyFunction, 10, FTW_ACTIONRETVAL | FTW_PHYS) == -1)
        {
            LOG_SYS("linkOrCopy: nftw() failed for '" << source << '\'');
        }

        VerboseLogging = false;
        const auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                            std::chrono::steady_clock::now() - StartTime)
                            .count();
        const double seconds = (ms + 1) / 1000.; // At least 1ms to avoid div-by-zero.
        const auto rate = FileCount / seconds;
        LOG_INF("Linking/Copying of " << FileCount << " files from " << source << " to " << DestPath
                                      << " finished in " << seconds << " seconds, or " << rate
                                      << " files / second.");
    }
};

LinkOrCopy::OperationType LinkOrCopy::Type;
std::string LinkOrCopy::SourcePath;
std::string LinkOrCopy::DestPath;
std::chrono::time_point<std::chrono::steady_clock> LinkOrCopy::StartTime;
bool LinkOrCopy::VerboseLogging = false;
unsigned LinkOrCopy::FileCount = 0;

void linkOrCopyTemplateToJail(const std::string& templatePath, const std::string& jailPath)
{
    LinkOrCopy::linkOrCopy(templatePath, jailPath, LinkOrCopy::OperationType::All);
}

#endif // BUILDING_TESTS

bool loolmount(const std::string& arg, std::string source, std::string target)
{
    source = Util::trim(source, '/');
    target = Util::trim(target, '/');
    const std::string cmd = Poco::Path(Util::getApplicationPath(), "loolmount").toString() + ' '
                            + arg + ' ' + source + ' ' + target;
    LOG_TRC("Executing loolmount command: " << cmd);
    return !system(cmd.c_str());
}

bool bind(const std::string& source, const std::string& target)
{
    Poco::File(target).createDirectory();
    const bool res = loolmount("-b", source, target);
    if (res)
        LOG_TRC("Bind-mounted [" << source << "] -> [" << target << "].");
    else
        LOG_ERR("Failed to bind-mount [" << source << "] -> [" << target << "].");
    return res;
}

bool remountReadonly(const std::string& source, const std::string& target)
{
    Poco::File(target).createDirectory();
    const bool res = loolmount("-r", source, target);
    if (res)
        LOG_TRC("Mounted [" << source << "] -> [" << target << "] readonly.");
    else
        LOG_ERR("Failed to mount [" << source << "] -> [" << target << "] readonly.");
    return res;
}

bool unmount(const std::string& target)
{
    LOG_DBG("Unmounting [" << target << "].");
    const bool res = loolmount("-u", "", target);
    if (res)
        LOG_TRC("Unmounted [" << target << "] successfully.");
    else
        LOG_ERR("Failed to unmount [" << target << "].");
    return res;
}

// This file signifies that we copied instead of mounted.
// NOTE: jail cleanup helpers are called from forkit and
// loolwsd, and they may have bind-mounting enabled, but the
// kit could have had it removed when falling back to copying.
// In such cases, we cannot safely know whether the jail was
// copied or not, since the bind envar will be present and
// assuming it was mounted, would leak them.
// Alternatively, if we remove the files when mounted
// we could destroy systemplate if remounting read-only had
// failed (and it wasn't owned by root).
constexpr const char* COPIED_JAIL_MARKER_FILE = "delete.me";

void markJailCopied(const std::string& root)
{
    // The reason we should be able to create this file
    // is because the jail must be writable.
    // Failing this will cause an exception, signaling an error.
    Poco::File(root + '/' + COPIED_JAIL_MARKER_FILE).createFile();
}

bool isJailCopied(const std::string& root)
{
    // If the marker file exists, the jail was copied.
    FileUtil::Stat delFileStat(root + '/' + COPIED_JAIL_MARKER_FILE);
    return delFileStat.exists();
}

bool safeRemoveDir(const std::string& path)
{
    // Always unmount, just in case.
    unmount(path);

    // Regardless of the bind flag, check if the jail is marked as copied.
    const bool copied = isJailCopied(path);

    // We must be empty if we had mounted.
    if (!copied && JailUtil::isBindMountingEnabled() && !FileUtil::isEmptyDirectory(path))
    {
        LOG_WRN("Path [" << path << "] is not empty. Will not remove it.");
        return false;
    }

    // Recursively remove if link/copied.
    const bool recursive = copied;
    FileUtil::removeFile(path, recursive);
    return true;
}

void removeJail(const std::string& root)
{
    LOG_INF("Removing jail [" << root << "].");

    // Unmount the tmp directory. Don't care if we fail.
    const std::string tmpPath = Poco::Path(root, "tmp").toString();
    FileUtil::removeFile(tmpPath, true); // Delete tmp contents with prejudice.
    unmount(tmpPath);

    // Unmount the loTemplate directory.
    //FIXME: technically, the loTemplate directory may have any name.
    unmount(Poco::Path(root, "lo").toString());

    // Unmount/delete the jail (sysTemplate).
    safeRemoveDir(root);
}

/// This cleans up the jails directories.
/// Note that we assume the templates are mounted
/// and we unmount first. This is critical, because
/// otherwise when mounting is disabled we may
/// inadvertently delete the contents of the mount-points.
void cleanupJails(const std::string& root)
{
    LOG_INF("Cleaning up childroot directory [" << root << "].");

    FileUtil::Stat stRoot(root);
    if (!stRoot.exists() || !stRoot.isDirectory())
    {
        LOG_TRC("Directory [" << root << "] is not a directory or doesn't exist.");
        return;
    }

    //FIXME: technically, the loTemplate directory may have any name.
    if (FileUtil::Stat(root + "/lo").exists())
    {
        // This is a jail.
        removeJail(root);
    }
    else
    {
        // Not a jail, recurse. UnitTest creates sub-directories.
        LOG_TRC("Directory [" << root << "] is not a jail, recursing.");

        std::vector<std::string> jails;
        Poco::File(root).list(jails);
        for (const auto& jail : jails)
        {
            const Poco::Path path(root, jail);
            if (jail == "tmp") // Delete tmp with prejeduce.
                FileUtil::removeFile(path.toString(), true);
            else
                cleanupJails(path.toString());
        }
    }

    // Remove empty directories.
    if (FileUtil::isEmptyDirectory(root))
        safeRemoveDir(root);
    else
        LOG_WRN("Jails root directory [" << root << "] is not empty. Will not remove it.");
}

void setupChildRoot(bool bindMount, const std::string& childRoot, const std::string& sysTemplate,
                    const std::string& loTemplate)
{
    // Start with a clean slate.
    cleanupJails(childRoot);
    Poco::File(childRoot + CHILDROOT_TMP_INCOMING_PATH).createDirectories();

    disableBindMounting(); // Clear to avoid surprises.

    // Try to enable bind-mounting if requested (via config).
    if (bindMount)
    {
        // Test mounting to verify it actually works,
        // as it might not function in some systems.
        const std::string target = Poco::Path(childRoot, "lool_test_mount").toString();
        if (bind(sysTemplate, target))
        {
            enableBindMounting();
            safeRemoveDir(target);
            LOG_INF("Enabling Bind-Mounting of jail contents for better performance per "
                    "mount_jail_tree config in loolwsd.xml.");
        }
        else
            LOG_ERR("Bind-Mounting fails and will be disabled for this run. To disable permanently "
                    "set mount_jail_tree config entry in loolwsd.xml to false.");
    }
    else
        LOG_INF("Disabling Bind-Mounting of jail contents per "
                "mount_jail_tree config in loolwsd.xml.");

    // Now setup the template.

    const std::string templatePath = JailUtil::getTemplatePath(childRoot);
    LOG_INF("Creating Template [" << templatePath << ']');

    // Copy SysTemplate to Template.
    LinkOrCopy::linkOrCopy(sysTemplate, templatePath, LinkOrCopy::OperationType::All);

    // Copy LoTemplate to Template.
    Poco::Path jailLOPath = Poco::Path::forDirectory(templatePath);
    jailLOPath.pushDirectory(JailUtil::LO_JAIL_SUBPATH);
    LinkOrCopy::linkOrCopy(loTemplate, jailLOPath.toString(), LinkOrCopy::OperationType::LO);

    // Link the network and system files in Template, if possible.
    SysTemplate::setupDynamicFiles(templatePath);
}

// Create the random devices in dev/ in the jail chroot.
void setupJailDevNodes(const std::string& root)
{
    if (!FileUtil::isWritable(root))
    {
        LOG_WRN("Path [" << root << "] is read-only. Will not create the random device nodes.");
        return;
    }

    const auto pathDev = Poco::Path(root, "/dev");

    try
    {
        // Create the path first.
        Poco::File(pathDev).createDirectory();
    }
    catch (const std::exception& ex)
    {
        LOG_WRN("Failed to create [" << pathDev.toString() << "]: " << ex.what());
        return;
    }

    // Create the urandom and random devices.
    if (!Poco::File(root + "/dev/random").exists())
    {
        LOG_DBG("Making /dev/random node in [" << root << "/dev].");
        if (mknod((root + "/dev/random").c_str(),
                  S_IFCHR | S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH,
                  makedev(1, 8))
            != 0)
        {
            LOG_SYS("mknod(" << root << "/dev/random) failed. Mount must not use nodev flag.");
        }
    }

    if (!Poco::File(root + "/dev/urandom").exists())
    {
        LOG_DBG("Making /dev/urandom node in [" << root << "/dev].");
        if (mknod((root + "/dev/urandom").c_str(),
                  S_IFCHR | S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH,
                  makedev(1, 9))
            != 0)
        {
            LOG_SYS("mknod(" << root << "/dev/urandom) failed. Mount must not use nodev flag.");
        }
    }
}

/// The envar name used to control bind-mounting of systemplate/jails.
constexpr const char* BIND_MOUNTING_ENVAR_NAME = "LOOL_BIND_MOUNT";

void enableBindMounting()
{
    // Set the envar to enable.
    setenv(BIND_MOUNTING_ENVAR_NAME, "1", 1);
}

void disableBindMounting()
{
    // Remove the envar to disable.
    unsetenv(BIND_MOUNTING_ENVAR_NAME);
}

bool isBindMountingEnabled()
{
    // Check if we have a valid envar set.
    return std::getenv(BIND_MOUNTING_ENVAR_NAME) != nullptr;
}

namespace SysTemplate
{
/// The network and other system files we need to keep up-to-date in jails.
/// These must be up-to-date, as they can change during
/// the long lifetime of our process. Also, it's unlikely
/// that systemplate will get re-generated after installation.
static const auto DynamicFilePaths
    = { "/etc/passwd",        "/etc/group",       "/etc/host.conf", "/etc/hosts",
        "/etc/nsswitch.conf", "/etc/resolv.conf", "/etc/timezone",  "/etc/localtime" };

/// Copy (false) by default for KIT_IN_PROCESS.
static bool LinkDynamicFiles = false;

static bool updateDynamicFilesImpl(const std::string& sysTemplate);

void setupDynamicFiles(const std::string& sysTemplate)
{
    LOG_INF("Setting up systemplate dynamic files in [" << sysTemplate << "].");

    const std::string etcSysTemplatePath = Poco::Path(sysTemplate, "etc").toString();
    LinkDynamicFiles = true; // Prefer linking, unless it fails.

    if (!updateDynamicFilesImpl(sysTemplate))
    {
        // Can't copy!
        LOG_WRN("Failed to update the dynamic files in ["
                << sysTemplate
                << "]. Will disable bind-mounting in this run and clone systemplate into the "
                   "jails, which is more resource intensive.");
        disableBindMounting(); // We can't mount from incomplete systemplate.
        LinkDynamicFiles = false;
    }

    FileUtil::Stat copiedFileStat(Poco::Path(sysTemplate, "etc/copied").toString());
    if (copiedFileStat.exists())
    {
        // At least one file is copied, we must check for changes before each jail setup.
        LinkDynamicFiles = false;
    }

    LOG_INF("Systemplate dynamic files in ["
            << sysTemplate << "] "
            << (LinkDynamicFiles ? "are linked and will remain" : "will be copied to keep them")
            << " up-to-date.");
}

bool updateDynamicFilesImpl(const std::string& sysTemplate)
{
    LOG_INF("Updating systemplate dynamic files in [" << sysTemplate << "].");
    for (const auto& dynFilename : DynamicFilePaths)
    {
        if (!FileUtil::Stat(dynFilename).exists())
        {
            LOG_INF("Dynamic file [" << dynFilename
                                     << "] does not exist. Some functionality may be affected.");
            continue;
        }

        const std::string srcFilename = FileUtil::realpath(dynFilename);
        if (srcFilename != dynFilename)
        {
            LOG_DBG("Dynamic file [" << dynFilename << "] points to real path [" << srcFilename
                                     << "], which will be used instead.");
        }

        const Poco::File srcFilePath(srcFilename);
        FileUtil::Stat srcStat(srcFilename);
        if (!srcStat.exists())
            continue;

        const std::string dstFilename = Poco::Path(sysTemplate, dynFilename).toString();
        FileUtil::Stat dstStat(dstFilename);

        // Is it outdated?
        if (dstStat.isUpToDate(srcStat))
        {
            LOG_INF("File [" << dstFilename << "] is already up-to-date.");
            continue;
        }

        // Check that sysTemplate is in fact writable to avoid predictable errors.
        if (!FileUtil::isWritable(sysTemplate))
        {
            disableBindMounting(); // We can't mount from incomplete systemplate that can't be updated.
            LinkDynamicFiles = false;
            LOG_INF("The systemplate directory ["
                    << sysTemplate << "] is read-only, and at least [" << dstFilename
                    << "] is out-of-date. Will have to copy sysTemplate to jails. To restore "
                       "optimal performance, make sure the files in ["
                    << sysTemplate << "/etc] are up-to-date.");
            return false;
        }

        LOG_INF("File [" << dstFilename << "] needs to be updated.");
        if (LinkDynamicFiles)
        {
            LOG_INF("Linking [" << srcFilename << "] -> [" << dstFilename << "].");

            // Link or copy.
            if (link(srcFilename.c_str(), dstFilename.c_str()) == 0)
                continue;

            // Hard-linking failed, try symbolic linking.
            if (symlink(srcFilename.c_str(), dstFilename.c_str()) == 0)
                continue;

            const int linkerr = errno;

            // With parallel tests, another test might have linked already.
            FileUtil::Stat dstStat2(dstFilename);
            if (dstStat2.isUpToDate(srcStat))
            {
                LOG_INF("File [" << dstFilename << "] now seems to be up-to-date.");
                continue;
            }

            // Failed to link a file. Disable linking and copy instead.
            LOG_WRN("Failed to link ["
                    << srcFilename << "] -> [" << dstFilename << "] (" << strerror(linkerr)
                    << "). Will copy and disable linking dynamic system files in this run.");
            LinkDynamicFiles = false;
        }

        // Linking failed, just copy.
        if (!LinkDynamicFiles)
        {
            LOG_INF("Copying [" << srcFilename << "] -> [" << dstFilename << "].");
            if (!FileUtil::copyAtomic(srcFilename, dstFilename, true))
            {
                FileUtil::Stat dstStat2(dstFilename); // Stat again.
                if (!dstStat2.isUpToDate(srcStat))
                {
                    return false; // No point in trying the remaining files.
                }
            }

            // Create the 'copied' file so we keep the files up-to-date.
            Poco::File(Poco::Path(sysTemplate, "etc/copied").toString()).createFile();
        }
    }

    return true;
}

bool updateDynamicFiles(const std::string& sysTemplate)
{
    // If the files are linked, they are always up-to-date.
    return LinkDynamicFiles ? true : updateDynamicFilesImpl(sysTemplate);
}

} // namespace SysTemplate

} // namespace JailUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
