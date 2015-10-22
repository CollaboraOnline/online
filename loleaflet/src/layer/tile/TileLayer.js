/*
 * L.TileLayer is used for standard xyz-numbered tile layers.
 */

// Implement String::startsWith which is non-portable (Firefox only, it seems)
// See http://stackoverflow.com/questions/646628/how-to-check-if-a-string-startswith-another-string#4579228

if (typeof String.prototype.startsWith !== 'function') {
	String.prototype.startsWith = function (str) {
		return this.slice(0, str.length) === str;
	};
}

L.TileLayer = L.GridLayer.extend({

	options: {
		maxZoom: 18,

		subdomains: 'abc',
		errorTileUrl: '',
		zoomOffset: 0,

		maxNativeZoom: null, // Number
		tms: false,
		zoomReverse: false,
		detectRetina: false,
		crossOrigin: false,
		preFetchOtherParts: false,
		previewInvalidationTimeout: 1000
	},

	initialize: function (url, options) {

		this._url = url;

		options = L.setOptions(this, options);

		// detecting retina displays, adjusting tileSize and zoom levels
		if (options.detectRetina && L.Browser.retina && options.maxZoom > 0) {

			options.tileSize = Math.floor(options.tileSize / 2);
			options.zoomOffset++;

			options.minZoom = Math.max(0, options.minZoom);
			options.maxZoom--;
		}

		if (typeof options.subdomains === 'string') {
			options.subdomains = options.subdomains.split('');
		}

		// for https://github.com/Leaflet/Leaflet/issues/137
		if (!L.Browser.android) {
			this.on('tileunload', this._onTileRemove);
		}
		this._documentInfo = '';
		// View or edit mode.
		this._permission = 'view';
		// Position and size of the visible cursor.
		this._visibleCursor = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		// Cursor overlay is visible or hidden (for blinking).
		this._isCursorOverlayVisible = false;
		// Cursor is visible or hidden (e.g. for graphic selection).
		this._isCursorVisible = true;
		// Rectangle graphic selection
		this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		// Position and size of the selection start (as if there would be a cursor caret there).

		this._lastValidPart = -1;
		// Cursor marker
		this._cursorMarker = null;
		// Graphic marker
		this._graphicMarker = null;
		// Selection handle marker
		this._selectionHandles = {};
		['start', 'end'].forEach(L.bind(function (handle) {
			this._selectionHandles[handle] = L.marker(new L.LatLng(0, 0), {
				icon: L.divIcon({
					className: 'leaflet-selection-marker-' + handle,
					iconSize: null
				}),
				draggable: true
			});
		}, this));

		this._emptyTilesCount = 0;
		this._msgQueue = [];
		this._toolbarCommandValues = {};
		this._previewInvalidations = [];
		this._partPageRectanglesTwips = [];
		this._partPageRectanglesPixels = [];
	},

    onAdd: function (map) {
		this._initContainer();
		this._getToolbarCommandsValues();
		this._selections = new L.LayerGroup();
		map.addLayer(this._selections);

		this._levels = {};
		this._tiles = {};
		this._tileCache = {};

		map._fadeAnimated = false;
		this._viewReset();
		map.on('drag resize zoomend', this._updateScrollOffset, this);
		map.on('copy', this._onCopy, this);
		map.on('zoomend', this._onUpdateCursor, this);
		map.on('zoomend', this._onUpdatePartPageRectangles, this);
		map.on('dragstart', this._onDragStart, this);
		map.on('requestloksession', this._onRequestLOKSession, this);
		map.on('error', this._mapOnError, this);
		map.on('resize', this._fitDocumentHorizontally, this);
		for (var key in this._selectionHandles) {
			this._selectionHandles[key].on('drag dragend', this._onSelectionHandleDrag, this);
		}
		this._textArea = map._textArea;
		this._textArea.focus();
		if (this.options.readOnly) {
			map.setPermission('readonly');
		}
		else if (this.options.edit) {
			map.setPermission('edit');
		}
		else {
			map.setPermission('view');
		}
		map.fire('statusindicator', {statusType: 'loleafletloaded'});
	},

	getEvents: function () {
		var events = {
			viewreset: this._viewReset,
			movestart: this._moveStart,
			moveend: this._move
		};

		if (!this.options.updateWhenIdle) {
			// update tiles on move, but not more often than once per given interval
			events.move = L.Util.throttle(this._move, this.options.updateInterval, this);
		}

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},

	setUrl: function (url, noRedraw) {
		this._url = url;

		if (!noRedraw) {
			this.redraw();
		}
		return this;
	},

	createTile: function (coords, done) {
		var tile = document.createElement('img');

		tile.onload = L.bind(this._tileOnLoad, this, done, tile);
		tile.onerror = L.bind(this._tileOnError, this, done, tile);

		if (this.options.crossOrigin) {
			tile.crossOrigin = '';
		}

		/*
		 Alt tag is set to empty string to keep screen readers from reading URL and for compliance reasons
		 http://www.w3.org/TR/WCAG20-TECHS/H67
		*/
		tile.alt = '';
		this._emptyTilesCount += 1;
		return tile;
	},

	_getToolbarCommandsValues: function() {
		for (var i = 0; i < this._map.unoToolbarCommands.length; i++) {
			var command = this._map.unoToolbarCommands[i];
			L.Socket.sendMessage('commandvalues command=' + command);
		}
	},

	_onMessage: function (textMsg, img) {
		if (textMsg.startsWith('commandvalues:')) {
			this._onCommandValuesMsg(textMsg);
		}
		else if (textMsg.startsWith('cursorvisible:')) {
			this._onCursorVisibleMsg(textMsg);
		}
		else if (textMsg.startsWith('downloadas:')) {
			this._onDownloadAsMsg(textMsg);
		}
		else if (textMsg.startsWith('error:')) {
			this._onErrorMsg(textMsg);
		}
		else if (textMsg.startsWith('getchildid:')) {
			this._onGetChildIdMsg(textMsg);
		}
		else if (textMsg.startsWith('graphicselection:')) {
			this._onGraphicSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('hyperlinkclicked:')) {
			this._onHyperlinkClickedMsg(textMsg);
		}
		else if (textMsg.startsWith('invalidatecursor:')) {
			this._onInvalidateCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('invalidatetiles:') && !textMsg.match('EMPTY')) {
			this._onInvalidateTilesMsg(textMsg);
		}
		else if (textMsg.startsWith('invalidatetiles:') && textMsg.match('EMPTY')) {
			var msg = 'invalidatetiles: ';
			msg += 'part=' + this._selectedPart + ' ';
			msg += 'x=0 y=0 ';
			msg += 'width=' + this._docWidthTwips + ' ';
			msg += 'height=' + this._docHeightTwips;
			this._onInvalidateTilesMsg(msg);
		}
		else if (textMsg.startsWith('partpagerectangles:')) {
			this._onPartPageRectanglesMsg(textMsg);
		}
		else if (textMsg.startsWith('searchnotfound:')) {
			this._onSearchNotFoundMsg(textMsg);
		}
		else if (textMsg.startsWith('searchresultselection:')) {
			this._onSearchResultSelection(textMsg);
		}
		else if (textMsg.startsWith('setpart:')) {
			this._onSetPartMsg(textMsg);
		}
		else if (textMsg.startsWith('statechanged:')) {
			this._onStateChangedMsg(textMsg);
		}
		else if (textMsg.startsWith('status:')) {
			this._onStatusMsg(textMsg);
		}
		else if (textMsg.startsWith('statusindicator')) {
			this._onStatusIndicatorMsg(textMsg);
		}
		else if (textMsg.startsWith('textselection:')) {
			this._onTextSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('textselectioncontent:')) {
			this._onTextSelectionContentMsg(textMsg);
		}
		else if (textMsg.startsWith('textselectionend:')) {
			this._onTextSelectionEndMsg(textMsg);
		}
		else if (textMsg.startsWith('textselectionstart:')) {
			this._onTextSelectionStartMsg(textMsg);
		}
		else if (textMsg.startsWith('tile:')) {
			this._onTileMsg(textMsg, img);
		}
	},

	_onCommandValuesMsg: function (textMsg) {
		var obj = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
		if (this._map.unoToolbarCommands.indexOf(obj.commandName) !== -1) {
			this._toolbarCommandValues[obj.commandName] = obj.commandValues;
			this._map.fire('updatetoolbarcommandvalues', {
				commandName: obj.commandName,
				commandValues: obj.commandValues
			});
		}
	},

	_onCursorVisibleMsg: function(textMsg) {
		var command = textMsg.match('cursorvisible: true');
		this._isCursorVisible = command ? true : false;
		this._isCursorOverlayVisible = true;
		this._onUpdateCursor();
	},

	_onDownloadAsMsg: function (textMsg) {
		var command = L.Socket.parseServerCmd(textMsg);
		var parser = document.createElement('a');
		var protocol = window.location.protocol === 'file:' ? 'http:' : window.location.protocol;
		parser.href = this._map.options.server;
		var url = protocol + '//' + parser.hostname + ':' + command.port + '/' +
			command.jail + '/' + command.dir + '/' + command.name;

		if (command.id === 'print') {
			var isFirefox = typeof InstallTrigger !== 'undefined' || navigator.userAgent.search('Firefox') >= 0;
			if (isFirefox || this._map.options.print === false) {
				// the print dialog doesn't work well on firefox
				this._map.fire('print', {url: url});
			}
			else {
				this._map.fire('filedownloadready', {url: url, name: name, id: command.id});
			}
		}
		else if (command.id === 'slideshow') {
			this._map.fire('slidedownloadready', {url: url});
		}
		else {
			this._map._fileDownloader.src = url;
		}
	},

	_onErrorMsg: function (textMsg) {
		var command = L.Socket.parseServerCmd(textMsg);
		this._map.fire('error', {cmd: command.errorCmd, kind: command.errorKind});
	},

	_onGetChildIdMsg: function (textMsg) {
		var command = L.Socket.parseServerCmd(textMsg);
		this._map.fire('childid', {id: command.id});
	},

	_onGraphicSelectionMsg: function (textMsg) {
		if (textMsg.match('EMPTY')) {
			this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		}
		else {
			var strTwips = textMsg.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._graphicSelection = new L.LatLngBounds(
							this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
							this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}

		this._onUpdateGraphicSelection();
	},

	_onHyperlinkClickedMsg: function (textMsg) {
		var link = textMsg.substring(18);
		window.open(link, '_blank');
	},

	_onInvalidateCursorMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
		var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
		var bottomRightTwips = topLeftTwips.add(offset);
		this._visibleCursor = new L.LatLngBounds(
						this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
						this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		this._isCursorOverlayVisible = true;
		this._onUpdateCursor();
	},

	_onPartPageRectanglesMsg: function (textMsg) {
		textMsg = textMsg.substring(19);
		var pages = textMsg.split(';');
		this._partPageRectanglesTwips = [];
		this._partPageRectanglesPixels = [];
		for (var i = 0; i < pages.length; i++) {
			var strTwips = pages[i].match(/\d+/g);
			if (!strTwips) {
				// probably not a text file
				return;
			}
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			var pageBoundsTwips = new L.Bounds(topLeftTwips, bottomRightTwips);
			this._partPageRectanglesTwips.push(pageBoundsTwips);
			var pageBoundsPixels = new L.Bounds(
					this._twipsToPixels(topLeftTwips),
					this._twipsToPixels(bottomRightTwips));
			this._partPageRectanglesPixels.push(pageBoundsPixels);
		}
		this._map.fire('partpagerectangles', {
			pixelRectangles: this._partPageRectanglesPixels,
			twipsRectangles: this._partPageRectanglesTwips
		});
		this._onCurrentPageUpdate();
	},

	_onSearchNotFoundMsg: function (textMsg) {
		var originalPhrase = textMsg.substring(16);
		this._map.fire('search', {originalPhrase: originalPhrase, count: 0});
	},

	_onSearchResultSelection: function (textMsg) {
		textMsg = textMsg.substring(23);
		var obj = JSON.parse(textMsg);
		var originalPhrase = obj.searchString;
		var count = obj.searchResultSelection.length;
		var results = [];
		for (var i = 0; i < obj.searchResultSelection.length; i++) {
			results.push({
				part: parseInt(obj.searchResultSelection[i].part),
				rectangles: this._twipsRectanglesToPixelBounds(obj.searchResultSelection[i].rectangles)
			});
		}
		this._map.fire('search', {originalPhrase: originalPhrase, count: count, results: results});
	},

	_onStateChangedMsg: function (textMsg) {
		var unoMsg = textMsg.substr(14).split('=');
		var commandName = '',
			state = '';
		if (unoMsg.length > 0) {
			commandName = unoMsg[0];
		}
		if (unoMsg.length > 1) {
			state = unoMsg[1];
		}
		this._map.fire('commandstatechanged', {commandName : commandName, state : state});
	},

	_onStatusIndicatorMsg: function (textMsg) {
		if (textMsg.startsWith('statusindicatorstart:')) {
			this._map.fire('statusindicator', {statusType : 'start'});
		}
		else if (textMsg.startsWith('statusindicatorsetvalue:')) {
			var value = textMsg.match(/\d+/g)[0];
			this._map.fire('statusindicator', {statusType : 'setvalue', value : value});
		}
		else if (textMsg.startsWith('statusindicatorfinish:')) {
			this._map.fire('statusindicator', {statusType : 'finish'});
		}
	},

	_onTextSelectionMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		this._selections.clearLayers();
		if (strTwips != null) {
			var rectangles = [];
			var selectionCenter = new L.Point(0, 0);
			for (var i = 0; i < strTwips.length; i += 4) {
				var topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i + 1]));
				var offset = new L.Point(parseInt(strTwips[i + 2]), parseInt(strTwips[i + 3]));
				var topRightTwips = topLeftTwips.add(new L.Point(offset.x, 0));
				var bottomLeftTwips = topLeftTwips.add(new L.Point(0, offset.y));
				var bottomRightTwips = topLeftTwips.add(offset);
				rectangles.push([bottomLeftTwips, bottomRightTwips, topLeftTwips, topRightTwips]);
				selectionCenter = selectionCenter.add(topLeftTwips);
				selectionCenter = selectionCenter.add(offset.divideBy(2));
			}

			var polygons = L.PolyUtil.rectanglesToPolygons(rectangles, this);
			for (i = 0; i < polygons.length; i++) {
				var selection = new L.Polygon(polygons[i], {
					pointerEvents: 'none',
					fillColor: '#43ACE8',
					fillOpacity: 0.25,
					weight: 2,
					opacity: 0.25});
				this._selections.addLayer(selection);
			}
			if (this._selectionContentRequest) {
				clearTimeout(this._selectionContentRequest);
			}
			this._selectionContentRequest = setTimeout(L.bind(function () {
				L.Socket.sendMessage('gettextselection mimetype=text/plain;charset=utf-8');}, this), 100);
		}
		this._onUpdateTextSelection();
	},

	_onTextSelectionContentMsg: function (textMsg) {
		this._selectionTextContent = textMsg.substr(22);
	},

	_onTextSelectionEndMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		if (strTwips != null) {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._textSelectionEnd = new L.LatLngBounds(
						this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
						this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}
		else {
			this._textSelectionEnd = null;
		}
	},

	_onTextSelectionStartMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		if (strTwips != null) {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._textSelectionStart = new L.LatLngBounds(
						this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
						this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}
		else {
			this._textSelectionStart = null;
		}

	},

	_onTileMsg: function (textMsg, img) {
		var command = L.Socket.parseServerCmd(textMsg);
		var coords = this._twipsToCoords(command);
		coords.z = command.zoom;
		coords.part = command.part;
		var key = this._tileCoordsToKey(coords);
		var tile = this._tiles[key];
		if (command.id !== undefined) {
			this._map.fire('tilepreview', {
				tile: img,
				id: command.id,
				width: command.width,
				height: command.height,
				part: command.part,
				docType: this._docType
			});
		}
		else if (tile) {
			if (this._tiles[key]._invalidCount > 0) {
				this._tiles[key]._invalidCount -= 1;
			}
			if (!tile.loaded) {
				this._emptyTilesCount -= 1;
				if (this._emptyTilesCount === 0) {
					this._map.fire('statusindicator', {statusType: 'alltilesloaded'});
				}
			}
			tile.el.src = img;
		}
		else if (command.preFetch === 'true') {
			this._tileCache[key] = img;
		}
		L.Log.log(textMsg, L.INCOMING, key);

	},

	_tileOnLoad: function (done, tile) {
		done(null, tile);
	},

	_tileOnError: function (done, tile, e) {
		var errorUrl = this.options.errorTileUrl;
		if (errorUrl) {
			tile.src = errorUrl;
		}
		done(e, tile);
	},

   _mapOnError: function (e) {
		if (e.msg) {
			this._map.setPermission('view');
		}
	},

	_onTileRemove: function (e) {
		e.tile.onload = null;
	},

	_clearSelections: function () {
		// hide the cursor
		this._isCursorOverlayVisible = false;
		this._onUpdateCursor();
		// hide the text selection
		this._selections.clearLayers();
		// hide the selection handles
		this._onUpdateTextSelection();
		// hide the graphic selection
		this._graphicSelection = null;
		this._onUpdateGraphicSelection();
	},

	_postMouseEvent: function(type, x, y, count, buttons, modifier) {
		L.Socket.sendMessage('mouse type=' + type +
				' x=' + x + ' y=' + y + ' count=' + count +
				' buttons=' + buttons + ' modifier=' + modifier);
	},

	_postKeyboardEvent: function(type, charcode, keycode) {
		L.Socket.sendMessage('key type=' + type +
				' char=' + charcode + ' key=' + keycode);
	},

	_postSelectGraphicEvent: function(type, x, y) {
		L.Socket.sendMessage('selectgraphic type=' + type +
				' x=' + x + ' y=' + y);
	},

	_postSelectTextEvent: function(type, x, y) {
		L.Socket.sendMessage('selecttext type=' + type +
				' x=' + x + ' y=' + y);
	},

	// Is rRectangle empty?
	_isEmptyRectangle: function (bounds) {
		if (!bounds) {
			return true;
		}
		return bounds.getSouthWest().equals(new L.LatLng(0, 0)) && bounds.getNorthEast().equals(new L.LatLng(0, 0));
	},

	// Update cursor layer (blinking cursor).
	_onUpdateCursor: function (e) {
		var pixBounds = L.bounds(this._map.latLngToLayerPoint(this._visibleCursor.getSouthWest()),
						 this._map.latLngToLayerPoint(this._visibleCursor.getNorthEast()));
		var cursorPos = this._visibleCursor.getNorthWest();

		if (!e && !this._map.getBounds().contains(cursorPos) && this._isCursorVisible) {
			var center = this._map.project(cursorPos);
			center = center.subtract(this._map.getSize().divideBy(2));
			center.x = Math.round(center.x < 0 ? 0 : center.x);
			center.y = Math.round(center.y < 0 ? 0 : center.y);
			this._map.fire('scrollto', {x: center.x, y: center.y});
		}

		if (this._permission === 'edit' && this._isCursorVisible && this._isCursorOverlayVisible
				&& !this._isEmptyRectangle(this._visibleCursor)) {
			if (this._cursorMarker) {
				this._map.removeLayer(this._cursorMarker);
			}

			this._cursorMarker = L.cursor(cursorPos);
			this._map.addLayer(this._cursorMarker);
			this._cursorMarker.setSize(pixBounds.getSize().multiplyBy(
						this._map.getZoomScale(this._map.getZoom())));
		}
		else if (this._cursorMarker) {
			this._map.removeLayer(this._cursorMarker);
			this._isCursorOverlayVisible = false;
		}
	},

	// Update dragged graphics selection resize.
	_onGraphicEdit: function (e) {
		if (!e.handle) { return; }

		var aPos = this._latLngToTwips(e.handle.getLatLng());
		if (e.type === 'editstart') {
			this._graphicMarker.isDragged = true;
			this._postSelectGraphicEvent('start', aPos.x, aPos.y);
		}
		else if (e.type === 'editend') {
			this._postSelectGraphicEvent('end', aPos.x, aPos.y);
			this._graphicMarker.isDragged = false;
		}
	},

	// Update dragged text selection.
	_onSelectionHandleDrag: function (e) {
		var aPos = this._latLngToTwips(e.target.getLatLng());

		if (e.type === 'drag') {
			e.target.isDragged = true;
		}
		if (e.type === 'dragend') {
			e.target.isDragged = false;
			this._textArea.focus();
		}

		if (this._selectionHandles.start === e.target) {
			this._postSelectTextEvent('start', aPos.x, aPos.y);
		}
		else if (this._selectionHandles.end === e.target) {
			this._postSelectTextEvent('end', aPos.x, aPos.y);
		}
	},

	// Update group layer selection handler.
	_onUpdateGraphicSelection: function () {
		if (this._graphicSelection && !this._isEmptyRectangle(this._graphicSelection)) {
			if (this._graphicMarker) {
				this._graphicMarker.off('editstart editend', this._onGraphicEdit, this);
				this._map.removeLayer(this._graphicMarker);
			}
			this._graphicMarker = L.rectangle(this._graphicSelection, {fill: false});
			if (!this._graphicMarker) {
				this._map.fire('error', {msg: 'Graphic marker initialization'});
				return;
			}
			this._graphicMarker.editing.enable();
			this._graphicMarker.on('editstart editend', this._onGraphicEdit, this);
			this._map.addLayer(this._graphicMarker);
		}
		else if (this._graphicMarker) {
			this._graphicMarker.off('editstart editend', this._onGraphicEdit, this);
			this._map.removeLayer(this._graphicMarker);
			this._graphicMarker.isDragged = false;
		}
	},

	// Update text selection handlers.
	_onUpdateTextSelection: function () {
		var startMarker, endMarker;
		for (var key in this._selectionHandles) {
			if (key === 'start') {
				startMarker = this._selectionHandles[key];
			}
			else if (key === 'end') {
				endMarker = this._selectionHandles[key];
			}
		}

		if (this._selections.getLayers().length !== 0 || startMarker.isDragged || endMarker.isDragged) {
			if (!startMarker || !endMarker ||
					this._isEmptyRectangle(this._textSelectionStart) ||
					this._isEmptyRectangle(this._textSelectionEnd)) {
				return;
			}

			var startPos = this._map.project(this._textSelectionStart.getSouthWest());
			var endPos = this._map.project(this._textSelectionEnd.getSouthWest());
			var startMarkerPos = this._map.project(startMarker.getLatLng());
			if (startMarkerPos.distanceTo(endPos) < startMarkerPos.distanceTo(startPos) && startMarker._icon && endMarker._icon) {
				// if the start marker is actually closer to the end of the selection
				// reverse icons and markers
				L.DomUtil.removeClass(startMarker._icon, 'leaflet-selection-marker-start');
				L.DomUtil.removeClass(endMarker._icon, 'leaflet-selection-marker-end');
				L.DomUtil.addClass(startMarker._icon, 'leaflet-selection-marker-end');
				L.DomUtil.addClass(endMarker._icon, 'leaflet-selection-marker-start');
				var tmp = startMarker;
				startMarker = endMarker;
				endMarker = tmp;
			}
			else if (startMarker._icon && endMarker._icon) {
				// normal markers and normal icons
				L.DomUtil.removeClass(startMarker._icon, 'leaflet-selection-marker-end');
				L.DomUtil.removeClass(endMarker._icon, 'leaflet-selection-marker-start');
				L.DomUtil.addClass(startMarker._icon, 'leaflet-selection-marker-start');
				L.DomUtil.addClass(endMarker._icon, 'leaflet-selection-marker-end');
			}

			if (!startMarker.isDragged) {
				var pos = this._map.project(this._textSelectionStart.getSouthWest());
				pos = pos.subtract(new L.Point(0, 2));
				pos = this._map.unproject(pos);
				startMarker.setLatLng(pos);
				this._map.addLayer(startMarker);
			}

			if (!endMarker.isDragged) {
				var pos = this._map.project(this._textSelectionEnd.getSouthEast());
				pos = pos.subtract(new L.Point(0, 2));
				pos = this._map.unproject(pos);
				endMarker.setLatLng(pos);
				this._map.addLayer(endMarker);
			}
		}
		else {
			this._textSelectionStart = null;
			this._textSelectionEnd = null;
			for (key in this._selectionHandles) {
				this._map.removeLayer(this._selectionHandles[key]);
				this._selectionHandles[key].isDragged = false;
			}
		}
	},

	_onCopy: function (e) {
		e = e.originalEvent;
		e.preventDefault();
		if (!this._selectionTextContent) {
			this._map.fire('error', {msg: 'Oops, no content available yet'});
		}
		else {
			// Decode UTF-8.
			e.clipboardData.setData('text/plain', decodeURIComponent(escape(this._selectionTextContent)));
		}
	},

	_onDragStart: function () {
		this._map.on('moveend', this._updateScrollOffset, this);
	},

	_onRequestLOKSession: function () {
		L.Socket.sendMessage('requestloksession');
	},

	_fitDocumentHorizontally: function (e) {
		if (this._docType !== 'spreadsheet') {
			var crsScale = this._map.options.crs.scale(1);
			if (this._docPixelSize.x > e.newSize.x) {
				var ratio = this._docPixelSize.x / e.newSize.x;
				var zoomDelta = Math.ceil(Math.log(ratio) / Math.log(crsScale));
				this._map.setZoom(Math.max(1, this._map.getZoom() - zoomDelta), {animate: false});
			}
			else if (e.newSize.x / this._docPixelSize.x > crsScale) {
				// we could zoom in
				var ratio = e.newSize.x / this._docPixelSize.x;
				var zoomDelta = Math.ceil(Math.log(ratio) / Math.log(crsScale));
				this._map.setZoom(Math.min(10, this._map.getZoom() + zoomDelta), {animate: false});
			}
		}
	},

	_onCurrentPageUpdate: function () {
		var mapCenter = this._map.project(this._map.getCenter());
		if (!this._partPageRectanglesPixels || !(this._currentPage >= 0) ||
				this._partPageRectanglesPixels[this._currentPage].contains(mapCenter)) {
			// page number has not changed
			return;
		}
		for (var i = 0; i < this._partPageRectanglesPixels.length; i++) {
			if (this._partPageRectanglesPixels[i].contains(mapCenter)) {
				this._currentPage = i;
				this._map.fire('pagenumberchanged', {
					currentPage: this._currentPage,
					pages: this._pages,
					docType: this._docType
				});
				return;
			}
		}
	},

	_onUpdatePartPageRectangles: function () {
		if (this._partPageRectanglesPixels.length > 0) {
			this._partPageRectanglesPixels = [];
			for (var i = 0; i < this._partPageRectanglesTwips.length; i++) {
				var pageBounds = new L.Bounds(
						this._twipsToPixels(this._partPageRectanglesTwips[i].min),
						this._twipsToPixels(this._partPageRectanglesTwips[i].max));
				this._partPageRectanglesPixels.push(pageBounds);
			}
			this._map.fire('partpagerectangles', {
				pixelRectangles: this._partPageRectanglesPixels,
				twipsRectangles: this._partPageRectanglesTwips
			});
		}
	},

    _invalidatePreviews: function () {
		if (this._map._docPreviews && this._previewInvalidations.length > 0) {
			var toInvalidate = {};
			for (var i = 0; i < this._previewInvalidations.length; i++) {
				var invalidBounds = this._previewInvalidations[i];
				for (var key in this._map._docPreviews) {
					// find preview tiles that need to be updated and add them in a set
					var preview = this._map._docPreviews[key];
					if (preview.index >= 0 && this._docType === 'text') {
						// we have a preview for a page
						if (this._partPageRectanglesTwips.length > preview.index &&
								invalidBounds.intersects(this._partPageRectanglesTwips[preview.index])) {
							toInvalidate[key] = true;
						}
					}
					else if (preview.index >= 0) {
						// we have a preview for a part
						if (preview.index === this._selectedPart ||
								(preview.index === this._prevSelectedPart && this._prevSelectedPartNeedsUpdate)) {
							// if the current part needs its preview updated OR
							// the part has been changed and we need to update the previous part preview
							if (preview.index === this._prevSelectedPart) {
								this._prevSelectedPartNeedsUpdate = false;
							}
							toInvalidate[key] = true;
						}
					}
					else {
						// we have a custom preview
						var bounds = new L.Bounds(
								new L.Point(preview.tilePosX, preview.tilePosY),
								new L.Point(preview.tilePosX + preview.tileWidth, preview.tilePosY + preview.tileHeight));
						if ((preview.part === this._selectedPart ||
								(preview.part === this._prevSelectedPart && this._prevSelectedPartNeedsUpdate)) &&
								invalidBounds.intersects(bounds)) {
							// if the current part needs its preview updated OR
							// the part has been changed and we need to update the previous part preview
							if (preview.index === this._prevSelectedPart) {
								this._prevSelectedPartNeedsUpdate = false;
							}
							toInvalidate[key] = true;
						}

					}
				}

			}

			for (key in toInvalidate) {
				// update invalid preview tiles
				preview = this._map._docPreviews[key];
				if (preview.autoUpdate) {
					if (preview.index >= 0) {
						this._map.getPreview(preview.id, preview.index, preview.maxWidth, preview.maxHeight, {autoUpdate: true});
					}
					else {
						this._map.getCustomPreview(preview.id, preview.part, preview.width, preview.height, preview.tilePosX,
								preview.tilePosY, preview.tileWidth, preview.tileHeight, {autoUpdate: true});
					}
				}
				else {
					this._map.fire('invalidatepreview', {id: preview.id});
				}
			}
		}
		this._previewInvalidations = [];
	}
});

L.tileLayer = function (url, options) {
	return new L.TileLayer(url, options);
};
