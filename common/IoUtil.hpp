/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_IOUTIL_HPP
#define INCLUDED_IOUTIL_HPP

#include <functional>
#include <memory>
#include <string>

#include <LOOLWebSocket.hpp>

namespace IoUtil
{
    /// Synchronously process LOOLWebSocket requests and dispatch to handler.
    /// Handler returns false to end.
    void SocketProcessor(const std::shared_ptr<LOOLWebSocket>& ws,
                         const std::string& name,
                         const std::function<bool(const std::vector<char>&)>& handler,
                         const std::function<void()>& closeFrame,
                         const std::function<bool()>& stopPredicate);

    ssize_t writeToPipe(int pipe, const char* buffer, ssize_t size);
    inline ssize_t writeToPipe(int pipe, const std::string& message)
    {
        return writeToPipe(pipe, message.c_str(), message.size());
    }

    ssize_t readFromPipe(int pipe, char* buffer, ssize_t size);

    /// Helper class to handle reading from a pipe.
    class PipeReader
    {
    public:
        PipeReader(const std::string& name, const int pipe) :
            _name(name),
            _pipe(pipe)
        {
        }

        const std::string& getName() const { return _name; }

        /// Reads a single line from the pipe.
        /// Returns 0 for timeout, <0 for error, and >0 on success.
        /// On success, line will contain the read message.
        int readLine(std::string& line,
                     const std::function<bool()>& stopPredicate);

    private:
        const std::string _name;
        const int _pipe;
        std::string _data;
    };
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
