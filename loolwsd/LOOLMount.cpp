/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * NB. this file is compiled both standalone, and as part of the LOOLMount.
 */

#include <sys/mount.h>

#include <cstring>
#include <iostream>

int main(int argc, char** argv)
{
    std::string source;
    std::string target;

    for (int i = 0; i < argc; ++i)
    {
        char *cmd = argv[i];
        char *eq  = NULL;
        if (strstr(cmd, "--source=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                source = std::string(++eq);
        }
        else if (strstr(cmd, "--target=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                target = std::string(++eq);
        }
    }

    if (!source.empty() && !target.empty())
    {
      if (mount(source.c_str(), target.c_str(), NULL, MS_BIND, NULL) < 0)
      {
        std::cout << "Failed to mount " << source
                  << " on " << target << " :"<< strerror(errno) << std::endl;
        exit(-1);
      }
    }
    else if (source.empty() && !target.empty())
    {
      if (umount(target.c_str()) < 0)
      {
        std::cout << "Failed to umount "
                  << target << " :"
                  << strerror(errno) << std::endl;
        exit(-1);
      }
    }
    else
    {
      std::cout << "Wrong parameters!" << std::endl;
      exit(-1);
    }

    exit(EXIT_SUCCESS);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
