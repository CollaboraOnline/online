/*
 * L.TileLayer is used for standard xyz-numbered tile layers.
 */

// Implement String::startsWith which is non-portable (Firefox only, it seems)
// See http://stackoverflow.com/questions/646628/how-to-check-if-a-string-startswith-another-string#4579228

if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    return this.slice(0, str.length) == str;
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
		crossOrigin: false
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
		this._bEdit = false;
		// Position and size of the visible cursor.
		this._aVisibleCursor = new L.LatLngBounds( new L.LatLng(0, 0), new L.LatLng(0, 0) );
		// Cursor overlay is visible or hidden (for blinking).
		this._bCursorOverlayVisible = false;
		// Cursor is visible or hidden (e.g. for graphic selection).
		this._bCursorVisible = true;
		// Rectangle graphic selection
		this._aGraphicSelection = new L.LatLngBounds( new L.LatLng(0, 0), new L.LatLng(0, 0) );
		// Cursor marker
		this._cursorMarker = null;
		// Graphic marker
		this._graphicMarker = null;
	},

	_initDocument: function () {
		if (!this._map.socket) {
			console.log('Socket initialization error');
			return;
		}
		if (this.options.doc) {
			this._map.socket.send('load url=' + this.options.doc);
			this._map.socket.send('status');
		}
		this._map.dragging.disable();
		this._map._scrollContainer.onscroll = L.bind(this._onScroll, this);
		this._map.on('zoomend resize', this._updateScrollOffset, this);
		this._map.on('clearselection', this._clearSelections, this);
		this._map.on('prevpart nextpart', this._onSwitchPart, this);
		this._map.on('mousedown mouseup mouseover mouseout mousemove dblclick',
				this._onMouseEvent, this);
		this._map.on('viewmode editmode', this._updateEditViewMode, this);
		this._map.on('drag', this._updateScrollOffset, this);
	},

	getEvents: function () {
		var events = {
			viewreset: this._viewReset,
			moveend: this._move,
			keypress: this._signalKey,
			keyup: this._signalKey
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
			textMsg = String.fromCharCode.apply(null, bytes.subarray(0, index + 1));
		}

		if (textMsg.startsWith('cursorvisible:')) {
			var command = textMsg.match('cursorvisible: true');
			this._bCursorVisible = command == undefined ? false : true;
			this._bCursorOverlayVisible = true;
			this._onUpdateCursor();
		}
		else if (textMsg.startsWith('invalidatecursor:')) {
			strTwips = textMsg.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._aVisibleCursor = new L.LatLngBounds(
							this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
							this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
			this._bCursorOverlayVisible = true;
			this._onUpdateCursor();
		}
		else if (textMsg.startsWith('graphicselection:')) {
			if (textMsg.match('EMPTY')) {
				this._aGraphicSelection = new L.LatLngBounds( new L.LatLng(0, 0), new L.LatLng(0, 0) );
			}
			else {
				strTwips = textMsg.match(/\d+/g);
				var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
				var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
				var bottomRightTwips = topLeftTwips.add(offset);
				this._aGraphicSelection = new L.LatLngBounds(
								this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
								this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
			}
			this._onUpdateGraphicSelection();
		}
		else if (textMsg.startsWith('invalidatetiles:')) {
			if (textMsg.match('EMPTY')) {
				// invalidate everything
				this.redraw();
				for (var key in this._tiles) {
					this._addTile(this._tiles[key].coords);
				}
			}
			else {
				strTwips = textMsg.match(/\d+/g);

				// convert to bounds
				var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
				var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
				var bottomRightTwips = topLeftTwips.add(offset);
				var invalidateBounds = new L.Bounds(topLeftTwips, bottomRightTwips);

				// FIXME - we want the fading when zooming, but not when
				// typing; we need to modify this so that we fade only
				// the tiles that do not exist yet
				this._map._fadeAnimated = false;

				for (var key in this._tiles) {
					var coords = this._tiles[key].coords;
					var point1 = this._coordsToTwips(coords);
					var point2 = new L.Point(point1.x + this._tileWidthTwips, point1.y + this._tileHeightTwips);
					var tileBounds = new L.Bounds(point1, point2);

					if (invalidateBounds.intersects(tileBounds)) {
						this._addTile(coords);
					}
				}
				this._update();
			}
		}
		else if (textMsg.startsWith('status:')) {
			var command = this._parseServerCmd(textMsg);
			if (command.width && command.height && this._documentInfo !== textMsg) {
				this._docWidthTwips = command.width;
				this._docHeightTwips = command.height;
				this._updateMaxBounds();
				this._documentInfo = textMsg;
				if (this._parts === undefined && command.parts > 1) {
					this._map.addControl(L.control.parts({
						'parts': command.parts,
						'currentPart': command.currentPart}));
				}
				this._parts = command.parts;
				this._currentPart = command.currentPart;
				this._update();
			}
		}
		else if (textMsg.startsWith('statusindicatorstart:')) {
			this._map.fire('statusindicator:start');
		}
		else if (textMsg.startsWith('statusindicatorsetvalue:')) {
			var statusIndicator = textMsg.match(/\d+/g)[0];
			this._map.fire('statusindicator:setvalue', {statusIndicator:statusIndicator});
		}
		else if (textMsg.startsWith('statusindicatorfinish:')) {
			this._map.fire('statusindicator:finish');
		}
		else if (textMsg.startsWith('tile:')) {
			var command = this._parseServerCmd(textMsg);
			var coords = this._twipsToCoords(new L.Point(command.x, command.y));
			coords.z = command.zoom;
			coords.part = command.part;
			var data = bytes.subarray(index + 1);

			// read the tile data
			var strBytes = '';
			for (var i = 0; i < data.length; i++) {
				strBytes += String.fromCharCode(data[i]);
			}

			// setup the tile
			var fragment = document.createDocumentFragment();
			this._addTileToMap(coords, fragment, 'data:image/png;base64,' + window.btoa(strBytes));
			this._level.el.appendChild(fragment);
		}
		else if (textMsg.startsWith('textselection:')) {
			strTwips = textMsg.match(/\d+/g);
			this._clearSelections();
			if (strTwips != null) {
				var rectangles = [];
				var selectionCenter = new L.Point(0,0);
				for (var i = 0; i < strTwips.length; i += 4) {
					var topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i+1]));
					var offset = new L.Point(parseInt(strTwips[i+2]), parseInt(strTwips[i+3]));
					var topRightTwips = topLeftTwips.add(new L.Point(offset.x, 0));
					var bottomLeftTwips = topLeftTwips.add(new L.Point(0, offset.y));
					var bottomRightTwips = topLeftTwips.add(offset);
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
					$('#scroll-container').mCustomScrollbar('scrollTo', [center.y, center.x]);
				}

				var polygons = this._rectanglesToPolygons(rectangles);
				for (var i = 0; i < polygons.length; i++) {
					var selection = new L.Polygon(polygons[i], {
						fillColor: '#43ACE8',
						fillOpacity: 0.25,
						weight: 2,
						opacity: 0.25});
					this._selections.addLayer(selection);
				}
			}
		}
		else if (textMsg.startsWith('setpart:')) {
			var part = parseInt(textMsg.match(/\d+/g)[0]);
			if (part != this._currentPart) {
				this._currentPart = part;
				this._update();
				this._clearSelections();
				this._map.fire('setpart', {currentPart: this._currentPart});
			}
		}
		else if (textMsg.startsWith('searchnotfound:')) {
			this._map.fire('searchnotfound');
		}
        else if (textMsg.startsWith('error:')) {
            alert(textMsg);
        }
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
		var tokens = msg.split(' ');
		var command = {};
		for (var i = 0; i < tokens.length; i++) {
			if (tokens[i].substring(0, 9) === 'tileposx=') {
				command.x = parseInt(tokens[i].substring(9));
			}
			else if (tokens[i].substring(0, 9) === 'tileposy=') {
				command.y = parseInt(tokens[i].substring(9));
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

	_rectanglesToPolygons: function(rectangles) {
		// algorithm found here http://stackoverflow.com/questions/13746284/merging-multiple-adjacent-rectangles-into-one-polygon
		var eps = 20;
		// Glue rectangles if the space between them is less then eps
		for (var i = 0; i < rectangles.length - 1; i++) {
			for (var j = i + 1; j < rectangles.length; j++) {
				for (var k = 0; k < rectangles[i].length; k++) {
					for (var l = 0; l < rectangles[j].length; l++) {
						if (Math.abs(rectangles[i][k].x - rectangles[j][l].x) < eps) {
							rectangles[j][l].x = rectangles[i][k].x;
						}
						if (Math.abs(rectangles[i][k].y - rectangles[j][l].y) < eps) {
							rectangles[j][l].y = rectangles[i][k].y;
						}
					}
				}
			}
		}

		points = {};
		for (var i = 0; i < rectangles.length; i++) {
			for (var j = 0; j < rectangles[i].length; j++) {
				if (points[rectangles[i][j]]) {
					delete points[rectangles[i][j]];
				}
				else {
					points[rectangles[i][j]] = rectangles[i][j];
				}
			}
		}

		function getKeys(points) {
			keys = [];
			for (var key in points) {
				if (points.hasOwnProperty(key)) {
					keys.push(key);
				}
			}
			return keys;
		}

		function x_then_y(a_str, b_str) {
			a = a_str.match(/\d+/g);
			a[0] = parseInt(a[0]);
			a[1] = parseInt(a[1]);
			b = b_str.match(/\d+/g);
			b[0] = parseInt(b[0]);
			b[1] = parseInt(b[1]);

			if (a[0] < b[0] || (a[0] == b[0] && a[1] < b[1])) {
				return -1;
			}
			else if (a[0] == b[0] && a[1] == b[1]) {
				return 0;
			}
			else {
				return 1;
			}
		}

		function y_then_x(a_str, b_str) {
			a = a_str.match(/\d+/g);
			a[0] = parseInt(a[0]);
			a[1] = parseInt(a[1]);
			b = b_str.match(/\d+/g);
			b[0] = parseInt(b[0]);
			b[1] = parseInt(b[1]);

			if (a[1] < b[1] || (a[1] == b[1] && a[0] < b[0])) {
				return -1;
			}
			else if (a[0] == b[0] && a[1] == b[1]) {
				return 0;
			}
			else {
				return 1;
			}
		}

		sort_x = getKeys(points).sort(x_then_y);
		sort_y = getKeys(points).sort(y_then_x);

		edges_h = {};
		edges_v = {};

		var len = getKeys(points).length;
		var i = 0;
		while (i < len) {
			var curr_y = points[sort_y[i]].y;
			while (i < len && points[sort_y[i]].y === curr_y) {
				edges_h[sort_y[i]] = sort_y[i+1];
				edges_h[sort_y[i+1]] = sort_y[i];
				i += 2;
			}
		}

		i = 0;
		while (i < len) {
			var curr_x = points[sort_x[i]].x;
			while (i < len && points[sort_x[i]].x === curr_x) {
				edges_v[sort_x[i]] = sort_x[i+1];
				edges_v[sort_x[i+1]] = sort_x[i];
				i += 2;
			}
		}

		var polygons = [];
		var edges_h_keys = getKeys(edges_h);
		while (edges_h_keys.length > 0) {
			var p = [[edges_h_keys[0], 0]];
			while (true) {
				var curr = p[p.length - 1][0];
				var e = p[p.length - 1][1];
				if (e === 0) {
					var next_vertex = edges_v[curr];
					delete edges_v[curr];
					p.push([next_vertex, 1]);
				}
				else {
					var next_vertex = edges_h[curr];
					delete edges_h[curr];
					p.push([next_vertex, 0]);
				}
				if (p[p.length - 1][0] === p[0][0] && p[p.length - 1][1] === p[0][1]) {
					p.pop();
					break;
				}
			}
			var polygon = [];
			for (var i = 0; i < p.length; i++) {
				polygon.push(this._twipsToLatLng(points[p[i][0]]));
				delete edges_h[p[i][0]];
				delete edges_v[p[i][0]];
			}
			polygon.push(this._twipsToLatLng(points[p[0][0]]));
			edges_h_keys = getKeys(edges_h);
			polygons.push(polygon);
		}
		return polygons;
	},

	_clearSelections: function () {
		this._selections.clearLayers();
	},

	_postMouseEvent: function(type, x, y, count) {
		this._map.socket.send('mouse type=' + type +
				' x=' + x + ' y=' + y + ' count=' + count);
	},

	_postKeyboardEvent: function(type, charcode, keycode) {
		this._map.socket.send('key type=' + type +
				' char=' + charcode + ' key=' + keycode);
	},

	_onMouseEvent: function (e) {
		if (e.type === 'mousedown') {
			this._selecting = true;
			this._clearSelections();
			var mousePos = this._latLngToTwips(e.latlng);
			this._mouseDownPos = mousePos;
			this._holdStart = setTimeout(L.bind(function() {
				this._holdStart = null;
				this._postMouseEvent('buttondown',this._mouseDownPos.x,
					this._mouseDownPos.y, 1);
			}, this), 500);

			this._bEdit = true;
		}
		else if (e.type === 'mouseup') {
			this._selecting = false;
			if (this._holdStart) {
				// it was a click
				clearTimeout(this._holdStart);
				this._holdStart = null;
				this._postMouseEvent('buttondown',this._mouseDownPos.x,
						this._mouseDownPos.y, 1);
			}
			var mousePos = this._latLngToTwips(e.latlng);
			this._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1);

			this._bEdit = true;
		}
		else if (e.type === 'mousemove' && this._selecting) {
			if (this._holdStart) {
				clearTimeout(this._holdStart);
				// it's not a dblclick, so we post the initial mousedown
				this._postMouseEvent('buttondown', this._mouseDownPos.x,
						this._mouseDownPos.y, 1);
				this._holdStart = null;
			}
			var mousePos = this._latLngToTwips(e.latlng);
			this._postMouseEvent('move', mousePos.x, mousePos.y, 1);
		}
		else if (e.type === 'dblclick') {
			var mousePos = this._latLngToTwips(e.latlng);
			this._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1);
			this._postMouseEvent('buttondown', mousePos.x, mousePos.y, 2);
			this._postMouseEvent('buttonup', mousePos.x, mousePos.y, 2);
			this._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1);
		}
	},

	_onSwitchPart: function (e) {
		if (e.type === 'prevpart') {
			if (this._currentPart > 0) {
				this._currentPart -= 1;
			}
		}
		else if (e.type === 'nextpart') {
			if (this._currentPart < this._parts - 1) {
				this._currentPart += 1;
			}
		}
		this._update();
		this._pruneTiles();
		this._clearSelections();
	},

	_updateEditViewMode: function (e) {
		if (e.type === 'viewmode') {
			this._map.dragging.enable();
			// disable all user interaction, will need to add keyboard too
			this._map.off('mousedown mouseup mouseover mouseout mousemove dblclick',
					this._onMouseEvent, this);
		}
		else if (e.type === 'editmode') {
			this._map.dragging.disable();
			this._map.on('mousedown mouseup mouseover mouseout mousemove dblclick',
					this._onMouseEvent, this);
		}
	},

	// TODO. This should be optimized to an index array
	_toUNOKeyCode: function ( keyCode ) {
		var unoKeyCode = keyCode;

		if (keyCode == 8) // backspace
			unoKeyCode = 1283; // BACKSPACE
		else if (keyCode == 9) // tab
			unoKeyCode = 1282; // TAB
		else if (keyCode == 13) // enter
			unoKeyCode = 1280; // RETURN
		else if (keyCode == 16) // shift
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 17) // ctrl
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 18) // alt
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 19) // pause/break
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 20) // caps lock
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 27) // escape
			unoKeyCode = 1281; // ESCAPE
		else if (keyCode == 32) // space
			unoKeyCode = 1284; // SPACE
		else if (keyCode == 33) // page up
			unoKeyCode = 1030; // PAGEUP
		else if (keyCode == 34) // page down
			unoKeyCode = 1031; // PAGEDOWN
		else if (keyCode == 35) // end
			unoKeyCode = 1029; // END
		else if (keyCode == 36) // home
			unoKeyCode = 1028; // HOME
		else if (keyCode == 37) // left arrow
			unoKeyCode = 1026; // LEFT
		else if (keyCode == 38) // up arrow
			unoKeyCode = 1025; // UP
		else if (keyCode == 39) // right arrow
			unoKeyCode = 1027; // UP
		else if (keyCode == 40) // down arrow
			unoKeyCode = 1024; // DOWN
		else if (keyCode == 45) // insert
			unoKeyCode = 1285; // INSERT
		else if (keyCode == 46) // delete
			unoKeyCode = 1286; // DELETE
		else if (keyCode == 91) // left window key
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 92) // right window key
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 93) // select key
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 96) // numpad 0
			unoKeyCode = 256; // NUM0
		else if (keyCode == 97) // numpad 1
			unoKeyCode = 257; // NUM1
		else if (keyCode == 98) // numpad 2
			unoKeyCode = 258; // NUM2
		else if (keyCode == 99) // numpad 3
			unoKeyCode = 259; // NUM3
		else if (keyCode == 100) // numpad 4
			unoKeyCode = 260; // NUM4
		else if (keyCode == 101) // numpad 5
			unoKeyCode = 261; // NUM5
		else if (keyCode == 102) // numpad 6
			unoKeyCode = 262; // NUM6
		else if (keyCode == 103) // numpad 7
			unoKeyCode = 263; // NUM7
		else if (keyCode == 104) // numpad 8
			unoKeyCode = 264; // NUM8
		else if (keyCode == 105) // numpad 9
			unoKeyCode = 265; // NUM9
		else if (keyCode == 106) // multiply
			unoKeyCode = 1289; // MULTIPLY
		else if (keyCode == 107) // add
			unoKeyCode = 1287; // ADD
		else if (keyCode == 109) // subtract
			unoKeyCode = 1288; // SUBTRACT
		else if (keyCode == 110) // decimal point
			unoKeyCode = 1309; // DECIMAL
		else if (keyCode == 111) // divide
			unoKeyCode = 1290; // DIVIDE
		else if (keyCode == 112) // f1
			unoKeyCode = 768; // F1
		else if (keyCode == 113) // f2
			unoKeyCode = 769; // F2
		else if (keyCode == 114) // f3
			unoKeyCode = 770; // F3
		else if (keyCode == 115) // f4
			unoKeyCode = 771; // F4
		else if (keyCode == 116) // f5
			unoKeyCode = 772; // F5
		else if (keyCode == 117) // f6
			unoKeyCode = 773; // F6
		else if (keyCode == 118) // f7
			unoKeyCode = 774; // F7
		else if (keyCode == 119) // f8
			unoKeyCode = 775; // F8
		else if (keyCode == 120) // f9
			unoKeyCode = 776; // F9
		else if (keyCode == 121) // f10
			unoKeyCode = 777; // F10
		else if (keyCode == 122) // f11
			unoKeyCode = 778; // F11
		else if (keyCode == 144) // num lock
			unoKeyCode = 1313; // NUMLOCK
		else if (keyCode == 145) // scroll lock
			unoKeyCode = 1314; // SCROLLLOCK
		else if (keyCode == 186) // semi-colon
			unoKeyCode = 1317; // SEMICOLON
		else if (keyCode == 187) // equal sign
			unoKeyCode = 1295; // EQUAL
		else if (keyCode == 188) // comma
			unoKeyCode = 1292; // COMMA
		else if (keyCode == 189) // dash
			unoKeyCode = 5; // DASH
		else if (keyCode == 190) // period
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 191) // forward slash
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 192) // grave accent
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 219) // open bracket
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 220) // back slash
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 221) // close bracket
			unoKeyCode = keyCode; // UNKOWN
		else if (keyCode == 222) // single quote
			unoKeyCode = keyCode; // UNKOWN

		return unoKeyCode;
	},

	// Receives a key press or release event.
	_signalKey: function (e) {
		if ( !this._bEdit )
			return;

		if ( e.type === 'keypress' ) {
			this._keyEvent = e.originalEvent;
			this._postKeyboardEvent('input', this._keyEvent.charCode, this._toUNOKeyCode(this._keyEvent.keyCode));
		}
		else if ( e.type === 'keyup' &&  this._keyEvent ) {
			this._postKeyboardEvent('up', this._keyEvent.charCode, this._toUNOKeyCode(this._keyEvent.keyCode));
		}
	},

	// Is rRectangle empty?
	_isEmptyRectangle: function (aBounds) {
		return aBounds.getSouthWest().equals( new L.LatLng(0,0) ) && aBounds.getNorthEast().equals( new L.LatLng(0,0) )
	},

	// Update cursor layer (blinking cursor).
	_onUpdateCursor: function () {
		if (this._bEdit && this._bCursorVisible && this._bCursorOverlayVisible && !this._isEmptyRectangle(this._aVisibleCursor)) {
			if (this._cursorMarker)
				this._map.removeLayer(this._cursorMarker);

			var pixBounds = L.bounds(this._map.latLngToLayerPoint(this._aVisibleCursor.getSouthWest()),
						 this._map.latLngToLayerPoint(this._aVisibleCursor.getNorthEast()));

			var latBounds = L.rectangle(this._aVisibleCursor).getLatLngs();
			this._cursorMarker = L.cursor(latBounds[2], {color: 'red'});
			this._map._bDisableKeyboard = true;
			this._map.addLayer(this._cursorMarker);
			this._cursorMarker.setSize(pixBounds.getSize());
		}
		else {
			if (this._cursorMarker) {
				this._map._bDisableKeyboard = false;
				this._map.removeLayer(this._cursorMarker);
				this._bCursorOverlayVisible = false;
			}
		}
	},

	_onUpdateGraphicSelection: function () {
		if (!this._isEmptyRectangle(this._aGraphicSelection)) {
			this._graphicMarker = L.rectangle(this._aGraphicSelection, {color: 'red', fill: false});
			this._map.addLayer(this._graphicMarker);
		}
		else {
			if (this._graphicMarker)
				this._map.removeLayer(this._graphicMarker);
		}
	}
});

L.tileLayer = function (url, options) {
	return new L.TileLayer(url, options);
};
