/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// WOPI proof management
#ifndef INCLUDED_PROOFKEY_HPP
#define INCLUDED_PROOFKEY_HPP

#include <string>
#include <utility>
#include <vector>

typedef std::vector<std::pair<std::string, std::string>> VecOfStringPairs;

// Returns pairs <header_name, header_value> to add to request
// The headers returned are X-WOPI-TimeStamp, X-WOPI-Proof
// If no proof key, returns empty vector
// Both parameters are utf-8-encoded strings
VecOfStringPairs GetProofHeaders(const std::string& access_token, const std::string& uri);

// Returns pairs <attribute, value> to set in proof-key element in discovery xml.
// If no proof key, returns empty vector
const VecOfStringPairs& GetProofKeyAttributes();

#endif // INCLUDED_PROOFKEY_HPP

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
