/* -*- js-indent-level: 8 -*- */


/**
 * Marker handler
 * @extends {L.CircleMarker}
 */
L.PathTransform.Handle = L.CircleMarker.extend({
	options: {
		className: 'leaflet-path-transform-handler'
	},

	onAdd: function (map) {
		L.CircleMarker.prototype.onAdd.call(this, map);
		if (this.options.setCursor) { // SVG/VML
			this.setCursorType(L.PathTransform.Handle.CursorsByType[
				this.options.index
			]);
		}
	}
});


/**
 * @const
 * @type {Array}
 */
L.PathTransform.Handle.CursorsByType = [
	'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize','nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize'
];

L.PathTransform.Handle.PolyCursorsByType = {
	'10': 'ew-resize',
	'8': 'ns-resize',
	'38': 'all-scroll',
};

/**
 * @extends {L.Handler.PathTransform.Handle}
 */
L.PathTransform.RotateHandle = L.PathTransform.Handle.extend({
	options: {
		className: 'leaflet-path-transform-handler transform-handler--rotate'
	},

	onAdd: function (map) {
		L.CircleMarker.prototype.onAdd.call(this, map);
		if (this._path && this.options.setCursor) { // SVG/VML
			this.setCursorType('all-scroll');
		}
	}
});

/**
 * @extends {L.Handler.PathTransform.Handle}
 */
L.PathTransform.CustomHandle = L.PathTransform.Handle.extend({
	// transform-handler--rotate and others are defined in branding.css
	// Until it is updated, we can use rotate as the style matches with the core
	options: {
		className: 'leaflet-path-transform-handler transform-handler--rotate',
	},

	onAdd: function (map) {
		L.CircleMarker.prototype.onAdd.call(this, map);
		if (this._path && this.options.setCursor) { // SVG/VML
			this.setCursorType('all-scroll');
		}
	}
});

/**
 * @extends {L.Handler.PathTransform.Handle}
 */
L.PathTransform.PolyHandle = L.PathTransform.Handle.extend({
	options: {
		className: 'leaflet-path-transform-handler',
	},

	onAdd: function (map) {
		L.CircleMarker.prototype.onAdd.call(this, map);
		if (this.options.setCursor) { // SVG/VML
			this.setCursorType(L.PathTransform.Handle.PolyCursorsByType[
				this.options.cursor.toString()
			]);
		}
	}
});

