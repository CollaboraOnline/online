/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
#include "config.h"
#include "Common.hpp"

extern "C" int forkit_main(int argc, char **argv);

int ClientPortNumber = DEFAULT_CLIENT_PORT_NUMBER;
std::string MasterLocation;

int main (int argc, char **argv)
{
    return forkit_main(argc, argv);
}
