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

#include <atomic>
#include <mutex>
#include <string>

#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/Random.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Util/ServerApplication.h>

#include "Auth.hpp"
#include "Common.hpp"
#include "Storage.hpp"
#include "Util.hpp"

/// A DocumentURI as mananged by us.
/// Contains URI, physical path, etc.
class DocumentURI
{
public:

    static
    Poco::URI getUri(std::string uri)
    {
        // The URI of the document is url-encoded
        // and passed in our URL.
        if (uri.size() > 1 && uri[0] == '/')
        {
            // Remove leading '/'.
            uri.erase(0, 1);
        }

        std::string decodedUri;
        Poco::URI::decode(uri, decodedUri);
        auto uriPublic = Poco::URI(decodedUri);

        if (uriPublic.isRelative() || uriPublic.getScheme() == "file")
        {
            // TODO: Validate and limit access to local paths!
            uriPublic.normalize();
        }

        Log::info("Public URI [" + uriPublic.toString() + "].");
        if (uriPublic.getPath().empty())
        {
            throw std::runtime_error("Invalid URI.");
        }

        return uriPublic;
    }

    static
    std::shared_ptr<DocumentURI> create(const std::string& uri,
                                        const std::string& jailRoot,
                                        const std::string& childId)
    {
        std::string decodedUri;
        Poco::URI::decode(uri, decodedUri);
        auto uriPublic = Poco::URI(decodedUri);

        if (uriPublic.isRelative() || uriPublic.getScheme() == "file")
        {
            // TODO: Validate and limit access to local paths!
            uriPublic.normalize();
        }

        Log::info("Public URI [" + uriPublic.toString() + "].");
        if (uriPublic.getPath().empty())
        {
            throw std::runtime_error("Invalid URI.");
        }

        return create(uriPublic, jailRoot, childId);
    }

    static
    std::shared_ptr<DocumentURI> create(const Poco::URI& uriPublic,
                                        const std::string& jailRoot,
                                        const std::string& childId)
    {
        Log::info("DocumentURI: uri: " + uriPublic.toString() + ", jailRoot: " + jailRoot + ", childId: " + childId);

        // The URL is the publicly visible one, not visible in the chroot jail.
        // We need to map it to a jailed path and copy the file there.

        // user/doc/childId
        const auto jailPath = Poco::Path(JailedDocumentRoot, childId);

        Log::info("jailPath: " + jailPath.toString() + ", jailRoot: " + jailRoot);

        auto uriJailed = uriPublic;
        if (uriPublic.isRelative() || uriPublic.getScheme() == "file")
        {
            Log::info("Public URI [" + uriPublic.toString() + "] is a file.");
            std::unique_ptr<StorageBase> storage(new LocalStorage(jailRoot, jailPath.toString(), uriPublic.getPath()));
            const auto localPath = storage->getLocalFilePathFromStorage();
            uriJailed = Poco::URI(Poco::URI("file://"), localPath);
        }
        else
        {
            Log::info("Public URI [" + uriPublic.toString() +
                      "] assuming cloud storage.");
            //TODO: Configure the storage to use. For now, assume it's WOPI.
            std::unique_ptr<StorageBase> storage(new WopiStorage(jailRoot, jailPath.toString(), uriPublic.toString()));
            const auto localPath = storage->getLocalFilePathFromStorage();
            uriJailed = Poco::URI(Poco::URI("file://"), localPath);
        }

        auto document = std::shared_ptr<DocumentURI>(new DocumentURI(uriPublic, uriJailed, childId));

        Log::info("DocumentURI [" + uriPublic.toString() + "] created.");
        return document;
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