L.Handler.PathTransform = L.Handler.extend({

	options: {
		rotation: true,
		scaling:  true,
		scaleSouthAndEastOnly:  false,
		uniformScaling: true,
		maxZoom:  22,
		handles: [],
		shapeType: 0,
		// edge handlers
		handlerOptions: {
			radius:      L.Browser.touch && !L.Browser.pointer ? 10 : 5,
			fillColor:   '#ffffff',
			color:       '#202020',
			fillOpacity: 1,
			weight:      2,
			opacity:     0.7,
			setCursor:   true
		},

		// rectangle
		boundsOptions: {
			weight:    1,
			opacity:   0,
			interactive: false,
			fill:      false
		},

		polyLineOptions: {
			weight: 1,
			opacity: 1,
			interactive: false,
			fill: true
		},

		// rotation handler
		rotateHandleOptions: {
			weight:    1,
			opacity:   1,
			setCursor: true,
			interactive: false
		},
		// rotation handle length
		handleLength: L.Browser.touch && !L.Browser.pointer ? 40 : 20,

		// maybe I'll add skewing in the future
		edgesCount:   4,

		handleClass:       L.PathTransform.Handle,
		rotateHandleClass: L.PathTransform.RotateHandle,
		customHandleClass: L.PathTransform.CustomHandle,
		polyHandleClass:   L.PathTransform.PolyHandle
	},


	/**
	* @class L.Handler.PathTransform
	* @constructor
	* @param  {L.Path} path
	*/
	initialize: function(path) {
		// references
		this._path = path;
		this._map  = null;

		// handlers
		this._activeMarker   = null;
		this._originMarker   = null;
		this._rotationMarker = null;
		this._customMarker   = null;
		this._customHandle   = null;
		this._customHandlePosition = null;
		this._polyMarker     = null;
		this._polyMarkerPosition = null;
		this._polyEdges      = [];
		this._polyLine       = null;
		// origins & temporary state
		this._rotationOrigin   = null;
		this._scaleOrigin      = null;
		this._angle            = 0;
		this._scale            = L.point(1, 1);
		this._initialDist      = 0;
		this._initialDistX     = 0;
		this._initialDistY     = 0;
		this._rotationStart    = null;
		this._rotationOriginPt = null;
		this._handlersVisible  = true;
		this._handlerPointsConverted = false;

		// preview and transform matrix
		this._matrix          = new L.Matrix(1, 0, 0, 1, 0, 0);
		this._projectedMatrix = new L.Matrix(1, 0, 0, 1, 0, 0);

		// ui elements
		this._handlersGroup  = null;
		this._rect           = null;
		this._handlers       = [];
		this._handleLine     = null;
	},


	/**
	* If the polygon is not rendered, you can transform it yourself
	* in the coordinates, and do it properly.
	* @param {Object=} options
	*/
	enable: function(options) {
		if (this._path._map) {
			this._map = this._path._map;
			if (options) {
				this.setOptions(options);
			}
			L.Handler.prototype.enable.call(this);
		}
	},


	/**
	* Init interactions and handlers
	*/
	addHooks: function() {
		this._createHandlers();
		this._path
			.on('dragstart', this._onDragStart, this)
			.on('drag',      this._onDrag, this)
			.on('dragend',   this._onDragEnd,   this);
		this._map.on('handlerstatus', this._onHandlerStatus, this);
	},


	/**
	* Remove handlers
	*/
	removeHooks: function() {
		this._hideHandlers();
		this._path
			.off('dragstart', this._onDragStart, this)
			.off('drag',      this._onDrag, this)
			.off('dragend',   this._onDragEnd,   this);
		this._map.off('handlerstatus', this._onHandlerStatus, this);

		if (this._map.hasLayer(this._rect)) {
			this._map.removeLayer(this._rect);
		}

		if (this._polyLine) {
			this._map.removeLayer(this._polyLine);
			this._polyLine = null;
		}

		this._handlersGroup = null;
		this._rect = null;
		this._handlers = [];
	},

	_onHandlerStatus: function(e) {
		if ((e.hidden && this._handlersVisible === false)
			|| (!e.hidden && this._handlersVisible))
			return;
		if (e.hidden) {
			this._hideHandlers();
			this._path.off('dragstart', this._onDragStart, this);
		} else {
			this._showHandlers();
			this._path.on('dragstart', this._onDragStart, this);
		}
	},


	/**
	* Change editing options
	* @param {Object} options
	*/
	setOptions: function(options) {
		var enabled = this._enabled;
		if (enabled) {
			this.disable();
		}

		this.options = L.PathTransform.merge({},
			L.Handler.PathTransform.prototype.options,
			options);

		if (enabled) {
			this.enable();
		}

		return this;
	},


	/**
	* @param  {Number}   angle
	* @param  {L.LatLng} origin
	* @return {L.Handler.PathTransform}
	*/
	rotate: function(angle, origin) {
		return this.transform(angle, null, origin);
	},


	/**
	* @param  {L.Point|Number} scale
	* @param  {L.LatLng}       origin
	* @return {L.Handler.PathTransform}
	*/
	scale: function(scale, origin) {
		if (typeof scale === 'number') {
			scale = L.point(scale, scale);
		}
		return this.transform(0, scale, null, origin);
	},


	/**
	* @param  {Number}    angle
	* @param  {L.Point}   scale
	* @param  {L.LatLng=} rotationOrigin
	* @param  {L.LatLng=} scaleOrigin
	* @return {L.Handler.PathTransform}
	*/
	transform: function(angle, scale, rotationOrigin, scaleOrigin) {
		var center     = this._path.getCenter();
		rotationOrigin = rotationOrigin || center;
		scaleOrigin    = scaleOrigin    || center;
		this._map = this._path._map;
		this._transformPoints(this._path, angle, scale, rotationOrigin, scaleOrigin);
		return this;
	},

	/**
	* @param  {L.Point}   point
	*/
	getMarker: function(point) {
		for (var i = 0, len = this._handlers.length; i < len; i++) {
			var handler = this._handlers[i];
			if (handler._containsPoint(point)) {
				return handler;
			}
		}
		return undefined;
	},

	/**
	* Update the polygon and handlers preview, no reprojection
	*/
	_update: function() {
		var matrix = this._matrix;

		// update handlers
		for (var i = 0, len = this._handlers.length; i < len; i++) {
			var handler = this._handlers[i];
			if (handler !== this._originMarker) {
				handler._point = matrix.transform(handler._initialPoint);
				handler._updatePath();
			}
		}

		matrix = matrix.clone().flip();

		this._applyTransform(matrix);
		this._path.fire('transform', { layer: this._path });
	},


	/**
	* @param  {L.Matrix} matrix
	*/
	_applyTransform: function(matrix) {
		this._path._transform(matrix._matrix);
		this._rect._transform(matrix._matrix);

		if (this.options.rotation) {
			this._handleLine._transform(matrix._matrix);
		}
	},


	/**
	* Apply final transformation
	*/
	_apply: function() {
		//console.group('apply transform');
		var map = this._map;
		var matrix = this._matrix.clone();
		var angle = this._angle;
		var scale = this._scale.clone();
		var moved = this._handleDragged;

		this._transformGeometries();

		// update handlers
		for (var i = 0, len = this._handlers.length; i < len; i++) {
			var handler = this._handlers[i];
			handler._latlng = map.layerPointToLatLng(handler._point);
			delete handler._initialPoint;
			handler.redraw();
		}

		this._matrix = L.matrix(1, 0, 0, 1, 0, 0);
		this._scale  = L.point(1, 1);
		this._angle  = 0;

		this._updateHandlers();

		if (this._mapDraggingWasEnabled) {
			if (moved) L.DomEvent._fakeStop({ type: 'click' });
			map.dragging.enable();
		}

		this._path.fire('transformed', {
			matrix: matrix,
			scale: scale,
			rotation: angle,
			// angle: angle * (180 / Math.PI),
			layer: this._path
		});
		// console.groupEnd('apply transform');
	},


	/**
	* Use this method to completely reset handlers, if you have changed the
	* geometry of transformed layer
	*/
	reset: function() {
		if (this._enabled) {
			if (this._rect) {
				this._handlersGroup.removeLayer(this._rect);
				this._rect = this._getBoundingPolygon().addTo(this._handlersGroup);
			}
			this._updateHandlers();
		}
	},


	/**
	* Recalculate rotation handlers position
	*/
	_updateHandlers: function() {
		var handlersGroup = this._handlersGroup;

		if (this._handleLine) {
			this._handlersGroup.removeLayer(this._handleLine);
		}

		if (this._rotationMarker) {
			this._handlersGroup.removeLayer(this._rotationMarker);
		}

		if (this._customMarker) {
			this._handlersGroup.removeLayer(this._customMarker);
		}

		if (this._polyLine) {
			this._handlersGroup.removeLayer(this._polyLine);
		}

		this._handleLine = this._rotationMarker = this._polyLine = null;

		for (var i = this._handlers.length - 1; i >= 0; i--) {
			handlersGroup.removeLayer(this._handlers[i]);
		}

		this._createHandlers();
	},


	/**
	* Transform geometries separately
	*/
	_transformGeometries: function() {
		this._path._transform(null);
		this._rect._transform(null);

		this._transformPoints(this._path);
		this._transformPoints(this._rect);

		if (this.options.rotation) {
			this._handleLine._transform(null);
			this._transformPoints(this._handleLine, this._angle, null, this._origin);
		}
	},


	/**
	* @param {Number} angle
	* @param {Number} scale
	* @param {L.LatLng=} rotationOrigin
	* @param {L.LatLng=} scaleOrigin
	*/
	_getProjectedMatrix: function(angle, scale, rotationOrigin, scaleOrigin) {
		var map    = this._map;
		var zoom   = map.getMaxZoom() || this.options.maxZoom;
		var matrix = L.matrix(1, 0, 0, 1, 0, 0);
		var origin;

		angle = angle || this._angle || 0;
		scale = scale || this._scale || L.point(1, 1);

		if (!(scale.x === 1 && scale.y === 1)) {
			scaleOrigin = scaleOrigin || this._scaleOrigin;
			origin = map.project(scaleOrigin, zoom);
			matrix = matrix
				._add(L.matrix(1, 0, 0, 1, origin.x, origin.y))
				._add(L.matrix(scale.x, 0, 0, scale.y, 0, 0))
				._add(L.matrix(1, 0, 0, 1, -origin.x, -origin.y));
		}

		if (angle) {
			rotationOrigin = rotationOrigin || this._rotationOrigin;
			origin = map.project(rotationOrigin, zoom);
			matrix = matrix.rotate(angle, origin).flip();
		}

		return matrix;
	},


	/**
	* @param  {L.LatLng} latlng
	* @param  {L.Matrix} matrix
	* @param  {L.Map}    map
	* @param  {Number}   zoom
	* @return {L.LatLng}
	*/
	_transformPoint: function(latlng, matrix, map, zoom) {
		return map.unproject(matrix.transform(
			map.project(latlng, zoom)), zoom);
	},


	/**
	* Applies transformation, does it in one sweep for performance,
	* so don't be surprised about the code repetition.
	*
	* @param {L.Path}    path
	* @param {Number=}   angle
	* @param {L.Point=}  scale
	* @param {L.LatLng=} rotationOrigin
	* @param {L.LatLng=} scaleOrigin
	*/
	_transformPoints: function(path, angle, scale, rotationOrigin, scaleOrigin) {
		var map = path._map;
		var zoom = map.getMaxZoom() || this.options.maxZoom;
		var i, len;

		var projectedMatrix = this._projectedMatrix =
			this._getProjectedMatrix(angle, scale, rotationOrigin, scaleOrigin);
		// console.time('transform');

		// all shifts are in-place
		if (path._point) { // L.Circle
			path._latlng = this._transformPoint(
				path._latlng, projectedMatrix, map, zoom);
		} else if (path._rings || path._parts) { // everything else
			var rings = path._rings;
			var latlngs = path._latlngs;
			path._bounds = new L.LatLngBounds();

			if (!L.Util.isArray(latlngs[0])) { // polyline
				latlngs = [latlngs];
			}
			for (i = 0, len = rings.length; i < len; i++) {
				for (var j = 0, jj = rings[i].length; j < jj; j++) {
					latlngs[i][j] = this._transformPoint(
						latlngs[i][j], projectedMatrix, map, zoom);
					path._bounds.extend(latlngs[i][j]);
				}
			}
		} else if (path instanceof L.SVGGroup) {
			path._bounds._southWest = this._transformPoint(path._bounds._southWest, projectedMatrix, map, zoom);
			path._bounds._northEast = this._transformPoint(path._bounds._northEast, projectedMatrix, map, zoom);
		}

		path._reset();
	},

	_getPoints: function () {
		var rectangleHandles = this.options.handles['rectangle'];
		if (rectangleHandles && rectangleHandles !== '') {
			var nw = rectangleHandles['1'][0],
			north = rectangleHandles['2'][0],
			ne = rectangleHandles['3'][0],
			west = rectangleHandles['4'][0],
			east = rectangleHandles['5'][0],
			sw = rectangleHandles['6'][0],
			south = rectangleHandles['7'][0],
			se = rectangleHandles['8'][0];
			return [sw, west, nw, north, ne, east, se, south];
		}
		this.options.rotation = false;
		return [];
	},

	_getMirroredIndex: function(type, index) {
		var sw = 0, w = 1, nw = 2, n = 3, ne = 4, e = 5, se = 6, s = 7;
		if (type === 'h')
			return [nw, w, sw, s, se, e, ne, n][index];
		else if (type === 'v')
			return [se, e, ne, n, nw, w, sw, s][index];
		else if (type === 'c')
			return [ne, e, se, s, sw, w, nw, n][index];
	},

	/**
	* Creates markers and handles
	*/
	_createHandlers: function() {
		var map = this._map;
		this._handlersGroup = this._handlersGroup ||
			new L.LayerGroup().addTo(map);
		this._rect = this._rect ||
			this._getBoundingPolygon().addTo(this._handlersGroup);
		if (this.options.handles.length <= 0)
			return;
		if (this.options.scaling) {
			this._handlers = [];
			var points = this._getPoints();
			for (var i = 0; i < points.length; i++) {
				if (!this._handlerPointsConverted)
					points[i].point = map._docLayer._convertCalcTileTwips(points[i].point);
				this._handlers.push(
					this._createHandler(this._map._docLayer._twipsToLatLng(points[i].point, this._map.getZoom()), i * 2, i, this._onScaleStart)
						.addTo(this._handlersGroup));
			}
			this._handlerPointsConverted = true;
		}

		if (this.options.handles['custom'] !== '') {
			this._createCustomHandlers();
		}
		if (this.options.handles['poly'] !== '') {
			this._createPolyHandlers();
			this.options.rotation = false;
		}
		// add bounds
		if (this.options.rotation) {
			//add rotation handler
			this._createRotationHandlers();
		}
	},


	/**
	* Rotation marker and small connecting handle
	*/
	_createRotationHandlers: function() {
		var map     = this._map;
		var bottom   = map._docLayer._twipsToLatLng(this._getPoints()[7].point, this._map.getZoom());
		var topPoint   = map._docLayer._twipsToLatLng(this._getPoints()[3].point, this._map.getZoom());

		var handlerPosition = map.layerPointToLatLng(
			L.PathTransform.pointOnLine(
				map.latLngToLayerPoint(bottom),
				map.latLngToLayerPoint(topPoint),
				this.options.handleLength)
		);

		this._handleLine = new L.Polyline([topPoint, handlerPosition],
			this.options.rotateHandleOptions).addTo(this._handlersGroup);
		var RotateHandleClass = this.options.rotateHandleClass;
		this._rotationMarker = new RotateHandleClass(handlerPosition,
			this.options.handlerOptions)
			.addTo(this._handlersGroup)
			.on('mousedown', this._onRotateStart, this);

		this._rotationOrigin = new L.LatLng(
			(topPoint.lat + bottom.lat) / 2,
			(topPoint.lng + bottom.lng) / 2
		);

		this._handlers.push(this._rotationMarker);
	},

	/**
	* Poly Handles(Lines, Connectors..), id = 9
	*/
	_createPolyHandlers: function() {
		var handleList = this.options.handles['poly']['9'];
		this._handlers = [];
		this._polyEdges = [];
		for (var i = 0; i < handleList.length; ++i) {
			this._handlers.push(
				this._createPolyHandler(handleList[i], i)
					.addTo(this._handlersGroup));
		}
	},

	_onPolyHandleDragStart: function(evt) {
		var marker = evt.target;
		var map = this._map;

		this._handleDragged = false;
		this._mapDraggingWasEnabled = false;
		if (map.dragging.enabled()) {
			map.dragging.disable();
			this._mapDraggingWasEnabled = true;
		}

		this._activeMarker = marker;
		var bottom = new L.LatLng(0,0);
		var topPoint = new L.LatLng(0,0);
		var latlngs = this._rect._latlngs;
		var isEdge = this._polyEdges.indexOf(this._activeMarker.options.index);
		if (isEdge < 0) {
			this._originMarker = marker;
			var middleHandlelatLngs = marker._latlng;
			if (marker.options.cursor == 10) {
				bottom  = new L.LatLng(
					(latlngs[0].lat + latlngs[3].lat) / 2,
					middleHandlelatLngs.lng);
				topPoint = new L.LatLng(
					(latlngs[1].lat + latlngs[2].lat) / 2,
					middleHandlelatLngs.lng);
			} else {
				bottom  = new L.LatLng(
					middleHandlelatLngs.lat,
					(latlngs[2].lng + latlngs[3].lng) / 2);
				topPoint = new L.LatLng(
					middleHandlelatLngs.lat,
					(latlngs[0].lng + latlngs[1].lng) / 2);
			}
			this._polyLine = new L.Polyline([topPoint, bottom],
				this.options.polyLineOptions).addTo(this._handlersGroup);
		}
		else {
			var originIndex = (this._activeMarker.options.index + 1) % this._polyEdges.length;
			this._originMarker = this._handlers[originIndex];
			if (this.options.shapeType == 2) { // flat line
				this._polyLine = new L.Polyline([
					originIndex === 0 ? this._originMarker.getLatLng() : this._activeMarker.getLatLng(),
					originIndex === 0 ? this._activeMarker.getLatLng() : this._originMarker.getLatLng()],
				this.options.polyLineOptions).addTo(this._handlersGroup);
			}
		}
		if (this._polyLine)
			this._map.addLayer(this._polyLine);

		this._scaleOrigin  = this._originMarker.getLatLng();

		this._initialMatrix = this._matrix.clone();
		this._cachePoints();

		this._activeMarker.addEventParent(this._map);
		this._map
			.on('mousemove', this._polyLine ? this._onPolyHandleDrag : this._onScale,    this)
			.on('mouseup',   this._polyLine ? this._onPolyHandleDragEnd: this._onScaleEnd, this);
		this._initialDist  = this._originMarker._point.distanceTo(this._activeMarker._point);
		this._initialDistX = this._originMarker._point.x - this._activeMarker._point.x;
		this._initialDistY = this._originMarker._point.y - this._activeMarker._point.y;

		this._path
			.fire('transformstart', { layer: this._path })
			.fire('scalestart', {
				layer: this._path,
				scale: L.point(1, 1),
				pos: this._activeMarker._latlng,
				handleId: this._activeMarker.options.id
			});
	},

	_onPolyHandleDrag: function(evt) {
		if (!this._rect) {
			return;
		}
		var direction = new L.LatLng(0,0);
		var middleHandleCursor = 0;
		if (this._activeMarker.options.cursor == 8) {
			direction.lat = evt.latlng.lat;
			direction.lng = this._activeMarker.getLatLng().lng;
			middleHandleCursor = 8;
		} else if (this._activeMarker.options.cursor == 10) {
			direction.lat = this._activeMarker.getLatLng().lat;
			direction.lng = evt.latlng.lng;
			middleHandleCursor = 10;
		} else {
			direction = evt.latlng;
		}
		if (this._polyLine) {
			var lineTop = this._polyLine.getLatLngs()[0];
			var lineBottom = this._polyLine.getLatLngs()[1];
			if (middleHandleCursor == 10) {
				lineTop.lng = direction.lng;
				lineBottom.lng = direction.lng;
			} else if (middleHandleCursor == 8) {
				lineTop.lat = direction.lat;
				lineBottom.lat = direction.lat;
			} else if (this.options.shapeType == 2) { // flat line
				var handleIndex = this._activeMarker.options.index;
				if (handleIndex == 0) {
					lineTop = direction;
				} else {
					lineBottom = direction;
				}
			}
			this._polyLine.setLatLngs([lineTop, lineBottom]);
		}
		this._activeMarker.setLatLng(direction);
		this._activeMarker._updatePath();
	},

	_onPolyHandleDragEnd: function() {
		if (!this._rect || !this._scaleOrigin) {
			return;
		}
		this._activeMarker.removeEventParent(this._map);
		this._map
			.off('mousemove', this._onPolyHandleDrag,    this)
			.off('mouseup',   this._onPolyHandleDragEnd, this);

		if (this.options.rotation) {
			this._map.addLayer(this._handleLine);
			this._map.addLayer(this._rotationMarker);
		}

		if (this.options.handles['custom'] !== '') {
			this._map.addLayer(this._customMarker);
		}

		this._apply();
		this._path.fire('scaleend', {
			layer: this._path,
			scale: this._scale.clone(),
			pos: this._activeMarker._latlng,
			handleId: this._activeMarker.options.id
		});

		this._scaleOrigin = undefined;
		this._originMarker = undefined;
		if (this._polyLine) {
			this._map.removeLayer(this._polyLine);
		}
	},

	/**
	* Custom Shape Handles, id = 22
	*/
	_createCustomHandlers: function() {
		var map = this._map;
		var handle = this.options.handles['custom']['22'][0];
		this._customHandle = handle;
		this._customHandlePosition = map._docLayer._twipsToLatLng(handle.point, this._map.getZoom());
		var CustomHandleClass = this.options.customHandleClass;
		var options = this.options.handlerOptions;
		this._customMarker = new CustomHandleClass(this._customHandlePosition,
			options)
			.addTo(this._handlersGroup)
			.on('mousedown', this._onCustomHandleDragStart, this);

		this._handlers.push(this._customMarker);
	},

	_onCustomHandleDragStart: function(evt) {
		var map = this._map;
		this._activeMarker = evt.target;

		this._handleDragged = false;
		map._docLayer._graphicMarker.isDragged = true;
		this._mapDraggingWasEnabled = false;
		if (map.dragging.enabled()) {
			map.dragging.disable();
			this._mapDraggingWasEnabled = true;
		}

		this._customMarker.addEventParent(this._map);
		this._path._map
			.on('mousemove', this._onCustomHandleDrag,     this)
			.on('mouseup',   this._onCustomHandleDragEnd,  this);
	},

	/**
	* @param  {Event} evt
	*/
	_onCustomHandleDrag: function(evt) {
		if (!this._rect) {
			return;
		}
		this._handleDragged = true;
		this._customMarker.setLatLng(evt.latlng);
		this._customMarker._updatePath();
	},

	_onCustomHandleDragEnd: function() {
		if (!this._rect) {
			return;
		}
		var map = this._map;
		map._docLayer._graphicMarker.isDragged = false;
		this._customMarker.removeEventParent(this._map);
		this._path._map
			.off('mousemove', this._onCustomHandleDrag,     this)
			.off('mouseup',   this._onCustomHandleDragEnd,  this);

		this._path.fire('scaleend', {
			pos: this._activeMarker._latlng,
			handleId: this._customHandle.id
		});

		this._activeMarker = null;
		// Set the initial position;
		// If the final look of the shape does not change we dont get selection update
		// In that case, marker may stay where it is placed. This fixes that.
		this._customMarker.setLatLng(this._customHandlePosition);
		this._customMarker._updatePath();
	},

	/**
	* @return {L.LatLng}
	*/
	_getRotationOrigin: function() {
		var latlngs = this._rect._latlngs;
		var lb = latlngs[0];
		var rt = latlngs[2];

		return new L.LatLng(
			(lb.lat + rt.lat) / 2,
			(lb.lng + rt.lng) / 2
		);
	},


	/**
	* Secure the rotation origin
	* @param  {Event} evt
	*/
	_onRotateStart: function(evt) {
		var map = this._map;

		this._handleDragged = false;
		this._mapDraggingWasEnabled = false;
		if (map.dragging.enabled()) {
			map.dragging.disable();
			this._mapDraggingWasEnabled = true;
		}
		this._originMarker     = null;
		this._rotationOriginPt = map.latLngToLayerPoint(this._getRotationOrigin());
		this._rotationStart    = evt.layerPoint;
		this._initialMatrix    = this._matrix.clone();

		this._angle = 0;
		this._rotationMarker.addEventParent(this._map);
		this._path._map
			.on('mousemove', this._onRotate,     this)
			.on('mouseup',   this._onRotateEnd, this);

		this._cachePoints();
		this._path
			.fire('transformstart',   { layer: this._path })
			.fire('rotatestart', { layer: this._path, rotation: 0 });
	},


	/**
	* @param  {Event} evt
	*/
	_onRotate: function(evt) {
		if (!this._rect || !this._rotationStart) {
			return;
		}
		var pos = evt.layerPoint;
		var previous = this._rotationStart;
		var origin   = this._rotationOriginPt;

		this._handleDragged = true;

		// rotation step angle
		this._angle = Math.atan2(pos.y - origin.y, pos.x - origin.x) -
			Math.atan2(previous.y - origin.y, previous.x - origin.x);

		this._matrix = this._initialMatrix
			.clone()
			.rotate(this._angle, origin)
			.flip();

		this._update();
		this._path.fire('rotate', { layer: this._path, rotation: this._angle });
	},


	/**
	* @param  {Event} evt
	*/
	_onRotateEnd: function(evt) {
		if (!this._rect || !this._rotationStart) {
			return;
		}
		var pos = evt.layerPoint;
		var previous = this._rotationStart;
		var origin = this._rotationOriginPt;
		var angle = Math.atan2(-(pos.y - origin.y), pos.x - origin.x) -
			Math.atan2(-(previous.y - origin.y), previous.x - origin.x);

		if (angle < 0) {
			angle += (2 * Math.PI);
		}

		this._rotationMarker.removeEventParent(this._map);
		this._path._map
			.off('mousemove', this._onRotate, this)
			.off('mouseup',   this._onRotateEnd, this);

		this._apply();
		this._path.fire('rotateend', { layer: this._path, rotation: angle });

		this._rotationStart = undefined;
	},


	/**
	* @param  {Event} evt
	*/
	_onScaleStart: function(evt) {
		var marker = evt.target;
		var map = this._map;

		this._handleDragged = false;
		this._mapDraggingWasEnabled = false;
		if (map.dragging.enabled()) {
			map.dragging.disable();
			this._mapDraggingWasEnabled = true;
		}

		this._activeMarker = marker;

		this._originMarker = this._handlers[(marker.options.index + 4) % 8];
		this._scaleOrigin  = this._originMarker.getLatLng();

		this._initialMatrix = this._matrix.clone();
		this._cachePoints();

		this._activeMarker.addEventParent(this._map);
		this._map
			.on('mousemove', this._onScale,    this)
			.on('mouseup',   this._onScaleEnd, this);
		this._initialDist  = this._originMarker._point.distanceTo(this._activeMarker._point);
		this._initialDistX = this._originMarker._point.x - this._activeMarker._point.x;
		this._initialDistY = this._originMarker._point.y - this._activeMarker._point.y;

		var index = this._activeMarker.options.index;
		this._path
			.fire('transformstart', { layer: this._path })
			.fire('scalestart', {
				layer: this._path,
				scale: L.point(1, 1),
				pos: this._activeMarker._latlng,
				handleId: this._getPoints()[index].id
			});

		if (this.options.rotation) {
			this._map.removeLayer(this._handleLine);
			this._map.removeLayer(this._rotationMarker);
		}

		if (this.options.handles['custom'] !== '') {
			this._map.removeLayer(this._customMarker);
		}

		//this._handleLine = this._rotationMarker = null;
	},


	/**
	* @param  {Event} evt
	*/
	_onScale: function(evt) {
		if (!this._rect || !this._scaleOrigin) {
			return;
		}

		var originPoint = this._originMarker._point;
		var ratioX, ratioY;

		this._handleDragged = true;

		if ((window.ThisIsAMobileApp && (this._activeMarker.options.index % 2) == 0) ||
		    this.options.uniformScaling) {
			ratioX = originPoint.distanceTo(evt.layerPoint) / this._initialDist;
			ratioY = ratioX;
		} else {
			ratioX = this._initialDistX !== 0 ?
				(originPoint.x - evt.layerPoint.x) / this._initialDistX : 1;
			ratioY = this._initialDistY !== 0 ?
				(originPoint.y - evt.layerPoint.y) / this._initialDistY : 1;
		}

		this._scale = new L.Point(ratioX, ratioY);

		// update matrix
		this._matrix = this._initialMatrix
			.clone()
			.scale(this._scale, originPoint);

		this._update();
		this._path.fire('scale', {
			layer: this._path, scale: this._scale.clone() });
	},


	/**
	* Scaling complete
	* @param  {Event} evt
	*/
	_onScaleEnd: function(/*evt*/) {
		if (!this._rect || !this._scaleOrigin) {
			return;
		}
		this._activeMarker.removeEventParent(this._map);
		this._map
			.off('mousemove', this._onScale,    this)
			.off('mouseup',   this._onScaleEnd, this);

		if (this.options.rotation) {
			this._map.addLayer(this._handleLine);
			this._map.addLayer(this._rotationMarker);
		}

		if (this.options.handles['custom'] !== '') {
			this._map.addLayer(this._customMarker);
		}

		var index = this._activeMarker.options.index;
		this._apply();
		this._path.fire('scaleend', {
			layer: this._path,
			scale: this._scale.clone(),
			pos: this._activeMarker._latlng,
			handleId: this._activeMarker.options.id || this._getPoints()[index].id
		});

		this._scaleOrigin = undefined;
		this._originMarker = undefined;
	},


	/**
	* Cache current handlers positions
	*/
	_cachePoints: function() {
		this._handlersGroup.eachLayer(function(layer) {
			layer.bringToFront();
		});
		for (var i = 0, len = this._handlers.length; i < len; i++) {
			var handler = this._handlers[i];
			handler._initialPoint = handler._point.clone();
		}
	},


	/**
	* Bounding polygon
	* @return {L.Polygon}
	*/
	_getBoundingPolygon: function() {
		return new L.Rectangle(
			this._path.getBounds(), this.options.boundsOptions);
	},


	/**
	* Create corner marker
	* @param  {L.LatLng} latlng
	* @param  {Number}   type one of L.Handler.PathTransform.HandlerTypes
	* @param  {Number}   index
	* @param  {Function} event mousedown function
	* @return {L.Handler.PathTransform.Handle}
	*/
	_createHandler: function(latlng, type, index, event) {
		var HandleClass = this.options.handleClass;
		var options = {
			className: 'leaflet-drag-transform-marker drag-marker--' +
			index + ' drag-marker--' + type,
			index:     index,
			type:      type,
		};
		if (this.options.scaleSouthAndEastOnly && index < 5) {
			options.opacity = 0;
			options.fill = false;
			options.interactive = false;
		}
		var marker = new HandleClass(latlng,
			L.Util.extend({}, this.options.handlerOptions, options)
		);

		marker.on('mousedown', event, this);
		return marker;
	},

	_createPolyHandler: function(handle, index) {
		var HandleClass = this.options.polyHandleClass;
		var options = {
			className: 'leaflet-drag-transform-marker',
			index:     index,
			cursor:    handle.pointer,
			id:        handle.id,
			kind:      handle.kind
		};
		if (options.cursor != 10 && options.cursor != 8) {
			this._polyEdges.push(index);
		}
		var marker = new HandleClass(this._map._docLayer._twipsToLatLng(handle.point, this._map.getZoom()),
			L.Util.extend({}, this.options.handlerOptions, options)
		);

		marker.on('mousedown', this._onPolyHandleDragStart, this);
		return marker;
	},


	/**
	* Hide(not remove) the handlers layer
	*/
	_hideHandlers: function() {
		if (this._handlersGroup)
			this._map.removeLayer(this._handlersGroup);
		this._handlersVisible = false;
	},

	_showHandlers: function() {
		this._map.addLayer(this._handlersGroup);
		this._updateHandlers();
		this._handlersVisible = true;
	},

	/**
	* Hide handlers and rectangle
	*/
	_onDragStart: function() {
		this._hideHandlers();
		this._rect.options.opacity = 1;
		this._map.addLayer(this._rect);
	},

	_onDrag: function(evt) {
		var rect = this._rect;
		var matrix = (evt.layer ? evt.layer : this._path).dragging._matrix.slice();

		this._rect._transform(matrix);
		rect._updatePath();
		rect._project();
	},


	/**
	* Drag rectangle, re-create handlers
	*/
	_onDragEnd: function(evt) {
		var rect = this._rect;
		var matrix = (evt.layer ? evt.layer : this._path).dragging._matrix.slice();

		if (!rect.dragging) {
			rect.dragging = new L.Handler.PathDrag(rect);
		}
		rect.dragging.enable();
		this._map.addLayer(rect);
		rect.dragging._transformPoints(matrix);
		rect._updatePath();
		rect._project();
		rect.dragging.disable();

		this._showHandlers();

		this._path.fire('transformed', {
			scale: L.point(1, 1),
			rotation: 0,
			matrix: L.matrix.apply(undefined, matrix),
			translate: L.point(matrix[4], matrix[5]),
			layer: this._path
		});
	}
});

L.SVGGroup.addInitHook(function() {
	if (this.options.transform) {
		this.transform = new L.Handler.PathTransform(this, this.options.transform);
	}
});
