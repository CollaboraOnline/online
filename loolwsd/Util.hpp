/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_UTIL_HPP
#define INCLUDED_UTIL_HPP

#include <string>
#include <sstream>
#include <functional>
#include <memory>

#include <Poco/File.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/Net/WebSocket.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include "Log.hpp"

/// Flag to stop pump loops.
extern volatile bool TerminationFlag;

namespace Util
{
    namespace rng
    {
        void reseed();
        unsigned getNext();
    }

    /// Encode an integral ID into a string, with padding support.
    std::string encodeId(const unsigned number, const int padding = 5);
    /// Decode an integral ID from a string.
    unsigned decodeId(const std::string& str);

    /// Creates a randomly name directory within path and returns the name.
    std::string createRandomDir(const std::string& path);
    /// Creates a randomly name file within path and returns the name.
    std::string createRandomFile(const std::string& path);

    bool windowingAvailable();

    // Sadly, older libpng headers don't use const for the pixmap pointer parameter to
    // png_write_row(), so can't use const here for pixmap.
    bool encodeBufferToPNG(unsigned char* pixmap, int width, int height,
                           std::vector<char>& output, LibreOfficeKitTileMode mode);
    bool encodeSubBufferToPNG(unsigned char* pixmap, int startX, int startY, int width, int height,
                              int bufferWidth, int bufferHeight,
                              std::vector<char>& output, LibreOfficeKitTileMode mode);

    /// Safely remove a file or directory.
    /// Supresses exception when the file is already removed.
    /// This can happen when there is a race (unavoidable) or when
    /// we don't care to check before we remove (when no race exists).
    inline
    void removeFile(const std::string& path, const bool recursive = false)
    {
        try
        {
            Poco::File(path).remove(recursive);
        }
        catch (const std::exception&)
        {
            // Already removed or we don't care about failures.
        }
    }

    inline
    void removeFile(const Poco::Path& path, const bool recursive = false)
    {
        removeFile(path.toString(), recursive);
    }

    /// Make a temp copy of a file.
    /// Primarily used by tests to avoid tainting the originals.
    /// srcDir shouldn't end with '/' and srcFilename shouldn't contain '/'.
    /// Returns the created file path.
    inline
    std::string getTempFilePath(const std::string srcDir, const std::string& srcFilename)
    {
        const std::string srcPath = srcDir + '/' + srcFilename;

        std::string dstPath = std::tmpnam(nullptr);
        dstPath += '_' + srcFilename;

        Poco::File(srcPath).copyTo(dstPath);
        return dstPath;
    }

    /// Returns the name of the signal.
    const char *signalName(int signo);

    /// Trap signals to cleanup and exit the process gracefully.
    void setTerminationSignals();
    void setFatalSignals();

    void requestTermination(const Poco::Process::PID& pid);

    int getMemoryUsage(const Poco::Process::PID nPid);

    std::string replace(const std::string& s, const std::string& a, const std::string& b);

    std::string formatLinesForLog(const std::string& s);

    void setThreadName(const std::string& s);

    /// Ensure that we have the correct UID unless in debug mode.
    bool hasCorrectUID();

    /// Display version information
    void displayVersionInfo(const char *app);
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
