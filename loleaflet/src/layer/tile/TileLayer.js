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
		preFetchOtherParts: false
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
		this._textSelectionStart = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		// Position and size of the selection end.
		this._textSelectionEnd = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));

		// Cursor marker
		this._cursorMarker = null;
		// Graphic marker
		this._graphicMarker = null;
		// Handle start marker
		this._startMarker = L.marker(new L.LatLng(0, 0), {
			icon: L.icon({
				iconUrl: L.Icon.Default.imagePath + '/handle_start.png',
				iconSize: [30, 44],
				iconAnchor: [28, 2]
			}),
			draggable: true
		});
		// Handle end marker
		this._endMarker = L.marker(new L.LatLng(0, 0), {
			icon: L.icon({
				iconUrl: L.Icon.Default.imagePath + '/handle_end.png',
				iconSize: [30, 44],
				iconAnchor: [2, 2]
			}),
			draggable: true
		});
		this._emptyTilesCount = 0;
	},

	_initDocument: function () {
		if (!this._map.socket) {
			console.log('Socket initialization error');
			return;
		}
		if (this.options.doc) {
			var msg = 'load url=' + this.options.doc;
			if (this.options.timeStamp) {
				msg += '?timestamp=' + this.options.timeStamp;
			}
			this.sendMessage(msg);
			this.sendMessage('status');
		}
		this._map.on('drag resize zoomend', this._updateScrollOffset, this);
		this._map.on('clearselection', this._clearSelections, this);
		this._map.on('copy', this._onCopy, this);
		this._map.on('zoomend', this._onUpdateCursor, this);
		this._startMarker.on('drag dragend', this._onSelectionHandleDrag, this);
		this._endMarker.on('drag dragend', this._onSelectionHandleDrag, this);
		this._textArea = this._map._textArea;
		this._textArea.focus();
		if (this.options.edit && !this.options.readOnly) {
			this._map.setPermission('edit');
		}
		if (this.options.readOnly) {
			this._map.setPermission('readonly');
		}
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

	_onMessage: function (evt) {
		var bytes, index, textMsg;

		if (typeof (evt.data) === 'string') {
			textMsg = evt.data;
		}
		else if (typeof (evt.data) === 'object') {
			bytes = new Uint8Array(evt.data);
			index = 0;
			// search for the first newline which marks the end of the message
			while (index < bytes.length && bytes[index] !== 10) {
				index++;
			}
			textMsg = String.fromCharCode.apply(null, bytes.subarray(0, index));
		}

		if (!textMsg.startsWith('tile:')) {
			// log the tile msg separately as we need the tile coordinates
			L.Log.log(textMsg, L.INCOMING);
			if (bytes !== undefined) {
				// if it's not a tile, parse the whole message
				textMsg = String.fromCharCode.apply(null, bytes);
			}
		}

		if (textMsg.startsWith('cursorvisible:')) {
			var command = textMsg.match('cursorvisible: true');
			this._isCursorVisible = command ? true : false;
			this._isCursorOverlayVisible = true;
			this._onUpdateCursor();
		}
		else if (textMsg.startsWith('invalidatecursor:')) {
			var strTwips = textMsg.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._visibleCursor = new L.LatLngBounds(
							this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
							this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
			this._isCursorOverlayVisible = true;
			this._onUpdateCursor();
		}
		else if (textMsg.startsWith('textselectionstart:')) {
			strTwips = textMsg.match(/\d+/g);
			if (strTwips != null) {
				topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
				offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
				bottomRightTwips = topLeftTwips.add(offset);
				this._textSelectionStart = new L.LatLngBounds(
							this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
							this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
			}
			else {
				this._textSelectionStart = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
			}
		}
		else if (textMsg.startsWith('textselectionend:')) {
			strTwips = textMsg.match(/\d+/g);
			if (strTwips != null) {
				topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
				offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
				bottomRightTwips = topLeftTwips.add(offset);
				this._textSelectionEnd = new L.LatLngBounds(
							this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
							this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
			}
			else {
				this._textSelectionEnd = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
			}
		}
		else if (textMsg.startsWith('graphicselection:')) {
			if (textMsg.match('EMPTY')) {
				this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
			}
			else {
				strTwips = textMsg.match(/\d+/g);
				topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
				offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
				bottomRightTwips = topLeftTwips.add(offset);
				this._graphicSelection = new L.LatLngBounds(
								this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
								this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
			}

			this._onUpdateGraphicSelection();
		}
		else if (textMsg.startsWith('invalidatetiles:') && !textMsg.match('EMPTY')) {
			command = this._parseServerCmd(textMsg);
			if (command.x === undefined || command.y === undefined || command.part === undefined) {
				strTwips = textMsg.match(/\d+/g);
				command.x = parseInt(strTwips[0]);
				command.y = parseInt(strTwips[1]);
				command.width = parseInt(strTwips[2]);
				command.height = parseInt(strTwips[3]);
				command.part = this._currentPart;
			}
			if (this._docType === 'text') {
				command.part = 0;
			}
			topLeftTwips = new L.Point(command.x, command.y);
			offset = new L.Point(command.width, command.height);
			bottomRightTwips = topLeftTwips.add(offset);
			var invalidBounds = new L.Bounds(topLeftTwips, bottomRightTwips);
			var visibleTopLeft = this._latLngToTwips(this._map.getBounds().getNorthWest());
			var visibleBottomRight = this._latLngToTwips(this._map.getBounds().getSouthEast());
			var visibleArea = new L.Bounds(visibleTopLeft, visibleBottomRight);

			for (var key in this._tiles) {
				var coords = this._tiles[key].coords;
				var tileTopLeft = this._coordsToTwips(coords);
				var tileBottomRight = new L.Point(this._tileWidthTwips, this._tileHeightTwips);
				var bounds = new L.Bounds(tileTopLeft, tileTopLeft.add(tileBottomRight));
				if (invalidBounds.intersects(bounds) && coords.part === command.part) {
					if (this._tiles[key]._invalidCount) {
						this._tiles[key]._invalidCount += 1;
					}
					else {
						this._tiles[key]._invalidCount = 1;
					}
					if (visibleArea.intersects(bounds)) {
						this.sendMessage('tile ' +
										'part=' + coords.part + ' ' +
										'width=' + this._tileSize + ' ' +
										'height=' + this._tileSize + ' ' +
										'tileposx=' + tileTopLeft.x + ' '    +
										'tileposy=' + tileTopLeft.y + ' ' +
										'tilewidth=' + this._tileWidthTwips + ' ' +
										'tileheight=' + this._tileHeightTwips, key);
					}
					else {
						// tile outside of the visible area, just remove it
						this._preFetchBorder = null;
						this._removeTile(key);
					}
				}
			}
			for (key in this._tileCache) {
				// compute the rectangle that each tile covers in the document based
				// on the zoom level
				coords = this._keyToTileCoords(key);
				if (coords.part !== command.part) {
					continue;
				}
				var scale = this._map.getZoomScale(coords.z);
				topLeftTwips = new L.Point(
						this.options.tileWidthTwips / scale * coords.x,
						this.options.tileHeightTwips / scale * coords.y);
				bottomRightTwips = topLeftTwips.add(new L.Point(
						this.options.tileWidthTwips / scale,
						this.options.tileHeightTwips / scale));
				bounds = new L.Bounds(topLeftTwips, bottomRightTwips);
				if (invalidBounds.intersects(bounds)) {
					delete this._tileCache[key];
				}
			}
		}
		else if (textMsg.startsWith('statechanged:')) {
			var unoMsg = textMsg.substr(14);
			var unoCmd = unoMsg.match('.uno:(.*)=')[1];
			var state = unoMsg.match('.*=(.*)')[1];
			if (unoCmd && state) {
				this._map.fire('statechanged', {unoCmd : unoCmd, state : state});
			}
		}
		else if (textMsg.startsWith('status:')) {
			command = this._parseServerCmd(textMsg);
			if (command.width && command.height && this._documentInfo !== textMsg) {
				this._docWidthTwips = command.width;
				this._docHeightTwips = command.height;
				this._docType = command.type;
				this._updateMaxBounds(true);
				this._documentInfo = textMsg;
				this._parts = command.parts;
				this._currentPart = command.currentPart;
				if (this._docType === 'text') {
					this._currentPart = 0;
					this._parts = 1;
					this._currentPage = command.currentPart;
					this._pages = command.parts;
					map.fire('pagenumberchanged', {
						currentPage: this._currentPage,
						pages: this._pages,
						docType: this._docType
					});
				}
				else {
					this.sendMessage('setclientpart part=' + this._currentPart);
					var partNames = textMsg.match(/[^\r\n]+/g);
					// only get the last matches
					partNames = partNames.slice(partNames.length - this._parts);
					this._map.fire('updateparts', {
						currentPart: this._currentPart,
						parts: this._parts,
						docType: this._docType,
						partNames: partNames
					});
				}
				this._update();
				if (this._preFetchPart !== this._currentPart) {
					this._preFetchPart = this._currentPart;
					this._preFetchBorder = null;
				}
			}
		}
		else if (textMsg.startsWith('statusindicatorstart:')) {
			this._map.fire('statusindicator', {statusType : 'start'});
		}
		else if (textMsg.startsWith('statusindicatorsetvalue:')) {
			var value = textMsg.match(/\d+/g)[0];
			this._map.fire('statusindicator', {statusType : 'setvalue', value : value});
		}
		else if (textMsg.startsWith('statusindicatorfinish:')) {
			this._map.fire('statusindicator', {statusType : 'finish'});
		}
		else if (textMsg.startsWith('tile:')) {
			command = this._parseServerCmd(textMsg);
			coords = this._twipsToCoords(command);
			coords.z = command.zoom;
			coords.part = command.part;
			var data = bytes.subarray(index + 1);

			// read the tile data
			var strBytes = '';
			for (var i = 0; i < data.length; i++) {
				strBytes += String.fromCharCode(data[i]);
			}

			key = this._tileCoordsToKey(coords);
			var tile = this._tiles[key];
			var img = 'data:image/png;base64,' + window.btoa(strBytes);
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
						this._map.fire('alltilesloaded');
					}
				}
				tile.el.src = img;
			}
			else if (command.preFetch === 'true') {
				this._emptyTilesCount -= 1;
				this._tileCache[key] = img;
			}
			L.Log.log(textMsg, L.INCOMING, key);
		}
		else if (textMsg.startsWith('textselection:')) {
			strTwips = textMsg.match(/\d+/g);
			this._clearSelections();
			if (strTwips != null) {
				var rectangles = [];
				var selectionCenter = new L.Point(0, 0);
				for (i = 0; i < strTwips.length; i += 4) {
					topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i + 1]));
					offset = new L.Point(parseInt(strTwips[i + 2]), parseInt(strTwips[i + 3]));
					var topRightTwips = topLeftTwips.add(new L.Point(offset.x, 0));
					var bottomLeftTwips = topLeftTwips.add(new L.Point(0, offset.y));
					bottomRightTwips = topLeftTwips.add(offset);
					rectangles.push([bottomLeftTwips, bottomRightTwips, topLeftTwips, topRightTwips]);
					selectionCenter = selectionCenter.add(topLeftTwips);
					selectionCenter = selectionCenter.add(offset.divideBy(2));
				}
				// average of all rectangles' centers
				selectionCenter = selectionCenter.divideBy(strTwips.length / 4);
				selectionCenter = this._twipsToLatLng(selectionCenter);
				if (!this._map.getBounds().contains(selectionCenter)) {
					var center = this._map.project(selectionCenter);
					center = center.subtract(this._map.getSize().divideBy(2));
					center.x = center.x < 0 ? 0 : center.x;
					center.y = center.y < 0 ? 0 : center.y;
					this._map.fire('scrollto', {x: center.x, y: center.y});
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
					this.sendMessage('gettextselection mimetype=text/plain;charset=utf-8');}, this), 100);
			}
			this._onUpdateTextSelection();
		}
		else if (textMsg.startsWith('textselectioncontent:')) {
			this._selectionTextContent = textMsg.substr(22);
		}
		else if (textMsg.startsWith('setpart:')) {
			var part = parseInt(textMsg.match(/\d+/g)[0]);
			if (part !== this._currentPart && this._docType !== 'text') {
				this._currentPart = part;
				this._update();
				this._clearSelections();
				this._map.fire('setpart', {currentPart: this._currentPart});
			}
			else if (this._docType === 'text') {
				map.fire('pagenumberchanged', {
					currentPage: part,
					pages: this._pages,
					docType: this._docType
				});
			}
		}
		else if (textMsg.startsWith('searchnotfound:')) {
			this._map.fire('searchnotfound');
		}
		else if (textMsg.startsWith('error:')) {
			vex.dialog.alert(textMsg);
		}
	},

	sendMessage: function (msg, coords) {
		L.Log.log(msg, L.OUTGOING, coords);
		this._map.socket.send(msg);
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

	_parseServerCmd: function (msg) {
		var tokens = msg.split(/[ \n]+/);
		var command = {};
		for (var i = 0; i < tokens.length; i++) {
			if (tokens[i].substring(0, 9) === 'tileposx=') {
				command.x = parseInt(tokens[i].substring(9));
			}
			else if (tokens[i].substring(0, 9) === 'tileposy=') {
				command.y = parseInt(tokens[i].substring(9));
			}
			else if (tokens[i].substring(0, 2) === 'x=') {
				command.x = parseInt(tokens[i].substring(2));
			}
			else if (tokens[i].substring(0, 2) === 'y=') {
				command.y = parseInt(tokens[i].substring(2));
			}
			else if (tokens[i].substring(0, 10) === 'tilewidth=') {
				command.tileWidth = parseInt(tokens[i].substring(10));
			}
			else if (tokens[i].substring(0, 11) === 'tileheight=') {
				command.tileHeight = parseInt(tokens[i].substring(11));
			}
			else if (tokens[i].substring(0, 6) === 'width=') {
				command.width = parseInt(tokens[i].substring(6));
			}
			else if (tokens[i].substring(0, 7) === 'height=') {
				command.height = parseInt(tokens[i].substring(7));
			}
			else if (tokens[i].substring(0, 5) === 'part=') {
				command.part = parseInt(tokens[i].substring(5));
			}
			else if (tokens[i].substring(0, 6) === 'parts=') {
				command.parts = parseInt(tokens[i].substring(6));
			}
			else if (tokens[i].substring(0, 8) === 'current=') {
				command.currentPart = parseInt(tokens[i].substring(8));
			}
			else if (tokens[i].substring(0, 3) === 'id=') {
				// remove newline characters
				command.id = tokens[i].substring(3).replace(/(\r\n|\n|\r)/gm, '');
			}
			else if (tokens[i].substring(0, 5) === 'type=') {
				// remove newline characters
				command.type = tokens[i].substring(5).replace(/(\r\n|\n|\r)/gm, '');
			}
			else if (tokens[i].substring(0,9) === 'prefetch=') {
				command.preFetch = tokens[i].substring(9);
			}
		}
		if (command.tileWidth && command.tileHeight) {
			var scale = command.tileWidth / this.options.tileWidthTwips;
			// scale = 1.2 ^ (10 - zoom)
			// zoom = 10 -log(scale) / log(1.2)
			command.zoom = Math.round(10 - Math.log(scale) / Math.log(1.2));
		}
		return command;
	},

	_onTileRemove: function (e) {
		e.tile.onload = null;
	},

	_clearSelections: function () {
		this._selections.clearLayers();
	},

	_postMouseEvent: function(type, x, y, count) {
		this.sendMessage('mouse type=' + type +
				' x=' + x + ' y=' + y + ' count=' + count);
	},

	_postKeyboardEvent: function(type, charcode, keycode) {
		this.sendMessage('key type=' + type +
				' char=' + charcode + ' key=' + keycode);
	},

	_postSelectGraphicEvent: function(type, x, y) {
		this.sendMessage('selectgraphic type=' + type +
				' x=' + x + ' y=' + y);
	},

	_postSelectTextEvent: function(type, x, y) {
		this.sendMessage('selecttext type=' + type +
				' x=' + x + ' y=' + y);
	},



	// Is rRectangle empty?
	_isEmptyRectangle: function (aBounds) {
		return aBounds.getSouthWest().equals(new L.LatLng(0, 0)) && aBounds.getNorthEast().equals(new L.LatLng(0, 0));
	},

	// Update cursor layer (blinking cursor).
	_onUpdateCursor: function (e) {
		var pixBounds = L.bounds(this._map.latLngToLayerPoint(this._visibleCursor.getSouthWest()),
						 this._map.latLngToLayerPoint(this._visibleCursor.getNorthEast()));
		var cursorPos = this._visibleCursor.getNorthWest();

		if (!e && !this._map.getBounds().contains(cursorPos) && this._isCursorVisible) {
			var center = this._map.project(cursorPos);
			center = center.subtract(this._map.getSize().divideBy(2));
			center.x = center.x < 0 ? 0 : center.x;
			center.y = center.y < 0 ? 0 : center.y;
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

		if (this._startMarker === e.target) {
			this._postSelectTextEvent('start', aPos.x, aPos.y);
		}
		if (this._endMarker === e.target) {
			this._postSelectTextEvent('end', aPos.x, aPos.y);
		}
	},

	// Update group layer selection handler.
	_onUpdateGraphicSelection: function () {
		if (!this._isEmptyRectangle(this._graphicSelection)) {
			if (this._graphicMarker) {
				this._graphicMarker.off('editstart editend', this._onGraphicEdit, this);
				this._map.removeLayer(this._graphicMarker);
			}
			this._graphicMarker = L.rectangle(this._graphicSelection, {fill: false});
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
		if (this._selections.getLayers().length !== 0) {
			if (!this._isEmptyRectangle(this._textSelectionStart) && !this._startMarker.isDragged) {
				this._startMarker.setLatLng(this._textSelectionStart.getSouthWest());
				this._map.addLayer(this._startMarker);
			}

			if (!this._isEmptyRectangle(this._textSelectionEnd) && !this._endMarker.isDragged) {
				this._endMarker.setLatLng(this._textSelectionEnd.getSouthEast());
				this._map.addLayer(this._endMarker);
			}
		}
		else {
			this._textSelectionStart = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
			this._textSelectionEnd = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
			this._map.removeLayer(this._startMarker);
			this._map.removeLayer(this._endMarker);
			this._endMarker.isDragged = false;
			this._startMarker.isDragged = false;
		}
	},

	_onCopy: function (e) {
		e = e.originalEvent;
		e.preventDefault();
		if (!this._selectionTextContent) {
			vex.dialog.alert('Oops, no content available yet');
		}
		else {
			e.clipboardData.setData('text/plain', this._selectionTextContent);
		}
	}
});

L.tileLayer = function (url, options) {
	return new L.TileLayer(url, options);
};
