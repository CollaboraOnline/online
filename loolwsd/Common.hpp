/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Default values and other shared data between processes.
#ifndef INCLUDED_COMMON_HPP
#define INCLUDED_COMMON_HPP

static const int DEFAULT_CLIENT_PORT_NUMBER = 9980;
static const int MASTER_PORT_NUMBER = 9981;
static const int INTERVAL_PROBES = 10;
static const int MAINTENANCE_INTERVAL = 1;
static const int POLL_TIMEOUT = 1000000;

#endif
/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
