/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
#ifndef LOOL_KIT_HPP
#define LOOL_KIT_HPP

void lokit_main(const std::string& childRoot,
                const std::string& sysTemplate,
                const std::string& loTemplate,
                const std::string& loSubPath);

bool globalPreinit(const std::string &loTemplate);

#endif // LOOL_KIT_HPP

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
