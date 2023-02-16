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
#include <fcntl.h>
#include <unistd.h>
#ifdef __linux__
#include <sys/sysmacros.h>
#endif

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

#include "Log.hpp"
#include <SigUtil.hpp>

namespace JailUtil
{
bool coolmount(const std::string& arg, std::string source, std::string target)
{
    source = Util::trim(source, '/');
    target = Util::trim(target, '/');
    const std::string cmd = Poco::Path(Util::getApplicationPath(), "coolmount").toString() + ' '
                            + arg + ' ' + source + ' ' + target;
    LOG_TRC("Executing coolmount command: " << cmd);
    return !system(cmd.c_str());
}

bool bind(const std::string& source, const std::string& target)
{
    LOG_DBG("Mounting [" << source << "] -> [" << target << ']');
    try
    {
        Poco::File(target).createDirectory();
        const bool res = coolmount("-b", source, target);
        if (res)
            LOG_TRC("Bind-mounted [" << source << "] -> [" << target << ']');
        else
            LOG_ERR("Failed to bind-mount [" << source << "] -> [" << target << ']');
        return res;
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to mount [" << source << "] -> [" << target << "]: " << exc.what());
    }

    return false;
}

bool remountReadonly(const std::string& source, const std::string& target)
{
    LOG_DBG("Remounting [" << source << "] -> [" << target << ']');
    try
    {
        Poco::File(target).createDirectory();
        const bool res = coolmount("-r", source, target);
        if (res)
            LOG_TRC("Mounted [" << source << "] -> [" << target << "] readonly");
        else
            LOG_ERR("Failed to mount [" << source << "] -> [" << target << "] readonly");
        return res;
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to remount [" << source << "] -> [" << target << "]: " << exc.what());
    }

    return false;
}

/// Unmount a bind-mounted jail directory.
static bool unmount(const std::string& target)
{
    LOG_DBG("Unmounting [" << target << ']');
    const bool res = coolmount("-u", "", target);
    if (res)
        LOG_TRC("Unmounted [" << target << "] successfully.");
    else
    {
        // If bind-mounting is enabled, noisily log failures.
        // Otherwise, it's a cleanup attempt of earlier mounts,
        // which may be left-over and now the config has changed.
        // This happens more often in dev labs than in prod.
        if (JailUtil::isBindMountingEnabled())
            LOG_ERR("Failed to unmount [" << target << ']');
        else
            LOG_DBG("Failed to unmount [" << target << ']');
    }

    return res;
}

// This file signifies that we copied instead of mounted.
// NOTE: jail cleanup helpers are called from forkit and
// coolwsd, and they may have bind-mounting enabled, but the
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

static bool safeRemoveDir(const std::string& path)
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
    LOG_INF("Removing jail [" << root << ']');

    // Unmount the tmp directory. Don't care if we fail.
    const std::string tmpPath = Poco::Path(root, "tmp").toString();
#ifdef __FreeBSD__
    unmount(tmpPath + "/dev");
#endif
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

    if (FileUtil::Stat(root + '/' + LO_JAIL_SUBPATH).exists())
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
            // Postpone deleting "tmp" directory until we clean all the jails
            // On FreeBSD the "tmp" dir contains a devfs moint point. Normally,
            // it gets unmounted by coolmount during shutdown, but coolmount
            // does nothing if it is called on the non-existing path.
            // Removing this dir there prevents clean unmounting of devfs later.
            if (jail == "tmp")
                continue;
            // Delete tmp and link cache with prejudice.
            if (jail == "linkable")
                FileUtil::removeFile(path.toString(), true);
            else
                cleanupJails(path.toString());
        }
        const Poco::Path tmpPath(root, "tmp");
        FileUtil::removeFile(tmpPath.toString(), true);
    }

    // Remove empty directories.
    if (FileUtil::isEmptyDirectory(root))
        safeRemoveDir(root);
    else
        LOG_WRN("Jails root directory [" << root << "] is not empty. Will not remove it.");
}

void createJailPath(const std::string& path)
{
    LOG_INF("Creating jail path (if missing): " << path);
    Poco::File(path).createDirectories();
    chmod(path.c_str(), S_IXUSR | S_IWUSR | S_IRUSR);
}

