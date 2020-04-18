/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Exception classes to differentiate between the
// different error situations and handling.

#pragma once

#include <exception>
#include <stdexcept>

// Generic LOOL errors and base for others.
class LoolException : public std::runtime_error
{
public:
    std::string toString() const
    {
        return what();
    }

protected:
    using std::runtime_error::runtime_error;
};

class StorageSpaceLowException : public LoolException
{
public:
    using LoolException::LoolException;
};

/// General exception thrown when we are not able to
/// connect to storage.
class StorageConnectionException : public LoolException
{
public:
    using LoolException::LoolException;
};

/// A bad-request exception that is meant to signify,
/// and translate into, an HTTP bad request.
class BadRequestException : public LoolException
{
public:
    using LoolException::LoolException;
};

/// A bad-argument exception that is meant to signify,
/// and translate into, an HTTP bad request.
class BadArgumentException : public BadRequestException
{
public:
    using BadRequestException::BadRequestException;
};

/// An authorization exception that is meant to signify,
/// and translate into, an HTTP unauthorized error.
class UnauthorizedRequestException : public LoolException
{
public:
    using LoolException::LoolException;
};

/// A service-unavailable exception that is meant to signify
/// an internal error.
class ServiceUnavailableException : public LoolException
{
public:
    using LoolException::LoolException;
};

/// Badly formed data we are parsing
class ParseError : public LoolException
{
public:
    using LoolException::LoolException;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
