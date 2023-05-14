/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

class DocumentBroker;

class Quarantine
{
public:
    Quarantine(DocumentBroker& docBroker, const std::string& docName);

    static void initialize(const std::string& path);

    bool quarantineFile(const std::string& docName);

    /// Removes the quarantined files for the given DocKey when we unload gracefully.
    void removeQuarantinedFiles();

private:
    bool isQuarantineEnabled() const { return !QuarantinePath.empty(); }

    /// Returns quarantine directory size in bytes.
    std::size_t quarantineSize();

    void makeQuarantineSpace();

    void clearOldQuarantineVersions();

    void removeQuarantine();

private:
    static std::unordered_map<std::string, std::vector<std::string>> QuarantineMap;
    /// Protects the shared QuarantineMap from concurrent modification.
    static std::mutex Mutex;
    static std::string QuarantinePath;

    /// The delimiter used in the quarantine filename.
    static constexpr char Delimiter = '_';

    const std::string _docKey;
    const std::string _docName;
    /// The quarantined filename is a multi-part string, formed
    /// from the timestamp, pid, docKey, and document filename.
    /// The Delimiter is used to join and later tokenize it.
    /// The document filename is encoded to ensure tokenization.
    const std::string _quarantinedFilename;
    const std::size_t _maxSizeBytes;
    const std::size_t _maxAgeSecs;
    const std::size_t _maxVersions;
};
