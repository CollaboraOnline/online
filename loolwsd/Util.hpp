/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_UTIL_HPP
#define INCLUDED_UTIL_HPP

namespace Util
{
    std::string logPrefix();
    bool windowingAvailable();
    bool encodePNGAndAppendToBuffer(const unsigned char *pixmap, int width, int height, std::vector<char>& output);
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
