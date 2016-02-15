/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOOLWSD_HPP
#define INCLUDED_LOOLWSD_HPP

#include "config.h"

#include <string>
#include <mutex>
#include <atomic>

#include <Poco/Util/OptionSet.h>
#include <Poco/Random.h>
#include <Poco/Path.h>
#include <Poco/Util/ServerApplication.h>
#include <Poco/Process.h>

#include "Auth.hpp"
#include "Common.hpp"
#include "Util.hpp"

/// A DocumentURI as mananged by us.
/// Contains URI, physical path, etc.
class DocumentURI
{
public:

    static
    std::shared_ptr<DocumentURI> create(const std::string& url,
                                     const std::string& jailRoot,
                                     const std::string& childId)
    {
        // TODO: Sanitize the url and limit access!
        auto uriPublic = Poco::URI(url);
        uriPublic.normalize();

        const auto publicFilePath = uriPublic.getPath();

        if (publicFilePath.empty())
            throw std::runtime_error("Invalid URL.");

        // This lock could become a bottleneck.
        // In that case, we can use a pool and index by publicPath.
        std::unique_lock<std::mutex> lock(DocumentURIMutex);

        // Find the document if already open.
        auto it = UriToDocumentURIMap.lower_bound(publicFilePath);
        if (it != UriToDocumentURIMap.end() && it->first == publicFilePath)
        {
            Log::info("DocumentURI [" + it->first + "] found.");
            return it->second;
        }

        // The URL is the publicly visible one, not visible in the chroot jail.
        // We need to map it to a jailed path and copy the file there.
        auto uriJailed = uriPublic;
        if (uriPublic.isRelative() || uriPublic.getScheme() == "file")
        {
            // chroot/jailId/user/doc
            const auto jailedDocRoot = Poco::Path(jailRoot, JailedDocumentRoot);

            // chroot/jailId/user/doc/childId
            const auto docPath = Poco::Path(jailedDocRoot, childId);
            Poco::File(docPath).createDirectories();

            const auto filename = Poco::Path(uriPublic.getPath()).getFileName();

            // chroot/jailId/user/doc/childId/file.ext
            const auto jailedFilePath = Poco::Path(docPath, filename).toString();

            const auto localPath = Poco::Path(JailedDocumentRoot, childId);
            uriJailed = Poco::URI(Poco::URI("file://"), Poco::Path(localPath, filename).toString());

            Log::info("Public URI [" + uriPublic.toString() +
                      "] jailed to [" + uriJailed.toString() + "].");

#ifdef __linux
            Log::info("Linking " + publicFilePath + " to " + jailedFilePath);
            if (!Poco::File(jailedFilePath).exists() && link(publicFilePath.c_str(), jailedFilePath.c_str()) == -1)
            {
                // Failed
                Log::error("link(\"" + publicFilePath + "\", \"" + jailedFilePath + "\") failed.");
            }
#endif

            try
            {
                // Fallback to copying.
                if (!Poco::File(jailedFilePath).exists())
                {
                    Log::info("Copying " + publicFilePath + " to " + jailedFilePath);
                    Poco::File(publicFilePath).copyTo(jailedFilePath);
                }
            }
            catch (const Poco::Exception& exc)
            {
                Log::error("copyTo(\"" + publicFilePath + "\", \"" + jailedFilePath + "\") failed: " + exc.displayText());
                throw;
            }
        }
        else
        {
            Log::info("Public URI [" + uriPublic.toString() +
                      "] is not a file.");
        }

        auto document = std::shared_ptr<DocumentURI>(new DocumentURI(uriPublic, uriJailed, childId));

        Log::info("DocumentURI [" + publicFilePath + "] created.");
        it = UriToDocumentURIMap.emplace_hint(it, publicFilePath, document);
        return it->second;
    }

    Poco::URI getPublicUri() const { return _uriPublic; }
    Poco::URI getJailedUri() const { return _uriJailed; }
    std::string getJailId() const { return _jailId; }

private:
    DocumentURI(const Poco::URI& uriPublic,
             const Poco::URI& uriJailed,
             const std::string& jailId) :
       _uriPublic(uriPublic),
       _uriJailed(uriJailed),
       _jailId(jailId)
    {
    }

private:

    // DocumentURI management mutex.
    static std::mutex DocumentURIMutex;
    static std::map<std::string, std::shared_ptr<DocumentURI>> UriToDocumentURIMap;

private:
    const Poco::URI _uriPublic;
    const Poco::URI _uriJailed;
    const std::string _jailId;
};

class LOOLWSD: public Poco::Util::ServerApplication
{
public:
    LOOLWSD();
    ~LOOLWSD();

    // An Application is a singleton anyway, so just keep these as
    // statics
    static std::atomic<unsigned> NextSessionId;
    static int NumPreSpawnedChildren;
    static int BrokerWritePipe;
    static bool DoTest;
    static std::string Cache;
    static std::string SysTemplate;
    static std::string LoTemplate;
    static std::string ChildRoot;
    static std::string LoSubPath;
    //static Auth AuthAgent;

    static const std::string CHILD_URI;
    static const std::string PIDLOG;
    static const std::string FIFO_PATH;
    static const std::string FIFO_LOOLWSD;
    static const std::string LOKIT_PIDLOG;

    static
    std::string GenSessionId()
    {
        return Util::encodeId(++NextSessionId, 4);
    }

protected:
    void initialize(Poco::Util::Application& self) override;
    void uninitialize() override;
    void defineOptions(Poco::Util::OptionSet& options) override;
    void handleOption(const std::string& name, const std::string& value) override;
    int main(const std::vector<std::string>& args) override;

private:
    void displayHelp();
    void displayVersion();
    Poco::Process::PID createBroker();
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
