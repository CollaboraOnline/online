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

#include <filesystem>
#include <iostream>

#include <io.h>

#define WIN32_LEAN_AND_MEAN
#include <Windows.h>

#include <common/FileUtil.hpp>

namespace
{
    std::wstring string_to_wide_string(const std::string& string)
    {
        if (string.empty())
        {
            return L"";
        }

        const auto size_needed = MultiByteToWideChar(CP_UTF8, 0, string.data(), (int)string.size(), nullptr, 0);
        if (size_needed <= 0)
        {
            throw std::runtime_error("MultiByteToWideChar() failed: " + std::to_string(size_needed));
        }

        std::wstring result(size_needed, 0);
        MultiByteToWideChar(CP_UTF8, 0, string.data(), (int)string.size(), result.data(), size_needed);

        return result;
    }

    std::string wide_string_to_string(const std::wstring& wide_string)
    {
        if (wide_string.empty())
        {
            return "";
        }

        const auto size_needed = WideCharToMultiByte(CP_UTF8, 0, wide_string.data(), (int)wide_string.size(), nullptr, 0, nullptr, nullptr);
        if (size_needed <= 0)
        {
            throw std::runtime_error("WideCharToMultiByte() failed: " + std::to_string(size_needed));
        }

        std::string result(size_needed, 0);
        WideCharToMultiByte(CP_UTF8, 0, wide_string.data(), (int)wide_string.size(), result.data(), size_needed, nullptr, nullptr);

        return result;
    }

} // anonymous namespace

namespace FileUtil
{
    void removeFile(const std::string& path, const bool recursive)
    {
        LOG_DBG("Removing [" << path << "] " << (recursive ? "recursively." : "only."));

        try
        {
            if (recursive)
                std::filesystem::remove_all(string_to_wide_string(path));
            else
                std::filesystem::remove(string_to_wide_string(path));
        }
        catch (const std::filesystem::filesystem_error& e)
        {
            // Don't complain if already non-existant.
            if (FileUtil::Stat(path).exists())
            {
                // Error only if it still exists.
                LOG_ERR("Failed to remove ["
                        << path << "] " << (recursive ? "recursively: " : "only: ") << e.what());
            }
        }
    }

    /// Remove directories only, which must be empty for this to work.
    static void removeEmptyDirTreeTakingPath(const std::filesystem::path& path)
    {
        for (auto const& dirent :
                 std::filesystem::directory_iterator{path, std::filesystem::directory_options::skip_permission_denied})
        {
            if (dirent.is_directory())
            {
                std::error_code ec;
                removeEmptyDirTreeTakingPath(dirent.path());
                std::filesystem::remove(dirent.path(), ec);
            }
        }
    }

    void removeEmptyDirTree(const std::string& path)
    {
        LOG_DBG("Removing empty directories at [" << path << "] recursively");

        removeEmptyDirTreeTakingPath(std::filesystem::path(string_to_wide_string(path)));
    }

    bool isEmptyDirectory(const char* path)
    {
        bool empty = true;
        for (auto const& dirent :
                 std::filesystem::directory_iterator{std::filesystem::path(string_to_wide_string(path)),
                                                     std::filesystem::directory_options::skip_permission_denied})
        {
            (void) dirent;
            empty = false;
            break;
        }
        return empty;
    }

    bool linkOrCopyFile(const std::string& source, const std::string& newPath)
    {
        return FileUtil::copy(source, newPath, /*log=*/true, /*throw_on_error=*/false);
    }

    std::string realpath(const char* path)
    {
        return path;
    }

    bool platformDependentCheckDiskSpace(const std::string& path, int64_t enoughSpace)
    {
        // FIXME
        return true;
    }

    int openFileAsFD(const std::string& file, int oflag, int mode)
    {
        return _wopen(string_to_wide_string(file).c_str(), oflag | O_BINARY, mode);
    }

    int closeFD(int fd)
    {
        return _close(fd);
    }

    void openFileToIFStream(const std::string& file, std::ifstream& stream, std::ios_base::openmode mode)
    {
        stream.open(string_to_wide_string(file), mode | std::ios_base::binary);
    }

    int getStatOfFile(const std::string& file, struct stat& sb)
    {
        return _wstat64i32(string_to_wide_string(file).c_str(), (struct _stat64i32*) &sb);
    }

    int getLStatOfFile(const std::string& file, struct stat& sb)
    {
        return getStatOfFile(file, sb);
    }

    void createDirectory(const std::string& dir)
    {
        std::filesystem::create_directory(string_to_wide_string(dir));
    }
} // namespace FileUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
