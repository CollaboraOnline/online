/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_TSQUEUE_H
#define INCLUDED_TSQUEUE_H

#include "config.h"

#include <condition_variable>
#include <mutex>
#include <deque>

// Thread-safe queue

template <class T>
class tsqueue
{
public:
    void put(const T& value)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        _queue.push_back(value);
        lock.unlock();
        _cv.notify_one();
    }

    T get()
    {
        std::unique_lock<std::mutex> lock(_mutex);
        _cv.wait(lock, [this] { return _queue.size() > 0; });
        T result = _queue.front();
        _queue.pop_front();
        return result;
    }

    void clear()
    {
        std::unique_lock<std::mutex> lock(_mutex);
        while (_queue.size())
            _queue.pop_front();
    }

    template<class UnaryPredicate>
    void remove_if(UnaryPredicate p)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        _queue.erase(std::remove_if(_queue.begin(), _queue.end(), p),
                     _queue.end());
    }

private:
    std::mutex _mutex;
    std::condition_variable _cv;
    std::deque<T> _queue;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