void setupChildRoot(bool bindMount, const std::string& childRoot, const std::string& sysTemplate)
{
    // Start with a clean slate.
    cleanupJails(childRoot);
    createJailPath(childRoot + CHILDROOT_TMP_INCOMING_PATH);

    disableBindMounting(); // Clear to avoid surprises.

    // Try to enable bind-mounting if requested (via config).
    if (bindMount)
    {
        // Test mounting to verify it actually works,
        // as it might not function in some systems.
        const std::string target = Poco::Path(childRoot, "cool_test_mount").toString();

        // Make sure that we can both mount and unmount before enabling bind-mounting.
        if (bind(sysTemplate, target) && unmount(target))
        {
            enableBindMounting();
            safeRemoveDir(target);
            LOG_INF("Enabling Bind-Mounting of jail contents for better performance per "
                    "mount_jail_tree config in coolwsd.xml.");
        }
        else
            LOG_ERR("Bind-Mounting fails and will be disabled for this run. To disable permanently "
                    "set mount_jail_tree config entry in coolwsd.xml to false.");
    }
    else
        LOG_INF("Disabling Bind-Mounting of jail contents per "
                "mount_jail_tree config in coolwsd.xml.");
}

// This is the second stage of setting up /dev/[u]random
// in the jails. Here we create the random devices in
// /tmp/dev/ in the jail chroot. See setupRandomDeviceLinks().
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
        LOG_ERR("Failed to create [" << pathDev.toString() << "]: " << ex.what());
        return;
    }

#ifndef __FreeBSD__
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
#else
    if (!Poco::File(root + "/dev/random").exists())
    {
         const bool res = coolmount("-d", "", root + "/dev");
         if (res)
            LOG_TRC("Mounted devfs hierarchy -> [" << root << "/dev].");
        else
            LOG_ERR("Failed to mount devfs -> [" << root << "/dev].");
    }
#endif
}

/// The envar name used to control bind-mounting of systemplate/jails.
constexpr const char* BIND_MOUNTING_ENVAR_NAME = "COOL_BIND_MOUNT";

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
    LOG_INF("Updating systemplate dynamic files in [" << sysTemplate << ']');

    bool checkWritableSysTemplate = true;
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
            LOG_TRC("Dynamic file [" << dynFilename << "] points to real path [" << srcFilename
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
            LOG_TRC("File [" << dstFilename << "] is already up-to-date.");
            continue;
        }

        if (checkWritableSysTemplate && !FileUtil::isWritable(sysTemplate))
        {
            disableBindMounting(); // We can't mount from incomplete systemplate that can't be updated.
            LinkDynamicFiles = false;
            LOG_WRN("The systemplate directory ["
                    << sysTemplate << "] is read-only, and at least [" << dstFilename
                    << "] is out-of-date. Will have to copy sysTemplate to jails. To restore "
                       "optimal performance, make sure the files in ["
                    << sysTemplate << "/etc] are up-to-date.");
            return false;
        }

        checkWritableSysTemplate = false; // We've checked and is writable.

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
            LOG_INF("Copying [" << srcFilename << "] -> [" << dstFilename << ']');
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

void setupRandomDeviceLink(const std::string& sysTemplate, const std::string& name)
{
    const std::string path = sysTemplate + "/dev/";
    try
    {
        // Create the path first.
        Poco::File(path).createDirectories();
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Failed to create [" << path << "]: " << ex.what());
        return;
    }

    const std::string linkpath = path + name;
    const std::string target = "../tmp/dev/" + name;
    LOG_DBG("Linking symbolically [" << linkpath << "] to [" << target << "].");

    const FileUtil::Stat stLink(linkpath, true); // The file is a link.
    if (stLink.exists())
    {
        if (!stLink.isLink())
            LOG_WRN("Random device link [" << linkpath << "] exists but isn't a link.");
        else
            LOG_TRC("Random device link [" << linkpath << "] already exists.");

        return;
    }

    if (symlink(target.c_str(), linkpath.c_str()) == -1)
        LOG_SYS("Failed to symlink(\"" << target << "\", \"" << linkpath << "\")");
}

// The random devices are setup in two stages.
// This is the first stage, where we create symbolic links
// in sysTemplate/dev/[u]random pointing to ../tmp/dev/[u]random
// when we setup sysTemplate in forkit.
// In the second stage, during jail creation, we create the dev
// nodes in /tmp/dev/[u]random inside the jail chroot.
void setupRandomDeviceLinks(const std::string& sysTemplate)
{
    setupRandomDeviceLink(sysTemplate, "random");
    setupRandomDeviceLink(sysTemplate, "urandom");
}

} // namespace SysTemplate

} // namespace JailUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
