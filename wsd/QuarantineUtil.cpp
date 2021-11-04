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
#include "LOOLWSD.hpp"
#include "DocumentBroker.hpp"

#include <common/Common.hpp>
#include <common/StringVector.hpp>
#include <common/Log.hpp>

namespace Quarantine
{
    bool isQuarantineEnabled()
    {
        return LOOLWSD::getConfigValue<bool>("quarantine_files[@enable]", false);
    }

    void createQuarantineMap()
    {
        if (!isQuarantineEnabled())
            return;

        std::vector<std::string> files;
        Poco::File(LOOLWSD::QuarantinePath).list(files);
        LOOLWSD::QuarantineMap.clear();

        std::vector<StringToken> tokens;
        std::string decoded;

        std::sort(files.begin(), files.end());
        for (auto file : files)
        {

            Util::tokenize(file.c_str(), file.size(), '_', tokens);
            Poco::URI::decode(file.substr(tokens[2]._index), decoded);
            LOOLWSD::QuarantineMap[decoded].emplace_back(LOOLWSD::QuarantinePath + file);

            tokens.clear();
            decoded.clear();
        }
    }

    void removeQuarantine()
    {
        if (!isQuarantineEnabled())
            return;

        FileUtil::removeFile(LOOLWSD::QuarantinePath, true);
    }

    // returns quarentine directory size in bytes
    // files with hardlink count of more than 1 is not counted
    // because they are originally stored in jails
    std::size_t quarantineSize()
    {
        if (!isQuarantineEnabled())
            return 0;

        std::vector<std::string> files;
        Poco::File(LOOLWSD::QuarantinePath).list(files);
        std::size_t size = 0;
        for (auto file : files)
        {
            FileUtil::Stat f(LOOLWSD::QuarantinePath + file);

            if (f.hardLinkCount() == 1)
                size += f.size();
        }
        return size;
    }

    void makeQuarantineSpace()
    {
        if (!isQuarantineEnabled())
            return;

        std::size_t sizeLimit = LOOLWSD::getConfigValue<std::size_t>("quarantine_files.limit_dir_size_mb", 0)*1024*1024;

        std::vector<std::string> files;
        Poco::File(LOOLWSD::QuarantinePath).list(files);

        std::sort(files.begin(), files.end());

        std::size_t currentSize = quarantineSize();
        std::size_t index = 0;
        while (currentSize >= sizeLimit && !files.empty())
        {
            FileUtil::Stat file(LOOLWSD::QuarantinePath + files[index]);
            if(file.hardLinkCount() != 1)
            {
                index++;
                continue;
            }
            currentSize -= file.size();
            FileUtil::removeFile(LOOLWSD::QuarantinePath + files[index], true);
            files.erase(files.begin());
        }
    }

    void clearOldQuarantineVersions(std::string Wopiscr)
    {
        if (!isQuarantineEnabled())
            return;

        std::size_t maxVersionCount = LOOLWSD::getConfigValue<std::size_t>("quarantine_files.max_versions_to_maintain", 2);
        std::string decoded;
        Poco::URI::decode(Wopiscr, decoded);
        while (LOOLWSD::QuarantineMap[decoded].size() > maxVersionCount)
        {
            FileUtil::removeFile(LOOLWSD::QuarantineMap[decoded][0]);
            LOOLWSD::QuarantineMap[decoded].erase(LOOLWSD::QuarantineMap[decoded].begin());
        }

    }

    bool quarantineFile(DocumentBroker* docBroker, std::string docName)
    {
        if (!isQuarantineEnabled())
            return false;

        std::string docKey;
        Poco::URI::encode(docBroker->getDocKey(), "?#/", docKey);

        const auto timeNow = std::chrono::system_clock::now();
        const std::string ts = std::to_string(std::chrono::duration_cast<std::chrono::seconds>(timeNow.time_since_epoch()).count());

        std::string sourcefilePath = LOOLWSD::ChildRoot + "tmp/lool-" + docBroker->getJailId() + "/user/docs/" + docBroker->getJailId() + "/" + docName;

        std::string linkedFileName = ts + "_" + std::to_string(docBroker->getPid()) + "_" + docKey;
        std::string linkedFilePath = LOOLWSD::QuarantinePath + linkedFileName;

        FileUtil::Stat fileStat(linkedFilePath);

        makeQuarantineSpace();

        int result_link = link(sourcefilePath.c_str(),linkedFilePath.c_str());

        if(result_link == 0)
        {
            LOOLWSD::QuarantineMap[docBroker->getDocKey()].emplace_back(linkedFilePath);
            clearOldQuarantineVersions(docKey);
            makeQuarantineSpace();

            LOG_INF("Quarantined " + sourcefilePath + " to " + linkedFilePath);
            return true;
        }
        else
        {
            std::string error(strerror(result_link));
            LOG_ERR("Quarantining of file " + sourcefilePath + " to " + linkedFilePath + " failed. " + error);
            return false;
        }

        return false;
    }
}
