/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "QuarantineUtil.hpp"

#include <Poco/Path.h>
#include <Poco/URI.h>
#include "ClientSession.hpp"
#include "COOLWSD.hpp"
#include "DocumentBroker.hpp"

#include <common/Common.hpp>
#include <common/StringVector.hpp>
#include <common/Log.hpp>
#include <common/JailUtil.hpp>

namespace Quarantine
{
    bool isQuarantineEnabled()
    {
        return COOLWSD::getConfigValue<bool>("quarantine_files[@enable]", false);
    }

    void createQuarantineMap()
    {
        if (!isQuarantineEnabled())
            return;

        std::vector<std::string> files;
        Poco::File(COOLWSD::QuarantinePath).list(files);
        COOLWSD::QuarantineMap.clear();

        std::vector<StringToken> tokens;
        std::string decoded;

        std::sort(files.begin(), files.end());
        for (const auto& file : files)
        {

            StringVector::tokenize(file.c_str(), file.size(), '_', tokens);
            Poco::URI::decode(file.substr(tokens[2]._index), decoded);
            COOLWSD::QuarantineMap[decoded].emplace_back(COOLWSD::QuarantinePath + file);

            tokens.clear();
            decoded.clear();
        }
    }

    void removeQuarantine()
    {
        if (!isQuarantineEnabled())
            return;

        FileUtil::removeFile(COOLWSD::QuarantinePath, true);
    }

    // returns quarantine directory size in bytes
    // files with hardlink count of more than 1 is not counted
    // because they are originally stored in jails
    std::size_t quarantineSize()
    {
        if (!isQuarantineEnabled())
            return 0;

        std::vector<std::string> files;
        Poco::File(COOLWSD::QuarantinePath).list(files);
        std::size_t size = 0;
        for (const auto& file : files)
        {
            FileUtil::Stat f(COOLWSD::QuarantinePath + file);

            if (f.hardLinkCount() == 1)
                size += f.size();
        }
        return size;
    }

    void makeQuarantineSpace()
    {
        if (!isQuarantineEnabled())
            return;

        std::size_t sizeLimit = COOLWSD::getConfigValue<std::size_t>("quarantine_files.limit_dir_size_mb", 0)*1024*1024;

        std::vector<std::string> files;
        Poco::File(COOLWSD::QuarantinePath).list(files);

        std::sort(files.begin(), files.end());

        std::size_t timeLimit = COOLWSD::getConfigValue<std::size_t>("quarantine_files.expiry_min", 30);
        const auto timeNow = std::chrono::system_clock::now();
        const auto ts = std::chrono::duration_cast<std::chrono::seconds>(timeNow.time_since_epoch()).count();

        std::size_t currentSize = quarantineSize();
        auto index = files.begin();
        while (index != files.end() && !files.empty())
        {
            FileUtil::Stat file(COOLWSD::QuarantinePath + *index);
            const auto modifyTime = std::chrono::duration_cast<std::chrono::seconds>(file.modifiedTimepoint().time_since_epoch()).count();
            bool isExpired = static_cast<std::size_t>(ts - modifyTime) > timeLimit * 60;

            if ( (file.hardLinkCount() == 1) && (isExpired || (currentSize >= sizeLimit)) )
            {
                currentSize -= file.size();
                FileUtil::removeFile(COOLWSD::QuarantinePath + *index, true);
                files.erase(index);
            }
            else
                index++;
        }
    }

    void clearOldQuarantineVersions(const std::string& docKey)
    {
        if (!isQuarantineEnabled())
            return;

        std::size_t maxVersionCount =
            std::max<size_t>(COOLWSD::getConfigValue<std::size_t>("quarantine_files.max_versions_to_maintain", 2), 1);
        std::string decoded;
        Poco::URI::decode(docKey, decoded);
        while (COOLWSD::QuarantineMap[decoded].size() > maxVersionCount)
        {
            FileUtil::removeFile(COOLWSD::QuarantineMap[decoded][0]);
            COOLWSD::QuarantineMap[decoded].erase(COOLWSD::QuarantineMap[decoded].begin());
        }
    }

    bool quarantineFile(DocumentBroker* docBroker, const std::string& docName)
    {
        if (!isQuarantineEnabled())
            return false;

        std::string docKey;
        Poco::URI::encode(docBroker->getDocKey(), "?#/", docKey);

        const auto timeNow = std::chrono::system_clock::now();
        const std::string ts = std::to_string(std::chrono::duration_cast<std::chrono::seconds>(timeNow.time_since_epoch()).count());

        std::string sourcefilePath;
        if(JailUtil::isBindMountingEnabled())
        {
            sourcefilePath = COOLWSD::ChildRoot + "tmp/cool-" + docBroker->getJailId() +
                             "/user/docs/" + docBroker->getJailId() + '/' + docName;
        }
        else
        {
            sourcefilePath = COOLWSD::ChildRoot + docBroker->getJailId() + "/tmp/user/docs/" +
                             docBroker->getJailId() + '/' + docName;
        }

        std::string linkedFileName = ts + '_' + std::to_string(docBroker->getPid()) + '_' + docKey + '_' + docName;
        std::string linkedFilePath = COOLWSD::QuarantinePath + linkedFileName;

        auto& fileList = COOLWSD::QuarantineMap[docBroker->getDocKey()];
        if(!fileList.empty())
        {
            FileUtil::Stat sourceStat(sourcefilePath);
            FileUtil::Stat lastFileStat(fileList[fileList.size()-1]);

            if(lastFileStat.inodeNumber() == sourceStat.inodeNumber())
            {
                LOG_INF("Quarantining of file " << sourcefilePath << " to " << linkedFilePath
                    << " is skipped because this file version is already quarantined.");
                return false;
            }
        }


        makeQuarantineSpace();

        int result_link = link(sourcefilePath.c_str(),linkedFilePath.c_str());

        if (result_link == 0)
        {
            fileList.emplace_back(linkedFilePath);
            clearOldQuarantineVersions(docKey);
            makeQuarantineSpace();

            LOG_INF("Quarantined " << sourcefilePath << " to " << linkedFilePath);
            return true;
        }
        else
        {
            int saved_errno = errno;
            LOG_ERR("Quarantining of file " << sourcefilePath << " to " << linkedFilePath << " failed: "
                    << Util::symbolicErrno(saved_errno) << ": " << std::strerror(saved_errno));
            return false;
        }

        return false;
    }
}
