/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <config.h>
#include <string>

class DocumentBroker;

class Quarantine
{
public:
    Quarantine(DocumentBroker& docBroker)
        : _docBroker(docBroker)
    {
    }

    static void initialize(const std::string& path);

    bool quarantineFile(const std::string& docName);

    /// Removes the quarantined files for the given DocKey when we unload gracefully.
    void removeQuarantinedFiles();

private:
    bool isQuarantineEnabled() const { return !QuarantinePath.empty(); }

    std::size_t quarantineSize();

    void makeQuarantineSpace();

    void clearOldQuarantineVersions(const std::string& docKey);

    void removeQuarantine();

private:
    static std::string QuarantinePath;

    DocumentBroker& _docBroker;
};
