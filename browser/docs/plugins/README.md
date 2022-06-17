# L.Path.Drag

[![npm version](https://badge.fury.io/js/leaflet-path-drag.svg)](http://badge.fury.io/js/leaflet-path-drag) [![CircleCI](https://circleci.com/gh/w8r/Leaflet.Path.Drag/tree/master.svg?style=shield)](https://circleci.com/gh/w8r/Leaflet.Path.Drag/tree/master)

Drag handler for [Leaflet](https://github.com/leaflet/leaflet) vector features.
It adds dragging API and events of `L.Marker` to `L.Polygon` and `L.Polyline`.

If you are looking for this functionality combined with [Leaflet.draw](https://github.com/leaflet/Leaflet.draw), take a look at [Leaflet.draw.drag](http://github.com/w8r/Leaflet.draw.drag) and [Leaflet.Editable.Drag](https://github.com/w8r/Leaflet.Editable.Drag).

## [Demo](https://w8r.github.io/Leaflet.Path.Drag)

## Usage

```javascript
<script src="path/to/leaflet/"></script>
<script src="path/to/L.Path.Drag.js"></script>
...
var polygon = new L.Polygon([...], { draggable: true }).addTo(map);
// you can use the drag events just like with markers
polygon
    .on('dragstart', onDragStart)
    .on('drag',      onDrag)
    .on('dragend',   onDragEnd);
```

with browserify

```
npm install leaflet-path-drag
...

require('leaflet');
var handler = require('leaflet-path-drag');
```

Requires Leaflet@1.1.x

For Leaflet@0.7.x support use code from `leaflet-0.7` branch

#### Enable/disable dragging

```js
var polygon = new L.Polygon([...], { draggable: true }).addTo(map);
polygon.dragging.enable();
polygon.dragging.disable();
```

## Info

It uses matrix transforms on SVG/VML paths, so part of it(`src/L.Path.Transform`) could be used for different transformations - skew/scale/etc - but you have to provide coordinates projection and handling yourself.

VML matrix transform tested in IE8, it has rendering glitches, but what can you expect.

## License

The MIT License (MIT)

Copyright (c) 2015 Alexander Milevski

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
