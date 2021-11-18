/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Exception classes to differentiate between the
// different error situations and handling.

#pragma once

#include <exception>
#include <stdexcept>

// Generic COOL errors and base for others.
class CoolException : public std::runtime_error
{
public:
    std::string toString() const
    {
        return what();
    }

protected:
    using std::runtime_error::runtime_error;
};

class StorageSpaceLowException : public CoolException
{
public:
    using CoolException::CoolException;
};

/// General exception thrown when we are not able to
/// connect to storage.
class StorageConnectionException : public CoolException
{
public:
    using CoolException::CoolException;
};

/// A bad-request exception that is meant to signify,
/// and translate into, an HTTP bad request.
class BadRequestException : public CoolException
{
public:
    using CoolException::CoolException;
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
class UnauthorizedRequestException : public CoolException
{
public:
    using CoolException::CoolException;
};

/// A service-unavailable exception that is meant to signify
/// an internal error.
class ServiceUnavailableException : public CoolException
{
public:
    using CoolException::CoolException;
};

/// Badly formed data we are parsing
class ParseError : public CoolException
{
public:
    using CoolException::CoolException;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
