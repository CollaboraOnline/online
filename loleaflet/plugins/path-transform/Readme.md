# Leaflet.Path.Transform [![npm version](https://badge.fury.io/js/leaflet-path-transform.svg)](https://badge.fury.io/js/leaflet-path-transform)

Drag/rotate/resize handler for [leaflet](http://leafletjs.com) vector features.

![screenshot 2016-03-21 15 31 48](https://cloud.githubusercontent.com/assets/26884/13921863/4470b97c-ef7a-11e5-8ea2-46161fffaedd.png)

Includes [L.Path.Drag](https://github.com/w8r/Leaflet.Path.Drag), so you don't
need to include it once again.

### Requirements

Leaflet 1.0+

### API
```shell
npm install leaflet-path-transform --save
```
or include `dist/L.Path.Transform.js` file

```js
require('leaflet-path-transform');

var map = L.map('map-canvas').setView(center, zoom);
var polygon = L.polygon([..., ...], { transform: true }).addTo(map);

polygon.transform.enable();
// or partially:
polygon.transform.enable({rotation: true, scaling: false});
// or, on an already enabled handler:
polygon.transform.setOptions({rotation: true, scaling: false});
```

If you have changed the geometry of the transformed layer and want the tool to reflect the changes, use:

```js
// you have changed the geometry here
layer.setLatLngs([...]);
// and want to update handlers:
layer.transform.reset();
```

### `options`

* **`options.handlerOptions`** - **<[Path_options](http://leafletjs.com/reference.html#path-options)>** - edge markers options
* **`options.boundsOptions`** - **<[Polyline_options](http://leafletjs.com/reference.html#polyline-options)>** - bounding rectangle options
* **`options.rotateHandleOptions`** - **<[Polyline_options](http://leafletjs.com/reference.html#polyline-options)>** - rotation handle line styles
* **`options.handleLength`** - **Number** - Length of the rotation handle in pixels. Defaults to 20.
* **`options.rotation`** - **Boolean** - Enable/disable rotation. Default `true`
* **`options.scaling`** - **Boolean** - Enable/disable scaling. Default `true`
* **`options.uniformScaling`** - **Boolean** - Use uniform scaling (maintain aspect ratio). Default `true`

**Handles**

For the corner and rotation handles plugin provides 2 classes:
`L.PathTransform.Handle` and `L.PathTransform.RotateHandle`, they are derived from `L.CircleMarker` and you can adjust them as you want. Also you can use some other compatible marker types by providing respective constructors through `options.handleClass` and `options.rotateHandleClass`.

**Cursors:**

Handler assigns `resize` cursors to handles. You can override that by setting `options.handlerOptions.setCursor` and `options.rotateHandleOptions.setCursor` to `false`


### Events

Following events are fired on the transformed layer

* **`rotatestart`, `rotate`, `rotateend`** - `{ rotation: <Radians> }`
* **`scalestart`, `scale`, `scaleend`** - `{ scale: <L.Point> }`
* **`transformstart`, `transform`, `transformed`** - `{ rotation: ..., scale: ..., matrix: <L.Matrix> }`


### Dragging

To control features dragging, see
[L.Path.Drag docs](https://github.com/w8r/Leaflet.Path.Drag).

```js
polygon.dragging.disable();
polygon.dragging.enable();
```



### TODO

 - [ ] Tests
 - [ ] Precision fix for rotation
 - [x] Leaflet 1.x support
 - [x] [Leaflet.Editable](https://github.com/Leaflet/Leaflet.Editable) adapter
 - [ ] [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw) adapter
 - [x] Canvas renderer support

### License

 Copyright (c) <year> <copyright holders>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
