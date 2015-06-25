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
		this._bEdit = false;
		// Position and size of the visible cursor.
		this._aVisibleCursor = new L.LatLngBounds( new L.LatLng(0, 0), new L.LatLng(0, 0) );
		// Cursor overlay is visible or hidden (for blinking).
		this._bCursorOverlayVisible = false;
		// Cursor is visible or hidden (e.g. for graphic selection).
		this._bCursorVisible = true;
		// Rectangle graphic selection
		this._aGraphicSelection = new L.LatLngBounds( new L.LatLng(0, 0), new L.LatLng(0, 0) );
		// Position and size of the selection start (as if there would be a cursor caret there).
		this._aTextSelectionStart = new L.LatLngBounds( new L.LatLng(0, 0), new L.LatLng(0, 0) );
		// Position and size of the selection end.
		this._aTextSelectionEnd = new L.LatLngBounds( new L.LatLng(0, 0), new L.LatLng(0, 0) );

		// Cursor marker
		this._cursorMarker = null;
		// Graphic marker
		this._graphicMarker = null;
		// Handle start marker
		this._startMarker = L.marker( new L.LatLng(0,0), {
			icon: L.icon({
				iconUrl: L.Icon.Default.imagePath + '/handle_start.png',
				iconSize: [30, 44],
				iconAnchor: [28, 2]
			}),
			draggable: true
		});
		// Handle end marker
		this._endMarker = L.marker( new L.LatLng(0,0), {
			icon: L.icon({
				iconUrl: L.Icon.Default.imagePath + '/handle_end.png',
				iconSize: [30, 44],
				iconAnchor: [2, 2]
			}),
			draggable: true
		});
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
		this._map.on('copy', this._onCopy, this);
		this._startMarker.on('drag dragend', this._onSelectionHandleDrag, this);
		this._endMarker.on('drag dragend', this._onSelectionHandleDrag, this);
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
		else if (textMsg.startsWith('textselectionstart:')) {
			strTwips = textMsg.match(/\d+/g);
			if (strTwips != null) {
				var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
				var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
				var bottomRightTwips = topLeftTwips.add(offset);
				this._aTextSelectionStart = new L.LatLngBounds(
							this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
							this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
			}
			else
				this._aTextSelectionStart = new L.LatLngBounds( new L.LatLng(0, 0), new L.LatLng(0, 0) );
		}
		else if (textMsg.startsWith('textselectionend:')) {
			strTwips = textMsg.match(/\d+/g);
			if (strTwips != null) {
				var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
				var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
				var bottomRightTwips = topLeftTwips.add(offset);
				this._aTextSelectionEnd = new L.LatLngBounds(
							this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
							this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
			}
			else
				this._aTextSelectionEnd = new L.LatLngBounds( new L.LatLng(0, 0), new L.LatLng(0, 0) );
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
		else if (textMsg.startsWith('invalidatetiles:') && !textMsg.match('EMPTY')) {
			strTwips = textMsg.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			var invalidBounds = new L.Bounds(topLeftTwips, bottomRightTwips);

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

			var key = this._tileCoordsToKey(coords);
			var tile = this._tiles[key];
			if (tile) {
				if (tile.el.src) {
					this._tiles[key]._skipAnim = true;
				}
				tile.el.src = 'data:image/png;base64,' + window.btoa(strBytes);
			}
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
						pointerEvents: 'none',
						fillColor: '#43ACE8',
						fillOpacity: 0.25,
						weight: 2,
						opacity: 0.25});
					this._selections.addLayer(selection);
				}
			}
			this._onUpdateTextSelection();
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

	_postSelectGraphicEvent: function(type, x, y) {
		this._map.socket.send('selectgraphic type=' + type +
				' x=' + x + ' y=' + y);
	},

	_postSelectTextEvent: function(type, x, y) {
		this._map.socket.send('selecttext type=' + type +
				' x=' + x + ' y=' + y);
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

	// Convert javascript key codes to UNO key codes.
	_toUNOKeyCode: function ( keyCode ) {
		return this.keymap[keyCode] || keyCode;
	},

	// Receives a key press or release event.
	_signalKey: function (e) {
		if ( !this._bEdit )
			return;

		if ( e.type == 'keydown' ) {
			this._keyEvent = null;
		}
		else if ( e.type === 'keypress' ) {
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

	// Update dragged graphics selection resize.
	_onGraphicEdit: function (e) {
		if ( !e.handle ) return;

		var aPos = this._latLngToTwips(e.handle.getLatLng());
		if ( e.type === 'editstart' ) {
			this._postSelectGraphicEvent('start', aPos.x, aPos.y);
		}
		else if ( e.type === 'editend' ) {
			this._postSelectGraphicEvent('end', aPos.x, aPos.y);
		}
	},

	// Update dragged text selection.
	_onSelectionHandleDrag: function (e) {
		var aPos = this._latLngToTwips(e.target.getLatLng());

		if (e.type === 'drag')
			e.target.isDragged = true;

		if (e.type === 'dragend')
			e.target.isDragged = false;

		if ( this._startMarker == e.target )
			this._postSelectTextEvent('start', aPos.x, aPos.y);

		if ( this._endMarker == e.target )
			this._postSelectTextEvent('end', aPos.x, aPos.y);
	},

	// Update group layer selection handler.
	_onUpdateGraphicSelection: function () {
		if (!this._isEmptyRectangle(this._aGraphicSelection)) {
			if (this._graphicMarker) {
				this._graphicMarker.off('editstart editend', this._onGraphicEdit, this);
				this._map.removeLayer(this._graphicMarker);
			}
			this._graphicMarker = L.rectangle(this._aGraphicSelection, {fill: false});
			this._graphicMarker.editing.enable();
			this._graphicMarker.on('editstart editend', this._onGraphicEdit, this);
			this._map.addLayer(this._graphicMarker);
		}
		else {
			if (this._graphicMarker) {
				this._graphicMarker.off('editstart editend', this._onGraphicEdit, this);
				this._map.removeLayer(this._graphicMarker);
			}
		}
	},

	// Update text selection handlers.
	_onUpdateTextSelection: function () {
		if (this._selections.getLayers().length !== 0) {
			if (!this._isEmptyRectangle(this._aTextSelectionStart) &&
					this._startMarker.isDragged !== true) {
				this._startMarker.setLatLng(this._aTextSelectionStart.getSouthWest());
				this._map.addLayer(this._startMarker);
			}

			if (!this._isEmptyRectangle(this._aTextSelectionEnd) &&
					this._endMarker.isDragged !== true) {
				this._endMarker.setLatLng(this._aTextSelectionEnd.getSouthEast());
				this._map.addLayer(this._endMarker);
			}
		}
		else {
			this._aTextSelectionStart = new L.LatLngBounds( new L.LatLng(0, 0), new L.LatLng(0, 0) );
			this._aTextSelectionEnd = new L.LatLngBounds( new L.LatLng(0, 0), new L.LatLng(0, 0) );
			this._map.removeLayer(this._startMarker);
			this._map.removeLayer(this._endMarker);
		}
	},

	_onCopy: function (e) {
		console.log(e);
		e = e.originalEvent;
		e.preventDefault();
		e.clipboardData.setData('text', 'test copy');
		var clipboardContainer = L.DomUtil.get('clipboard-container');
		L.DomUtil.setStyle(clipboardContainer, 'display', 'none');
		this._map._container.focus();
	}
});

L.tileLayer = function (url, options) {
	return new L.TileLayer(url, options);
};
