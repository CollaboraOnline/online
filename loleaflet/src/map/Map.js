/* -*- js-indent-level: 8 -*- */
/*
 * L.Map is the central class of the API - it is used to create a map.
 */

/* global vex $ */
L.Map = L.Evented.extend({

	options: {
		crs: L.CRS.Simple,
		center: [0, 0],
		zoom: 10,
		minZoom: 1,
		maxZoom: 20,
		fadeAnimation: false, // Not useful for typing.
		trackResize: true,
		markerZoomAnimation: true,
		defaultZoom: 10,
		tileWidthTwips: 3840,
		tileHeightTwips: 3840,
		urlPrefix: 'lool'
	},

	lastActiveTime: Date.now(),

	initialize: function (id, options) { // (HTMLElement or String, Object)
		options = L.setOptions(this, options);

		if (this.options.documentContainer) {
			// have it as DOM object
			this.options.documentContainer = L.DomUtil.get(this.options.documentContainer);
		}

		this._initContainer(id);
		this._initLayout();

		// hack for https://github.com/Leaflet/Leaflet/issues/1980
		this._onResize = L.bind(this._onResize, this);

		this._initEvents();

		if (options.maxBounds) {
			this.setMaxBounds(options.maxBounds);
		}

		if (options.zoom !== undefined) {
			this._zoom = this._limitZoom(options.zoom);
		}

		if (options.center && options.zoom !== undefined) {
			this.setView(L.latLng(options.center), options.zoom, {reset: true});
		}

		L.Cursor.imagePath = options.cursorURL || L.Cursor.getCursorURL('cursors');

		if (options.webserver === undefined) {
			var protocol = window.location.protocol === 'file:' ? 'https:' : window.location.protocol;
			options.webserver = options.server.replace(/^(ws|wss):/i, protocol);
		}

		// we are adding components like '/insertfile' at the end which would
		// lead to URL's of the form <webserver>//insertfile/...
		options.webserver = options.webserver.replace(/\/*$/, '');

		this._handlers = [];
		this._layers = {};
		this._zoomBoundLayers = {};
		this._sizeChanged = true;
		this._bDisableKeyboard = false;
		this._active = true;
		this._fatal = false;
		this._enabled = true;
		this._debugAlwaysActive = false; // disables the dimming / document inactivity when true
		this._serverRecycling = false;

		vex.dialogID = -1;

		this.callInitHooks();

		if (this.options.imagePath) {
			L.Icon.Default.imagePath = this.options.imagePath;
		}
		this._addLayers(this.options.layers);
		this._socket = L.socket(this);
		this._progressBar = L.progressOverlay(this.getCenter(), L.point(150, 25));

		// Inhibit the context menu - the browser thinks that the document
		// is just a bunch of images, hence the context menu is useless (tdf#94599)
		this.on('contextmenu', function() {});

		// When all these conditions are met, fire statusindicator:initializationcomplete
		this.initConditions = {
			'doclayerinit': false,
			'statusindicatorfinish': false,
			'StyleApply': false,
			'CharFontName': false,
			'updatepermission': false
		};
		this.initComplete = false;

		this.on('updatepermission', function(e) {
			if (!this.initComplete) {
				this._fireInitComplete('updatepermission');
			}

			if (e.perm === 'readonly') {
				L.DomUtil.addClass(this._container.parentElement, 'readonly');
				L.DomUtil.addClass(L.DomUtil.get('logo'), 'readonly');
				L.DomUtil.addClass(L.DomUtil.get('toolbar-wrapper'), 'readonly');
				L.DomUtil.addClass(L.DomUtil.get('main-menu'), 'readonly');
				L.DomUtil.addClass(L.DomUtil.get('presentation-controls-wrapper'), 'readonly');
				L.DomUtil.addClass(L.DomUtil.get('spreadsheet-row-column-frame'), 'readonly');
			}
		}, this);
		this.on('doclayerinit', function() {
			if (!this.initComplete) {
				this._fireInitComplete('doclayerinit');
			}
		});
		this.on('updatetoolbarcommandvalues', function(e) {
			if (this.initComplete) {
				return;
			}
			if (e.commandName === '.uno:StyleApply') {
				this._fireInitComplete('StyleApply');
			}
			else if (e.commandName === '.uno:CharFontName') {
				this._fireInitComplete('CharFontName');
			}
		});

		this.showBusy(_('Initializing...'), false);
		this.on('statusindicator', this._onUpdateProgress, this);

		// View info (user names and view ids)
		this._viewInfo = {};

		// View color map
		this._viewColors = {};

		// This becomes true if document was ever modified by the user
		this._everModified = false;

		this.on('commandstatechanged', function(e) {
			if (e.commandName === '.uno:ModifiedStatus')
				this._everModified = this._everModified || (e.state === 'true');
		}, this);
	},

	// public methods that modify map state

	getViewId: function (username) {
		for (var idx in this._viewInfo) {
			if (this._viewInfo[idx].username === username) {
				return this._viewInfo[idx].id;
			}
		}
		return -1;
	},

	addView: function(viewInfo) {
		this._viewInfo[viewInfo.id] = viewInfo;
		this.fire('postMessage', {msgId: 'View_Added', args: {ViewId: viewInfo.id, UserId: viewInfo.userid, UserName: viewInfo.username, Color: viewInfo.color, ReadOnly: viewInfo.readonly}});

		// Fire last, otherwise not all events are handled correctly.
		this.fire('addview', {viewId: viewInfo.id, username: viewInfo.username, extraInfo: viewInfo.userextrainfo, readonly: this.isViewReadOnly(viewInfo.id)});
	},

	removeView: function(viewid) {
		var username = this._viewInfo[viewid].username;
		delete this._viewInfo[viewid];
		this.fire('postMessage', {msgId: 'View_Removed', args: {ViewId: viewid}});

		// Fire last, otherwise not all events are handled correctly.
		this.fire('removeview', {viewId: viewid, username: username});
	},


	// replaced by animation-powered implementation in Map.PanAnimation.js
	setView: function (center, zoom) {
		zoom = zoom === undefined ? this.getZoom() : zoom;
		this._resetView(L.latLng(center), this._limitZoom(zoom));
		return this;
	},

	showBusy: function(label, bar) {
		// If document is already loaded, ask the toolbar widget to show busy
		// status on the bottom statusbar
		if (this._docLayer) {
			this.fire('showbusy', {label: label});
			return;
		}

		this._progressBar.setLabel(label);
		this._progressBar.setBar(bar);
		this._progressBar.setValue(0);

		if (!this.hasLayer(this._progressBar)) {
			this.addLayer(this._progressBar);
		}
	},

	hideBusy: function () {
		this.fire('hidebusy');

		if (this.hasLayer(this._progressBar)) {
			this.removeLayer(this._progressBar);
		}
	},

	setZoom: function (zoom, options) {
		if (!this._loaded) {
			this._zoom = this._limitZoom(zoom);
			return this;
		}
		if (this._docLayer && this._docLayer._docType === 'spreadsheet') {
			// for spreadsheets, when the document is smaller than the viewing area
			// we want it to be glued to the row/column headers instead of being centered
			this._docLayer._checkSpreadSheetBounds(zoom);
		}
		return this.setView(this.getCenter(), zoom, {zoom: options});
	},

	zoomIn: function (delta, options) {
		return this.setZoom(this._zoom + (delta || 1), options);
	},

	zoomOut: function (delta, options) {
		return this.setZoom(this._zoom - (delta || 1), options);
	},

	setZoomAround: function (latlng, zoom, options) {
		var scale = this.getZoomScale(zoom),
		    viewHalf = this.getSize().divideBy(2),
		    containerPoint = latlng instanceof L.Point ? latlng : this.latLngToContainerPoint(latlng),

		    centerOffset = containerPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale),
		    newCenter = this.containerPointToLatLng(viewHalf.add(centerOffset));

		return this.setView(newCenter, zoom, {zoom: options});
	},

	fitBounds: function (bounds, options) {

		options = options || {};
		bounds = bounds.getBounds ? bounds.getBounds() : L.latLngBounds(bounds);

		var paddingTL = L.point(options.paddingTopLeft || options.padding || [0, 0]),
		    paddingBR = L.point(options.paddingBottomRight || options.padding || [0, 0]),

		    zoom = this.getBoundsZoom(bounds, false, paddingTL.add(paddingBR));

		zoom = options.maxZoom ? Math.min(options.maxZoom, zoom) : zoom;

		var paddingOffset = paddingBR.subtract(paddingTL).divideBy(2),

		    swPoint = this.project(bounds.getSouthWest(), zoom),
		    nePoint = this.project(bounds.getNorthEast(), zoom),
		    center = this.unproject(swPoint.add(nePoint).divideBy(2).add(paddingOffset), zoom);

		return this.setView(center, zoom, options);
	},

	fitWorld: function (options) {
		return this.fitBounds([[-90, -180], [90, 180]], options);
	},

	panTo: function (center, options) { // (LatLng)
		return this.setView(center, this._zoom, {pan: options});
	},

	panBy: function (offset) { // (Point)
		// replaced with animated panBy in Map.PanAnimation.js
		this.fire('movestart');

		this._rawPanBy(L.point(offset));

		this.fire('move');
		return this.fire('moveend');
	},

	setMaxBounds: function (bounds, options) {
		bounds = L.latLngBounds(bounds);

		this.options.maxBounds = bounds;
		options = options || {};

		if (!bounds) {
			return this.off('moveend', this._panInsideMaxBounds);
		}

		if (this._loaded) {
			this._panInsideMaxBounds();
		}

		if (options.panInside === false) {
			return this.off('moveend', this._panInsideMaxBounds);
		}

		return this.on('moveend', this._panInsideMaxBounds);
	},

	panInsideBounds: function (bounds, options) {
		var center = this.getCenter(),
		    newCenter = this._limitCenter(center, this._zoom, bounds);

		if (center.equals(newCenter)) { return this; }

		return this.panTo(newCenter, options);
	},

	invalidateSize: function (options) {
		if (!this._loaded) { return this; }

		options = L.extend({
			animate: false,
			pan: true
		}, options === true ? {animate: true} : options);

		var oldSize = this.getSize();
		this._sizeChanged = true;

		var newSize = this.getSize(),
		    oldCenter = oldSize.divideBy(2).round(),
		    newCenter = newSize.divideBy(2).round(),
		    offset = oldCenter.subtract(newCenter);

		if (!offset.x && !offset.y) { return this; }

		if (options.animate && options.pan) {
			this.panBy(offset);

		} else {
			if (options.pan) {
				this._rawPanBy(offset);
			}

			this.fire('move');

			if (options.debounceMoveend) {
				clearTimeout(this._sizeTimer);
				this._sizeTimer = setTimeout(L.bind(this.fire, this, 'moveend'), 200);
			} else {
				this.fire('moveend');
			}
		}

		return this.fire('resize', {
			oldSize: oldSize,
			newSize: newSize
		});
	},

	stop: function () {
		L.Util.cancelAnimFrame(this._flyToFrame);
		if (this._panAnim) {
			this._panAnim.stop();
		}
		return this;
	},

	// TODO handler.addTo
	addHandler: function (name, HandlerClass) {
		if (!HandlerClass) { return this; }

		var handler = this[name] = new HandlerClass(this);

		this._handlers.push(handler);

		if (this.options[name]) {
			handler.enable();
		}

		return this;
	},

	remove: function () {

		this._initEvents(true);

		try {
			// throws error in IE6-8
			delete this._container._leaflet;
		} catch (e) {
			this._container._leaflet = undefined;
		}

		L.DomUtil.remove(this._mapPane);

		if (this._clearControlPos) {
			this._clearControlPos();
		}

		this._clearHandlers();

		if (this._loaded) {
			this.fire('unload');
		}

		if (this._docLayer) {
			this.removeLayer(this._docLayer);
		}
		this.removeControls();
		this._socket.close();
		return this;
	},

	createPane: function (name, container) {
		var className = 'leaflet-pane' + (name ? ' leaflet-' + name.replace('Pane', '') + '-pane' : ''),
		    pane = L.DomUtil.create('div', className, container || this._mapPane);

		if (name) {
			this._panes[name] = pane;
		}
		return pane;
	},


	// public methods for getting map state

	getViewName: function(viewid) {
		return this._viewInfo[viewid].username;
	},

	getViewColor: function(viewid) {
		return this._viewInfo[viewid].color;
	},

	isViewReadOnly: function(viewid) {
		return this._viewInfo[viewid].readonly !== '0';
	},

	getCenter: function () { // (Boolean) -> LatLng
		this._checkIfLoaded();
		return this.layerPointToLatLng(this._getCenterLayerPoint());
	},

	getZoom: function () {
		return this._zoom;
	},

	getBounds: function () {
		var bounds = this.getPixelBounds(),
		    sw = this.unproject(bounds.getBottomLeft()),
		    ne = this.unproject(bounds.getTopRight());

		return new L.LatLngBounds(sw, ne);
	},

	getMinZoom: function () {
		return this.options.minZoom === undefined ? this._layersMinZoom || 0 : this.options.minZoom;
	},

	getMaxZoom: function () {
		return this.options.maxZoom === undefined ?
			(this._layersMaxZoom === undefined ? Infinity : this._layersMaxZoom) :
			this.options.maxZoom;
	},

	getBoundsZoom: function (bounds, inside, padding) { // (LatLngBounds[, Boolean, Point]) -> Number
		bounds = L.latLngBounds(bounds);

		var zoom = this.getMinZoom() - (inside ? 1 : 0),
		    maxZoom = this.getMaxZoom(),
		    size = this.getSize(),

		    nw = bounds.getNorthWest(),
		    se = bounds.getSouthEast(),

		    zoomNotFound = true,
		    boundsSize;

		padding = L.point(padding || [0, 0]);

		do {
			zoom++;
			boundsSize = this.project(se, zoom).subtract(this.project(nw, zoom)).add(padding).floor();
			zoomNotFound = !inside ? size.contains(boundsSize) : boundsSize.x < size.x || boundsSize.y < size.y;

		} while (zoomNotFound && zoom <= maxZoom);

		if (zoomNotFound && inside) {
			return null;
		}

		return inside ? zoom : zoom - 1;
	},

	getSize: function () {
		if (!this._size || this._sizeChanged) {
			this._size = new L.Point(
				this._container.clientWidth,
				this._container.clientHeight);

			this._sizeChanged = false;
		}
		return this._size.clone();
	},

	getPixelBounds: function (center, zoom) {
		var topLeftPoint = this._getTopLeftPoint(center, zoom);
		return new L.Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
	},

	getPixelOrigin: function () {
		this._checkIfLoaded();
		return this._pixelOrigin;
	},

	getPixelWorldBounds: function (zoom) {
		return this.options.crs.getProjectedBounds(zoom === undefined ? this.getZoom() : zoom);
	},

	getPane: function (pane) {
		return typeof pane === 'string' ? this._panes[pane] : pane;
	},

	getPanes: function () {
		return this._panes;
	},

	getContainer: function () {
		return this._container;
	},


	// TODO replace with universal implementation after refactoring projections

	getZoomScale: function (toZoom, fromZoom) {
		var crs = this.options.crs;
		fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
		return crs.scale(toZoom) / crs.scale(fromZoom);
	},

	getScaleZoom: function (scale, fromZoom) {
		fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
		return fromZoom + (Math.log(scale) / Math.LN2);
	},


	// conversion methods

	project: function (latlng, zoom) { // (LatLng[, Number]) -> Point
		zoom = zoom === undefined ? this._zoom : zoom;
		var projectedPoint = this.options.crs.latLngToPoint(L.latLng(latlng), zoom);
		return new L.Point(L.round(projectedPoint.x, 1e-6), L.round(projectedPoint.y, 1e-6));
	},

	unproject: function (point, zoom) { // (Point[, Number]) -> LatLng
		zoom = zoom === undefined ? this._zoom : zoom;
		return this.options.crs.pointToLatLng(L.point(point), zoom);
	},

	layerPointToLatLng: function (point) { // (Point)
		var projectedPoint = L.point(point).add(this.getPixelOrigin());
		return this.unproject(projectedPoint);
	},

	latLngToLayerPoint: function (latlng) { // (LatLng)
		var projectedPoint = this.project(L.latLng(latlng))._round();
		return projectedPoint._subtract(this.getPixelOrigin());
	},

	wrapLatLng: function (latlng) {
		return this.options.crs.wrapLatLng(L.latLng(latlng));
	},

	distance: function (latlng1, latlng2) {
		return this.options.crs.distance(L.latLng(latlng1), L.latLng(latlng2));
	},

	containerPointToLayerPoint: function (point) { // (Point)
		return L.point(point).subtract(this._getMapPanePos());
	},

	layerPointToContainerPoint: function (point) { // (Point)
		return L.point(point).add(this._getMapPanePos());
	},

	containerPointToLatLng: function (point) {
		var layerPoint = this.containerPointToLayerPoint(L.point(point));
		return this.layerPointToLatLng(layerPoint);
	},

	latLngToContainerPoint: function (latlng) {
		return this.layerPointToContainerPoint(this.latLngToLayerPoint(L.latLng(latlng)));
	},

	mouseEventToContainerPoint: function (e) { // (MouseEvent)
		return L.DomEvent.getMousePosition(e, this._container);
	},

	mouseEventToLayerPoint: function (e) { // (MouseEvent)
		return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
	},

	mouseEventToLatLng: function (e) { // (MouseEvent)
		return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
	},

	focus: function () {
		console.debug('focus:');
		if (this._docLayer && document.activeElement !== this._docLayer._textArea) {
			console.debug('focus: focussing');
			this._docLayer._textArea.focus();
		}
	},

	_fireInitComplete: function (condition) {
		if (this.initComplete) {
			return;
		}

		this.initConditions[condition] = true;
		for (var key in this.initConditions) {
			if (!this.initConditions[key]) {
				return;
			}
		}
		this.fire('statusindicator', {statusType: 'initializationcomplete'});
		this.initComplete = true;
	},

	_initContainer: function (id) {
		var container = this._container = L.DomUtil.get(id);

		if (!container) {
			throw new Error('Map container not found.');
		} else if (container._leaflet) {
			throw new Error('Map container is already initialized.');
		}

		var textAreaContainer = L.DomUtil.create('div', 'clipboard-container', container.parentElement);
		this._textArea = L.DomUtil.create('input', 'clipboard', textAreaContainer);
		this._textArea.setAttribute('type', 'text');
		this._textArea.setAttribute('autocorrect', 'off');
		this._textArea.setAttribute('autocapitalize', 'off');
		this._textArea.setAttribute('autocomplete', 'off');
		this._textArea.setAttribute('spellcheck', 'false');
		this._resizeDetector = L.DomUtil.create('iframe', 'resize-detector', container);
		this._fileDownloader = L.DomUtil.create('iframe', '', container);
		L.DomUtil.setStyle(this._fileDownloader, 'display', 'none');

		container._leaflet = true;
	},

	_initLayout: function () {
		var container = this._container;

		this._fadeAnimated = this.options.fadeAnimation && L.Browser.any3d;

		L.DomUtil.addClass(container, 'leaflet-container' +
			(L.Browser.touch ? ' leaflet-touch' : '') +
			(L.Browser.retina ? ' leaflet-retina' : '') +
			(L.Browser.ielt9 ? ' leaflet-oldie' : '') +
			(L.Browser.safari ? ' leaflet-safari' : '') +
			(this._fadeAnimated ? ' leaflet-fade-anim' : ''));

		var position = L.DomUtil.getStyle(container, 'position');

		if (position !== 'absolute' && position !== 'relative' && position !== 'fixed') {
			container.style.position = 'absolute';
		}

		this._initPanes();

		if (this._initControlPos) {
			this._initControlPos();
		}
	},

	_initPanes: function () {
		var panes = this._panes = {};
		this._paneRenderers = {};

		this._mapPane = this.createPane('mapPane', this._container);

		this.createPane('tilePane');
		this.createPane('shadowPane');
		this.createPane('overlayPane');
		this.createPane('markerPane');
		this.createPane('popupPane');

		if (!this.options.markerZoomAnimation) {
			L.DomUtil.addClass(panes.markerPane, 'leaflet-zoom-hide');
			L.DomUtil.addClass(panes.shadowPane, 'leaflet-zoom-hide');
		}
	},


	// private methods that modify map state

	_resetView: function (center, zoom, preserveMapOffset, afterZoomAnim) {

		var zoomChanged = (this._zoom !== zoom);

		if (!afterZoomAnim) {
			this.fire('movestart');

			if (zoomChanged) {
				this.fire('zoomstart');
			}
		}

		this._zoom = zoom;

		if (!preserveMapOffset) {
			L.DomUtil.setPosition(this._mapPane, new L.Point(0, 0));
		}

		this._pixelOrigin = this._getNewPixelOrigin(center);

		var loading = !this._loaded;
		this._loaded = true;

		this.fire('viewreset', {hard: !preserveMapOffset});

		if (loading) {
			this.fire('load');
		}

		this.fire('move');

		if (zoomChanged || afterZoomAnim) {
			this.fire('zoomend');
			this.fire('zoomlevelschange');
		}

		this.fire('moveend', {hard: !preserveMapOffset});
	},

	_rawPanBy: function (offset) {
		L.DomUtil.setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
	},

	_getZoomSpan: function () {
		return this.getMaxZoom() - this.getMinZoom();
	},

	_panInsideMaxBounds: function () {
		this.panInsideBounds(this.options.maxBounds);
	},

	_checkIfLoaded: function () {
		if (!this._loaded) {
			throw new Error('Set map center and zoom first.');
		}
	},

	// DOM event handling

	_initEvents: function (remove) {
		if (!L.DomEvent) { return; }

		this._targets = {};

		this._mouseOut = false;

		var onOff = remove ? 'off' : 'on';

		L.DomEvent[onOff](this._container, 'click dblclick mousedown mouseup ' +
			'mouseover mouseout mousemove contextmenu dragover drop ' +
			'keydown keypress keyup trplclick qdrplclick', this._handleDOMEvent, this);
		L.DomEvent[onOff](this._textArea, 'copy cut paste keydown keypress keyup compositionstart compositionupdate compositionend textInput', this._handleDOMEvent, this);

		if (this.options.trackResize && this._resizeDetector.contentWindow) {
			L.DomEvent[onOff](this._resizeDetector.contentWindow, 'resize', this._onResize, this);
		}

		L.DomEvent[onOff](window, 'blur', this._onLostFocus, this);
		L.DomEvent[onOff](window, 'focus', this._onGotFocus, this);
	},

	_onResize: function () {
		L.Util.cancelAnimFrame(this._resizeRequest);
		this._resizeRequest = L.Util.requestAnimFrame(
		        function () { this.invalidateSize({debounceMoveend: true}); }, this, false, this._container);
	},

	_activate: function () {
		if (this._serverRecycling) {
			return;
		}

		console.debug('_activate:');
		clearTimeout(vex.timer);

		if (!this._active) {
			// Only activate when we are connected.
			if (this._socket.connected()) {
				console.debug('sending useractive');
				this._socket.sendMessage('useractive');
				this._active = true;
				if (this._doclayer) {
					this._docLayer._onMessage('invalidatetiles: EMPTY', null);
				}
				if (vex.dialogID > 0) {
					var id = vex.dialogID;
					vex.dialogID = -1;
					this._startInactiveTimer();
					this.focus();
					return vex.close(id);
				}
			} else {
				this._socket.initialize(this);
			}
		}

		this._startInactiveTimer();
		this.focus();
		return false;
	},

	_dim: function() {
		if (this.options.alwaysActive || this._debugAlwaysActive === true) {
			return;
		}

		console.debug('_dim:');
		if (!this._socket.connected()) {
			return;
		}

		this._active = false;
		clearTimeout(vex.timer);

		var options = $.extend({}, vex.defaultOptions, {
			contentCSS: {'background':'rgba(0, 0, 0, 0)',
				     'font-size': 'xx-large',
				     'color': '#fff',
				     'text-align': 'center'},
			content: _('Inactive document - please click to resume editing')
		});
		options.id = vex.globalID;
		vex.dialogID = options.id;
		vex.globalID += 1;
		options.$vex = $('<div>').addClass(vex.baseClassNames.vex).addClass(options.className).css(options.css).data({
			vex: options
		});
		options.$vexOverlay = $('<div>').addClass(vex.baseClassNames.overlay).addClass(options.overlayClassName).css(options.overlayCSS).data({
			vex: options
		});

		var map = this;
		options.$vex.bind('click.vex', function(e) {
			console.debug('_dim: click.vex function');
			return map._activate();
		});
		options.$vex.append(options.$vexOverlay);

		options.$vexContent = $('<div>').addClass(vex.baseClassNames.content).addClass(options.contentClassName).css(options.contentCSS).text(options.content).data({
			vex: options
		});
		options.$vex.append(options.$vexContent);

		$(options.appendLocation).append(options.$vex);
		vex.setupBodyClassName(options.$vex);

		this._doclayer && this._docLayer._onMessage('textselection:', null);
		console.debug('_dim: sending userinactive');
		map.fire('postMessage', {msgId: 'User_Idle'});
		this._socket.sendMessage('userinactive');
	},

	_dimIfInactive: function () {
		console.debug('_dimIfInactive: diff=' + (Date.now() - this.lastActiveTime));
		if ((Date.now() - this.lastActiveTime) >= this.options.idleTimeoutSecs * 1000) {
			this._dim();
		} else {
			this._startInactiveTimer();
		}
	},

	_startInactiveTimer: function () {
		if (this._serverRecycling) {
			return;
		}

		console.debug('_startInactiveTimer:');
		clearTimeout(vex.timer);
		var map = this;
		vex.timer = setTimeout(function() {
			map._dimIfInactive();
		}, 1 * 60 * 1000); // Check once a minute
	},

	_deactivate: function () {
		if (this._serverRecycling) {
			return;
		}

		console.debug('_deactivate:');
		clearTimeout(vex.timer);

		if (!this._active || vex.dialogID > 0) {
			// A dialog is already dimming the screen and probably
			// shows an error message. Leave it alone.
			this._active = false;
			this._docLayer && this._docLayer._onMessage('textselection:', null);
			if (this._socket.connected()) {
				console.debug('_deactivate: sending userinactive');
				this._socket.sendMessage('userinactive');
			}

			return;
		}

		var map = this;
		vex.timer = setTimeout(function() {
			map._dim();
		}, map.options.outOfFocusTimeoutSecs * 1000);
	},

	_onLostFocus: function () {
		if (!this._loaded) { return; }

		console.debug('_onLostFocus: ');
		var doclayer = this._docLayer;
		if (!doclayer) { return; }

		// save state of cursor (blinking marker) and the cursor overlay
		doclayer._isCursorVisibleOnLostFocus = doclayer._isCursorVisible;
		doclayer._isCursorOverlayVisibleOnLostFocus = doclayer._isCursorOverlayVisible;

		// if the blinking cursor is visible, disable the overlay when we go out of focus
		if (doclayer._isCursorVisible && doclayer._isCursorOverlayVisible) {
			doclayer._isCursorOverlayVisible = false;
			doclayer._updateCursorAndOverlay();
		}

		this._deactivate();
	},

	_onGotFocus: function () {
		console.debug('_onGotFocus:');
		if (!this._loaded) { return; }

		var doclayer = this._docLayer;
		if (doclayer &&
		    typeof doclayer._isCursorOverlayVisibleOnLostFocus !== 'undefined' &&
		    typeof doclayer._isCursorVisibleOnLostFocus !== 'undefined') {
			// we restore the old cursor position by a small delay, so that if the user clicks
			// inside the document we skip to restore it, so that the user does not see the cursor
			// jumping from the old position to the new one
			setTimeout(function () {
				// restore the state that was before focus was lost
				doclayer._isCursorOverlayVisible = doclayer._isCursorOverlayVisibleOnLostFocus;
				doclayer._isCursorVisible = doclayer._isCursorVisibleOnLostFocus;
				doclayer._updateCursorAndOverlay();
			}, 300);
		}

		this._activate();
	},

	_onUpdateProgress: function (e) {
		if (e.statusType === 'start') {
			if (this._socket.socket.readyState === 1) {
				// auto-save
				this.showBusy(_('Saving...'), true);
			}
			else {
				this.showBusy(_('Loading...'), true);
			}
		}
		else if (e.statusType === 'setvalue') {
			this._progressBar.setValue(e.value);
		}
		else if (e.statusType === 'finish' || e.statusType === 'loleafletloaded' || e.statusType === 'reconnected') {
			this.hideBusy();
		}
	},

	_isMouseEnteringLeaving: function (e) {
		var target = e.target || e.srcElement,
		    related = e.relatedTarget;

		if (!target) { return false; }

		return (L.DomUtil.hasClass(target, 'leaflet-tile')
			&& !(related && (L.DomUtil.hasClass(related, 'leaflet-tile')
				|| L.DomUtil.hasClass(related, 'leaflet-cursor'))));
	},

	_handleDOMEvent: function (e) {
		if (!this._loaded || !this._enabled || L.DomEvent._skipped(e)) { return; }

		this.lastActiveTime = Date.now();

		// find the layer the event is propagating from
		var target = this._targets[L.stamp(e.target || e.srcElement)],
			//type = e.type === 'keypress' && e.keyCode === 13 ? 'click' : e.type;
		    type = e.type;

		// For touch devices, to pop-up the keyboard, it is required to call
		// .focus() method on hidden input within actual 'click' event here
		// Calling from some other place with no real 'click' event doesn't work
		if (type === 'click') {
			if (this._permission === 'edit') {
				this._textArea.blur();
				this._textArea.focus();
			}

			// unselect if anything is selected already
			if (this._docLayer && this._docLayer._annotations && this._docLayer._annotations.unselect) {
				this._docLayer._annotations.unselect();
			}
		}

		// we need to keep track if we have entered/left the map
		this._mouseEnteringLeaving = false;
		// mouse leaving the map ?
		if (!target && !this._mouseOut && type === 'mouseout') {
			this._mouseEnteringLeaving = this._isMouseEnteringLeaving(e);
			this._mouseOut = this._mouseEnteringLeaving; // event type == mouseout
		}
		// mouse entering the map ?
		if (!target && this._mouseOut && type === 'mouseover') {
			this._mouseEnteringLeaving = this._isMouseEnteringLeaving(e);
			this._mouseOut = !this._mouseEnteringLeaving; // event type == mouseover
		}

		// special case for map mouseover/mouseout events so that they're actually mouseenter/mouseleave
		if (!target && !this._mouseEnteringLeaving && (type === 'mouseover' || type === 'mouseout') &&
				!L.DomEvent._checkMouse(this._container, e)) { return; }

		// prevents outline when clicking on keyboard-focusable element
		if (type === 'mousedown') {
			L.DomUtil.preventOutline(e.target || e.srcElement);
			// Prevents image dragging on Mozilla when map's dragging
			// option is set to false
			e.preventDefault();
		}

		// workaround for drawing shapes, wihout this shapes cannot be shrunken
		if (target !== undefined && target._path !== undefined && type === 'mousemove') {
			target = undefined;
		}
		this._fireDOMEvent(target || this, e, type);
	},

	_fireDOMEvent: function (target, e, type) {
		if (!target.listens(type, true) && (type !== 'click' || !target.listens('preclick', true))) { return; }

		if (type === 'contextmenu') {
			L.DomEvent.preventDefault(e);
		}

		// prevents firing click after you just dragged an object
		if (e.type === 'click' && !e._simulated && this._draggableMoved(target)) { return; }

		var data = {
			originalEvent: e
		};
		if (e.type !== 'keypress' && e.type !== 'keyup' && e.type !== 'keydown' &&
			e.type !== 'copy' && e.type !== 'cut' && e.type !== 'paste' &&
		    e.type !== 'compositionstart' && e.type !== 'compositionupdate' && e.type !== 'compositionend' && e.type !== 'textInput') {
			data.containerPoint = target instanceof L.Marker ?
					this.latLngToContainerPoint(target.getLatLng()) : this.mouseEventToContainerPoint(e);
			data.layerPoint = this.containerPointToLayerPoint(data.containerPoint);
			data.latlng = this.layerPointToLatLng(data.layerPoint);
		}
		if (type === 'click') {
			target.fire('preclick', data, true);
		}
		target.fire(type, data, true);
	},

	_draggableMoved: function (obj) {
		obj = obj.options.draggable ? obj : this;
		return (obj.dragging && obj.dragging.moved()) || (this.boxZoom && this.boxZoom.moved());
	},

	_clearHandlers: function () {
		for (var i = 0, len = this._handlers.length; i < len; i++) {
			this._handlers[i].disable();
		}
	},

	whenReady: function (callback, context) {
		if (this._loaded) {
			callback.call(context || this, {target: this});
		} else {
			this.on('load', callback, context);
		}
		return this;
	},


	// private methods for getting map state

	_getMapPanePos: function () {
		return L.DomUtil.getPosition(this._mapPane) || new L.Point(0, 0);
	},

	_moved: function () {
		var pos = this._getMapPanePos();
		return pos && !pos.equals([0, 0]);
	},

	_getTopLeftPoint: function (center, zoom) {
		var pixelOrigin = center && zoom !== undefined ?
			this._getNewPixelOrigin(center, zoom) :
			this.getPixelOrigin();
		return pixelOrigin.subtract(this._getMapPanePos());
	},

	_getNewPixelOrigin: function (center, zoom) {
		var viewHalf = this.getSize()._divideBy(2);
		// TODO round on display, not calculation to increase precision?
		return this.project(center, zoom)._subtract(viewHalf)._add(this._getMapPanePos())._round();
	},

	_latLngToNewLayerPoint: function (latlng, zoom, center) {
		var topLeft = this._getNewPixelOrigin(center, zoom);
		return this.project(latlng, zoom)._subtract(topLeft);
	},

	// layer point of the current center
	_getCenterLayerPoint: function () {
		return this.containerPointToLayerPoint(this.getSize()._divideBy(2));
	},

	// offset of the specified place to the current center in pixels
	_getCenterOffset: function (latlng) {
		return this.latLngToLayerPoint(latlng).subtract(this._getCenterLayerPoint());
	},

	// adjust center for view to get inside bounds
	_limitCenter: function (center, zoom, bounds) {

		if (!bounds) { return center; }

		var centerPoint = this.project(center, zoom),
		    viewHalf = this.getSize().divideBy(2),
		    viewBounds = new L.Bounds(centerPoint.subtract(viewHalf), centerPoint.add(viewHalf)),
		    offset = this._getBoundsOffset(viewBounds, bounds, zoom);

		return this.unproject(centerPoint.add(offset), zoom);
	},

	// adjust offset for view to get inside bounds
	_limitOffset: function (offset, bounds) {
		if (!bounds) { return offset; }

		var viewBounds = this.getPixelBounds(),
		    newBounds = new L.Bounds(viewBounds.min.add(offset), viewBounds.max.add(offset));

		return offset.add(this._getBoundsOffset(newBounds, bounds));
	},

	// returns offset needed for pxBounds to get inside maxBounds at a specified zoom
	_getBoundsOffset: function (pxBounds, maxBounds, zoom) {
		var nwOffset = this.project(maxBounds.getNorthWest(), zoom).subtract(pxBounds.min),
		    seOffset = this.project(maxBounds.getSouthEast(), zoom).subtract(pxBounds.max),

		    dx = this._rebound(nwOffset.x, -seOffset.x),
		    dy = this._rebound(nwOffset.y, -seOffset.y);

		return new L.Point(dx, dy);
	},

	_rebound: function (left, right) {
		return left + right > 0 ?
			Math.round(left - right) / 2 :
			Math.max(0, Math.ceil(left)) - Math.max(0, Math.floor(right));
		// TODO: do we really need ceil and floor ?
		// for spreadsheets it can cause one pixel alignment offset btw grid and row/column header
		// and a one pixel horizontal auto-scrolling issue;
		// both issues have been fixed by rounding the projection: see Map.project above;
		// anyway in case of similar problems, this code needs to be checked
	},

	_limitZoom: function (zoom) {
		var min = this.getMinZoom(),
		    max = this.getMaxZoom();

		return Math.max(min, Math.min(max, zoom));
	},

	enable: function(enabled) {
		this._enabled = enabled;
		if (this._enabled) {
			$('.scroll-container').mCustomScrollbar('update');
		}
		else {
			$('.scroll-container').mCustomScrollbar('disable');
		}
	}
});

L.map = function (id, options) {
	return new L.Map(id, options);
};
