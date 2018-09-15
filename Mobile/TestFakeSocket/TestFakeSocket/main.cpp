/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <iostream>
#include <thread>

#define MOBILEAPP

#include "FakeSocket.cpp"

int main(int argc, char **argv)
{
    int s0 = fakeSocketSocket();
    int s1 = fakeSocketSocket();
    int s2 = fakeSocketSocket();

    std::cout << "sockets: " << s0 << ", " << s1 << ", " << s2 << "\n";

    fakeSocketClose(s1);

    s1 = fakeSocketSocket();
    std::cout << "closed and created s1 again: " << s1 << "\n";

    int rc = fakeSocketListen(s0);
    if (rc == -1)
    {
        perror("listen");
        return 1;
    }

    int s3;
    std::thread t0([&] {
            s3 = fakeSocketAccept4(s0, 0);
            if (s3 == -1)
                perror("accept");
        });

    rc = fakeSocketConnect(s1, s0);
    if (rc == -1)
    {
        perror("connect");
        return 1;
    }
    
    t0.join();
    if (s3 == -1)
        return 1;

    rc = fakeSocketWrite(s1, "hello", 6);
    if (rc == -1)
    {
        perror("write");
        return 1;
    }
    std::cout << "wrote 'hello'\n";

    char buf[100];
    rc = fakeSocketRead(s3, buf, 100);
    if (rc == -1)
    {
        perror("read");
        return 1;
    }
    buf[rc] = 0;
    std::cout << "read " << buf << "\n";

    rc = fakeSocketWrite(s1, "goodbye", 7);
    if (rc == -1)
    {
        perror("write");
        return 1;
    }
    std::cout << "wrote 'goodbye'\n";

    rc = fakeSocketRead(s3, buf, 4);
    if (rc != -1)
    {
        std::cerr << "Tried partial read, and succeeded!?\n";
        return 1;
    }

    rc = fakeSocketRead(s3, buf, 100);
    if (rc == -1)
    {
        perror("read");
        return 1;
    }
    buf[rc] = 0;
    std::cout << "read " << buf << "\n";

    int pipe[2];
    rc = fakeSocketPipe2(pipe);
    if (rc == -1)
    {
        perror("pipe2");
        return 1;
    }

    rc = fakeSocketWrite(pipe[0], "x", 1);
    if (rc == -1)
    {
        perror("write");
        return 1;
    }
    rc = fakeSocketRead(pipe[1], buf, 1);
    if (rc == -1)
    {
        perror("read");
        return 1;
    }
    if (buf[0] != 'x')
    {
        std::cerr << "Wrote 'x' but read '" << buf[0] << "'\n";
        return 1;
    }
        
    return 0;
}


    
/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
