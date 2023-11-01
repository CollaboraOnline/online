/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

#include "Exceptions.hpp"

#undef EXCEPTION_DECL

// not beautiful
#define EXCEPTION_DECL(type,unused) \
    std::atomic<size_t> type::count;

EXCEPTION_DECL(StorageSpaceLowException,LoolException)
EXCEPTION_DECL(StorageConnectionException,LoolException)
EXCEPTION_DECL(BadRequestException,LoolException)
EXCEPTION_DECL(BadArgumentException,BadRequestException)
EXCEPTION_DECL(UnauthorizedRequestException,LoolException)
EXCEPTION_DECL(ServiceUnavailableException,LoolException)
EXCEPTION_DECL(ParseError,LoolException)


/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
