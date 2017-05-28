/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * The main entry point for the LibreOfficeKit process serving
 * a document editing session.
 */

#include "config.h"

#include <dlfcn.h>
#include <ftw.h>
#include <malloc.h>
#include <sys/capability.h>
#include <unistd.h>
#include <utime.h>

#include <atomic>
#include <cassert>
#include <climits>
#include <condition_variable>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <sstream>
#include <thread>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitInit.h>
#include <LibreOfficeKit/LibreOfficeKit.hxx>

#include <Poco/Exception.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/Socket.h>
#include <Poco/Process.h>
#include <Poco/Runnable.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Thread.h>
#include <Poco/URI.h>
#include <Poco/Util/Application.h>

#include "ChildSession.hpp"
#include "Common.hpp"
#include "IoUtil.hpp"
#include "KitHelper.hpp"
#include "Kit.hpp"
#include "Protocol.hpp"
#include "LOOLWebSocket.hpp"
#include "Log.hpp"
#include "Png.hpp"
#include "Rectangle.hpp"
#include "TileDesc.hpp"
#include "Unit.hpp"
#include "UserMessages.hpp"
#include "Util.hpp"

#include "common/SigUtil.hpp"
#include "common/Seccomp.hpp"

#ifdef FUZZER
#include <kit/DummyLibreOfficeKit.hpp>
#include <wsd/LOOLWSD.hpp>
#endif

#define LIB_SOFFICEAPP  "lib" "sofficeapp" ".so"
#define LIB_MERGED      "lib" "mergedlo" ".so"

using Poco::Exception;
using Poco::File;
using Poco::JSON::Array;
using Poco::JSON::Object;
using Poco::JSON::Parser;
using Poco::Net::WebSocket;
using Poco::Runnable;
using Poco::StringTokenizer;
using Poco::Thread;
using Poco::Timestamp;
using Poco::URI;
using Poco::Util::Application;

#ifndef BUILDING_TESTS
using Poco::Net::HTTPClientSession;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Path;
using Poco::Process;
#endif

using namespace LOOLProtocol;

// We only host a single document in our lifetime.
class Document;
static std::shared_ptr<Document> document;
static LokHookFunction2* initFunction = nullptr;

namespace
{
#ifndef BUILDING_TESTS
    enum class LinkOrCopyType { All, LO, NoUsr };
    LinkOrCopyType linkOrCopyType;
    std::string sourceForLinkOrCopy;
    Path destinationForLinkOrCopy;

    bool shouldCopyDir(const char *path)
    {
        switch (linkOrCopyType)
        {
        case LinkOrCopyType::NoUsr:
            // bind mounted.
            return strcmp(path,"usr") != 0;
        case LinkOrCopyType::LO:
            return
                strcmp(path, "program/wizards") != 0 &&
                strcmp(path, "sdk") != 0 &&
                strcmp(path, "share/basic") != 0 &&
                strcmp(path, "share/gallery") != 0 &&
                strcmp(path, "share/Scripts") != 0 &&
                strcmp(path, "share/template") != 0 &&
                strcmp(path, "share/config/wizard") != 0 &&
                strcmp(path, "share/config/wizard") != 0;
        default: // LinkOrCopyType::All
            return true;
        }
    }

    int linkOrCopyFunction(const char *fpath,
                           const struct stat* /*sb*/,
                           int typeflag,
                           struct FTW* /*ftwbuf*/)
    {
        if (strcmp(fpath, sourceForLinkOrCopy.c_str()) == 0)
            return 0;

        assert(fpath[strlen(sourceForLinkOrCopy.c_str())] == '/');
        const char *relativeOldPath = fpath + strlen(sourceForLinkOrCopy.c_str()) + 1;
        Path newPath(destinationForLinkOrCopy, Path(relativeOldPath));

        switch (typeflag)
        {
        case FTW_F:
        case FTW_SLN:
            File(newPath.parent()).createDirectories();
            if (link(fpath, newPath.toString().c_str()) == -1)
            {
                LOG_SYS("link(\"" << fpath << "\", \"" <<
                        newPath.toString() << "\") failed. Will copy.");
                try
                {
                    File(fpath).copyTo(newPath.toString());
                }
                catch (const std::exception& exc)
                {
                    LOG_ERR("Copying of '" << fpath << "' to " << newPath.toString() <<
                            " failed: " << exc.what() << ". Exiting.");
                    std::_Exit(Application::EXIT_SOFTWARE);
                }
            }
            break;
        case FTW_D:
            {
                struct stat st;
                if (stat(fpath, &st) == -1)
                {
                    LOG_SYS("stat(\"" << std::string(fpath) << "\") failed.");
                    return 1;
                }
                if (!shouldCopyDir(relativeOldPath))
                {
                    LOG_TRC("skip redundant paths " << relativeOldPath);
                    return FTW_SKIP_SUBTREE;
                }
                File(newPath).createDirectories();
                struct utimbuf ut;
                ut.actime = st.st_atime;
                ut.modtime = st.st_mtime;
                if (utime(newPath.toString().c_str(), &ut) == -1)
                {
                    LOG_SYS("utime(\"" << newPath.toString() << "\") failed.");
                    return 1;
                }
            }
            break;
        case FTW_DNR:
            LOG_ERR("Cannot read directory '" << fpath << "'");
            return 1;
        case FTW_NS:
            LOG_ERR("nftw: stat failed for '" << fpath << "'");
            return 1;
        default:
            LOG_FTL("nftw: unexpected type: '" << typeflag);
            assert(false);
            break;
        }
        return 0;
    }

    void linkOrCopy(const std::string& source,
                    const Path& destination,
                    LinkOrCopyType type)
    {
        linkOrCopyType = type;
        sourceForLinkOrCopy = source;
        if (sourceForLinkOrCopy.back() == '/')
            sourceForLinkOrCopy.pop_back();
        destinationForLinkOrCopy = destination;
        if (nftw(source.c_str(), linkOrCopyFunction, 10, FTW_ACTIONRETVAL) == -1)
        {
            LOG_ERR("linkOrCopy: nftw() failed for '" << source << "'");
        }
    }

