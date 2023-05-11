/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <string>
#include <unordered_map>
#include <vector>

class DocumentBroker;

class Quarantine
{
public:
    Quarantine(DocumentBroker& docBroker);

    static void initialize(const std::string& path);

    void setDocumentName(const std::string& docName) { _docName = docName; }

    bool quarantineFile(const std::string& docName);

    /// Removes the quarantined files for the given DocKey when we unload gracefully.
    void removeQuarantinedFiles();

private:
    bool isQuarantineEnabled() const { return !QuarantinePath.empty(); }

    std::size_t quarantineSize();

    void makeQuarantineSpace();

    void clearOldQuarantineVersions();

    void removeQuarantine();

private:
    static std::unordered_map<std::string, std::vector<std::string>> QuarantineMap;
    static std::string QuarantinePath;

    const std::string _docKey;
    const std::string _quarantinedFilenamePrefix;
    const std::size_t _maxSizeBytes;
    const std::size_t _maxAgeSecs;
    const std::size_t _maxVersions;
    std::string _docName;
};
