/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

extern const char *lo_ios_app_getCacheDir();

extern int loolwsd_server_socket_fd;

extern unsigned char *lo_ios_app_get_cgcontext_for_buffer(unsigned char *buffer, int width, int height);

extern void lo_ios_app_release_cgcontext_for_buffer();

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
