/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <limits>

namespace Util
{

/// Holds the position and size of a rectangle.
struct Rectangle
{
private:
    int _x1;
    int _y1;
    int _x2;
    int _y2;

public:
    Rectangle()
        : _x1(std::numeric_limits<int>::max())
        , _y1(std::numeric_limits<int>::max())
        , _x2(std::numeric_limits<int>::min())
        , _y2(std::numeric_limits<int>::min())
    {}

    Rectangle(int x, int y, int width, int height)
        : _x1(x)
        , _y1(y)
        , _x2(x + width)
        , _y2(y + height)
    {}

    void extend(Rectangle& rectangle)
    {
        if (rectangle._x1 < _x1)
            _x1 = rectangle._x1;
        if (rectangle._x2 > _x2)
            _x2 = rectangle._x2;
        if (rectangle._y1 < _y1)
            _y1 = rectangle._y1;
        if (rectangle._y2 > _y2)
            _y2 = rectangle._y2;
    }

    void setLeft(int x1)
    {
        _x1 = x1;
    }

    int getLeft() const
    {
        return _x1;
    }

    void setRight(int x2)
    {
        _x2 = x2;
    }

    int getRight() const
    {
        return _x2;
    }

    void setTop(int y1)
    {
        _y1 = y1;
    }

    int getTop() const
    {
        return _y1;
    }

    void setBottom(int y2)
    {
        _y2 = y2;
    }

    int getBottom() const
    {
        return _y2;
    }

    int getWidth()
    {
        return _x2 - _x1;
    }

    int getHeight()
    {
        return _y2 - _y1;
    }

    bool isValid()
    {
        return _x1 <= _x2 && _y1 <= _y2;
    }

    bool hasSurface()
    {
        return _x1 < _x2 && _y1 < _y2;
    }

    bool intersects(const Rectangle& rOther)
    {
        Util::Rectangle intersection;
        intersection._x1 = std::max(_x1, rOther._x1);
        intersection._y1 = std::max(_y1, rOther._y1);
        intersection._x2 = std::min(_x2, rOther._x2);
        intersection._y2 = std::min(_y2, rOther._y2);
        return intersection.isValid();
    }
};

}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