    void dropCapability(cap_value_t capability)
    {
        cap_t caps;
        cap_value_t cap_list[] = { capability };

        caps = cap_get_proc();
        if (caps == nullptr)
        {
            LOG_SYS("cap_get_proc() failed.");
            std::_Exit(1);
        }

        char *capText = cap_to_text(caps, nullptr);
        LOG_TRC("Capabilities first: " << capText);
        cap_free(capText);

        if (cap_set_flag(caps, CAP_EFFECTIVE, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1 ||
            cap_set_flag(caps, CAP_PERMITTED, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1)
        {
            LOG_SYS("cap_set_flag() failed.");
            std::_Exit(1);
        }

        if (cap_set_proc(caps) == -1)
        {
            LOG_SYS("cap_set_proc() failed.");
            std::_Exit(1);
        }

        capText = cap_to_text(caps, nullptr);
        LOG_TRC("Capabilities now: " << capText);
        cap_free(capText);

        cap_free(caps);
    }

    void symlinkPathToJail(const Path& jailPath, const std::string &loTemplate,
                           const std::string &loSubPath)
    {
        Path symlinkSource(jailPath, Path(loTemplate.substr(1)));
        File(symlinkSource.parent()).createDirectories();

        std::string symlinkTarget;
        for (auto i = 0; i < Path(loTemplate).depth(); i++)
            symlinkTarget += "../";
        symlinkTarget += loSubPath;

        LOG_DBG("symlink(\"" << symlinkTarget << "\",\"" << symlinkSource.toString() << "\")");
        if (symlink(symlinkTarget.c_str(), symlinkSource.toString().c_str()) == -1)
        {
            LOG_SYS("symlink(\"" << symlinkTarget << "\",\"" << symlinkSource.toString() << "\") failed");
            throw Exception("symlink() failed");
        }
    }
#endif
}

/// A quick & dirty cache of the last few PNGs
/// and their hashes to avoid re-compression
/// wherever possible.
class PngCache
{
    typedef std::shared_ptr< std::vector< char > > CacheData;
    struct CacheEntry {
        size_t    _hitCount;
        CacheData _data;
        CacheEntry(size_t defaultSize) :
            _hitCount(1),   // Every entry is used at least once; prevent removal at birth.
            _data( new std::vector< char >() )
        {
            _data->reserve( defaultSize );
        }
    } ;
    size_t _cacheSize;
    static const size_t CacheSizeSoftLimit = (1024 * 4 * 32); // 128k of cache
    static const size_t CacheSizeHardLimit = CacheSizeSoftLimit * 2;
    size_t _cacheHits;
    size_t _cacheTests;
    std::map< uint64_t, CacheEntry > _cache;

    void balanceCache()
    {
        // A normalish PNG image size for text in a writer document is
        // around 4k for a content tile, and sub 1k for a background one.
        if (_cacheSize > CacheSizeHardLimit)
        {
            size_t avgHits = 0;
            for (auto it = _cache.begin(); it != _cache.end(); ++it)
                avgHits += it->second._hitCount;

            LOG_DBG("cache " << _cache.size() << " items total size " <<
                    _cacheSize << " current hits " << avgHits << ", total hit rate " <<
                    (_cacheHits * 100. / _cacheTests) << "% at balance start");
            avgHits /= _cache.size();

            for (auto it = _cache.begin(); it != _cache.end();)
            {
                if ((_cacheSize > CacheSizeSoftLimit && it->second._hitCount == 0) ||
                    (_cacheSize > CacheSizeHardLimit && it->second._hitCount > 0 && it->second._hitCount <= avgHits))
                {
                    // Shrink cache when we exceed the size to maximize
                    // the chance of hitting these entries in the future.
                    _cacheSize -= it->second._data->size();
                    it = _cache.erase(it);
                }
                else
                {
                    if (it->second._hitCount > 0)
                        it->second._hitCount--;
                    ++it;
                }
            }

            LOG_DBG("cache " << _cache.size() << " items total size " <<
                    _cacheSize << " after balance");
        }
    }

    /// Lookup an entry in the cache and store the data in output.
    /// Returns true on success, otherwise false.
    bool cacheTest(const uint64_t hash, std::vector<char>& output)
    {
        if (hash)
        {
            ++_cacheTests;
            auto it = _cache.find(hash);
            if (it != _cache.end())
            {
                ++_cacheHits;
                LOG_DBG("PNG cache with hash " << hash << " hit.");
                output.insert(output.end(),
                              it->second._data->begin(),
                              it->second._data->end());
                it->second._hitCount++;
                return true;
            }
        }

        return false;
    }

    bool cacheEncodeSubBufferToPNG(unsigned char* pixmap, size_t startX, size_t startY,
                                   int width, int height,
                                   int bufferWidth, int bufferHeight,
                                   std::vector<char>& output, LibreOfficeKitTileMode mode,
                                   const uint64_t hash)
    {
        LOG_DBG("PNG cache with hash " << hash << " missed.");
        CacheEntry newEntry(bufferWidth * bufferHeight * 1);
        if (Png::encodeSubBufferToPNG(pixmap, startX, startY, width, height,
                                      bufferWidth, bufferHeight,
                                      *newEntry._data, mode))
        {
            if (hash)
            {
                newEntry._data->shrink_to_fit();
                _cache.emplace(hash, newEntry);
                _cacheSize += newEntry._data->size();
            }

            output.insert(output.end(),
                          newEntry._data->begin(),
                          newEntry._data->end());
            balanceCache();
            return true;
        }
        else
            return false;
    }

public:
    PngCache() :
        _cacheSize(0),
        _cacheHits(0),
        _cacheTests(0)
    {
    }

    bool encodeBufferToPNG(unsigned char* pixmap, int width, int height,
                           std::vector<char>& output, LibreOfficeKitTileMode mode,
                           uint64_t hash)
    {
        if (cacheTest(hash, output))
        {
            return true;
        }

        return cacheEncodeSubBufferToPNG(pixmap, 0, 0, width, height,
                                         width, height, output, mode, hash);
    }

    bool encodeSubBufferToPNG(unsigned char* pixmap, size_t startX, size_t startY,
                              int width, int height,
                              int bufferWidth, int bufferHeight,
                              std::vector<char>& output, LibreOfficeKitTileMode mode,
                              uint64_t hash)
    {
        if (cacheTest(hash, output))
        {
            return true;
        }

        return cacheEncodeSubBufferToPNG(pixmap, startX, startY, width, height,
                                         bufferWidth, bufferHeight, output, mode, hash);
    }
};

static FILE* ProcSMapsFile = nullptr;

/// A document container.
/// Owns LOKitDocument instance and connections.
/// Manages the lifetime of a document.
/// Technically, we can host multiple documents
/// per process. But for security reasons don't.
/// However, we could have a loolkit instance
/// per user or group of users (a trusted circle).
class Document : public Runnable, public IDocumentManager
{
public:
    /// We have two types of password protected documents
    /// 1) Documents which require password to view
    /// 2) Document which require password to modify
    enum class PasswordType { ToView, ToModify };

public:
    Document(const std::shared_ptr<lok::Office>& loKit,
             const std::string& jailId,
             const std::string& docKey,
             const std::string& docId,
             const std::string& url,
             std::shared_ptr<TileQueue> tileQueue,
             const std::shared_ptr<LOOLWebSocket>& ws)
      : _loKit(loKit),
        _jailId(jailId),
        _docKey(docKey),
        _docId(docId),
        _url(url),
        _tileQueue(std::move(tileQueue)),
        _ws(ws),
        _docPassword(""),
        _haveDocPassword(false),
        _isDocPasswordProtected(false),
        _docPasswordType(PasswordType::ToView),
        _stop(false),
        _isLoading(0)
    {
        LOG_INF("Document ctor for [" << _docKey <<
                "] url [" << _url << "] on child [" << _jailId <<
                "] and id [" << _docId << "].");
        assert(_loKit);

        _callbackThread.start(*this);
    }

    ~Document()
    {
        LOG_INF("~Document dtor for [" << _docKey <<
                "] url [" << _url << "] on child [" << _jailId <<
                "] and id [" << _docId << "]. There are " <<
                _sessions.size() << " views.");

        // Wait for the callback worker to finish.
        _stop = true;

        _tileQueue->put("eof");
        _callbackThread.join();
    }

    const std::string& getUrl() const { return _url; }

    bool createSession(const std::string& sessionId)
    {
        std::unique_lock<std::mutex> lock(_mutex);

        try
        {
            if (_sessions.find(sessionId) != _sessions.end())
            {
                LOG_WRN("Session [" << sessionId << "] on url [" << _url << "] already exists.");
                return true;
            }

            LOG_INF("Creating " << (_sessions.empty() ? "first" : "new") <<
                    " session for url: " << _url << " for sessionId: " <<
                    sessionId << " on jailId: " << _jailId);

            auto session = std::make_shared<ChildSession>(sessionId, _jailId, *this);
            _sessions.emplace(sessionId, session);

            LOG_DBG("Sessions: " << _sessions.size());
            return true;
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Exception while creating session [" << sessionId <<
                    "] on url [" << _url << "] - '" << ex.what() << "'.");
            return false;
        }
    }

    /// Purges dead connections and returns
    /// the remaining number of clients.
    /// Returns -1 on failure.
    size_t purgeSessions()
    {
        std::vector<std::shared_ptr<ChildSession>> deadSessions;
        size_t num_sessions = 0;
        {
            std::unique_lock<std::mutex> lock(_mutex, std::defer_lock);
            if (!lock.try_lock())
            {
                // Not a good time, try later.
                return -1;
            }

            // If there are no live sessions, we don't need to do anything at all and can just
            // bluntly exit, no need to clean up our own data structures. Also, there is a bug that
            // causes the deadSessions.clear() call below to crash in some situations when the last
            // session is being removed.
            for (auto it = _sessions.cbegin(); it != _sessions.cend(); )
            {
                if (it->second->isCloseFrame())
                {
                    deadSessions.push_back(it->second);
                    it = _sessions.erase(it);
                }
                else
                {
                    ++it;
                }
            }

            num_sessions = _sessions.size();
            if (num_sessions == 0)
            {
                LOG_INF("Document [" << _url << "] has no more views, exiting bluntly.");
                std::_Exit(Application::EXIT_OK);
            }
        }

        // Don't destroy sessions while holding our lock.
        // We may deadlock if a session is waiting on us
        // during callback initiated while handling a command
        // and the dtor tries to take its lock (which is taken).
        deadSessions.clear();

        return num_sessions;
    }

    /// Set Document password for given URL
    void setDocumentPassword(int passwordType)
    {
        LOG_INF("setDocumentPassword: passwordProtected=" << _isDocPasswordProtected <<
                " passwordProvided=" << _haveDocPassword <<
                " password='" << _docPassword << "'");

        Util::assertIsLocked(_documentMutex);

        if (_isDocPasswordProtected && _haveDocPassword)
        {
            // it means this is the second attempt with the wrong password; abort the load operation
            _loKit->setDocumentPassword(_jailedUrl.c_str(), nullptr);
            return;
        }

        // One thing for sure, this is a password protected document
        _isDocPasswordProtected = true;
        if (passwordType == LOK_CALLBACK_DOCUMENT_PASSWORD)
            _docPasswordType = PasswordType::ToView;
        else if (passwordType == LOK_CALLBACK_DOCUMENT_PASSWORD_TO_MODIFY)
            _docPasswordType = PasswordType::ToModify;

        LOG_INF("Calling _loKit->setDocumentPassword");
        if (_haveDocPassword)
            _loKit->setDocumentPassword(_jailedUrl.c_str(), _docPassword.c_str());
        else
            _loKit->setDocumentPassword(_jailedUrl.c_str(), nullptr);
        LOG_INF("setDocumentPassword returned");
    }

    void renderTile(const std::vector<std::string>& tokens, const std::shared_ptr<LOOLWebSocket>& ws)
    {
        assert(ws && "Expected a non-null websocket.");
        auto tile = TileDesc::parse(tokens);

        // Send back the request with all optional parameters given in the request.
        const auto tileMsg = tile.serialize("tile:");
#if ENABLE_DEBUG
        const std::string response = tileMsg + " renderid=" + Util::UniqueId() + "\n";
#else
        const std::string response = tileMsg + "\n";
#endif

        std::vector<char> output;
        output.reserve(response.size() + (4 * tile.getWidth() * tile.getHeight()));
        output.resize(response.size());
        std::memcpy(output.data(), response.data(), response.size());

        std::vector<unsigned char> pixmap;
        pixmap.resize(output.capacity());

        std::unique_lock<std::mutex> lock(_documentMutex);
        if (!_loKitDocument)
        {
            LOG_ERR("Tile rendering requested before loading document.");
            return;
        }

        if (_loKitDocument->getViewsCount() <= 0)
        {
            LOG_ERR("Tile rendering requested without views.");
            return;
        }

        const double area = tile.getWidth() * tile.getHeight();
        Timestamp timestamp;
        _loKitDocument->paintPartTile(pixmap.data(), tile.getPart(),
                                      tile.getWidth(), tile.getHeight(),
                                      tile.getTilePosX(), tile.getTilePosY(),
                                      tile.getTileWidth(), tile.getTileHeight());
        const auto elapsed = timestamp.elapsed();
        LOG_TRC("paintTile at (" << tile.getPart() << ',' << tile.getTilePosX() << ',' << tile.getTilePosY() <<
                ") " << "ver: " << tile.getVersion() << " rendered in " << (elapsed/1000.) <<
                " ms (" << area / elapsed << " MP/s).");
        const auto mode = static_cast<LibreOfficeKitTileMode>(_loKitDocument->getTileMode());

        const uint64_t hash = Png::hashBuffer(pixmap.data(), tile.getWidth(), tile.getHeight());
        if (hash != 0 && tile.getOldHash() == hash)
        {
            // The tile content is identical to what the client already has, so skip it
            LOG_TRC("Match oldhash==hash (" << hash << "), skipping");
            return;
        }

        if (!_pngCache.encodeBufferToPNG(pixmap.data(), tile.getWidth(), tile.getHeight(), output, mode, hash))
        {
            //FIXME: Return error.
            //sendTextFrame("error: cmd=tile kind=failure");
            LOG_ERR("Failed to encode tile into PNG.");
            return;
        }

        LOG_TRC("Sending render-tile response (" << output.size() << " bytes) for: " << response);
        ws->sendFrame(output.data(), output.size(), WebSocket::FRAME_BINARY);
    }

    void renderCombinedTiles(const std::vector<std::string>& tokens, const std::shared_ptr<LOOLWebSocket>& ws)
    {
        assert(ws && "Expected a non-null websocket.");
        auto tileCombined = TileCombined::parse(tokens);
        auto& tiles = tileCombined.getTiles();

        Util::Rectangle renderArea;
        std::vector<Util::Rectangle> tileRecs;
        tileRecs.reserve(tiles.size());

        for (auto& tile : tiles)
        {
            Util::Rectangle rectangle(tile.getTilePosX(), tile.getTilePosY(),
                                      tileCombined.getTileWidth(), tileCombined.getTileHeight());

            if (tileRecs.empty())
            {
                renderArea = rectangle;
            }
            else
            {
                renderArea.extend(rectangle);
            }

            tileRecs.push_back(rectangle);
        }

        const size_t tilesByX = renderArea.getWidth() / tileCombined.getTileWidth();
        const size_t tilesByY = renderArea.getHeight() / tileCombined.getTileHeight();
        const size_t pixmapWidth = tilesByX * tileCombined.getWidth();
        const size_t pixmapHeight = tilesByY * tileCombined.getHeight();
        const size_t pixmapSize = 4 * pixmapWidth * pixmapHeight;
        std::vector<unsigned char> pixmap(pixmapSize, 0);

        std::unique_lock<std::mutex> lock(_documentMutex);
        if (!_loKitDocument)
        {
            LOG_ERR("Tile rendering requested before loading document.");
            return;
        }

        if (_loKitDocument->getViewsCount() <= 0)
        {
            LOG_ERR("Tile rendering requested without views.");
            return;
        }

        const double area = pixmapWidth * pixmapHeight;
        Timestamp timestamp;
        _loKitDocument->paintPartTile(pixmap.data(), tileCombined.getPart(),
                                      pixmapWidth, pixmapHeight,
                                      renderArea.getLeft(), renderArea.getTop(),
                                      renderArea.getWidth(), renderArea.getHeight());
        Timestamp::TimeDiff elapsed = timestamp.elapsed();
        LOG_DBG("paintTile (combined) at (" << renderArea.getLeft() << ", " << renderArea.getTop() << "), (" <<
                renderArea.getWidth() << ", " << renderArea.getHeight() << ") " <<
                " rendered in " << (elapsed/1000.) << " ms (" << area / elapsed << " MP/s).");
        const auto mode = static_cast<LibreOfficeKitTileMode>(_loKitDocument->getTileMode());

        std::vector<char> output;
        output.reserve(pixmapWidth * pixmapHeight * 4);

        size_t tileIndex = 0;
        for (Util::Rectangle& tileRect : tileRecs)
        {
            const size_t positionX = (tileRect.getLeft() - renderArea.getLeft()) / tileCombined.getTileWidth();
            const size_t positionY = (tileRect.getTop() - renderArea.getTop()) / tileCombined.getTileHeight();

            const auto oldSize = output.size();
            const auto pixelWidth = tileCombined.getWidth();
            const auto pixelHeight = tileCombined.getHeight();

            const uint64_t hash = Png::hashSubBuffer(pixmap.data(), positionX * pixelWidth, positionY * pixelHeight,
                                                     pixelWidth, pixelHeight, pixmapWidth, pixmapHeight);

            if (hash != 0 && tiles[tileIndex].getOldHash() == hash)
            {
                // The tile content is identical to what the client already has, so skip it
                LOG_TRC("Match for tile #" << tileIndex << " at (" << positionX << "," <<
                        positionY << ") oldhash==hash (" << hash << "), skipping");
                tiles.erase(tiles.begin() + tileIndex);
                continue;
            }

            if (!_pngCache.encodeSubBufferToPNG(pixmap.data(), positionX * pixelWidth, positionY * pixelHeight,
                                                pixelWidth, pixelHeight, pixmapWidth, pixmapHeight, output, mode, hash))
            {
                //FIXME: Return error.
                //sendTextFrame("error: cmd=tile kind=failure");
                LOG_ERR("Failed to encode tile into PNG.");
                return;
            }

            const auto imgSize = output.size() - oldSize;
            LOG_TRC("Encoded tile #" << tileIndex << " at (" << positionX << "," << positionY << ") with oldhash=" <<
                    tiles[tileIndex].getOldHash() << ", hash=" << hash << " in " << imgSize << " bytes.");
            tiles[tileIndex].setHash(hash);
            tiles[tileIndex].setImgSize(imgSize);
            tileIndex++;
        }

        elapsed = timestamp.elapsed();
        LOG_DBG("renderCombinedTiles at (" << renderArea.getLeft() << ", " << renderArea.getTop() << "), (" <<
                renderArea.getWidth() << ", " << renderArea.getHeight() << ") " <<
                " took " << (elapsed/1000.) << " ms (including the paintTile).");

#if ENABLE_DEBUG
        const auto tileMsg = tileCombined.serialize("tilecombine:") + " renderid=" + Util::UniqueId() + "\n";
#else
        const auto tileMsg = tileCombined.serialize("tilecombine:") + "\n";
#endif
        LOG_TRC("Sending back painted tiles for " << tileMsg);

        std::vector<char> response;
        response.resize(tileMsg.size() + output.size());
        std::copy(tileMsg.begin(), tileMsg.end(), response.begin());
        std::copy(output.begin(), output.end(), response.begin() + tileMsg.size());

        ws->sendFrame(response.data(), response.size(), WebSocket::FRAME_BINARY);
    }

    bool sendTextFrame(const std::string& message) override
    {
        try
        {
            if (!_ws || _ws->poll(Poco::Timespan(0), Poco::Net::Socket::SelectMode::SELECT_ERROR))
            {
                LOG_ERR("Child Doc: Bad socket while sending [" << getAbbreviatedMessage(message) << "].");
                return false;
            }

            _ws->sendFrame(message.data(), message.size());
            return true;
        }
        catch (const Exception& exc)
        {
            LOG_ERR("Document::sendTextFrame: Exception: " << exc.displayText() <<
                    (exc.nested() ? "( " + exc.nested()->displayText() + ")" : ""));
        }

        return false;
    }

    static void GlobalCallback(const int type, const char* p, void* data)
    {
        if (TerminationFlag)
        {
            return;
        }

        const std::string payload = p ? p : "(nil)";
        LOG_TRC("Document::GlobalCallback " << LOKitHelper::kitCallbackTypeToString(type) <<
                " [" << payload << "].");
        Document* self = static_cast<Document*>(data);
        if (type == LOK_CALLBACK_DOCUMENT_PASSWORD_TO_MODIFY ||
            type == LOK_CALLBACK_DOCUMENT_PASSWORD)
        {
            // Mark the document password type.
            self->setDocumentPassword(type);
            return;
        }

        // Broadcast leftover status indicator callbacks to all clients
        self->broadcastCallbackToClients(type, payload);
    }

    static void ViewCallback(const int type, const char* p, void* data)
    {
        if (TerminationFlag)
        {
            return;
        }

        CallbackDescriptor* descriptor = static_cast<CallbackDescriptor*>(data);
        assert(descriptor && "Null callback data.");
        assert(descriptor->Doc && "Null Document instance.");

        auto tileQueue = descriptor->Doc->getTileQueue();
        assert(tileQueue && "Null TileQueue.");

        const std::string payload = p ? p : "(nil)";
        LOG_TRC("Document::ViewCallback [" << descriptor->ViewId <<
                "] [" << LOKitHelper::kitCallbackTypeToString(type) <<
                "] [" << payload << "].");

        // when we examine the content of the JSON
        std::string targetViewId;

        if (type == LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR ||
            type == LOK_CALLBACK_CELL_CURSOR)
        {
            Poco::StringTokenizer tokens(payload, ",", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
            // Payload may be 'EMPTY'.
            if (tokens.count() == 4)
            {
                auto cursorX = std::stoi(tokens[0]);
                auto cursorY = std::stoi(tokens[1]);
                auto cursorWidth = std::stoi(tokens[2]);
                auto cursorHeight = std::stoi(tokens[3]);

                tileQueue->updateCursorPosition(0, 0, cursorX, cursorY, cursorWidth, cursorHeight);
            }
        }
        else if (type == LOK_CALLBACK_INVALIDATE_VIEW_CURSOR ||
                 type == LOK_CALLBACK_CELL_VIEW_CURSOR)
        {
            Poco::JSON::Parser parser;
            const auto result = parser.parse(payload);
            const auto& command = result.extract<Poco::JSON::Object::Ptr>();
            targetViewId = command->get("viewId").toString();
            auto part = command->get("part").toString();
            auto text = command->get("rectangle").toString();
            Poco::StringTokenizer tokens(text, ",", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
            // Payload may be 'EMPTY'.
            if (tokens.count() == 4)
            {
                auto cursorX = std::stoi(tokens[0]);
                auto cursorY = std::stoi(tokens[1]);
                auto cursorWidth = std::stoi(tokens[2]);
                auto cursorHeight = std::stoi(tokens[3]);

                tileQueue->updateCursorPosition(std::stoi(targetViewId), std::stoi(part), cursorX, cursorY, cursorWidth, cursorHeight);
            }
        }

        // merge various callback types together if possible
        if (type == LOK_CALLBACK_INVALIDATE_TILES ||
            type == LOK_CALLBACK_DOCUMENT_SIZE_CHANGED)
        {
            // no point in handling invalidations or page resizes per-view,
            // all views have to be in sync
            tileQueue->put("callback all " + std::to_string(type) + ' ' + payload);
        }
        else if (type == LOK_CALLBACK_INVALIDATE_VIEW_CURSOR ||
                 type == LOK_CALLBACK_CELL_VIEW_CURSOR)
        {
            // these should go to all views but the one that that triggered it
            tileQueue->put("callback except-" + targetViewId + ' ' + std::to_string(type) + ' ' + payload);
        }
        else
            tileQueue->put("callback " + std::to_string(descriptor->ViewId) + ' ' + std::to_string(type) + ' ' + payload);
    }

private:

    /// Helper method to broadcast callback and its payload to all clients
    void broadcastCallbackToClients(const int type, const std::string& payload)
    {
        // "-1" means broadcast
        _tileQueue->put("callback all " + std::to_string(type) + ' ' + payload);
    }

    /// Load a document (or view) and register callbacks.
    bool onLoad(const std::string& sessionId,
                const std::string& uri,
                const std::string& userName,
                const std::string& docPassword,
                const std::string& renderOpts,
                const bool haveDocPassword,
                const std::string& lang) override
    {
        std::unique_lock<std::mutex> lock(_mutex);

        LOG_INF("Loading url [" << uri << "] for session [" << sessionId <<
                "] which has " << (_sessions.size() - 1) <<
                " sessions. Another load in progress: " << _isLoading);

        while (_isLoading)
        {
            _cvLoading.wait(lock);
        }

        // This shouldn't happen, but for sanity.
        const auto it = _sessions.find(sessionId);
        if (it == _sessions.end() || !it->second)
        {
            LOG_ERR("Cannot find session [" << sessionId << "] to load view for.");
            return false;
        }

        auto session = it->second;

        // Flag and release lock.
        ++_isLoading;
        lock.unlock();

        try
        {
            if (!load(session, uri, userName, docPassword, renderOpts, haveDocPassword, lang))
            {
                return false;
            }
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Exception while loading url [" << uri <<
                    "] for session [" << sessionId << "]: " << exc.what());
            return false;
        }

        --_isLoading;
        _cvLoading.notify_one();

        return true;
    }

    void onUnload(const ChildSession& session) override
    {
        const auto& sessionId = session.getId();
        LOG_INF("Unloading session [" << sessionId << "] on url [" << _url << "].");

        const auto viewId = session.getViewId();
        _tileQueue->removeCursorPosition(viewId);

        std::unique_lock<std::mutex> lockLokDoc(_documentMutex);
        if (_loKitDocument == nullptr)
        {
            LOG_ERR("Unloading session [" << sessionId << "] without loKitDocument.");
            return;
        }

        _loKitDocument->setView(viewId);
        _loKitDocument->registerCallback(nullptr, nullptr);

        int viewCount = _loKitDocument->getViewsCount();
        if (viewCount == 1)
        {
            std::unique_lock<std::mutex> lock(_mutex);
            if (_sessions.empty())
            {
                LOG_INF("Document [" << _url << "] has no more views, exiting bluntly.");
                std::_Exit(Application::EXIT_OK);
            }

            LOG_INF("Document [" << _url << "] has no more views, but has " <<
                    _sessions.size() << " sessions still. Destroying the document.");
            _loKitDocument.reset();
            LOG_INF("Document [" << _url << "] session [" << sessionId << "] unloaded Document.");
            return;
        }
        else
        {
            _loKitDocument->destroyView(viewId);
        }

        // Since callback messages are processed on idle-timer,
        // we could recieve callbacks after destroying a view.
        // Retain the CallbackDescriptor object, which is shared with Core.
        // _viewIdToCallbackDescr.erase(viewId);

        viewCount = _loKitDocument->getViewsCount();
        LOG_INF("Document [" << _url << "] session [" <<
                sessionId << "] unloaded view [" << viewId << "]. Have " <<
                viewCount << " view" << (viewCount != 1 ? "s." : "."));

        if (viewCount > 0)
        {
            // Get the list of view ids from the core
            std::vector<int> viewIds(viewCount);
            _loKitDocument->getViewIds(viewIds.data(), viewCount);

            lockLokDoc.unlock();

            // Broadcast updated view info
            notifyViewInfo(viewIds);
        }
    }

    std::map<int, UserInfo> getViewInfo() override
    {
        std::unique_lock<std::mutex> lock(_mutex);

        return _sessionUserInfo;
    }

    std::mutex& getMutex() override
    {
        return _mutex;
    }

    std::shared_ptr<TileQueue>& getTileQueue() override
    {
        return _tileQueue;
    }

    /// Notify all views of viewId and their associated usernames
    void notifyViewInfo(const std::vector<int>& viewIds) override
    {
        // Store the list of viewid, username mapping in a map
        std::map<int, UserInfo> viewInfoMap = getViewInfo();
        std::map<std::string, int> viewColorsMap = getViewColors();

        // Double check if list of viewids from core and our list matches,
        // and create an array of JSON objects containing id and username
        std::ostringstream oss;
        oss << "viewinfo: [";
        for (const auto& viewId : viewIds)
        {
            oss << "{\"id\":" << viewId << ",";
            int color = 0;
            const auto itView = viewInfoMap.find(viewId);
            if (itView == viewInfoMap.end())
            {
                LOG_ERR("No username found for viewId [" << viewId << "].");
                oss << "\"username\":\"Unknown\",";
            }
            else
            {
                oss << "\"userid\":\"" << itView->second.UserId << "\",";
                const auto username = itView->second.Username;
                oss << "\"username\":\"" << username << "\",";
                if (!itView->second.UserExtraInfo.empty())
                    oss << itView->second.UserExtraInfo << ',';
                const auto readonly = itView->second.IsReadOnly;
                oss << "\"readonly\":\"" << readonly << "\",";
                const auto it = viewColorsMap.find(username);
                if (it != viewColorsMap.end())
                {
                    color = it->second;
                }
            }

            oss << "\"color\":" << color << "},";
        }

        oss.seekp(-1, std::ios_base::cur); // Remove last comma.
        oss << "]";
        const auto msg = oss.str();

        // Broadcast updated viewinfo to all clients.
        sendTextFrame("client-all " + msg);
    }

private:

    // Get the color value for all author names from the core
    std::map<std::string, int> getViewColors()
    {
        std::string colorValues;
        std::map<std::string, int> viewColors;

        {
            std::unique_lock<std::mutex> lock(_documentMutex);

            char* values = _loKitDocument->getCommandValues(".uno:TrackedChangeAuthors");
            colorValues = std::string(values == nullptr ? "" : values);
            std::free(values);
        }

        try
        {
            if (!colorValues.empty())
            {
                Poco::JSON::Parser parser;
                auto root = parser.parse(colorValues).extract<Poco::JSON::Object::Ptr>();
                if (root->get("authors").type() == typeid(Poco::JSON::Array::Ptr))
                {
                    auto authorsArray = root->get("authors").extract<Poco::JSON::Array::Ptr>();
                    for (auto& authorVar: *authorsArray)
                    {
                        auto authorObj = authorVar.extract<Poco::JSON::Object::Ptr>();
                        auto authorName = authorObj->get("name").convert<std::string>();
                        auto colorValue = authorObj->get("color").convert<int>();
                        viewColors[authorName] = colorValue;
                    }
                }
            }
        }
        catch(const Exception& exc)
        {
            LOG_ERR("Poco Exception: " << exc.displayText() <<
                    (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
        }

        return viewColors;
    }

    std::shared_ptr<lok::Document> load(const std::shared_ptr<ChildSession>& session,
                                        const std::string& uri,
                                        const std::string& userName,
                                        const std::string& docPassword,
                                        const std::string& renderOpts,
                                        const bool haveDocPassword,
                                        const std::string& lang)
    {
        const std::string sessionId = session->getId();

        std::unique_lock<std::mutex> lock(_documentMutex);

        if (!_loKitDocument)
        {
            // This is the first time we are loading the document
            LOG_INF("Loading new document from URI: [" << uri << "] for session [" << sessionId << "].");

            _loKit->registerCallback(GlobalCallback, this);

            const auto flags = LOK_FEATURE_DOCUMENT_PASSWORD
                             | LOK_FEATURE_DOCUMENT_PASSWORD_TO_MODIFY
                             | LOK_FEATURE_PART_IN_INVALIDATION_CALLBACK
                             | LOK_FEATURE_NO_TILED_ANNOTATIONS;
            _loKit->setOptionalFeatures(flags);

            // Save the provided password with us and the jailed url
            _haveDocPassword = haveDocPassword;
            _docPassword = docPassword;
            _jailedUrl = uri;
            _isDocPasswordProtected = false;

            std::string options;
            if (!lang.empty())
                options = "Language=" + lang;

            LOG_DBG("Calling lokit::documentLoad(" << uri << ", \"" << options << "\").");
            Timestamp timestamp;
            _loKitDocument.reset(_loKit->documentLoad(uri.c_str(), options.c_str()));
            LOG_DBG("Returned lokit::documentLoad(" << uri << ") in " << (timestamp.elapsed() / 1000.) << "ms.");

            if (!_loKitDocument || !_loKitDocument->get())
            {
                LOG_ERR("Failed to load: " << uri << ", error: " << _loKit->getError());

                // Checking if wrong password or no password was reason for failure.
                if (_isDocPasswordProtected)
                {
                    LOG_INF("Document [" << uri << "] is password protected.");
                    if (!_haveDocPassword)
                    {
                        LOG_INF("No password provided for password-protected document [" << uri << "].");
                        std::string passwordFrame = "passwordrequired:";
                        if (_docPasswordType == PasswordType::ToView)
                            passwordFrame += "to-view";
                        else if (_docPasswordType == PasswordType::ToModify)
                            passwordFrame += "to-modify";
                        session->sendTextFrame("error: cmd=load kind=" + passwordFrame);
                    }
                    else
                    {
                        LOG_INF("Wrong password for password-protected document [" << uri << "].");
                        session->sendTextFrame("error: cmd=load kind=wrongpassword");
                    }
                }

                return nullptr;
            }

            // Only save the options on opening the document.
            // No support for changing them after opening a document.
            _renderOpts = renderOpts;
        }
        else
        {
            LOG_INF("Document with url [" << uri << "] already loaded. Need to create new view for session [" << sessionId << "].");

            // Check if this document requires password
            if (_isDocPasswordProtected)
            {
                if (!haveDocPassword)
                {
                    std::string passwordFrame = "passwordrequired:";
                    if (_docPasswordType == PasswordType::ToView)
                        passwordFrame += "to-view";
                    else if (_docPasswordType == PasswordType::ToModify)
                        passwordFrame += "to-modify";
                    session->sendTextFrame("error: cmd=load kind=" + passwordFrame);
                    return nullptr;
                }
                else if (docPassword != _docPassword)
                {
                    session->sendTextFrame("error: cmd=load kind=wrongpassword");
                    return nullptr;
                }
            }

            LOG_INF("Creating view to url [" << uri << "] for session [" << sessionId << "].");
            _loKitDocument->createView();
            LOG_TRC("View to url [" << uri << "] created.");
        }

        const std::string renderParams = makeRenderParams(userName);
        LOG_INF("Initializing for rendering session [" << sessionId << "] on document url [" <<
                _url << "] with: [" << renderParams << "].");

        // initializeForRendering() should be called before
        // registerCallback(), as the previous creates a new view in Impress.
        _loKitDocument->initializeForRendering(renderParams.c_str());

        const int viewId = _loKitDocument->getView();
        session->setViewId(viewId);
        _sessionUserInfo[viewId] = UserInfo(session->getViewUserId(), session->getViewUserName(),
                                            session->getViewUserExtraInfo(), session->isReadOnly());

        _viewIdToCallbackDescr.emplace(viewId,
                                       std::unique_ptr<CallbackDescriptor>(new CallbackDescriptor({ this, viewId })));
        _loKitDocument->registerCallback(ViewCallback, _viewIdToCallbackDescr[viewId].get());

        const int viewCount = _loKitDocument->getViewsCount();
        LOG_INF("Document url [" << _url << "] for session [" <<
                sessionId << "] loaded view [" << viewId << "]. Have " <<
                viewCount << " view" << (viewCount != 1 ? "s." : "."));

        return _loKitDocument;
    }

    bool forwardToChild(const std::string& prefix, const std::vector<char>& payload)
    {
        assert(payload.size() > prefix.size());

        // Remove the prefix and trim.
        size_t index = prefix.size();
        for ( ; index < payload.size(); ++index)
        {
            if (payload[index] != ' ')
            {
                break;
            }
        }

        auto data = payload.data() + index;
        auto size = payload.size() - index;

        std::string name;
        std::string sessionId;
        if (LOOLProtocol::parseNameValuePair(prefix, name, sessionId, '-') && name == "child")
        {
            std::unique_lock<std::mutex> lock(_mutex);

            const auto it = _sessions.find(sessionId);
            if (it != _sessions.end())
            {
                auto session = it->second;

                static const std::string disconnect("disconnect");
                if (size == disconnect.size() &&
                    strncmp(data, disconnect.data(), disconnect.size()) == 0)
                {
                    LOG_DBG("Removing ChildSession [" << sessionId << "].");
                    _sessions.erase(it);
                    const auto count = _sessions.size();
                    LOG_DBG("Have " << count << " child" << (count == 1 ? "" : "ren") <<
                            " after removing ChildSession [" << sessionId << "].");

                    // No longer needed, and allow session dtor to take it.
                    lock.unlock();
                    session.reset();
                    return true;
                }

                // No longer needed, and allow the handler to take it.
                lock.unlock();
                if (session)
                {
                    std::vector<char> vect(size);
                    vect.assign(data, data + size);

                    // TODO loolnb - this is probably wrong...
                    session->handleMessage(/* fin = */ false, WebSocketHandler::WSOpCode::Binary, vect);
                    return true;
                }
            }

            const auto abbrMessage = getAbbreviatedMessage(data, size);
            LOG_WRN("Child session [" << sessionId << "] not found to forward message: " << abbrMessage);
        }
        else
        {
            LOG_ERR("Failed to parse prefix of forward-to-child message: " << prefix);
        }

        return false;
    }

    std::string makeRenderParams(const std::string& userName)
    {
        Object::Ptr renderOptsObj;

        // Fill the object with renderoptions, if any
        if (!_renderOpts.empty())
        {
            Parser parser;
            Poco::Dynamic::Var var = parser.parse(_renderOpts);
            renderOptsObj = var.extract<Object::Ptr>();
        }
        else if (!userName.empty())
        {
            renderOptsObj = new Object();
        }

        // Append name of the user, if any, who opened the document to rendering options
        if (!userName.empty())
        {
            Object::Ptr authorObj = new Object();
            authorObj->set("type", "string");
            std::string decodedUserName;
            URI::decode(userName, decodedUserName);
            authorObj->set("value", decodedUserName);
            renderOptsObj->set(".uno:Author", authorObj);
        }

        std::string renderParams;
        if (renderOptsObj)
        {
            std::ostringstream ossRenderOpts;
            renderOptsObj->stringify(ossRenderOpts);
            renderParams = ossRenderOpts.str();
        }

        return renderParams;
    }

    void run() override
    {
        Util::setThreadName("lokit_" + _docId);

        LOG_DBG("Thread started.");

        // Update memory stats every 5 seconds.
        const auto memStatsPeriodMs = 5000;
        auto lastMemStatsTime = std::chrono::steady_clock::now();
        sendTextFrame(Util::getMemoryStats(ProcSMapsFile));

        try
        {
            while (!_stop && !TerminationFlag)
            {
                const TileQueue::Payload input = _tileQueue->get(POLL_TIMEOUT_MS * 2);
                if (input.empty())
                {
                    const auto duration = (std::chrono::steady_clock::now() - lastMemStatsTime);
                    const auto durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
                    if (durationMs > memStatsPeriodMs)
                    {
                        sendTextFrame(Util::getMemoryStats(ProcSMapsFile));
                        lastMemStatsTime = std::chrono::steady_clock::now();
                    }

                    continue;
                }

                LOG_TRC("Kit Recv " << LOOLProtocol::getAbbreviatedMessage(input));

                if (_stop || TerminationFlag)
                {
                    LOG_INF("Kit: Stop flagged.");
                    break;
                }

                const auto tokens = LOOLProtocol::tokenize(input.data(), input.size());

                if (tokens[0] == "eof")
                {
                    LOG_INF("Received EOF. Finishing.");
                    break;
                }

                if (tokens[0] == "tile")
                {
                    renderTile(tokens, _ws);
                }
                else if (tokens[0] == "tilecombine")
                {
                    renderCombinedTiles(tokens, _ws);
                }
                else if (LOOLProtocol::getFirstToken(tokens[0], '-') == "child")
                {
                    forwardToChild(tokens[0], input);
                }
                else if (tokens[0] == "callback")
                {
                    if (tokens.size() >= 3)
                    {
                        bool broadcast = false;
                        int viewId = -1;
                        int exceptViewId = -1;

                        const std::string& target = tokens[1];
                        if (target == "all")
                        {
                            broadcast = true;
                        }
                        else if (LOOLProtocol::matchPrefix("except-", target))
                        {
                            exceptViewId = std::stoi(target.substr(7));
                            broadcast = true;
                        }
                        else
                        {
                            viewId = std::stoi(target);
                        }

                        const int type = std::stoi(tokens[2]);

                        // payload is the rest of the message
                        const auto offset = tokens[0].length() + tokens[1].length() + tokens[2].length() + 3; // + delims
                        const std::string payload(input.data() + offset, input.size() - offset);

                        // Forward the callback to the same view, demultiplexing is done by the LibreOffice core.
                        // TODO: replace with a map to be faster.
                        bool isFound = false;
                        for (auto& it : _sessions)
                        {
                            auto session = it.second;
                            if (session && ((broadcast && (session->getViewId() != exceptViewId)) || (!broadcast && (session->getViewId() == viewId))))
                            {
                                if (!it.second->isCloseFrame())
                                {
                                    isFound = true;
                                    session->loKitCallback(type, payload);
                                }
                                else
                                {
                                    LOG_ERR("Session-thread of session [" << session->getId() << "] for view [" <<
                                            viewId << "] is not running. Dropping [" << LOKitHelper::kitCallbackTypeToString(type) <<
                                            "] payload [" << payload << "].");
                                }

                                if (!broadcast)
                                {
                                    break;
                                }
                            }
                        }

                        if (!isFound)
                        {
                            LOG_WRN("Document::ViewCallback. Session [" << viewId <<
                                    "] is no longer active to process [" << LOKitHelper::kitCallbackTypeToString(type) <<
                                    "] [" << payload << "] message to Master Session.");
                        }
                    }
                    else
                    {
                        LOG_ERR("Invalid callback message: [" << LOOLProtocol::getAbbreviatedMessage(input) << "].");
                    }
                }
                else
                {
                    LOG_ERR("Unexpected request: [" << LOOLProtocol::getAbbreviatedMessage(input) << "].");
                }
            }
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("QueueHandler::run: Exception: " << exc.what());
        }

        LOG_DBG("Thread finished.");
    }

    /// Return access to the lok::Document instance.
    std::shared_ptr<lok::Document> getLOKitDocument() override
    {
        if (!_loKitDocument)
        {
            LOG_ERR("Document [" << _docKey << "] is not loaded.");
            throw std::runtime_error("Document " + _docKey + " is not loaded.");
        }

        return _loKitDocument;
    }

    /// Return access to the lok::Document instance.
    std::mutex& getDocumentMutex() override
    {
        return _documentMutex;
    }

private:
    std::shared_ptr<lok::Office> _loKit;
    const std::string _jailId;
    /// URL-based key. May be repeated during the lifetime of WSD.
    const std::string _docKey;
    /// Short numerical ID. Unique during the lifetime of WSD.
    const std::string _docId;
    const std::string _url;
    std::string _jailedUrl;
    std::string _renderOpts;

    std::shared_ptr<lok::Document> _loKitDocument;
    std::shared_ptr<TileQueue> _tileQueue;
    std::shared_ptr<LOOLWebSocket> _ws;
    PngCache _pngCache;

    // Document password provided
    std::string _docPassword;
    // Whether password was provided or not
    bool _haveDocPassword;
    // Whether document is password protected
    bool _isDocPasswordProtected;
    // Whether password is required to view the document, or modify it
    PasswordType _docPasswordType;

    std::atomic<bool> _stop;
    mutable std::mutex _mutex;

    /// Mutex guarding the lok::Document so that we can lock operations
    /// like setting a view followed by a tile render, etc.
    std::mutex _documentMutex;

    std::condition_variable _cvLoading;
    std::atomic_size_t _isLoading;
    std::map<int, std::unique_ptr<CallbackDescriptor>> _viewIdToCallbackDescr;
    std::map<std::string, std::shared_ptr<ChildSession>> _sessions;

    /// For showing disconnected user info in the doc repair dialog.
    std::map<int, UserInfo> _sessionUserInfo;
    Poco::Thread _callbackThread;
};

void documentViewCallback(const int type, const char* payload, void* data)
{
    Document::ViewCallback(type, payload, data);
}

#ifndef BUILDING_TESTS
void lokit_main(const std::string& childRoot,
                const std::string& jailId,
                const std::string& sysTemplate,
                const std::string& loTemplate,
                const std::string& loSubPath,
                bool noCapabilities,
                bool queryVersion,
                bool displayVersion)
{
#ifndef FUZZER
    SigUtil::setFatalSignals();
    SigUtil::setTerminationSignals();
#endif

    Util::setThreadName("loolkit");

    // Reinitialize logging when forked.
    const bool logToFile = std::getenv("LOOL_LOGFILE");
    const char* logFilename = std::getenv("LOOL_LOGFILENAME");
    const char* logLevel = std::getenv("LOOL_LOGLEVEL");
    const char* logColor = std::getenv("LOOL_LOGCOLOR");
    std::map<std::string, std::string> logProperties;
    if (logToFile && logFilename)
    {
        logProperties["path"] = std::string(logFilename);
    }

    Log::initialize("kit", logLevel ? logLevel : "", logColor != nullptr, logToFile, logProperties);
    Util::rng::reseed();

    assert(!childRoot.empty());
    assert(!sysTemplate.empty());
    assert(!loTemplate.empty());
    assert(!loSubPath.empty());

    LOG_DBG("Process started.");

    std::string userdir_url;
    std::string instdir_path;

    // lokit's destroy typically throws from
    // framework/source/services/modulemanager.cxx:198
    // So we insure it lives until std::_Exit is called.
    std::shared_ptr<lok::Office> loKit;
    Path jailPath;
    bool bRunInsideJail = !noCapabilities;
    try
    {
        jailPath = Path::forDirectory(childRoot + "/" + jailId);
        LOG_INF("Jail path: " << jailPath.toString());
        File(jailPath).createDirectories();

        if (bRunInsideJail)
        {
            userdir_url = "file:///user";
            instdir_path = "/" + loSubPath + "/program";

            // Create a symlink inside the jailPath so that the absolute pathname loTemplate, when
            // interpreted inside a chroot at jailPath, points to loSubPath (relative to the chroot).
            symlinkPathToJail(jailPath, loTemplate, loSubPath);

            // Font paths can end up as realpaths so match that too.
            char *resolved = realpath(loTemplate.c_str(), nullptr);
            if (resolved)
            {
                if (strcmp(loTemplate.c_str(), resolved) != 0)
                    symlinkPathToJail(jailPath, std::string(resolved), loSubPath);
                free (resolved);
            }

            Path jailLOInstallation(jailPath, loSubPath);
            jailLOInstallation.makeDirectory();
            File(jailLOInstallation).createDirectory();

            // Copy (link) LO installation and other necessary files into it from the template.
            bool bLoopMounted = false;
            if (std::getenv("LOOL_BIND_MOUNT"))
            {
                Path usrSrcPath(sysTemplate, "usr");
                Path usrDestPath(jailPath, "usr");
                File(usrDestPath).createDirectory();
                std::string mountCommand =
                    std::string("loolmount ") +
                    usrSrcPath.toString() +
                    std::string(" ") +
                    usrDestPath.toString();
                LOG_DBG("Initializing jail bind mount.");
                bLoopMounted = !system(mountCommand.c_str());
                LOG_DBG("Initialized jail bind mount.");
            }
            linkOrCopy(sysTemplate, jailPath,
                       bLoopMounted ? LinkOrCopyType::NoUsr : LinkOrCopyType::All);
            linkOrCopy(loTemplate, jailLOInstallation, LinkOrCopyType::LO);

            // We need this because sometimes the hostname is not resolved
            const auto networkFiles = {"/etc/host.conf", "/etc/hosts", "/etc/nsswitch.conf", "/etc/resolv.conf"};
            for (const auto& filename : networkFiles)
            {
                const auto etcPath = Path(jailPath, filename).toString();
                const File networkFile(filename);
                if (networkFile.exists() && !File(etcPath).exists())
                {
                    networkFile.copyTo(etcPath);
                }
            }

            LOG_DBG("Initialized jail files.");

            // Create the urandom and random devices
            File(Path(jailPath, "/dev")).createDirectory();
            if (mknod((jailPath.toString() + "/dev/random").c_str(),
                      S_IFCHR | S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH,
                      makedev(1, 8)) != 0)
            {
                LOG_SYS("mknod(" << jailPath.toString() << "/dev/random) failed.");
            }

            if (mknod((jailPath.toString() + "/dev/urandom").c_str(),
                      S_IFCHR | S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH,
                      makedev(1, 9)) != 0)
            {
                LOG_SYS("mknod(" << jailPath.toString() << "/dev/urandom) failed.");
            }

            ProcSMapsFile = fopen("/proc/self/smaps", "r");
            if (ProcSMapsFile == nullptr)
            {
                LOG_SYS("Failed to symlink /proc/self/smaps. Memory stats will be missing.");
            }

            LOG_INF("chroot(\"" << jailPath.toString() << "\")");
            if (chroot(jailPath.toString().c_str()) == -1)
            {
                LOG_SYS("chroot(\"" << jailPath.toString() << "\") failed.");
                std::_Exit(Application::EXIT_SOFTWARE);
            }

            if (chdir("/") == -1)
            {
                LOG_SYS("chdir(\"/\") in jail failed.");
                std::_Exit(Application::EXIT_SOFTWARE);
            }

            dropCapability(CAP_SYS_CHROOT);
            dropCapability(CAP_MKNOD);
            dropCapability(CAP_FOWNER);

            LOG_DBG("Initialized jail nodes, dropped caps.");
        }
        else // noCapabilities set
        {
            LOG_INF("Using template " << loTemplate << " as install subpath - skipping jail setup");
            userdir_url = "file:///" + jailPath.toString() + "/user";
            instdir_path = "/" + loTemplate + "/program";
        }

        {
            const char *instdir = instdir_path.c_str();
            const char *userdir = userdir_url.c_str();
#ifndef KIT_IN_PROCESS
            LibreOfficeKit* kit = UnitKit::get().lok_init(instdir, userdir);
#else
            LibreOfficeKit* kit = nullptr;
#ifdef FUZZER
            if (LOOLWSD::DummyLOK)
                kit = dummy_lok_init_2(instdir, userdir);
#endif
#endif
            if (!kit)
            {
                kit = (initFunction ? initFunction(instdir, userdir) : lok_init_2(instdir, userdir));
            }

            loKit = std::make_shared<lok::Office>(kit);
            if (!loKit)
            {
                LOG_FTL("LibreOfficeKit initialization failed. Exiting.");
                std::_Exit(Application::EXIT_SOFTWARE);
            }
        }

        // Lock down the syscalls that can be used
        if (!Seccomp::lockdown(Seccomp::Type::KIT))
        {
            LOG_ERR("LibreOfficeKit security lockdown failed. Exiting.");
            std::_Exit(Application::EXIT_SOFTWARE);
        }

        assert(loKit);
        LOG_INF("Process is ready.");

        static const std::string pid = std::to_string(Process::id());

        std::string requestUrl = NEW_CHILD_URI;
        requestUrl += "pid=" + pid + "&jailid=" + jailId;
        if (queryVersion)
        {
            char* versionInfo = loKit->getVersionInfo();
            std::string versionString(versionInfo);
            if (displayVersion)
                std::cout << "office version details: " << versionString << std::endl;
            std::string encodedVersionStr;
            URI::encode(versionString, "", encodedVersionStr);
            requestUrl += "&version=" + encodedVersionStr;
            free(versionInfo);
        }

        // Open websocket connection between the child process and WSD.
        HTTPClientSession cs("127.0.0.1", MasterPortNumber);
        cs.setTimeout(Poco::Timespan(10, 0)); // 10 second
        LOG_DBG("Connecting to Master " << cs.getHost() << ':' << cs.getPort());
        HTTPRequest request(HTTPRequest::HTTP_GET, requestUrl);
        HTTPResponse response;
        auto ws = std::make_shared<LOOLWebSocket>(cs, request, response);
        ws->setReceiveTimeout(0);

        auto queue = std::make_shared<TileQueue>();

        const std::string socketName = "child_ws_" + pid;
        IoUtil::SocketProcessor(ws, socketName,
                [&socketName, &ws, &loKit, &jailId, &queue](const std::vector<char>& data)
                {
                    std::string message(data.data(), data.size());

#ifndef KIT_IN_PROCESS
                    if (UnitKit::get().filterKitMessage(ws, message))
                    {
                        return true;
                    }
#endif

                    LOG_DBG(socketName << ": recv [" << LOOLProtocol::getAbbreviatedMessage(message) << "].");
                    StringTokenizer tokens(message, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

                    // Note: Syntax or parsing errors here are unexpected and fatal.
                    if (TerminationFlag)
                    {
                        LOG_DBG("Too late, we're going down");
                    }
                    else if (tokens[0] == "session")
                    {
                        const std::string& sessionId = tokens[1];
                        const std::string& docKey = tokens[2];
                        const std::string& docId = tokens[3];

                        std::string url;
                        URI::decode(docKey, url);
                        LOG_INF("New session [" << sessionId << "] request on url [" << url << "].");

                        if (!document)
                        {
                            document = std::make_shared<Document>(loKit, jailId, docKey, docId, url, queue, ws);
                        }

                        // Validate and create session.
                        if (!(url == document->getUrl() &&
                              document->createSession(sessionId)))
                        {
                            LOG_DBG("CreateSession failed.");
                        }
                    }
                    else if (tokens[0] == "exit")
                    {
                        LOG_TRC("Setting TerminationFlag due to 'exit' command from parent.");
                        TerminationFlag = true;
                    }
                    else if (tokens[0] == "tile" || tokens[0] == "tilecombine" || tokens[0] == "canceltiles" ||
                             LOOLProtocol::getFirstToken(tokens[0], '-') == "child")
                    {
                        if (document)
                        {
                            queue->put(message);
                        }
                        else
                        {
                            LOG_WRN("No document while processing " << tokens[0] << " request.");
                        }
                    }
                    else
                    {
                        LOG_ERR("Bad or unknown token [" << tokens[0] << "]");
                    }

                    return true;
                },
                []() {},
                []()
                {
                    if (document && document->purgeSessions() == 0)
                    {
                        LOG_INF("Last session discarded. Terminating.");
                        TerminationFlag = true;
                    }

                    return TerminationFlag.load();
                });

#if 0
        std::string uri = "file://$HOME/docs/basic-presentation.pptx";
        std::shared_ptr<lok::Document> loKitDoc;

        const auto flags = LOK_FEATURE_DOCUMENT_PASSWORD
                           | LOK_FEATURE_DOCUMENT_PASSWORD_TO_MODIFY
                           | LOK_FEATURE_PART_IN_INVALIDATION_CALLBACK
                           | LOK_FEATURE_NO_TILED_ANNOTATIONS;
        loKit->setOptionalFeatures(flags);
        loKitDoc.reset(loKit->documentLoad(uri.c_str()));
        if (!loKitDoc || !loKitDoc->get())
        {
            LOG_ERR("Failed to load: " << uri << ", error: " << loKit->getError());
            std::_Exit(Application::EXIT_OK);
        }

        // specific case to debug
        // ...
#endif

        // Let forkit handle the jail cleanup.
    }
    catch (const Exception& exc)
    {
        LOG_ERR("Poco Exception: " << exc.displayText() <<
                (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Exception: " << exc.what());
    }

    // Trap the signal handler, if invoked,
    // to prevent exiting.
    LOG_INF("Process finished.");
    std::unique_lock<std::mutex> lock(SigHandlerTrap);
    std::_Exit(Application::EXIT_OK);
}
#endif

/// Initializes LibreOfficeKit for cross-fork re-use.
bool globalPreinit(const std::string &loTemplate)
{
#ifdef FUZZER
    if (LOOLWSD::DummyLOK)
        return true;
#endif
    const std::string libSofficeapp = loTemplate + "/program/" LIB_SOFFICEAPP;
    const std::string libMerged = loTemplate + "/program/" LIB_MERGED;

    std::string loadedLibrary;
    void *handle;
    if (File(libMerged).exists())
    {
        LOG_TRC("dlopen(" << libMerged << ", RTLD_GLOBAL|RTLD_NOW)");
        handle = dlopen(libMerged.c_str(), RTLD_GLOBAL|RTLD_NOW);
        if (!handle)
        {
            LOG_FTL("Failed to load " << libMerged << ": " << dlerror());
            return false;
        }
        loadedLibrary = libMerged;
    }
    else
    {
        if (File(libSofficeapp).exists())
        {
            LOG_TRC("dlopen(" << libSofficeapp << ", RTLD_GLOBAL|RTLD_NOW)");
            handle = dlopen(libSofficeapp.c_str(), RTLD_GLOBAL|RTLD_NOW);
            if (!handle)
            {
                LOG_FTL("Failed to load " << libSofficeapp << ": " << dlerror());
                return false;
            }
            loadedLibrary = libSofficeapp;
        }
        else
        {
            LOG_FTL("Neither " << libSofficeapp << " or " << libMerged << " exist.");
            return false;
        }
    }

    LokHookPreInit* preInit = reinterpret_cast<LokHookPreInit *>(dlsym(handle, "lok_preinit"));
    if (!preInit)
    {
        LOG_FTL("No lok_preinit symbol in " << loadedLibrary << ": " << dlerror());
        return false;
    }

    initFunction = reinterpret_cast<LokHookFunction2 *>(dlsym(handle, "libreofficekit_hook_2"));
    if (!initFunction)
    {
        LOG_FTL("No libreofficekit_hook_2 symbol in " << loadedLibrary << ": " << dlerror());
    }

    LOG_TRC("Invoking lok_preinit(" << loTemplate << "/program\", \"file:///user\")");
    const auto start = std::chrono::steady_clock::now();
    if (preInit((loTemplate + "/program").c_str(), "file:///user") != 0)
    {
        LOG_FTL("lok_preinit() in " << loadedLibrary << " failed");
        return false;
    }

    LOG_TRC("Finished lok_preinit(" << loTemplate << "/program\", \"file:///user\") in " <<
            std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - start).count() <<
            " ms.");
    return true;
}

#if !defined(BUILDING_TESTS) && !defined(KIT_IN_PROCESS)
namespace Util
{

void alertAllUsers(const std::string& msg)
{
    document->sendTextFrame(msg);
}

void alertAllUsers(const std::string& cmd, const std::string& kind)
{
    alertAllUsers("errortoall: cmd=" + cmd + " kind=" + kind);
}

}
#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
