/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * L.Map is the central class of the API - it is used to create a map.
 */

function moveObjectVertically(obj, diff) {
	if (obj) {
		var prevTop = obj.css('top');
		if (prevTop) {
			prevTop = parseInt(prevTop.slice(0, -2)) + diff;
		}
		else {
			prevTop = 0 + diff;
		}
		obj.css({'top': String(prevTop) + 'px'});
	}
}

function isAnyVexDialogActive() {
	var res = false;
	for (var vexId in vex.getAll()) {
		res = res || vex.getById(vexId).isOpen;
	}
	return res;
}

/* global closebutton vex revHistoryEnabled $ _ */
L.Map = L.Evented.extend({

	options: {
		crs: L.CRS.Simple,
		center: [0, 0],
		zoom: 10,
		minZoom: 6,
		maxZoom: 14,
		maxBounds: L.latLngBounds([0, 0], [-100, 100]),
		fadeAnimation: false, // Not useful for typing.
		trackResize: true,
		markerZoomAnimation: true,
		defaultZoom: 10,
		// 15 = 1440 twips-per-inch / 96 dpi.
		// Chosen to match previous hardcoded value of 3840 for
		// the current tile pixel size of 256.
		tileWidthTwips: window.tileSize * 15,
		tileHeightTwips: window.tileSize * 15,
		urlPrefix: 'lool',
		wopiSrc: '',
		cursorURL: 'images/cursors'
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

		// Start with readonly toolbars on desktop
		if (!L.Browser.mobile) {
			L.DomUtil.addClass(L.DomUtil.get('toolbar-wrapper'), 'readonly');
		}

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

		L.Cursor.imagePath = options.cursorURL;

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
		this._documentIdle = false;
		this._helpTarget = null; // help page that fits best the current context

		this.callInitHooks();

		if (this.options.imagePath) {
			L.Icon.Default.imagePath = this.options.imagePath;
		}
		this._addLayers(this.options.layers);
		this._socket = L.socket(this);

		var center = this.getCenter();
		if (L.Browser.mobile) {
			var doubledProgressHeight = 200;
			var size = new L.point(screen.width, screen.height - doubledProgressHeight);
			center = this.layerPointToLatLng(size._divideBy(2));
		}
		this._progressBar = L.progressOverlay(center, new L.point(150, 25));

		if (L.Browser.mobile) {
			this._clipboardContainer = L.control.mobileInput().addTo(this);
			if (this.tap !== undefined) {
				this._clipboardContainer._cursorHandler.on('up', this.tap._onCursorClick, this.tap);
			}
		} else {
			this._clipboardContainer = L.clipboardContainer();
			this.addLayer(this._clipboardContainer);
		}

		// Avoid white bar on the bottom - force resize-detector to get full size
		if (window.mode.isMobile()) {
			$('#document-container').css('bottom', '0px');
			this._clipboardContainer._textArea.blur();
			this._clipboardContainer._textArea.focus();
		}

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
				if (!L.Browser.mobile) {
					L.DomUtil.addClass(L.DomUtil.get('toolbar-wrapper'), 'readonly');
				}
				L.DomUtil.addClass(L.DomUtil.get('main-menu'), 'readonly');
				L.DomUtil.addClass(L.DomUtil.get('presentation-controls-wrapper'), 'readonly');
				L.DomUtil.addClass(L.DomUtil.get('spreadsheet-row-column-frame'), 'readonly');
			}
			else {
				L.DomUtil.removeClass(this._container.parentElement, 'readonly');
				if (!L.Browser.mobile) {
					L.DomUtil.removeClass(L.DomUtil.get('toolbar-wrapper'), 'readonly');
				}
				L.DomUtil.removeClass(L.DomUtil.get('main-menu'), 'readonly');
				L.DomUtil.removeClass(L.DomUtil.get('presentation-controls-wrapper'), 'readonly');
				L.DomUtil.removeClass(L.DomUtil.get('spreadsheet-row-column-frame'), 'readonly');
			}
		}, this);
		this.on('doclayerinit', function() {
			if (!this.initComplete) {
				this._fireInitComplete('doclayerinit');
			}
			if (!L.Browser.mobile && this._docLayer._docType == 'text') {
				var interactiveRuler = this._permission === 'edit' ? true : false;
				L.control.ruler({position:'topleft', interactive:interactiveRuler}).addTo(this);
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

		this.on('editorgotfocus', this._onEditorGotFocus, this);

		// View info (user names and view ids)
		this._viewInfo = {};
		this._viewInfoByUserName = {};

		// View color map
		this._viewColors = {};

		// This becomes true if document was ever modified by the user
		this._everModified = false;

		// Document is completely loaded or not
		this._docLoaded = false;

		this.on('commandstatechanged', function(e) {
			if (e.commandName === '.uno:ModifiedStatus')
				this._everModified = this._everModified || (e.state === 'true');
		}, this);

		this.on('docloaded', function(e) {
			this._docLoaded = e.status;
			if (this._docLoaded) {
				// so that dim timer starts from now()
				this.lastActiveTime = Date.now();
				if (!document.hasFocus()) {
					this._deactivate();
				} else {
					this._activate();
				}
			} else if (this._docLayer) {
				// remove the comments and changes
				this._docLayer.clearAnnotations();
			}

			this.initializeModificationIndicator();
		}, this);
	},

	loadDocument: function(socket) {
		this._socket.connect(socket);
	},

	sendInitUNOCommands: function() {
		// TODO: remove duplicated init code
		this._socket.sendMessage('commandvalues command=.uno:LanguageStatus');
		this._socket.sendMessage('commandvalues command=.uno:ViewAnnotations');
		this.fire('updaterowcolumnheaders');
		this._docLayer._getToolbarCommandsValues();
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
		if (viewInfo.userextrainfo !== undefined && viewInfo.userextrainfo.avatar !== undefined) {
			this._viewInfoByUserName[viewInfo.username] = viewInfo;
		}
		this.fire('postMessage', {msgId: 'View_Added', args: {Deprecated: true, ViewId: viewInfo.id, UserId: viewInfo.userid, UserName: viewInfo.username, UserExtraInfo: viewInfo.userextrainfo, Color: L.LOUtil.rgbToHex(viewInfo.color), ReadOnly: viewInfo.readonly}});

		// Fire last, otherwise not all events are handled correctly.
		this.fire('addview', {viewId: viewInfo.id, username: viewInfo.username, extraInfo: viewInfo.userextrainfo, readonly: this.isViewReadOnly(viewInfo.id)});

		this.updateAvatars();
	},

	removeView: function(viewid) {
		var username = this._viewInfo[viewid].username;
		delete this._viewInfoByUserName[this._viewInfo[viewid].username];
		delete this._viewInfo[viewid];
		this.fire('postMessage', {msgId: 'View_Removed', args: {Deprecated: true, ViewId: viewid}});

		// Fire last, otherwise not all events are handled correctly.
		this.fire('removeview', {viewId: viewid, username: username});
	},


	// replaced by animation-powered implementation in Map.PanAnimation.js
	setView: function (center, zoom) {
		zoom = zoom === undefined ? this.getZoom() : zoom;
		this._resetView(L.latLng(center), this._limitZoom(zoom));
		return this;
	},

	updateAvatars: function() {
		if (this._docLayer && this._docLayer._annotations && this._docLayer._annotations._items) {
			for (var idxAnno in this._docLayer._annotations._items) {
				var annotation = this._docLayer._annotations._items[idxAnno];
				var username = annotation._data.author;
				if (this._viewInfoByUserName[username])
					annotation._data.avatar = this._viewInfoByUserName[username].userextrainfo.avatar;
				annotation._updateContent();
			}
		}
	},

	initializeModificationIndicator: function() {
		var lastModButton = L.DomUtil.get('menu-last-mod');
		if (lastModButton !== null && lastModButton !== undefined
			&& lastModButton.firstChild.innerHTML !== null
			&& lastModButton.firstChild.childElementCount == 0) {
			var mainSpan = document.createElement('span');
			var label = document.createTextNode(_('Last modification'));
			var separator = document.createTextNode(': ');
			this.lastModIndicator = document.createElement('span');
			mainSpan.appendChild(label);
			mainSpan.appendChild(separator);
			mainSpan.appendChild(this.lastModIndicator);

			this.updateModificationIndicator(this._lastmodtime);

			// Replace menu button body with new content
			lastModButton.firstChild.innerHTML = '';
			lastModButton.firstChild.appendChild(mainSpan);

			if (revHistoryEnabled) {
				L.DomUtil.setStyle(lastModButton, 'cursor', 'pointer');
			}
		}
	},

	updateModificationIndicator: function(newModificationTime) {
		var timeout;

		if (typeof newModificationTime === 'string') {
			this._lastmodtime = newModificationTime;
		}

		clearTimeout(this._modTimeout);

		if (this.lastModIndicator !== null && this.lastModIndicator !== undefined) {
			var dateTime = new Date(this._lastmodtime.replace(/,.*/, 'Z'));
			var dateValue = dateTime.toLocaleDateString(String.locale,
				{ year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

			var elapsed = Date.now() - dateTime;
			if (elapsed < 60000) {
				dateValue = _('%d seconds ago').replace('%d', Math.round(elapsed / 1000));
				timeout = 6000;
			} else if (elapsed < 3600000) {
				dateValue = _('%d minutes ago').replace('%d', Math.round(elapsed / 60000));
				timeout = 60000;
			}

			this.lastModIndicator.innerHTML = dateValue;

			if (timeout) {
				this._modTimeout = setTimeout(L.bind(this.updateModificationIndicator, this, -1), timeout);
			}
		}
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
		var curCenter = this.getCenter();
		if (this._docLayer && this._docLayer._visibleCursor && this.getBounds().contains(this._docLayer._visibleCursor.getCenter())) {
			// Calculate new center after zoom. The intent is that the caret
			// position stays the same.
			var zoomScale = 1.0 / this.getZoomScale(zoom, this._zoom);
			var caretPos = this._docLayer._visibleCursor.getCenter();
			var newCenter = new L.LatLng(curCenter.lat + (caretPos.lat - curCenter.lat) * (1.0 - zoomScale),
						     curCenter.lng + (caretPos.lng - curCenter.lng) * (1.0 - zoomScale));
			return this.setView(newCenter, zoom, {zoom: options});
		}
		return this.setView(curCenter, zoom, {zoom: options});
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

	setMaxBounds: function (bounds) {
		bounds = L.latLngBounds(bounds);

		this.options.maxBounds = bounds;

		if (this._loaded) {
			this.panInsideBounds(this.options.maxBounds);
		}
	},

	setDocBounds: function (bounds) {
		bounds = L.latLngBounds(bounds);
		this.options.docBounds = bounds;
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
			pan: false
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

		// Check for the special proof-of-concept case where no WOPI is involved but we
		// still run loleaflet in an iframe of its own and thus need to receive the
		// postMessage things.
		if (name === 'wopi' && this.options['notWopiButIframe']) {
			handler.addHooks();
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

	getLayerMaxBounds: function () {
		return L.bounds(this.latLngToLayerPoint(this.options.maxBounds.getNorthWest()),
			this.latLngToLayerPoint(this.options.maxBounds.getSouthEast()));
	},

	getLayerDocBounds: function () {
		return L.bounds(this.latLngToLayerPoint(this.options.docBounds.getNorthWest()),
			this.latLngToLayerPoint(this.options.docBounds.getSouthEast()));
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
		return fromZoom + (Math.log(scale) / Math.log(1.2));
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
		this._clipboardContainer.focus();
	},

	setHelpTarget: function(page) {
		this._helpTarget = page;
	},

	showHelp: function() {
		var helpURL = 'https://help.libreoffice.org/help.html';
		var helpVersion = '6.0';
		if (this._helpTarget !== null) {
			helpURL += '?Target=' + this._helpTarget + '&Language=' + String.locale + '&System=UNIX&Version=' + helpVersion;
		}

		this.fire('hyperlinkclicked', {url: helpURL});
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

		this._resizeDetector = L.DomUtil.create('iframe', 'resize-detector', container);
		this._fileDownloader = L.DomUtil.create('iframe', '', container);
		L.DomUtil.setStyle(this._fileDownloader, 'display', 'none');

		this._resizeDetector.contentWindow.addEventListener('touchstart', L.DomEvent.preventDefault, {passive: false});

		L.DomEvent.on(this._resizeDetector.contentWindow, 'contextmenu', L.DomEvent.preventDefault);
		L.DomEvent.on(this._fileDownloader.contentWindow, 'contextmenu', L.DomEvent.preventDefault);
		L.DomEvent.addListener(container, 'scroll', this._onScroll, this);
		container._leaflet = true;
	},

	_onScroll: function() {
		this._container.scrollTop = 0;
		this._container.scrollLeft = 0;
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
			'mouseover mouseout mousemove dragover drop ' +
			'trplclick qdrplclick', this._handleDOMEvent, this);

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
		if (this._serverRecycling || this._documentIdle) {
			return false;
		}

		console.debug('_activate:');
		clearTimeout(vex.timer);

		if (!this._active) {
			// Only activate when we are connected.
			if (this._socket.connected()) {
				console.debug('sending useractive');
				this._socket.sendMessage('useractive');
				this._active = true;
				if (this._docLayer) {
					this._docLayer._resetClientVisArea();
					this._docLayer._requestNewTiles();
				}

				if (isAnyVexDialogActive()) {
					for (var vexId in vex.getAll()) {
						var opts = vex.getById(vexId).options;
						if (!opts.overlayClosesOnClick || !opts.escapeButtonCloses) {
							return false;
						}
					}

					this._startInactiveTimer();
					if (!L.Browser.mobile) {
						this.focus();
					}
					return vex.closeAll();
				}
			} else {
				this.loadDocument();
			}
		}

		this._startInactiveTimer();
		if (!L.Browser.mobile) {
			this.focus();
		}
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

		var message = '';
		var map = this;
		if (!map['wopi'].DisableInactiveMessages) {
			message = _('Inactive document - please click to resume editing');
		}

		vex.open({
			content: message,
			contentClassName: 'loleaflet-user-idle',
			afterOpen: function() {
				var $vexContent = $(this.contentEl);
				$vexContent.bind('click.vex', function() {
					console.debug('_dim: click.vex function');
					return map._activate();
				});
			},
			showCloseButton: false
		});

		this._doclayer && this._docLayer._onMessage('textselection:', null);
		console.debug('_dim: sending userinactive');
		map.fire('postMessage', {msgId: 'User_Idle'});
		this._socket.sendMessage('userinactive');
	},

	_dimIfInactive: function () {
		console.debug('_dimIfInactive: diff=' + (Date.now() - this.lastActiveTime));
		if (this._docLoaded && // don't dim if document hasn't been loaded yet
		    (Date.now() - this.lastActiveTime) >= this.options.idleTimeoutSecs * 1000) {
			this._dim();
		} else {
			this._startInactiveTimer();
		}
	},

	_startInactiveTimer: function () {
		if (this._serverRecycling || this._documentIdle || !this._docLoaded) {
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
		if (this._serverRecycling || this._documentIdle || !this._docLoaded) {
			return;
		}

		console.debug('_deactivate:');
		clearTimeout(vex.timer);

		if (!this._active || isAnyVexDialogActive()) {
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

	// The editor got focus (probably a dialog closed or user clicked to edit).
	_onEditorLostFocus: function() {
		if (!this._loaded) { return; }

		var doclayer = this._docLayer;
		if (doclayer)
		{
			doclayer._isFocused = false;
			doclayer._updateCursorAndOverlay();
		}
	},

	// Our browser tab lost focus.
	_onLostFocus: function () {
		this._onEditorLostFocus();
		this._deactivate();
	},

	// The editor got focus (probably a dialog closed or user clicked to edit).
	_onEditorGotFocus: function() {
		if (!this._loaded) { return; }

		var doclayer = this._docLayer;
		if (doclayer)
		{
			doclayer._isFocused = true;
			// we restore the old cursor position by a small delay, so that if the user clicks
			// inside the document we skip to restore it, so that the user does not see the cursor
			// jumping from the old position to the new one
			setTimeout(function () {
				console.debug('apply focus change in timeout');
				doclayer._updateCursorAndOverlay();
			}, 300);
		}

	},

	// Our browser tab lost focus.
	_onGotFocus: function () {
		this._onEditorGotFocus();
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
		if (!this._docLayer || !this._loaded || !this._enabled || L.DomEvent._skipped(e)) { return; }

		this.lastActiveTime = Date.now();

		// find the layer the event is propagating from
		var target = this._targets[L.stamp(e.target || e.srcElement)],
			//type = e.type === 'keypress' && e.keyCode === 13 ? 'click' : e.type;
		    type = e.type;

		// For touch devices, to pop-up the keyboard, it is required to call
		// .focus() method on hidden input within actual 'click' event here
		// Calling from some other place with no real 'click' event doesn't work.

		// (tml: For me, for this to work with a mobile device, we need to
		// accept 'mouseup', too, and check the _wasSingleTap flag set over in Map.Tap.js.)
		if (type === 'click' || (type === 'mouseup' &&
					 typeof this._container._wasSingleTap !== 'undefined' &&
					 this._container._wasSingleTap)) {
			if (this._permission === 'edit') {
				this.focus();
			}

			// unselect if anything is selected already
			if (this._docLayer && this._docLayer._annotations && this._docLayer._annotations.unselect) {
				this._docLayer._annotations.unselect();
			}
		}

		// we need to keep track about the last action, this
		// will help us to avoid wrongly removing the editor
		if (type === 'keypress') {
			this.lastActionByUser = true;
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
	},

	_goToViewId: function(id) {
		if (id === -1)
			return;

		if (this.getDocType() === 'spreadsheet') {
			this._docLayer.goToCellViewCursor(id);
		} else if (this.getDocType() === 'text' || this.getDocType() === 'presentation') {
			this._docLayer.goToViewCursor(id);
		}
	},

	_setFollowing: function(followingState, viewId) {
		var userDefined = viewId !== null && viewId !== undefined;
		var followDefined = followingState !== null && followingState !== undefined;

		var followEditor = true;
		var followUser = false;

		if (userDefined && viewId !== -1 && viewId !== this._docLayer.viewId) {
			followUser = true;
			followEditor = false;
		}

		if (followDefined && followingState === false) {
			followEditor = false;
			followUser = false;
		}

		this._docLayer._followUser = followUser;
		this._docLayer._followEditor = followEditor;

		if (followUser) {
			this._goToViewId(viewId);
			this._docLayer._followThis = viewId;
		}
		else if (followEditor) {
			var editorId = this._docLayer._editorId;
			if (editorId !== -1 && editorId !== this._docLayer.viewId) {
				this._goToViewId(editorId);
				this._docLayer._followThis = editorId;
			}
		}
		else {
			this.fire('deselectuser', {viewId: this._docLayer._followThis});
			this._docLayer._followThis = -1;
		}

		// Notify about changes
		this.fire('postMessage', {msgId: 'FollowUser_Changed',
			args: {FollowedViewId: this._docLayer._followThis,
				IsFollowUser: followUser,
				IsFollowEditor: followEditor}});
	},

	showMenubar: function() {
		if (!this.isMenubarHidden())
			return;
		$('.main-nav').show();
		if (closebutton && !window.mode.isTablet()) {
			$('#closebuttonwrapper').show();
		}

		var obj = $('.unfold');
		obj.removeClass('unfold');
		obj.addClass('fold');

		moveObjectVertically($('#spreadsheet-row-column-frame'), 36);
		moveObjectVertically($('#document-container'), 36);
		moveObjectVertically($('#presentation-controls-wrapper'), 36);
	},

	hideMenubar: function() {
		if (this.isMenubarHidden())
			return;
		$('.main-nav').hide();
		if (closebutton) {
			$('#closebuttonwrapper').hide();
		}

		var obj = $('.fold');
		obj.removeClass('fold');
		obj.addClass('unfold');

		moveObjectVertically($('#spreadsheet-row-column-frame'), -36);
		moveObjectVertically($('#document-container'), -36);
		moveObjectVertically($('#presentation-controls-wrapper'), -36);
	},

	isMenubarHidden: function() {
		return $('.main-nav').css('display') === 'none';
	},

	toggleMenubar: function() {
		if (this.isMenubarHidden())
			this.showMenubar();
		else
			this.hideMenubar();
	}
});

L.map = function (id, options) {
	return new L.Map(id, options);
};
