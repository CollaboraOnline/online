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

#include "QuarantineUtil.hpp"

#include <Poco/Path.h>
#include <Poco/URI.h>
#include "ClientSession.hpp"
#include "COOLWSD.hpp"
#include "DocumentBroker.hpp"
#include "FileUtil.hpp"
#include "Util.hpp"

#include <chrono>
#include <common/Common.hpp>
#include <common/StringVector.hpp>
#include <common/Log.hpp>
#include <mutex>

namespace
{
std::size_t getSecondsSinceEpoch()
{
    const auto timeNow = std::chrono::system_clock::now();
    return std::chrono::duration_cast<std::chrono::seconds>(timeNow.time_since_epoch()).count();
}

} // namespace

std::string Quarantine::QuarantinePath;
std::unordered_map<std::string, std::vector<Quarantine::Entry>> Quarantine::QuarantineMap;
std::mutex Quarantine::Mutex;
std::size_t Quarantine::MaxSizeBytes;
std::size_t Quarantine::MaxAgeSecs;
std::size_t Quarantine::MaxVersions;

Quarantine::Quarantine(DocumentBroker& docBroker, const std::string& docName)
    : _docKey(docBroker.getDocKey())
    , _docName(Util::encodeURIComponent(docName, std::string(",/?:@&=+$#") + Delimiter))
    , _quarantinedFilename(Delimiter + std::to_string(docBroker.getPid()) + Delimiter + _docName)
{
    LOG_DBG("Quarantine ctor for [" << _docKey << "], filename: [" << _quarantinedFilename << ']');
}

void Quarantine::initialize(const std::string& path)
{
    if (!COOLWSD::getConfigValue<bool>("quarantine_files[@enable]", false) ||
        !QuarantinePath.empty())
    {
        return;
    }

    MaxSizeBytes = COOLWSD::getConfigValue<std::size_t>("quarantine_files.limit_dir_size_mb", 250) *
                   1024 * 1024;
    MaxAgeSecs = COOLWSD::getConfigValue<std::size_t>("quarantine_files.expiry_min", 3000) * 60;
    MaxVersions = std::max(
        COOLWSD::getConfigValue<std::size_t>("quarantine_files.max_versions_to_maintain", 5), 1UL);
    LOG_INF("Initializing Quarantine at [" << path << "] with Max Size: " << MaxSizeBytes
                                           << " bytes, Max Age: " << MaxAgeSecs
                                           << " seconds, Max Versions: " << MaxVersions);

    // Make sure the quarantine directories exists, or we throw if we can't create it.
    Poco::File(path).createDirectories();

    // This function should ever be called once, but for consistency, take the lock.
    std::lock_guard<std::mutex> lock(Mutex);

    QuarantineMap.clear();

    std::vector<Poco::File> legacyFiles;
    std::vector<Poco::File> files;
    Poco::File(path).list(files);
    for (const Poco::File& file : files)
    {
        if (file.isFile())
        {
            legacyFiles.emplace_back(file);
        }
        else if (file.isDirectory())
        {
            // Directories are always DocKeys.
            Poco::Path filePath = file.path();
            const std::string& docKey = filePath.directory(filePath.depth());
            const std::string fullPath = file.path();

            std::vector<Poco::File> newFiles;
            Poco::File(fullPath).list(newFiles);
            if (newFiles.empty())
            {
                // Remove empty directories.
                LOG_TRC("Removing empty quarantine directory [" << fullPath << ']');
                FileUtil::removeFile(fullPath, /*recursive=*/true);
                continue;
            }

            std::vector<Entry> entries;
            entries.reserve(newFiles.size());
            for (const Poco::File& newFile : newFiles)
            {
                if (newFile.isFile())
                {
                    entries.emplace_back(path, docKey, Poco::Path(newFile.path()).getFileName());
                }
            }

            LOG_TRC("Found " << entries.size() << " quarantine file for DocKey [" << docKey << ']');
            if (!entries.empty())
            {
                QuarantineMap[docKey] = entries;
            }
        }
    }

    LOG_TRC("Found " << legacyFiles.size() << " quarantine legacy files");
    for (const Poco::File& legacyFile : legacyFiles)
    {
        Entry entry(path, Poco::Path(legacyFile.path()).getFileName());

        QuarantineMap[entry.docKey()].emplace_back(entry);
    }

    // Now we need to sort the files for each DocKey from oldest to newest.
    for (auto& pair : QuarantineMap)
    {
        std::sort(pair.second.begin(), pair.second.end(), [](const auto& lhs, const auto& rhs)
                  { return lhs.secondsSinceEpoch() < rhs.secondsSinceEpoch(); });
    }

    // We are initialized at this point.
    QuarantinePath = path;

    for (auto& pair : QuarantineMap)
    {
        LOG_TRC("BC Found " << pair.second.size() << " quarantine file(s) for DocKey ["
                            << pair.first << ']');
    }

    // Clean up.
    makeQuarantineSpace(/*headroomBytes=*/0);

    for (auto& pair : QuarantineMap)
    {
        LOG_TRC("AC Found " << pair.second.size() << " quarantine file(s) for DocKey ["
                            << pair.first << ']');
    }

    LOG_DBG("Found " << QuarantineMap.size() << " DocKey quarantines with total "
                     << quarantineSize() << " bytes");
}

