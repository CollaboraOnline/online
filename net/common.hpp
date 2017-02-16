/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef NB_COMMON_HPP
#define NB_COMMON_HPP

typedef std::vector<std::string> HeaderStrings;
typedef std::vector<unsigned char> Payload;

// FIXME: lots of return conditions:
//        partial data, malicious/invalid data, complete data
//        does this belong in a separate method ?
size_t parseHTTP(const std::vector<unsigned char> data,
                 HeaderStrings &headers, Payload & /* payload */)
{
    size_t i, start;
	for (i = start = 0; i < data.size(); ++i)
    {
	    unsigned char c = data[i];
	    if (c == 0)
        {   // someone doing something cute.
            return -1;
        }
        if (c == '\r' || c == '\n')
        {
            std::string header(reinterpret_cast<const char *>(&data[start]), i - start);
            while (++i < data.size() &&
                   (data[i] == '\n' || data[i] == '\r'))
            {}
            start = i;
            // terminating \r\n
            if (header.size() == 0)
                break;
            headers.push_back(header);
        }
    }
    return i;
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
