/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_MESSAGEQUEUE_HPP
#define INCLUDED_MESSAGEQUEUE_HPP

#include <condition_variable>
#include <mutex>
#include <deque>
#include <vector>

/** Thread-safe message queue (FIFO).
*/
class MessageQueue
{
public:

    typedef std::vector<char> Payload;

    MessageQueue()
    {
    }

    virtual ~MessageQueue();

    MessageQueue(const MessageQueue&) = delete;
    MessageQueue& operator=(const MessageQueue&) = delete;

    /// Thread safe insert the message.
    void put(const Payload& value);
    void put(const std::string& value)
    {
        put(Payload(value.data(), value.data() + value.size()));
    }

    /// Thread safe obtaining of the message.
    Payload get();

    /// Thread safe removal of all the pending messages.
    void clear();

    /// Thread safe remove_if.
    void remove_if(std::function<bool(const Payload&)> pred);

private:
    std::mutex _mutex;
    std::condition_variable _cv;

protected:
    virtual void put_impl(const Payload& value);

    virtual bool wait_impl() const;

    virtual Payload get_impl();

    virtual void clear_impl();

    std::deque<Payload> _queue;
};

/** MessageQueue specialized for handling of tiles.

Used for basic handling of incoming requests, only can remove tiles when it
gets a "canceltiles" command.
*/
class BasicTileQueue : public MessageQueue
{
protected:
    virtual void put_impl(const Payload& value);
};

/** MessageQueue specialized for priority handling of tiles.

This class builds on BasicTileQueue, and additonaly provides de-duplication
of tile requests.

TODO: we'll need to add reordering of the tiles at some stage here too - so
that the ones closest to the cursor position are returned first.
*/
class TileQueue : public BasicTileQueue
{
protected:
    virtual void put_impl(const Payload& value);
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
