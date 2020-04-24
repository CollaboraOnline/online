/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <cassert>
#include <map>
#include <mutex>

#include "MobileApp.hpp"

#if MOBILEAPP

static std::map<unsigned, DocumentData> idToDocDataMap;
static std::mutex idToDocDataMapMutex;

DocumentData &allocateDocumentDataForMobileAppDocId(unsigned docId)
{
    const std::lock_guard<std::mutex> lock(idToDocDataMapMutex);

    assert(idToDocDataMap.find(docId) == idToDocDataMap.end());
    idToDocDataMap[docId] = DocumentData();
    return idToDocDataMap[docId];
}

DocumentData &getDocumentDataForMobileAppDocId(unsigned docId)
{
    const std::lock_guard<std::mutex> lock(idToDocDataMapMutex);

    assert(idToDocDataMap.find(docId) != idToDocDataMap.end());
    return idToDocDataMap[docId];
}

void deallocateDocumentDataForMobileAppDocId(unsigned docId)
{
    assert(idToDocDataMap.find(docId) != idToDocDataMap.end());
    idToDocDataMap.erase(docId);
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
