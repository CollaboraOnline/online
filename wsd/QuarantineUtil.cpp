/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
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
std::unordered_map<std::string, std::vector<std::string>> Quarantine::QuarantineMap;
std::mutex Quarantine::Mutex;

Quarantine::Quarantine(DocumentBroker& docBroker, const std::string& docName)
    : _docKey(docBroker.getDocKey())
    , _docName(Util::encodeURIComponent(docName, std::string(",/?:@&=+$#") + Delimiter))
    , _quarantinedFilename(Delimiter + std::to_string(docBroker.getPid()) + Delimiter +
                           docBroker.getDocKey() + Delimiter + _docName)
    , _maxSizeBytes(COOLWSD::getConfigValue<std::size_t>("quarantine_files.limit_dir_size_mb", 0) *
                    1024 * 1024)
    , _maxAgeSecs(COOLWSD::getConfigValue<std::size_t>("quarantine_files.expiry_min", 30) * 60)
    , _maxVersions(std::max(
          COOLWSD::getConfigValue<std::size_t>("quarantine_files.max_versions_to_maintain", 2),
          1UL))
{
    LOG_DBG("Quarantine ctor for [" << _docKey << ']');
}

void Quarantine::initialize(const std::string& path)
{
    if (!COOLWSD::getConfigValue<bool>("quarantine_files[@enable]", false) ||
        !QuarantinePath.empty())
        return;

    // This function should ever be called once, but for consistency, take the lock.
    std::lock_guard<std::mutex> lock(Mutex);

    QuarantineMap.clear();

    std::vector<std::string> files;
    Poco::File(path).list(files);

    std::sort(files.begin(), files.end(),
              [](const auto& lhs, const auto& rhs)
              {
                  const auto lhsPair = Util::u64FromString(Util::split(lhs, Delimiter).first);
                  const auto rhsPair = Util::u64FromString(Util::split(rhs, Delimiter).first);
                  return lhsPair.first && rhsPair.first && lhsPair.second < rhsPair.second;
              });

    std::vector<StringToken> tokens;
    for (const auto& file : files)
    {
        StringVector::tokenize(file.c_str(), file.size(), Delimiter, tokens);
        if (tokens.size() >= 3)
        {
            const auto docKey = file.substr(tokens[2]._index, tokens[tokens.size() - 1]._index -
                                                                  tokens[2]._index - 1);
            const auto fullpath = path + file;
            LOG_TRC("Adding quarantine file [" << fullpath << "] for docKey [" << docKey
                                               << "] from quarantine directory");
            QuarantineMap[docKey].emplace_back(fullpath);
        }

        tokens.clear();
    }

    QuarantinePath = path;
}

void Quarantine::removeQuarantine()
{
    if (!isQuarantineEnabled())
        return;

    FileUtil::removeFile(QuarantinePath, true);
}

std::size_t Quarantine::quarantineSize()
{
    if (!isQuarantineEnabled())
        return 0;

    std::vector<std::string> files;
    Poco::File(QuarantinePath).list(files);
    std::size_t size = 0;
    for (const auto& file : files)
    {
        FileUtil::Stat f(QuarantinePath + file);
        size += f.size();
    }

    return size;
}

void Quarantine::makeQuarantineSpace()
{
    if (!isQuarantineEnabled())
        return;

    LOG_ASSERT_MSG(!Mutex.try_lock(), "Quarantine Mutex must be taken");

    std::vector<std::string> files;
    Poco::File(QuarantinePath).list(files);
    if (files.empty())
        return;

    std::sort(files.begin(), files.end(),
              [](const auto& lhs, const auto& rhs)
              {
                  const auto lhsPair = Util::u64FromString(Util::split(lhs, Delimiter).first);
                  const auto rhsPair = Util::u64FromString(Util::split(rhs, Delimiter).first);
                  return lhsPair.first && rhsPair.first && lhsPair.second < rhsPair.second;
              });

    const std::size_t now = getSecondsSinceEpoch();

    std::size_t currentSize = quarantineSize();
    auto index = files.begin();
    while (index != files.end() && !files.empty())
    {
        bool purge = currentSize >= _maxSizeBytes;
        if (!purge)
        {
            // Parse the timestamp from the quarantined filename (first token).
            const auto pair = Util::u64FromString(Util::split(*index, Delimiter).first);
            const auto age = (now - pair.first);
            if (!pair.second || (now > pair.first && age > _maxAgeSecs))
            {
                LOG_TRC("Will remove quarantined file [" << *index << "] which is " << age
                                                         << " secs old (max " << _maxAgeSecs
                                                         << " secs)");
                purge = true;
            }
        }

        if (purge)
        {
            FileUtil::Stat file(QuarantinePath + *index);
            LOG_TRC("Removing quarantined file ["
                    << *index << "] (" << file.size() << " bytes). Current quarantine size: "
                    << currentSize << " (max " << _maxSizeBytes << " bytes)");
            currentSize -= file.size();
            FileUtil::removeFile(QuarantinePath + *index, true);
            files.erase(index);
        }
        else
            index++;
    }
}

void Quarantine::clearOldQuarantineVersions()
{
    if (!isQuarantineEnabled())
        return;

    LOG_ASSERT_MSG(!Mutex.try_lock(), "Quarantine Mutex must be taken");

    auto& container = QuarantineMap[_docKey];
    if (container.size() > _maxVersions)
    {
        const std::size_t excess = container.size() - _maxVersions;
        LOG_TRC("Removing " << excess << " excess quarantined file versions for [" << _docKey
                            << ']');
        for (std::size_t i = 0; i < excess; ++i)
        {
            const std::string& path = container[i];
            LOG_TRC("Removing excess quarantined file version #" << (i + 1) << " [" << path
                                                                 << "] for [" << _docKey << ']');

            FileUtil::removeFile(path);
        }

        // And remove them from the container.
        container.erase(container.begin(), container.begin() + excess);
    }
}

bool Quarantine::quarantineFile(const std::string& docPath)
{
    if (!isQuarantineEnabled())
        return false;

    const std::string linkedFilePath =
        QuarantinePath + std::to_string(getSecondsSinceEpoch()) + _quarantinedFilename;

    std::lock_guard<std::mutex> lock(Mutex);

    auto& fileList = QuarantineMap[_docKey];
    if (!fileList.empty())
    {
        FileUtil::Stat sourceStat(docPath);
        FileUtil::Stat lastFileStat(fileList[fileList.size() - 1]);

        if (lastFileStat.isIdenticalTo(sourceStat))
        {
            LOG_INF("Quarantining of file ["
                    << docPath << "] to [" << linkedFilePath
                    << "] is skipped because this file version is already quarantined");
            return false;
        }
    }

    makeQuarantineSpace();

    if (FileUtil::linkOrCopyFile(docPath, linkedFilePath))
    {
        fileList.emplace_back(linkedFilePath);
        clearOldQuarantineVersions();
        makeQuarantineSpace();

        LOG_INF("Quarantined [" << docPath << "] to [" << linkedFilePath << ']');
        return true;
    }

    LOG_ERR("Quarantining of file [" << docPath << "] to [" << linkedFilePath << "] failed");
    return false;
}

void Quarantine::removeQuarantinedFiles()
{
    std::lock_guard<std::mutex> lock(Mutex);

    LOG_DBG("Removing all quarantined files for [" << _docKey << ']');
    for (const auto& file : QuarantineMap[_docKey])
    {
        LOG_TRC("Removing quarantined file [" << file << "] for [" << _docKey << ']');
        FileUtil::removeFile(file);
    }

    QuarantineMap.erase(_docKey);
}
