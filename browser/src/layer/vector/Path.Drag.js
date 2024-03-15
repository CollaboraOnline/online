var END = {
	mousedown:     'mouseup',
	touchstart:    'touchend',
	pointerdown:   'touchend',
	MSPointerDown: 'touchend'
};

var MOVE = {
	mousedown:     'mousemove',
	touchstart:    'touchmove',
	pointerdown:   'touchmove',
	MSPointerDown: 'touchmove'
};

function distance(a, b) {
	var dx = a.x - b.x, dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Drag handler
 * @class L.Path.Drag
 * @extends {L.Handler}
 */
L.Handler.PathDrag = L.Handler.extend(/** @lends  L.Path.Drag.prototype */ {

	statics: {
		DRAGGING_CLS: 'leaflet-path-draggable',
	},


	/**
	* @param  {L.Path} path
	* @constructor
	*/
	initialize: function(path) {

		/**
		* @type {L.Path}
		*/
		this._path = path;

		/**
		* @type {Array.<Number>}
		*/
		this._matrix = null;

		/**
		* @type {L.Point}
		*/
		this._startPoint = null;

		/**
		* @type {L.Point}
		*/
		this._dragStartPoint = null;

		/**
		* Whether the drag is constrained (Shift key pressed)
		* @type {Boolean}
		*/
		this.shiftConstraint = false;

		/**
		* @type {Boolean}
		*/
		this._mapDraggingWasEnabled = false;

	},

	noManualDrag: window.memo.decorator(function(f) {
		if ('noManualDrag' in this._path) {
			return this._path.noManualDrag.bind(this._path)(f).bind(this._path);
		} else {
			return f;
		}
	}),

	/**
	* Enable dragging
	*/
	addHooks: function() {
		this._path.on('mousedown', this._onDragStart, this);

		this._path.options.className = this._path.options.className ?
			(this._path.options.className + ' ' + L.Handler.PathDrag.DRAGGING_CLS) :
			 L.Handler.PathDrag.DRAGGING_CLS;

		this._path.addClass(L.Handler.PathDrag.DRAGGING_CLS);
	},

	/**
	* Disable dragging
	*/
	removeHooks: function() {
		this._path.off('mousedown', this._onDragStart, this);

		this._path.options.className = this._path.options.className
			.replace(new RegExp('\\s+' + L.Handler.PathDrag.DRAGGING_CLS), '');

		this._path.removeClass(L.Handler.PathDrag.DRAGGING_CLS);

		L.DomEvent.off(document, 'mousemove touchmove', this.noManualDrag(window.memo.bind(this._onDrag, this)),    this);
		L.DomEvent.off(document, 'mouseup touchend',    this.noManualDrag(window.memo.bind(this._onDragEnd, this)), this);
	},

	/**
	* @return {Boolean}
	*/
	moved: function() {
		return this._path._dragMoved;
	},

	/**
	* Start drag
	* @param  {L.MouseEvent} evt
	*/
	_onDragStart: function(evt) {
		var eventType = evt.originalEvent._simulated ? 'touchstart' : evt.originalEvent.type;

		if (!MOVE[eventType])
			return;

		this._mouseDown = evt.originalEvent;
		this._mapDraggingWasEnabled = false;
		this._startPoint = evt.containerPoint.clone();
		this._dragStartPoint = evt.containerPoint.clone();
		this._matrix = [1, 0, 0, 1, 0, 0];
		L.DomEvent.stop(evt.originalEvent);

		this._path._renderer.addContainerClass('leaflet-interactive');

		L.DomEvent
		 .on(document, MOVE[eventType], this.noManualDrag(window.memo.bind(this._onDrag, this)),    this)
		 .on(document, END[eventType],  this.noManualDrag(window.memo.bind(this._onDragEnd, this)), this);

		if (this._path._map.dragging.enabled()) {
			// I guess it's required because mousedown gets simulated with a delay
			//this._path._map.dragging._draggable._onUp(evt);

			this._path._map.dragging.disable();
			this._mapDraggingWasEnabled = true;
		}
		this._path._dragMoved = false;

		if (this._path._popup) { // that might be a case on touch devices as well
			this._path._popup._close();
		}

		this._replaceCoordGetters(evt);
	},

	/**
	* Dragging
	* @param  {L.MouseEvent} evt
	*/
	_onDrag: function(evt) {
		if (!this._startPoint)
			return;

		L.DomEvent.stop(evt);

		var first = (evt.touches && evt.touches.length >= 1 ? evt.touches[0] : evt);
		var containerPoint = this._path._map.mouseEventToContainerPoint(first);

		// skip taps
		if (evt.type === 'touchmove' && !this._path._dragMoved) {
			var totalMouseDragDistance = this._dragStartPoint.distanceTo(containerPoint);
			if (totalMouseDragDistance <= this._path._map.options.tapTolerance) {
				return;
			}
		}

		if (this._startPoint === null)
			return;

		var x = containerPoint.x;
		var y = containerPoint.y;

		var dx = x - this._startPoint.x;
		var dy = y - this._startPoint.y;

		if (isNaN(dx) || isNaN(dy))
			return;

		this.shiftConstraint = evt.shiftKey;

		if (this.constraint) {
			if (this.constraint.dragMethod === 'PieSegmentDragging') {
				var initialOffset = this.constraint.initialOffset;
				var dragDirection = this.constraint.dragDirection;

				var dsx = x - this._dragStartPoint.x;
				var dsy = y - this._dragStartPoint.y;
				var additionalOffset = (dsx * dragDirection.x + dsy * dragDirection.y) / this.constraint.range2;
				var currentOffset = (dx * dragDirection.x + dy * dragDirection.y) / this.constraint.range2;

				if (additionalOffset < -initialOffset && currentOffset < 0)
					currentOffset = 0;
				else if (additionalOffset > (1.0 - initialOffset) && currentOffset > 0)
					currentOffset = 0;

				dx = currentOffset * dragDirection.x;
				dy = currentOffset * dragDirection.y;

				x = this._startPoint.x + dx;
				y = this._startPoint.y + dy;
			}
		} else if (this.shiftConstraint) {
			var ds = containerPoint.subtract(this._dragStartPoint);

			var delta = L.Constraint.shiftConstraint(ds);

			var angle = ds.angleOf();
			if (L.Constraint.angleNear(angle, 0) || L.Constraint.angleNear(angle, Math.PI)) {
				// Snap back the y to 0
				delta.x = dx;
				delta.y = -this._matrix[5];
				y = this._startPoint.y;
			} else if (L.Constraint.angleNear(angle, Math.PI / 2) || L.Constraint.angleNear(angle, -Math.PI / 2)) {
				// Snap back the x to 0
				delta.x = -this._matrix[4];
				delta.y = dy;
				x = this._startPoint.x;
			} else {
				delta.x -= this._matrix[4];
				delta.y -= this._matrix[5];
				x = this._startPoint.x + delta.x;
				y = this._startPoint.y + delta.y;
			}
			dx = delta.x;
			dy = delta.y;
		}

		// Send events only if point was moved
		if (dx || dy) {
			if (!this._path._dragMoved) {
				this._path._dragMoved = true;
				this._path.fire('dragstart', evt);
				// we don't want that to happen on click
				this._path.bringToFront();
			}

			this._matrix[4] += dx;
			this._matrix[5] += dy;

			this._startPoint.x = x;
			this._startPoint.y = y;

			this._path.fire('predrag', evt);
			this._path._transform(this._matrix);
			this._path.fire('drag', evt);
		}
	},

	/**
	* Dragging stopped, apply
	* @param  {L.MouseEvent} evt
	*/
	_onDragEnd: function(evt) {
		L.DomEvent.stop(evt);
		var containerPoint = this._path._map.mouseEventToContainerPoint(evt);
		var moved = this.moved();

		// apply matrix
		if (moved) {
			this._transformPoints(this._matrix);
			this._path._updatePath();
			this._path._project();
			this._path._transform(null);
		}

		L.DomEvent.off(document, 'mousemove touchmove', this.noManualDrag(window.memo.bind(this._onDrag, this)),    this);
		L.DomEvent.off(document, 'mouseup touchend',    this.noManualDrag(window.memo.bind(this._onDragEnd, this)), this);

		this._restoreCoordGetters();

		// consistency
		if (moved) {
			this._path.fire('dragend', {
				distance: distance(this._dragStartPoint, containerPoint)
			});

			// hack for skipping the click in canvas-rendered layers
			var contains = this._path._containsPoint;
			this._path._containsPoint = L.Util.falseFn;
			L.Util.requestAnimFrame(function() {
				L.DomEvent._skipped({ type: 'click' });
				this._path._containsPoint = contains;
			}, this);
		}

		this._matrix          = null;
		this._startPoint      = null;
		this._dragStartPoint  = null;
		this._path._dragMoved = false;

		if (this._mapDraggingWasEnabled) {
			if (moved) L.DomEvent._fakeStop({ type: 'click' });
			this._path._map.dragging.enable();
		}

		if (!moved && this._mouseDown && !this._path.options.manualDrag(this._mouseDown)) {
			this._path._map._handleDOMEvent(this._mouseDown);
			this._path._map._handleDOMEvent(evt);
		}
	},


	/**
	* Applies transformation, does it in one sweep for performance,
	* so don't be surprised about the code repetition.
	*
	* [ x ]   [ a  b  tx ] [ x ]   [ a * x + b * y + tx ]
	* [ y ] = [ c  d  ty ] [ y ] = [ c * x + d * y + ty ]
	*
	* @param {Array.<Number>} matrix
	*/
	_transformPoints: function(matrix, dest) {
		var path = this._path;
		var i, len, latlng;

		var px = L.point(matrix[4], matrix[5]);

		var crs = path._map.options.crs;
		var transformation = crs.transformation;
		var scale = crs.scale(path._map.getZoom());
		var projection = crs.projection;

		var diff = transformation.untransform(px, scale)
			.subtract(transformation.untransform(L.point(0, 0), scale));
		var applyTransform = !dest;
		var bounds = path._bounds;

		path._bounds = new L.LatLngBounds();

		// window.app.console.time('transform');
		// all shifts are in-place
		if (path._point) { // L.Circle
			dest = projection.unproject(
				projection.project(path._latlng)._add(diff));
			if (applyTransform) {
				path._latlng = dest;
				path._point._add(px);
			}
		} else if (path._rings || path._parts) { // everything else
			var rings   = path._rings || path._parts;
			var latlngs = path._latlngs;
			dest = dest || latlngs;
			if (!L.Util.isArray(latlngs[0])) { // polyline
				latlngs = [latlngs];
				dest    = [dest];
			}
			for (i = 0, len = rings.length; i < len; i++) {
				dest[i] = dest[i] || [];
				for (var j = 0, jj = rings[i].length; j < jj; j++) {
					latlng     = latlngs[i][j];
					dest[i][j] = projection
						.unproject(projection.project(latlng)._add(diff));
					if (applyTransform) {
						path._bounds.extend(latlngs[i][j]);
						rings[i][j]._add(px);
					}
				}
			}
		} else if (path instanceof L.SVGGroup) {
			if (applyTransform) {
				bounds._southWest = projection.unproject(projection.project(bounds._southWest)._add(diff));
				bounds._northEast = projection.unproject(projection.project(bounds._northEast)._add(diff));
				path._bounds = bounds;
			}
		}

		return dest;
		// window.app.console.timeEnd('transform');
	},


	/**
	* If you want to read the latlngs during the drag - your right,
	* but they have to be transformed
	*/
	_replaceCoordGetters: function() {
		if (this._path.getLatLng) { // Circle, CircleMarker
			this._path.getLatLng_ = this._path.getLatLng;
			this._path.getLatLng = L.Util.bind(function() {
				return this.dragging._transformPoints(this.dragging._matrix, {});
			}, this._path);
		} else if (this._path.getLatLngs) {
			this._path.getLatLngs_ = this._path.getLatLngs;
			this._path.getLatLngs = L.Util.bind(function() {
				return this.dragging._transformPoints(this.dragging._matrix, []);
			}, this._path);
		}
	},


	/**
	* Put back the getters
	*/
	_restoreCoordGetters: function() {
		if (this._path.getLatLng_) {
			this._path.getLatLng = this._path.getLatLng_;
			delete this._path.getLatLng_;
		} else if (this._path.getLatLngs_) {
			this._path.getLatLngs = this._path.getLatLngs_;
			delete this._path.getLatLngs_;
		}
	}

});


/**
 * @param  {L.Path} layer
 * @return {L.Path}
 */
L.Handler.PathDrag.makeDraggable = function(layer) {
	layer.dragging = new L.Handler.PathDrag(layer);
	return layer;
};


/**
 * Also expose as a method
 * @return {L.Path}
 */
L.Path.prototype.makeDraggable = function() {
	return L.Handler.PathDrag.makeDraggable(this);
};

var fnInitHook = function() {
	if (this.options.draggable) {
		// ensure interactive
		this.options.interactive = true;

		if (this.dragging) {
			this.dragging.enable();
		} else {
			L.Handler.PathDrag.makeDraggable(this);
			this.dragging.enable();
		}
		this.dragging.constraint = this.options.dragConstraint;
	} else if (this.dragging) {
		this.dragging.disable();
		this.dragging.constraint = null;
	}
};

L.SVGGroup.addInitHook(fnInitHook);
