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
		crossOrigin: false
	},

	keymap: {
		8   : 1283, // backspace	: BACKSPACE
		9   : 1282, // tab 		: TAB
		13  : 1280, // enter 		: RETURN
		16  : null, // shift		: UNKOWN
		17  : null, // ctrl		: UNKOWN
		18  : null, // alt		: UNKOWN
		19  : null, // pause/break	: UNKOWN
		20  : null, // caps lock	: UNKOWN
		27  : 1281, // escape		: ESCAPE
		32  : 1284, // space		: SPACE
		33  : 1030, // page up		: PAGEUP
		34  : 1031, // page down	: PAGEDOWN
		35  : 1029, // end		: END
		36  : 1028, // home		: HOME
		37  : 1026, // left arrow	: LEFT
		38  : 1025, // up arrow		: UP
		39  : 1027, // right arrow	: RIGHT
		40  : 1024, // down arrow	: DOWN
		45  : 1285, // insert		: INSERT
		46  : 1286, // delete		: DELETE
		91  : null, // left window key	: UNKOWN
		92  : null, // right window key	: UNKOWN
		93  : null, // select key	: UNKOWN
		96  : 256,  // numpad 0		: NUM0
		97  : 257,  // numpad 1		: NUM1
		98  : 258,  // numpad 2		: NUM2
		99  : 259,  // numpad 3		: NUM3
		100 : 260,  // numpad 4		: NUM4
		101 : 261,  // numpad 5		: NUM5
		102 : 262,  // numpad 6		: NUM6
		103 : 263,  // numpad 7		: NUM7
		104 : 264,  // numpad 8		: NUM8
		105 : 265,  // numpad 9		: NUM9
		106 : 1289, // multiply		: MULTIPLY
		107 : 1287, // add		: ADD
		109 : 1288, // subtract		: SUBTRACT
		110 : 1309, // decimal point	: DECIMAL
		111 : 1290, // divide		: DIVIDE
		112 : 768,  // f1		: F1
		113 : 769,  // f2		: F2
		114 : 770,  // f3		: F3
		115 : 771,  // f4		: F4
		116 : 772,  // f5		: F5
		117 : 773,  // f6		: F6
		118 : 774,  // f7		: F7
		119 : 775,  // f8		: F8
		120 : 776,  // f9		: F9
		121 : 777,  // f10		: F10
		122 : 778,  // f11		: F11
		144 : 1313, // num lock		: NUMLOCK
		145 : 1314, // scroll lock	: SCROLLLOCK
		186 : 1317, // semi-colon	: SEMICOLON
		187 : 1295, // equal sign	: EQUAL
		188 : 1292, // comma		: COMMA
		189 : 5,    // dash		: DASH
		190 : null, // period		: UNKOWN
		191 : null, // forward slash	: UNKOWN
		192 : null, // grave accent	: UNKOWN
		219 : null, // open bracket	: UNKOWN
		220 : null, // back slash	: UNKOWN
		221 : null, // close bracket	: UNKOWN
		222 : null  // single quote	: UNKOWN
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
		this._editMode = false;
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
		this._mouseEventsQueue = [];
		this._textArea = L.DomUtil.get('clipboard');
		this._textArea.focus();
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
		this._map._scrollContainer.onscroll = L.bind(this._onScroll, this);
		this._map.on('zoomend resize', this._updateScrollOffset, this);
		this._map.on('clearselection', this._clearSelections, this);
		this._map.on('prevpart nextpart', this._onSwitchPart, this);
		this._map.on('viewmode editmode', this._updateEditViewMode, this);
		this._map.on('drag', this._updateScrollOffset, this);
		this._map.on('copy', this._onCopy, this);
		this._startMarker.on('drag dragend', this._onSelectionHandleDrag, this);
		this._endMarker.on('drag dragend', this._onSelectionHandleDrag, this);
		if (this.options.editMode) {
			this._map.fire('updatemode:edit');
		}
	},

	getEvents: function () {
		var events = {
			viewreset: this._viewReset,
			moveend: this._move,
			keydown: this._signalKey,
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
			strTwips = textMsg.match(/\d+/g);
			topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			bottomRightTwips = topLeftTwips.add(offset);
			var invalidBounds = new L.Bounds(topLeftTwips, bottomRightTwips);

			this._map._fadeAnimated = false;

			for (var key in this._tiles) {
				var coords = this._tiles[key].coords;
				var point1 = this._coordsToTwips(coords);
				var point2 = new L.Point(point1.x + this._tileWidthTwips, point1.y + this._tileHeightTwips);
				var bounds = new L.Bounds(point1, point2);
				if (invalidBounds.intersects(bounds)) {
					this._map.socket.send('tile ' +
									'part=' + coords.part + ' ' +
									'width=' + this._tileSize + ' ' +
									'height=' + this._tileSize + ' ' +
									'tileposx=' + point1.x + ' '    +
									'tileposy=' + point1.y + ' ' +
									'tilewidth=' + this._tileWidthTwips + ' ' +
									'tileheight=' + this._tileHeightTwips);
				}
			}
			for (var key in this._tileCache) {
				// compute the rectangle that each tile covers in the document based
				// on the zoom level
				coords = this._keyToTileCoords(key);
				var scale = this._map.getZoomScale(coords.z);
				topLeftTwips = new L.Point(
						this.options.tileWidthTwips * scale * coords.x,
						this.options.tileHeightTwips * scale * coords.y);
				bottomRightTwips = topLeftTwips.add(new L.Point(
						this.options.tileWidthTwips * scale,
						this.options.tileHeightTwips * scale));
				bounds = new L.Bounds(topLeftTwips, bottomRightTwips);
				if (invalidBounds.intersects(bounds)) {
					delete this._tileCache[key];
				}
			}
		}
		else if (textMsg.startsWith('status:')) {
			command = this._parseServerCmd(textMsg);
			if (command.width && command.height && this._documentInfo !== textMsg) {
				this._docWidthTwips = command.width;
				this._docHeightTwips = command.height;
				this._updateMaxBounds(true);
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
			command = this._parseServerCmd(textMsg);
			coords = this._twipsToCoords(new L.Point(command.x, command.y));
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
			if (tile) {
				if (tile.el.src) {
					this._tiles[key]._skipPrune = true;
				}
				tile.el.src = 'data:image/png;base64,' + window.btoa(strBytes);
			}
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
					$('#scroll-container').mCustomScrollbar('scrollTo', [center.y, center.x]);
				}

				var polygons = this._rectanglesToPolygons(rectangles);
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
					this._map.socket.send('gettextselection mimetype=text/plain;charset=utf-8');}, this), 100);
			}
			this._onUpdateTextSelection();
		}
		else if (textMsg.startsWith('textselectioncontent:')) {
			this._selectionTextContent = textMsg.substr(22);
		}
		else if (textMsg.startsWith('setpart:')) {
			var part = parseInt(textMsg.match(/\d+/g)[0]);
			if (part !== this._currentPart) {
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

		var points = {};
		for (i = 0; i < rectangles.length; i++) {
			for (j = 0; j < rectangles[i].length; j++) {
				if (points[rectangles[i][j]]) {
					delete points[rectangles[i][j]];
				}
				else {
					points[rectangles[i][j]] = rectangles[i][j];
				}
			}
		}

		function getKeys(points) {
			var keys = [];
			for (var key in points) {
				if (points.hasOwnProperty(key)) {
					keys.push(key);
				}
			}
			return keys;
		}

		function xThenY(aStr, bStr) {
			var a = aStr.match(/\d+/g);
			a[0] = parseInt(a[0]);
			a[1] = parseInt(a[1]);
			var b = bStr.match(/\d+/g);
			b[0] = parseInt(b[0]);
			b[1] = parseInt(b[1]);

			if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) {
				return -1;
			}
			else if (a[0] === b[0] && a[1] === b[1]) {
				return 0;
			}
			else {
				return 1;
			}
		}

		function yThenX(aStr, bStr) {
			var a = aStr.match(/\d+/g);
			a[0] = parseInt(a[0]);
			a[1] = parseInt(a[1]);
			var b = bStr.match(/\d+/g);
			b[0] = parseInt(b[0]);
			b[1] = parseInt(b[1]);

			if (a[1] < b[1] || (a[1] === b[1] && a[0] < b[0])) {
				return -1;
			}
			else if (a[0] === b[0] && a[1] === b[1]) {
				return 0;
			}
			else {
				return 1;
			}
		}

		var sortX = getKeys(points).sort(xThenY);
		var sortY = getKeys(points).sort(yThenX);

		var edgesH = {};
		var edgesV = {};

		var len = getKeys(points).length;
		i = 0;
		while (i < len) {
			var currY = points[sortY[i]].y;
			while (i < len && points[sortY[i]].y === currY) {
				edgesH[sortY[i]] = sortY[i + 1];
				edgesH[sortY[i + 1]] = sortY[i];
				i += 2;
			}
		}

		i = 0;
		while (i < len) {
			var currX = points[sortX[i]].x;
			while (i < len && points[sortX[i]].x === currX) {
				edgesV[sortX[i]] = sortX[i + 1];
				edgesV[sortX[i + 1]] = sortX[i];
				i += 2;
			}
		}

		var polygons = [];
		var edgesHKeys = getKeys(edgesH);
		while (edgesHKeys.length > 0) {
			var p = [[edgesHKeys[0], 0]];
			while (true) {
				var curr = p[p.length - 1][0];
				var e = p[p.length - 1][1];
				if (e === 0) {
					var nextVertex = edgesV[curr];
					delete edgesV[curr];
					p.push([nextVertex, 1]);
				}
				else {
					nextVertex = edgesH[curr];
					delete edgesH[curr];
					p.push([nextVertex, 0]);
				}
				if (p[p.length - 1][0] === p[0][0] && p[p.length - 1][1] === p[0][1]) {
					p.pop();
					break;
				}
			}
			var polygon = [];
			for (i = 0; i < p.length; i++) {
				polygon.push(this._twipsToLatLng(points[p[i][0]]));
				delete edgesH[p[i][0]];
				delete edgesV[p[i][0]];
			}
			polygon.push(this._twipsToLatLng(points[p[0][0]]));
			edgesHKeys = getKeys(edgesH);
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

	_postSelectGraphicEvent: function(type, x, y) {
		this._map.socket.send('selectgraphic type=' + type +
				' x=' + x + ' y=' + y);
	},

	_postSelectTextEvent: function(type, x, y) {
		this._map.socket.send('selecttext type=' + type +
				' x=' + x + ' y=' + y);
	},

	_onMouseEvent: function (e) {
		if (this._graphicMarker && this._graphicMarker.isDragged) {
			return;
		}

		if (this._startMarker.isDragged === true || this._endMarker.isDragged === true) {
			return;
		}

		if (e.type === 'mousedown') {
			this._selecting = true;
			if (this._holdMouseEvent) {
				clearTimeout(this._holdMouseEvent);
			}
			var mousePos = this._latLngToTwips(e.latlng);
			this._mouseEventsQueue.push(L.bind(function() {
				this._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1);}, this));
			this._holdMouseEvent = setTimeout(L.bind(this._executeMouseEvents, this), 500);
		}
		else if (e.type === 'mouseup') {
			this._selecting = false;
			if (this._holdMouseEvent) {
				clearTimeout(this._holdMouseEvent);
				this._holdMouseEvent = null;
			}
			if (this._mouseEventsQueue.length === 3) {
				// i.e. we have mousedown, mouseup, mousedown and here comes another
				// mouseup. Those are 2 consecutive clicks == doubleclick, we cancel
				// everything and wait for the dblclick event to arrive where it's handled
				this._mouseEventsQueue = [];
				return;
			}
			mousePos = this._latLngToTwips(e.latlng);
			this._mouseEventsQueue.push(L.bind(function() {
				this._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1);
				this._textArea.focus();
			}, this));
			this._holdMouseEvent = setTimeout(L.bind(this._executeMouseEvents, this), 250);

			if (this._startMarker._icon) {
				L.DomUtil.removeClass(this._startMarker._icon, 'leaflet-not-clickable');
			}
			if (this._endMarker._icon) {
				L.DomUtil.removeClass(this._endMarker._icon, 'leaflet-not-clickable');
			}
		}
		else if (e.type === 'mousemove' && this._selecting) {
			if (this._holdMouseEvent) {
				clearTimeout(this._holdMouseEvent);
				this._holdMouseEvent = null;
				for (var i = 0; i < this._mouseEventsQueue.length; i++) {
					// synchronously execute old mouse events so we know that
					// they arrive to the server before the move command
					this._mouseEventsQueue[i]();
				}
				this._mouseEventsQueue = [];
			}
			mousePos = this._latLngToTwips(e.latlng);
			this._postMouseEvent('move', mousePos.x, mousePos.y, 1);
			if (this._startMarker._icon) {
				L.DomUtil.addClass(this._startMarker._icon, 'leaflet-not-clickable');
			}
			if (this._endMarker._icon) {
				L.DomUtil.addClass(this._endMarker._icon, 'leaflet-not-clickable');
			}
		}
		else if (e.type === 'dblclick') {
			mousePos = this._latLngToTwips(e.latlng);
			this._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1);
			this._postMouseEvent('buttondown', mousePos.x, mousePos.y, 2);
			this._postMouseEvent('buttonup', mousePos.x, mousePos.y, 2);
			this._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1);
		}
	},

	_executeMouseEvents: function () {
		this._holdMouseEvent = null;
		for (var i = 0; i < this._mouseEventsQueue.length; i++) {
			this._mouseEventsQueue[i]();
		}
		this._mouseEventsQueue = [];
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
			this._editMode = false;
			this._onUpdateCursor();
			this._clearSelections();
			this._onUpdateTextSelection();
		}
		else if (e.type === 'editmode') {
			this._editMode = true;
			this._map.dragging.disable();
			this._map.on('mousedown mouseup mouseover mouseout mousemove dblclick',
					this._onMouseEvent, this);
			this._map._container.focus();
		}
	},

	// Convert javascript key codes to UNO key codes.
	_toUNOKeyCode: function (keyCode) {
		return this.keymap[keyCode] || keyCode;
	},

	// Receives a key press or release event.
	_signalKey: function (e) {
		if (!this._editMode) {
			return;
		}

		if (e.originalEvent.ctrlKey) {
			// we prepare for a copy event
			this._textArea.value = 'dummy text';
			this._textArea.focus();
			this._textArea.select();
			return;
		}

		var charCode = e.originalEvent.charCode;
		var keyCode = e.originalEvent.keyCode;
		// TODO handle browser differences
		if (e.type === 'keydown' && keyCode === 8) {
			// chrome backspace
			this._postKeyboardEvent('input', charCode, this._toUNOKeyCode(keyCode));
		}
		else if (e.type === 'keypress') {
			if (keyCode === 8) {
				// backspace has already been handled
				return;
			}
			if (charCode === keyCode && charCode !== 13) {
				// Chrome sets keyCode = charCode for printable keys
				// while LO requires it to be 0
				keyCode = 0;
			}
			this._postKeyboardEvent('input', charCode, this._toUNOKeyCode(keyCode));
		}
		else if (e.type === 'keyup') {
			this._postKeyboardEvent('up', charCode, this._toUNOKeyCode(keyCode));
		}
	},

	// Is rRectangle empty?
	_isEmptyRectangle: function (aBounds) {
		return aBounds.getSouthWest().equals(new L.LatLng(0, 0)) && aBounds.getNorthEast().equals(new L.LatLng(0, 0));
	},

	// Update cursor layer (blinking cursor).
	_onUpdateCursor: function () {
		if (this._editMode && this._isCursorVisible && this._isCursorOverlayVisible && !this._isEmptyRectangle(this._visibleCursor)) {
			if (this._cursorMarker) {
				this._map.removeLayer(this._cursorMarker);
			}

			var pixBounds = L.bounds(this._map.latLngToLayerPoint(this._visibleCursor.getSouthWest()),
						 this._map.latLngToLayerPoint(this._visibleCursor.getNorthEast()));

			var cursorPos = this._visibleCursor.getNorthWest();
			this._cursorMarker = L.cursor(cursorPos);
			this._map.addLayer(this._cursorMarker);
			this._cursorMarker.setSize(pixBounds.getSize());

			var cursor = this._map.latLngToLayerPoint(this._cursorMarker.getLatLng());
			var start = this._map.latLngToLayerPoint(this._startMarker.getLatLng());
			var end = this._map.latLngToLayerPoint(this._endMarker.getLatLng());

			if (Math.abs(start.distanceTo(cursor)) < Math.abs(end.distanceTo(cursor))) {
				var swap = this._endMarker.getLatLng();
				this._endMarker.setLatLng(this._startMarker.getLatLng());
				this._startMarker.setLatLng(swap);
			}
			if (!this._map.getBounds().contains(cursorPos)) {
				var center = this._map.project(cursorPos);
				center = center.subtract(this._map.getSize().divideBy(2));
				center.x = center.x < 0 ? 0 : center.x;
				center.y = center.y < 0 ? 0 : center.y;
				$('#scroll-container').mCustomScrollbar('scrollTo', [center.y, center.x]);
			}
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
		if (this._startMarker.isDragged === true || this._endMarker.isDragged === true)
			return;

		if (this._selections.getLayers().length !== 0) {
			if (!this._isEmptyRectangle(this._textSelectionStart)) {
				this._startMarker.setLatLng(this._textSelectionStart.getSouthWest());
				this._map.addLayer(this._startMarker);
			}

			if (!this._isEmptyRectangle(this._textSelectionEnd)) {
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
			alert('Oops, no content available yet');
		}
		else {
			e.clipboardData.setData('text/plain', this._selectionTextContent);
		}
	}
});

L.tileLayer = function (url, options) {
	return new L.TileLayer(url, options);
};
