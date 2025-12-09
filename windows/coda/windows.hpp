/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.hxx>

#include <string>

extern int coolwsd_server_socket_fd;
extern const char *user_name;
extern std::string app_installation_path;
extern std::string app_installation_uri;

extern void load_next_document();
void output_file_dialog_from_core(const char* suggestedURI, char* result, size_t resultLen);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