void Quarantine::removeQuarantine()
{
    if (!isEnabled())
        return;

    FileUtil::removeFile(QuarantinePath, true);
}

std::size_t Quarantine::quarantineSize()
{
    LOG_ASSERT_MSG(!Mutex.try_lock(), "Quarantine Mutex must be taken");

    std::size_t size = 0;
    for (const auto& pair : QuarantineMap)
    {
        for (const Entry& entry : pair.second)
        {
            size += entry.size();
        }
    }

    return size;
}

void Quarantine::makeQuarantineSpace()
{
    if (!isEnabled())
        return;

    LOG_ASSERT_MSG(!Mutex.try_lock(), "Quarantine Mutex must be taken");

    std::vector<std::string> files = getAllFilesSorted(QuarantinePath);
    if (files.empty())
        return;

    const std::size_t now = getSecondsSinceEpoch();

    std::size_t currentSize = quarantineSize();
    auto index = files.begin();
    while (index != files.end())
    {
        bool purge = currentSize >= MaxSizeBytes;
        if (!purge)
        {
            // Parse the timestamp from the quarantined filename (first token).
            const auto pair = Util::u64FromString(Util::split(*index, Delimiter).first);
            const auto age = (now - pair.first);
            if (!pair.second || (now > pair.first && age > MaxAgeSecs))
            {
                LOG_TRC("Will remove quarantined file [" << *index << "] which is " << age
                                                         << " secs old (max " << MaxAgeSecs
                                                         << " secs)");
                purge = true;
            }
        }

        if (purge)
        {
            FileUtil::Stat file(QuarantinePath + *index);
            LOG_TRC("Removing quarantined file ["
                    << *index << "] (" << file.size() << " bytes). Current quarantine size: "
                    << currentSize << " (max " << MaxSizeBytes << " bytes)");
            currentSize -= file.size();
            FileUtil::removeFile(QuarantinePath + *index, true);
            index = files.erase(index);
        }
        else
            index++;
    }
}

void Quarantine::clearOldQuarantineVersions()
{
    if (!isEnabled())
        return;

    LOG_ASSERT_MSG(!Mutex.try_lock(), "Quarantine Mutex must be taken");

    auto& container = QuarantineMap[_docKey];
    if (container.size() > MaxVersions)
    {
        const std::size_t excess = container.size() - MaxVersions;
        LOG_TRC("Removing " << excess << " excess quarantined file versions for [" << _docKey
                            << ']');
        for (std::size_t i = 0; i < excess; ++i)
        {
            const std::string& path = container[i].fullPath();
            LOG_TRC("Removing excess quarantined file version #" << (i + 1) << " [" << path
                                                                 << "] for [" << _docKey << ']');

            FileUtil::removeFile(path);
        }

        // And remove them from the container.
        container.erase(container.begin(), container.begin() + excess);
    }
}

std::vector<std::string> Quarantine::getAllFilesSorted(const std::string& path)
{
    std::vector<std::string> files;
    Poco::File(path).list(files);

    std::sort(files.begin(), files.end(),
              [](const auto& lhs, const auto& rhs)
              {
                  const auto lhsPair = Util::u64FromString(Util::split(lhs, Delimiter).first);
                  const auto rhsPair = Util::u64FromString(Util::split(rhs, Delimiter).first);
                  return lhsPair.first && rhsPair.first && lhsPair.second < rhsPair.second;
              });

    return files;
}

bool Quarantine::quarantineFile(const std::string& docPath)
{
    if (!isEnabled())
        return false;

    FileUtil::Stat sourceStat(docPath);
    if (!sourceStat.exists())
    {
        LOG_WRN("Quarantining of file [" << docPath << "] failed because it does not exist");
        return false;
    }

    Entry entry(QuarantinePath, _docKey, getSecondsSinceEpoch(), _quarantinedFilename,
                sourceStat.size());
    Poco::File(Poco::Path(QuarantinePath, _docKey)).createDirectories();

    const std::string linkedFilePath = entry.fullPath();
    LOG_TRC("Quarantining [" << docPath << "] to [" << linkedFilePath << ']');

    std::lock_guard<std::mutex> lock(Mutex);

    // Check if we have a duplicate or a new version.
    auto& fileList = QuarantineMap[_docKey];
    if (!fileList.empty())
    {
        const auto& lastFile = fileList[fileList.size() - 1];
        FileUtil::Stat lastFileStat(lastFile.fullPath());

        if (lastFileStat.isIdenticalTo(sourceStat))
        {
            LOG_WRN("Quarantining of file ["
                    << docPath << "] to [" << linkedFilePath
                    << "] is skipped because this file version is already quarantined as ["
                    << lastFile.fullPath() << ']');
            return false;
        }
    }

    makeQuarantineSpace();

    if (FileUtil::linkOrCopyFile(docPath, linkedFilePath))
    {
        fileList.emplace_back(entry);
        clearOldQuarantineVersions();
        makeQuarantineSpace();

        LOG_WRN("Quarantined [" << docPath << "] to [" << linkedFilePath << ']');
        return true;
    }

    LOG_ERR("Quarantining of file [" << docPath << "] to [" << linkedFilePath << "] failed");
    return false;
}

