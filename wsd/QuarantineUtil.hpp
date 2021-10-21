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
namespace Quarantine
{
    void createQuarantineMap();

    void removeQuarantine();

    std::size_t quarantineSize();

    void makeQuarantineSpace();

    void clearOldQuarantineVersions(std::string Wopiscr);

    bool quarantineFile(DocumentBroker* docBroker, std::string docName);
}
