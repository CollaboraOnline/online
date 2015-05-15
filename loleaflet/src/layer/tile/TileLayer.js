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
		this._map.on('mousedown mouseup mouseover mouseout mousemove',
				this._onMouseEvent, this);
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

		tile.src = '';

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

		if (textMsg.startsWith('status')) {
			var command = this._parseServerCmd(textMsg);
			if (command.width && command.height && this._documentInfo !== textMsg) {
				this._docWidthTwips = command.width;
				this._docHeightTwips = command.height;
				this._updateMaxBounds();
				this._documentInfo = textMsg;
				if (this._parts === undefined && command.parts > 1) {
					this._map.addControl(L.control.parts({'parts':command.parts}));
				}
				this._parts = command.parts;
				this._currentPart = 0;
				this._update();
			}
		}
		else if (textMsg.startsWith('tile')) {
			var command = this._parseServerCmd(textMsg);
			var coords = this._twipsToCoords(new L.Point(command.x, command.y));
			coords.z = command.zoom;
			var data = bytes.subarray(index + 1);

			var key = this._tileCoordsToKey(coords);
			var tile = this._tiles[key];
			if (tile) {
				tile.el.src = 'data:image/png;base64,' + window.btoa(String.fromCharCode.apply(null, data));
			}
		}
		else if (textMsg.startsWith('textselection:')) {
			strTwips = textMsg.match(/\d+/g);
			this._clearSelections();
			if (strTwips != null) {
				for (var i = 0; i < strTwips.length; i += 4) {
					var topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i+1]));
					var offset = new L.Point(parseInt(strTwips[i+2]), parseInt(strTwips[i+3]));
					var bottomRightTwips = topLeftTwips.add(offset);
					var bounds = new L.LatLngBounds(
							this._twipsToLatLng(topLeftTwips),
							this._twipsToLatLng(bottomRightTwips));
					if (!this._map.getBounds().contains(bounds.getCenter())) {
						var center = this._map.project(bounds.getCenter());
						center = center.subtract(this._map.getSize().divideBy(2));
						center.x = center.x < 0 ? 0 : center.x;
						center.y = center.y < 0 ? 0 : center.y;
						$('#scroll-container').mCustomScrollbar('scrollTo', [center.y, center.x]);
					}
					var selection = new L.Rectangle(bounds, {stroke:false});
					this._selections.addLayer(selection);
				}
			}
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
			if (tokens[i].substring(0, 9) === 'tileposy=') {
				command.y = parseInt(tokens[i].substring(9));
			}
			if (tokens[i].substring(0, 10) === 'tilewidth=') {
				command.tileWidth = parseInt(tokens[i].substring(10));
			}
			if (tokens[i].substring(0, 11) === 'tileheight=') {
				command.tileHeight = parseInt(tokens[i].substring(11));
			}
			if (tokens[i].substring(0, 6) === 'width=') {
				command.width = parseInt(tokens[i].substring(6));
			}
			if (tokens[i].substring(0, 7) === 'height=') {
				command.height = parseInt(tokens[i].substring(7));
			}
			if (tokens[i].substring(0, 6) === 'parts=') {
				command.parts = parseInt(tokens[i].substring(7));
			}
			if (tokens[i].substring(0, 8) === 'current=') {
				command.part = parseInt(tokens[i].substring(7));
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

	// stops loading all tiles in the background layer
	_abortLoading: function () {
		var i, tile;
		for (i in this._tiles) {
			tile = this._tiles[i].el;

			tile.onload = L.Util.falseFn;
			tile.onerror = L.Util.falseFn;

			if (!tile.complete) {
				tile.src = L.Util.emptyImageUrl;
				L.DomUtil.remove(tile);
			}
		}
	},

	_clearSelections: function () {
		this._selections.clearLayers();
	},

	_onMouseEvent: function (e) {
		if (e.type === 'mousedown') {
			this._selecting = true;
			this._clearSelections();
			//this._map.socket.send('selecttext type=reset x=0 y=0');
			var selectionStart = this._latLngToTwips(e.latlng);
			this._map.socket.send('selecttext type=reset ' +
					'x=' + selectionStart.x + ' ' +
					'y=' + selectionStart.y);

			this._map.socket.send('selecttext type=start ' +
					'x=' + selectionStart.x + ' ' +
					'y=' + selectionStart.y);
		}
		else if (e.type === 'mouseup') {
			this._selecting = false;
		}
		else if (e.type === 'mousemove' && this._selecting) {
			var selectionEnd = this._latLngToTwips(e.latlng);
			this._map.socket.send('selecttext type=end ' +
					'x=' + selectionEnd.x + ' ' +
					'y=' + selectionEnd.y);
		}
	}
});

L.tileLayer = function (url, options) {
	return new L.TileLayer(url, options);
};
