/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_TILECACHE_HPP
#define INCLUDED_TILECACHE_HPP

#include <fstream>
#include <memory>
#include <set>
#include <string>

#include <Poco/File.h>
#include <Poco/Timestamp.h>
#include <Poco/Mutex.h>

using Poco::FastMutex;

/** Handles the cache for tiles of one document.

The cache consists of 2 cache directories:

  * persistent - that always represents the document as is saved
  * editing - that represents the document in the current state (with edits)

The editing cache is cleared on startup, and copied to the persistent on each save.
*/
class TileCache
{
public:
    /// When the docURL is a non-file:// url, the timestamp has to be provided by the caller.
    /// For file:// url's, it's ignored.
    /// When it is missing for non-file:// url, it is assumed the document must be read, and no cached value used.
    TileCache(const std::string& docURL, const std::string& timestamp);

    std::unique_ptr<std::fstream> lookupTile(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight);
    void saveTile(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight, const char *data, size_t size);
    std::string getTextFile(std::string fileName);

    /// Notify the cache that the document was saved - to copy tiles from the Editing cache to Persistent.
    void documentSaved();

    /// Notify whether we need to use the Editing cache.
    void setEditing(bool editing = true);

    // The parameter is a message
    void saveTextFile(const std::string& text, std::string fileName);

    // Saves a font / style / etc rendering
    // The dir parameter should be the type of rendering, like "font", "style", etc
    void saveRendering(const std::string& name, const std::string& dir, const char *data, size_t size);

    std::unique_ptr<std::fstream> lookupRendering(const std::string& name, const std::string& dir);

    // The tiles parameter is an invalidatetiles: message as sent by the child process
    void invalidateTiles(const std::string& tiles);

    void invalidateTiles(int part, int x, int y, int width, int height);

private:
    /// Toplevel cache dirname.
    std::string toplevelCacheDirName();

    /// Path of the (sub-)cache dir, the parameter specifies which (sub-)cache to use.
    std::string cacheDirName(bool useEditingCache);

    std::string cacheFileName(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight);
    bool parseCacheFileName(const std::string& fileName, int& part, int& width, int& height, int& tilePosX, int& tilePosY, int& tileWidth, int& tileHeight);

    /// Extract location from fileName, and check if it intersects with [x, y, width, height].
    bool intersectsTile(const std::string& fileName, int part, int x, int y, int width, int height);

    /// Load the timestamp from modtime.txt.
    Poco::Timestamp getLastModified();

    /// Store the timestamp to modtime.txt.
    void saveLastModified(const Poco::Timestamp& timestamp);

    /// Create or cleanup the cache directory.
    /// For non-file:// protocols, the timestamp has to be provided externally.
    void setup(const std::string& timestamp);

    const std::string& _docURL;

    /// The document is being edited.
    bool _isEditing;

    /// We have some unsaved changes => use the Editing cache.
    bool _hasUnsavedChanges;

    /// Set of tiles that we want to remove from the Persistent cache on the next save.
    std::set<std::string> _toBeRemoved;

    Poco::FastMutex _cacheMutex;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
