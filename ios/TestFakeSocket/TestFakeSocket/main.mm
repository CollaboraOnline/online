/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <iostream>
#include <thread>

#import <Foundation/Foundation.h>

#include "FakeSocket.cpp"

int main(int argc, char **argv)
{
    fakeSocketSetLoggingCallback([](const std::string& line)
                                 {
                                     NSLog([NSString stringWithUTF8String:line.c_str()]);
                                 });

    int s0 = fakeSocketSocket();
    int s1 = fakeSocketSocket();
    int s2 = fakeSocketSocket();

    std::cout << "sockets: s0=" << s0 << ", s1=" << s1 << ", s2=" << s2 << "\n";

    fakeSocketClose(s1);

    s1 = fakeSocketSocket();
    std::cout << "closed and created s1 again: " << s1 << "\n";

    int rc = fakeSocketListen(s0);
    if (rc == -1)
    {
        perror("listening on s0");
        return 1;
    }

    int s3, s4;
    std::thread t0([&] {
            s3 = fakeSocketAccept4(s0, 0);
            if (s3 == -1)
            {
                perror("accept");
                return;
            }
            std::cout << "accepted s3=" << s3 << " from s0\n";
            s4 = fakeSocketAccept4(s0, 0);
            if (s4 == -1)
            {
                perror("accept");
                return;
            }
            std::cout << "accepted s4=" << s4 << " from s0\n";
        });

    rc = fakeSocketConnect(s1, s0);
    if (rc == -1)
    {
        perror("connect");
        return 1;
    }
    std::cout << "connected s1\n";

    rc = fakeSocketConnect(s2, s0);
    if (rc == -1)
    {
        perror("connect");
        return 1;
    }
    std::cout << "connected s2\n";
    
    t0.join();
    if (s3 == -1 || s4 == -1)
        return 1;

    rc = fakeSocketWrite(s1, "hello", 5);
    if (rc == -1)
    {
        perror("write");
        return 1;
    }
    std::cout << "wrote 'hello' to s1\n";

    rc = fakeSocketWrite(s2, "moin", 4);
    if (rc == -1)
    {
        perror("write");
        return 1;
    }
    std::cout << "wrote 'moin' to s2\n";

    char buf[100];

    rc = fakeSocketRead(s3, buf, 100);
    if (rc == -1)
    {
        perror("read");
        return 1;
    }
    buf[rc] = 0;
    std::cout << "read " << buf << " from s3\n";

    rc = fakeSocketRead(s4, buf, 100);
    if (rc == -1)
    {
        perror("read");
        return 1;
    }
    buf[rc] = 0;
    std::cout << "read '" << buf << "' from s4\n";

    rc = fakeSocketWrite(s3, "goodbye", 7);
    if (rc == -1)
    {
        perror("write");
        return 1;
    }
    std::cout << "wrote 'goodbye' to s3\n";

    rc = fakeSocketRead(s1, buf, 4);
    if (rc != -1)
    {
        std::cerr << "Tried partial read, and succeeded!?\n";
        return 1;
    }

    rc = fakeSocketRead(s1, buf, 100);
    if (rc == -1)
    {
        perror("read");
        return 1;
    }
    buf[rc] = 0;
    std::cout << "read '" << buf << "' from s1\n";

    int pipe[2];
    rc = fakeSocketPipe2(pipe);
    if (rc == -1)
    {
        perror("pipe2");
        return 1;
    }

    fakeSocketClose(s3);
    std::cout << "closed s3\n";

    rc = fakeSocketRead(s1, buf, 100);
    if (rc == -1)
    {
        perror("read");
        return 1;
    }
    if (rc != 0)
    {
        std::cerr << "read '" << buf << "' from s1 after peer s3 was closed!?\n";
        return 1;
    }
    std::cout << "correctly got eof from s1\n";

    rc = fakeSocketRead(s1, buf, 100);
    if (rc == -1)
    {
        perror("read");
        return 1;
    }
    if (rc != 0)
    {
        std::cerr << "read '" << buf << "' from s1 after peer s3 was closed!?\n";
        return 1;
    }
    std::cout << "correctly got eof from s1\n";

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
        std::cerr << "wrote 'x' to pipe but read '" << buf[0] << "'\n";
        return 1;
    }

    rc = fakeSocketWrite(pipe[1], "y", 1);
    if (rc == -1)
    {
        perror("write");
        return 1;
    }
    rc = fakeSocketRead(pipe[0], buf, 1);
    if (rc == -1)
    {
        perror("read");
        return 1;
    }
    if (buf[0] != 'y')
    {
        std::cerr << "wrote 'y' to pipe but read '" << buf[0] << "'\n";
        return 1;
    }
        
    rc = fakeSocketWrite(pipe[0], "z", 1);
    if (rc == -1)
    {
        perror("write");
        return 1;
    }
    rc = fakeSocketShutdown(pipe[0]);
    if (rc == -1)
    {
        perror("shutdown");
        return 1;
    }
    rc = fakeSocketRead(pipe[1], buf, 1);
    if (rc == -1)
    {
        perror("read");
        return 1;
    }
    if (buf[0] != 'z')
    {
        std::cerr << "wrote 'z' to pipe but read '" << buf[0] << "'\n";
        return 1;
    }
    rc = fakeSocketWrite(pipe[0], "a", 1);
    if (rc != -1)
    {
        std::cerr << "could write to socket after shutdown\n";
        return 1;
    }
    if (errno != EPIPE)
    {
        std::cerr << "write to socket after shutdown did not set errno to EPIPE\n";
        return 1;
    }
    rc = fakeSocketRead(pipe[0], buf, 1);
    if (rc == -1)
    {
        std::cerr << "read from socket after shutdown failed\n";
        return 1;
    }
    if (rc > 0)
    {
        std::cerr << "could read something even if socket was shutdown\n";
        return 1;
    }

    rc = fakeSocketRead(pipe[1], buf, 1);
    if (rc == -1)
    {
        perror("read");
        return 1;
    }
    if (rc != 0)
    {
        std::cerr << "read something even if peer was shutdown\n";
        return 1;
    }

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
