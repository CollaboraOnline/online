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
#include "JailUtil.hpp"

#include <sys/types.h>
#include <fcntl.h>
#include <unistd.h>
#ifdef __linux
#include <sys/sysmacros.h>
#endif

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

#include "Log.hpp"

namespace JailUtil
{
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
        LOG_TRC("Mounted [" << source << "] -> [" << target << "].");
    else
        LOG_ERR("Failed to mount [" << source << "] -> [" << target << "].");
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

bool safeRemoveDir(const std::string& path)
{
    unmount(path);

    static const bool bind = std::getenv("LOOL_BIND_MOUNT");

    // We must be empty if we had mounted.
    if (bind && !FileUtil::isEmptyDirectory(path))
    {
        LOG_WRN("Path [" << path << "] is not empty. Will not remove it.");
        return false;
    }

    // Recursively remove if link/copied.
    FileUtil::removeFile(path, !bind);
    return true;
}

void removeJail(const std::string& path)
{
    LOG_INF("Removing jail [" << path << "].");

    // Unmount the tmp directory. Don't care if we fail.
    const std::string tmpPath = Poco::Path(path, "tmp").toString();
    FileUtil::removeFile(tmpPath, true); // Delete tmp contents with prejeduce.
    unmount(tmpPath);

    // Unmount the loTemplate directory.
    unmount(Poco::Path(path, "lo").toString());

    // Unmount the jail (sysTemplate).
    safeRemoveDir(path);
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

void setupJails(bool bindMount, const std::string& jailRoot, const std::string& sysTemplate)
{
    // Start with a clean slate.
    cleanupJails(jailRoot);
    Poco::File(jailRoot).createDirectories();

    unsetenv("LOOL_BIND_MOUNT"); // Clear to avoid surprises.
    if (bindMount)
    {
        // Test mounting to verify it actually works,
        // as it might not function in some systems.
        const std::string target = Poco::Path(jailRoot, "lool_test_mount").toString();
        if (bind(sysTemplate, target))
        {
            safeRemoveDir(target);
            setenv("LOOL_BIND_MOUNT", "1", 1);
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
}

void symlinkPathToJail(const std::string& sysTemplate, const std::string& loTemplate,
                       const std::string& loSubPath)
{
    std::string symlinkTarget;
    for (int i = 0; i < Poco::Path(loTemplate).depth(); i++)
        symlinkTarget += "../";
    symlinkTarget += loSubPath;

    const Poco::Path symlinkSourcePath(sysTemplate + '/' + loTemplate);
    const std::string symlinkSource = symlinkSourcePath.toString();
    Poco::File(symlinkSourcePath.parent()).createDirectories();

    LOG_DBG("Linking symbolically [" << symlinkSource << "] to [" << symlinkTarget << "].");

    const FileUtil::Stat stLink(symlinkSource, true); // The file is a link.
    if (stLink.exists())
    {
        if (!stLink.isLink())
            LOG_WRN("Link [" << symlinkSource << "] already exists but isn't a link.");
        else
            LOG_TRC("Link [" << symlinkSource << "] already exists, skipping linking.");

        return;
    }

    if (symlink(symlinkTarget.c_str(), symlinkSource.c_str()) == -1)
        LOG_SYS("Failed to symlink(\"" << symlinkTarget << "\", \"" << symlinkSource << "\")");
}

// This is the second stage of setting up /dev/[u]random
// in the jails. Here we create the random devices in
// /tmp/dev/ in the jail chroot. See setupRandomDeviceLinks().
void setupJailDevNodes(const std::string& root)
{
    // Create the urandom and random devices
    Poco::File(Poco::Path(root, "/dev")).createDirectory();
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

namespace SysTemplate
{
/// The network and other system files we need to keep up-to-date in jails.
/// These must be up-to-date, as they can change during
/// the long lifetime of our process. Also, it's unlikely
/// that systemplate will get re-generated after installation.
static const auto DynamicFilePaths = { "/etc/passwd", "/etc/group",         "/etc/host.conf",
                                       "/etc/hosts",  "/etc/nsswitch.conf", "/etc/resolv.conf" };

/// Copy by default for KIT_IN_PROCESS.
static bool LinkDynamicFiles = false;

void setupDynamicFiles(const std::string& sysTemplate)
{
    LOG_INF("Setting up dynamic files in sysTemplate.");

    const std::string etcSysTemplatePath = Poco::Path(sysTemplate, "etc").toString();
    LinkDynamicFiles = true;
    for (const auto& srcFilename : DynamicFilePaths)
    {
        const Poco::File srcFilePath(srcFilename);
        if (!srcFilePath.exists())
            continue;

        // Remove the file to create a symlink.
        const Poco::Path dstFilePath(sysTemplate, srcFilename);
        if (LinkDynamicFiles)
        {
            LOG_INF("Linking [" << srcFilename << "] -> [" << dstFilePath.toString() << "].");
            FileUtil::removeFile(dstFilePath);

            // Link or copy.
            if (link(srcFilename, dstFilePath.toString().c_str()) != -1)
                continue;

            // Failed to link a file. Disable linking and copy instead.
            LOG_WRN("Failed to link [" << srcFilename << "] -> [" << dstFilePath.toString() << "] ("
                                       << strerror(errno) << "). Will copy.");
            LinkDynamicFiles = false;
        }

        // Linking fails, just copy.
        LOG_INF("Copying [" << srcFilename << "] -> [" << dstFilePath.toString() << "].");
        srcFilePath.copyTo(etcSysTemplatePath);
    }
}

void updateDynamicFiles(const std::string& sysTemplate)
{
    if (!LinkDynamicFiles)
    {
        LOG_INF("Updating dynamic files in sysTemplate.");

        const std::string etcSysTemplatePath = Poco::Path(sysTemplate, "etc").toString();
        for (const auto& srcFilename : DynamicFilePaths)
        {
            const Poco::File srcFilePath(srcFilename);
            if (!srcFilePath.exists())
                continue;

            const Poco::Path dstFilePath(sysTemplate, srcFilename);
            LOG_DBG("Copying [" << srcFilename << "] -> [" << dstFilePath.toString() << "].");
            srcFilePath.copyTo(etcSysTemplatePath);
        }
    }
}

void setupLoSymlink(const std::string& sysTemplate, const std::string& loTemplate,
                    const std::string& loSubPath)
{
    symlinkPathToJail(sysTemplate, loTemplate, loSubPath);

    // Font paths can end up as realpaths so match that too.
    char* resolved = realpath(loTemplate.c_str(), nullptr);
    if (resolved)
    {
        if (strcmp(loTemplate.c_str(), resolved) != 0)
            symlinkPathToJail(sysTemplate, std::string(resolved), loSubPath);
        free(resolved);
    }
}

void setupRandomDeviceLink(const std::string& sysTemplate, const std::string& name)
{
    const std::string path = sysTemplate + "/dev/";
    Poco::File(path).createDirectories();

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