std::string Quarantine::lastQuarantinedFilePath() const
{
    if (!isEnabled())
        return std::string();

    std::lock_guard<std::mutex> lock(Mutex);

    const auto& fileList = QuarantineMap[_docKey];
    return fileList.empty() ? std::string() : fileList[fileList.size() - 1].fullPath();
}

void Quarantine::removeQuarantinedFiles()
{
    std::lock_guard<std::mutex> lock(Mutex);

    LOG_DBG("Removing all quarantined files for [" << _docKey << ']');
    for (const auto& file : QuarantineMap[_docKey])
    {
        LOG_TRC("Removing quarantined file [" << file.fullPath() << "] for [" << _docKey << ']');
        FileUtil::removeFile(file.fullPath());
    }

    QuarantineMap.erase(_docKey);
}

Quarantine::Entry::Entry(const std::string& root, const std::string& filename)
{
    LOG_TRC("Quarantine file name: [" << filename << ']');

    _fullPath = Poco::Path(root, filename).toString();

    std::vector<StringToken> tokens;
    StringVector::tokenize(filename.c_str(), filename.size(), Delimiter, tokens);
    LOG_TRC("Quarantine file name: [" << filename << "]: " << tokens.size());
    if (tokens.size() > 3)
    {
        _secondsSinceEpoch =
            Util::u64FromString(filename.substr(tokens[0]._index, tokens[0]._length), /*def=*/0)
                .first;

        _pid = Util::u64FromString(filename.substr(tokens[1]._index, tokens[1]._length), /*def=*/0)
                   .first;

        // Note: this is unreliable since both the dockey and filename can (and often do) contain the Delimiter '_'.
        _docKey = filename.substr(tokens[2]._index,
                                  tokens[tokens.size() - 1]._index - tokens[2]._index - 1);

        _filename =
            filename.substr(tokens[tokens.size() - 1]._index, tokens[tokens.size() - 1]._length);

        FileUtil::Stat f(_fullPath);
        _size = f.good() ? f.size() : 0;
    }

    LOG_TRC("Legacy quarantine file for [" << _docKey << "], name: [" << _filename << "], size: "
                                           << _size << ", created: " << _secondsSinceEpoch);
}

Quarantine::Entry::Entry(const std::string& root, const std::string& docKey,
                         const std::string& filename)
{
    _fullPath = Poco::Path(Poco::Path(root, docKey), filename).toString();
    _docKey = docKey;

    std::vector<StringToken> tokens;
    StringVector::tokenize(filename.c_str(), filename.size(), Delimiter, tokens);
    LOG_TRC("Quarantine file for [" << _docKey << "], name: [" << filename
                                    << "]: " << tokens.size());
    if (tokens.size() >= 3)
    {
        _secondsSinceEpoch =
            Util::u64FromString(filename.substr(tokens[0]._index, tokens[0]._length), /*def=*/0)
                .first;

        _pid = Util::u64FromString(filename.substr(tokens[1]._index, tokens[1]._length), /*def=*/0)
                   .first;

        _filename = filename.substr(tokens[2]._index, tokens[2]._length);

        FileUtil::Stat f(_fullPath);
        _size = f.good() ? f.size() : 0;
    }

    LOG_TRC("Quarantine file for [" << _docKey << "], name: [" << _filename << "], size: " << _size
                                    << ", created: " << _secondsSinceEpoch);
}

Quarantine::Entry::Entry(const std::string& root, const std::string& docKey,
                         uint64_t secondsSinceEpoch, const std::string& filename, uint64_t size)
{
    const std::string newFilename = std::to_string(secondsSinceEpoch) + filename;
    _fullPath = Poco::Path(Poco::Path(root, docKey), newFilename).toString();
    _docKey = docKey;

    _secondsSinceEpoch = secondsSinceEpoch;

    _pid = getpid();

    _filename = filename;

    _size = size; // The file isn't quarantined yet, so we use the size of the source.

    LOG_TRC("New quarantine file for [" << _docKey << "], name: [" << _filename << "], size: "
                                        << _size << ", created: " << _secondsSinceEpoch);
}
